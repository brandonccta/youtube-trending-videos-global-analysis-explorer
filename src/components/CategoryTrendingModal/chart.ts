import * as d3 from 'd3';
import { formatViews } from '../../utils/formatNumber';
import type { CategoryTrendRow, VideoTrendRow } from '../../services/countries';
import { parseTags, normalizeDate, formatVideoDuration } from './model';
import { categoryLineColor } from '../../utils/categoryColors';

// re-export so callers don't need to import from two places
export { categoryLineColor as colorForCategory };

function escapeHtml(val: unknown): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// module-level date parser — avoids duplication across both chart functions
function parseDate(dateStr: unknown): Date | null {
  if (!dateStr) return null;
  return d3.timeParse('%Y-%m-%d')(String(dateStr).split('T')[0]) ?? null;
}

function addChartTitle(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  title: string,
  width: number,
  isNarrow: boolean
) {
  const titleText = g
    .append('text')
    .attr('x', width / 2)
    .attr('y', isNarrow ? -18 : -10)
    .attr('text-anchor', 'middle')
    .style('fill', 'var(--color-ge-text)')
    .style('font-size', isNarrow ? '15px' : '16px')
    .style('font-family', 'var(--font-display)')
    .style('font-weight', '900');

  // wrap long titles on narrow screens
  if (isNarrow && title.length > 36) {
    const words = title.split(' ');
    let line = '';
    let lineNumber = 0;
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      if (testLine.length > 36 && line) {
        titleText
          .append('tspan')
          .attr('x', width / 2)
          .attr('dy', lineNumber === 0 ? 0 : 18)
          .text(line);
        line = word;
        lineNumber++;
      } else {
        line = testLine;
      }
    }
    if (line) {
      titleText
        .append('tspan')
        .attr('x', width / 2)
        .attr('dy', lineNumber === 0 ? 0 : 18)
        .text(line);
    }
  } else {
    titleText.text(title);
  }
}

type LinePoint = { date: Date; value: number; raw?: unknown; category?: string };

type ChartBase = {
  g: d3.Selection<SVGGElement, unknown, null, undefined>;
  xScale: d3.ScaleTime<number, number>;
  yScale: d3.ScaleLinear<number, number>;
  tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>;
  moveTip: (event: PointerEvent) => void;
  hideTip: () => void;
  fmtMonth: (date: Date) => string;
  width: number;
  height: number;
};

function buildChartBase({
  svgEl,
  wrapEl,
  containerW,
  isNarrow,
  dates,
  maxValue,
}: {
  svgEl: SVGSVGElement;
  wrapEl: HTMLDivElement;
  containerW: number;
  isNarrow: boolean;
  dates: Date[];
  maxValue: number;
}): ChartBase {
  const margin = isNarrow
    ? { top: 52, right: 24, bottom: 72, left: 80 }
    : { top: 40, right: 24, bottom: 60, left: 80 };
  const width = Math.max(320, containerW) - margin.left - margin.right;
  const height = 500 - margin.top - margin.bottom;

  d3.select(svgEl).selectAll('*').remove();

  const svg = d3
    .select(svgEl)
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom);

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3.scaleTime().domain(d3.extent(dates) as [Date, Date]).range([0, width]);
  const yScale = d3
    .scaleLinear()
    .domain([0, Math.max(maxValue * 1.1, 1)])
    .range([height, 0]);

  const xAxis = d3
    .axisBottom(xScale)
    .ticks(isNarrow ? Math.min(8, Math.max(5, Math.floor(width / 80))) : d3.timeMonth.every(2))
    .tickFormat(
      d3.timeFormat('%Y-%m') as (value: Date | d3.NumberValue, i: number) => string
    );

  const xAxisG = g.append('g').attr('transform', `translate(0,${height})`).call(xAxis);

  xAxisG
    .selectAll('text')
    .style('fill', 'var(--color-ge-text)')
    .style('font-size', '11px')
    .each(function (this: d3.BaseType) {
      if (isNarrow) {
        d3.select(this as SVGTextElement)
          .attr('transform', 'rotate(-25)')
          .attr('text-anchor', 'end')
          .attr('dx', '-0.4em')
          .attr('dy', '0.35em');
      }
    });

  const yAxis = d3
    .axisLeft(yScale)
    .ticks(8)
    .tickFormat((d: d3.NumberValue) => {
      const n = d.valueOf();
      return n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n);
    });

  g.append('g')
    .call(yAxis)
    .selectAll('text')
    .style('fill', 'var(--color-ge-text)')
    .style('font-size', '11px');

  // axis labels
  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('y', -50)
    .attr('x', -height / 2)
    .attr('text-anchor', 'middle')
    .style('fill', 'var(--color-ge-text)')
    .style('font-size', '12px')
    .style('font-family', 'var(--font-display)')
    .text('Trending Appearances');

  g.append('text')
    .attr('x', width / 2)
    .attr('y', height + 45)
    .attr('text-anchor', 'middle')
    .style('fill', 'var(--color-ge-text)')
    .style('font-size', '12px')
    .style('font-family', 'var(--font-display)')
    .text('Date');

  // tooltip overlay
  const tooltip = d3
    .select(wrapEl)
    .append('div')
    .attr('class', 'ge-chart-tip')
    .style('position', 'absolute')
    .style('pointer-events', 'none')
    .style('opacity', 0)
    .style('background', 'var(--color-ge-surface)')
    .style('border', '1px solid var(--color-ge-border)')
    .style('border-radius', '10px')
    .style('padding', '12px')
    .style('box-shadow', '0 10px 30px rgba(0,0,0,0.35)')
    .style('max-width', '360px')
    .style('z-index', 60);

  const fmtMonth = d3.timeFormat('%Y-%m');
  const moveTip = (event: PointerEvent) => {
    const rect = wrapEl.getBoundingClientRect();
    tooltip
      .style('left', `${event.clientX - rect.left + 14}px`)
      .style('top', `${event.clientY - rect.top + 14}px`);
  };
  const hideTip = () => tooltip.style('opacity', 0);

  return { g, xScale, yScale, tooltip, moveTip, hideTip, fmtMonth, width, height };
}

export function renderCategoryTrendingChart({
  svgEl,
  wrapEl,
  containerW,
  isNarrow,
  countryName,
  filteredData,
  selectedKeySet,
  parsedTags,
  onToggleKey,
}: {
  svgEl: SVGSVGElement;
  wrapEl: HTMLDivElement;
  containerW: number;
  isNarrow: boolean;
  countryName: string | null;
  filteredData: CategoryTrendRow[];
  selectedKeySet: Set<string>;
  maxSelected: number;
  parsedTags: Map<string, string[]>;
  onToggleKey: (key: string) => void;
}) {
  const allDates = filteredData.map((d) => parseDate(d.date)).filter(Boolean) as Date[];
  const maxValue =
    (d3.max(filteredData, (d) => Number(d.trending_appearances) || 0) as number) || 1;

  const { g, xScale, yScale, tooltip, moveTip, hideTip, fmtMonth, width } = buildChartBase({
    svgEl,
    wrapEl,
    containerW,
    isNarrow,
    dates: allDates,
    maxValue,
  });

  const line = d3
    .line<LinePoint>()
    .x((d) => xScale(d.date))
    .y((d) => yScale(d.value))
    .curve(d3.curveMonotoneX);

  const showCategoryTip = (event: PointerEvent, d: LinePoint, category: string, color: string) => {
    const raw = d.raw as CategoryTrendRow | undefined;
    const rawDateStr = raw?.date;
    const dateKey = normalizeDate(rawDateStr);
    const key = `${category}|${dateKey}`;

    let tags = parsedTags.get(key) || [];
    if (tags.length === 0) {
      tags = parsedTags.get(`${category}|${rawDateStr}`) || [];
    }
    if (tags.length === 0 && raw?.top5_tags) {
      tags = parseTags(raw.top5_tags).slice(0, 5);
    }

    tooltip.style('opacity', 1).html(`
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:999px;background:${escapeHtml(color)};"></span>
          <div style="font-family:var(--font-display);font-weight:800;color:var(--color-ge-text);font-size:12px;">
            ${escapeHtml(category)}
          </div>
        </div>
        <div style="color:var(--color-ge-dim);font-size:11px;margin-bottom:8px;">
          ${fmtMonth(d.date)} · <span style="color:var(--color-ge-text);font-weight:700;">${d.value}</span> appearances
        </div>
        <div style="color:var(--color-ge-muted);font-size:10px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px;">
          Top tags
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${(tags.length ? tags.slice(0, 5) : ['—'])
            .map(
              (t) =>
                `<span style="border:1px solid var(--color-ge-border);background:var(--color-ge-surface2);color:var(--color-ge-text);border-radius:999px;padding:4px 8px;font-size:11px;">${escapeHtml(t)}</span>`
            )
            .join('')}
        </div>
      `);
    moveTip(event);
  };

  // group data points by category
  const dataByCategory: Record<string, LinePoint[]> = {};
  for (const d of filteredData) {
    const date = parseDate(d.date);
    if (!date) continue;
    const cat = d.category ?? '';
    if (!dataByCategory[cat]) dataByCategory[cat] = [];
    dataByCategory[cat].push({ date, value: Number(d.trending_appearances) || 0, raw: d });
  }

  for (const arr of Object.values(dataByCategory)) {
    arr.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  const baseRadius = 4;
  const selectedRadius = baseRadius * 2;

  Object.keys(dataByCategory).forEach((category, i) => {
    const color = categoryLineColor(category);
    const pathData = dataByCategory[category] ?? [];
    if (!pathData.length) return;

    g.append('path')
      .datum(pathData)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 2.5)
      .attr('d', line);

    g.selectAll(`.dot-${i}`)
      .data(pathData)
      .enter()
      .append('circle')
      .attr('class', `dot-${i}`)
      .attr('cx', (d) => xScale(d.date))
      .attr('cy', (d) => yScale(d.value))
      .attr('r', (d) => {
        const dateKey = normalizeDate((d.raw as CategoryTrendRow | undefined)?.date);
        const key = `${category}|${dateKey}`;
        return selectedKeySet.has(key) ? selectedRadius : baseRadius;
      })
      .attr('fill', color)
      .attr('stroke', 'var(--color-ge-bg)')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('pointerenter', (event: PointerEvent, d: LinePoint) =>
        showCategoryTip(event, d, category, color)
      )
      .on('pointermove', (event: PointerEvent) => moveTip(event))
      .on('pointerleave', hideTip)
      .on('click', (_: PointerEvent, d: LinePoint) => {
        const dateKey = normalizeDate((d.raw as CategoryTrendRow | undefined)?.date);
        const key = `${category}|${dateKey}`;
        if (!key) return;
        onToggleKey(key);
      });
  });

  addChartTitle(g, `Top Trending Categories Over Time — ${countryName}`, width, isNarrow);

  return () => {
    d3.select(wrapEl).selectAll('.ge-chart-tip').remove();
  };
}

export function renderVideoTrendingChart({
  svgEl,
  wrapEl,
  containerW,
  isNarrow,
  countryName,
  filteredData,
  selectedKeySet,
  onToggleKey,
}: {
  svgEl: SVGSVGElement;
  wrapEl: HTMLDivElement;
  containerW: number;
  isNarrow: boolean;
  countryName: string | null;
  filteredData: VideoTrendRow[];
  selectedKeySet: Set<string>;
  onToggleKey: (key: string) => void;
}) {
  const allDates = filteredData.map((d) => parseDate(d.date)).filter(Boolean) as Date[];
  const maxValue =
    (d3.max(filteredData, (d) => Number(d.trending_appearances) || 0) as number) || 1;

  const { g, xScale, yScale, tooltip, moveTip, hideTip, fmtMonth, width } = buildChartBase({
    svgEl,
    wrapEl,
    containerW,
    isNarrow,
    dates: allDates,
    maxValue,
  });

  const showVideoTip = (event: PointerEvent, d: LinePoint, color: string) => {
    const raw = d.raw as VideoTrendRow | undefined;
    tooltip.style('opacity', 1).html(`
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:999px;background:${escapeHtml(color)};"></span>
          <div style="font-family:var(--font-display);font-weight:800;color:var(--color-ge-text);font-size:12px;">
            ${escapeHtml(raw?.video_title || 'Top Video')}
          </div>
        </div>
        <div style="color:var(--color-ge-dim);font-size:11px;margin-bottom:8px;">
          ${fmtMonth(d.date)} · <span style="color:var(--color-ge-text);font-weight:700;">${d.value}</span> appearances
        </div>
        <div style="color:var(--color-ge-muted);font-size:10px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px;">
          Video Details
        </div>
        <div style="color:var(--color-ge-dim);font-size:10px;margin-bottom:4px;">
          Channel: <span style="color:var(--color-ge-text);">${escapeHtml(raw?.channel_title || '—')}</span> |
          Duration: <span style="color:var(--color-ge-text);">${escapeHtml(formatVideoDuration(raw?.video_duration) ?? '—')}</span>
        </div>
        <div style="color:var(--color-ge-dim);font-size:10px;">
          Views: <span style="color:var(--color-ge-text);font-weight:700;">${formatViews(Number(raw?.video_view_count) || 0)}</span> |
          Likes: <span style="color:var(--color-ge-text);">${formatViews(Number(raw?.video_like_count) || 0)}</span> |
          Comments: <span style="color:var(--color-ge-text);">${formatViews(Number(raw?.video_comment_count) || 0)}</span>
        </div>
      `);
    moveTip(event);
  };

  const videoPoints: LinePoint[] = filteredData
    .map((d) => {
      const date = parseDate(d.date);
      if (!date) return null;
      return { date, value: Number(d.trending_appearances) || 0, raw: d, category: d.category };
    })
    .filter(Boolean) as LinePoint[];

  const baseRadius = 4;
  const selectedRadius = baseRadius * 2;

  // use D3 data-join for consistency with category chart
  g.selectAll('.video-dot')
    .data(videoPoints)
    .enter()
    .append('circle')
    .attr('class', 'video-dot')
    .attr('cx', (d) => xScale(d.date))
    .attr('cy', (d) => yScale(d.value))
    .attr('r', (d) => {
      const raw = d.raw as VideoTrendRow | undefined;
      const key = `${raw?.video_title ?? ''}|${normalizeDate(raw?.date)}`;
      return selectedKeySet.has(key) ? selectedRadius : baseRadius;
    })
    .attr('fill', (d) => categoryLineColor(d.category))
    .attr('stroke', 'var(--color-ge-bg)')
    .attr('stroke-width', 1.5)
    .style('cursor', 'pointer')
    .on('pointerenter', (event: PointerEvent, d: LinePoint) =>
      showVideoTip(event, d, categoryLineColor(d.category))
    )
    .on('pointermove', (event: PointerEvent) => moveTip(event))
    .on('pointerleave', hideTip)
    .on('click', (_: PointerEvent, d: LinePoint) => {
      const raw = d.raw as VideoTrendRow | undefined;
      const key = `${raw?.video_title ?? ''}|${normalizeDate(raw?.date)}`;
      if (!key) return;
      onToggleKey(key);
    });

  addChartTitle(g, `Top Trending Videos Over Time — ${countryName}`, width, isNarrow);

  return () => {
    d3.select(wrapEl).selectAll('.ge-chart-tip').remove();
  };
}
