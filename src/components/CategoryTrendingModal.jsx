import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { fetchCategoryTrendingOverTime } from '../api/countries';
import { CATEGORY_COLORS, DEFAULT_CAT } from './Sidebar';

const CATEGORY_LINE_COLORS = {
  'Entertainment': '#38bdf8',      // blue
  'Gaming': '#fb923c',              // orange
  'Music': '#34d399',               // green
  'People & Blogs': '#f472b6',     // red/pink
  'Sports': '#a78bfa',              // purple
};

export default function CategoryTrendingModal({ countryName, isOpen, onClose }) {
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const chartWrapRef = useRef(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [maxSelected, setMaxSelected] = useState(3);
  // Keep order so we can evict oldest when exceeding maxSelected
  const [selectedKeys, setSelectedKeys] = useState([]); // ["<category>|<dateStr>", ...]

  const colorForCategory = (category) =>
    CATEGORY_LINE_COLORS[category] ||
    (CATEGORY_COLORS[category]?.text) ||
    DEFAULT_CAT.text;

  const topCategories = useMemo(() => {
    if (!data?.length) return [];
    const totals = new Map();
    for (const row of data) {
      const cat = row.category;
      if (!cat) continue;
      const v = Number(row.trending_appearances) || 0;
      totals.set(cat, (totals.get(cat) || 0) + v);
    }
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat]) => cat);
  }, [data]);

  const filteredData = useMemo(() => {
    if (!data?.length) return [];
    if (!topCategories.length) return [];
    const set = new Set(topCategories);
    return data.filter(d => set.has(d.category));
  }, [data, topCategories]);

  // Implicit cap: how many selectable dots exist on the chart right now
  const maxSelectableDots = useMemo(() => {
    // Each row corresponds to one dot (category + month)
    return filteredData.length;
  }, [filteredData.length]);

  const selectedKeySet = useMemo(() => new Set(selectedKeys), [selectedKeys]);

  const parsedTags = useMemo(() => {
    const map = new Map(); // key => tags[]
    for (const row of filteredData) {
      const key = `${row.category}|${row.date}`;
      const tagsRaw = row?.top5_tags;
      const tags = Array.isArray(tagsRaw)
        ? tagsRaw
        : typeof tagsRaw === 'string'
          ? tagsRaw
              .replace(/^\[|\]$/g, '') // strip [ ]
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)
          : [];
      map.set(key, tags.slice(0, 5));
    }
    return map;
  }, [filteredData]);

  const selectedCards = useMemo(() => {
    if (!selectedKeys.length) return [];
    const byKey = new Map(filteredData.map(r => [`${r.category}|${r.date}`, r]));
    return selectedKeys
      .map(key => {
        const row = byKey.get(key);
        if (!row) return null;
        return {
          key,
          category: row.category,
          date: row.date,
          trending_appearances: Number(row.trending_appearances) || 0,
          top5_tags: parsedTags.get(key) || [],
        };
      })
      .filter(Boolean);
  }, [filteredData, parsedTags, selectedKeys]);

  const legendCategories = useMemo(() => topCategories, [topCategories]);

  useEffect(() => {
    if (!isOpen || !countryName) return;
    
    setLoading(true);
    setError(null);
    fetchCategoryTrendingOverTime(countryName)
      .then(result => {
        setData(result);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [isOpen, countryName]);

  // Reset selections when country changes or modal reopens
  useEffect(() => {
    if (!isOpen) return;
    setSelectedKeys([]);
  }, [isOpen, countryName]);

  // Keep maxSelected within the implicit cap (and >= 1)
  useEffect(() => {
    const cap = Math.max(1, maxSelectableDots || 1);
    setMaxSelected((prev) => Math.max(1, Math.min(cap, Number(prev) || 1)));
  }, [maxSelectableDots]);

  // If the implicit cap shrinks, trim selected keys to fit
  useEffect(() => {
    const cap = Math.max(1, maxSelectableDots || 1);
    setSelectedKeys((prev) => (prev.length <= cap ? prev : prev.slice(prev.length - cap)));
  }, [maxSelectableDots]);

  useEffect(() => {
    if (!isOpen || !filteredData.length || !svgRef.current) return;

    const margin = { top: 40, right: 24, bottom: 60, left: 80 };
    const containerW =
      chartWrapRef.current?.clientWidth ||
      svgRef.current?.parentElement?.clientWidth ||
      900;
    const width = Math.max(320, containerW) - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Parse dates and group by category
    const parseDate = d3.timeParse('%Y-%m-%d');
    const dataByCategory = {};
    
    filteredData.forEach(d => {
      const date = parseDate(d.date);
      if (!date) return;
      const cat = d.category;
      if (!dataByCategory[cat]) {
        dataByCategory[cat] = [];
      }
      dataByCategory[cat].push({
        date,
        value: Number(d.trending_appearances) || 0,
        raw: d,
      });
    });

    // Sort each category's data by date
    Object.keys(dataByCategory).forEach(cat => {
      dataByCategory[cat].sort((a, b) => a.date - b.date);
    });

    // Set up scales
    const allDates = filteredData.map(d => parseDate(d.date)).filter(Boolean);
    const xScale = d3.scaleTime()
      .domain(d3.extent(allDates))
      .range([0, width]);

    const maxValue = d3.max(filteredData, d => Number(d.trending_appearances) || 0) || 1;
    const yScale = d3.scaleLinear()
      .domain([0, maxValue * 1.1])
      .range([height, 0]);

    // Create line generator
    const line = d3.line()
      .x(d => xScale(d.date))
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX);

    // Add axes
    const xAxis = d3.axisBottom(xScale)
      .ticks(d3.timeMonth.every(2))
      .tickFormat(d3.timeFormat('%Y-%m'));
    
    const yAxis = d3.axisLeft(yScale)
      .ticks(8)
      .tickFormat(d => d >= 1000 ? `${(d / 1000).toFixed(0)}K` : d);

    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis)
      .selectAll('text')
      .style('fill', 'var(--color-ge-text)')
      .style('font-size', '11px');

    g.append('g')
      .call(yAxis)
      .selectAll('text')
      .style('fill', 'var(--color-ge-text)')
      .style('font-size', '11px');

    // Add axis labels
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

    // Tooltip (HTML overlay)
    const tooltip = d3.select(wrapRef.current)
      .append('div')
      .attr('class', 'ge-chart-tip')
      .style('position', 'absolute')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('background', 'var(--color-ge-surface)')
      .style('border', '1px solid var(--color-ge-border)')
      .style('border-radius', '10px')
      .style('padding', '10px 12px')
      .style('box-shadow', '0 10px 30px rgba(0,0,0,0.35)')
      .style('max-width', '360px')
      .style('z-index', 60);

    const fmtMonth = d3.timeFormat('%Y-%m');

    const showTip = (event, d, category, color) => {
      const key = `${category}|${d.raw?.date}`;
      const tags = parsedTags.get(key) || [];

      tooltip
        .style('opacity', 1)
        .html(`
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
            <span style="display:inline-block;width:10px;height:10px;border-radius:999px;background:${color};"></span>
            <div style="font-family:var(--font-display);font-weight:800;color:var(--color-ge-text);font-size:12px;">
              ${category}
            </div>
          </div>
          <div style="color:var(--color-ge-dim);font-size:11px;margin-bottom:8px;">
            ${fmtMonth(d.date)} · <span style="color:var(--color-ge-text);font-weight:700;">${d.value}</span> appearances
          </div>
          <div style="color:var(--color-ge-muted);font-size:10px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px;">
            Top tags
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${(tags.length ? tags.slice(0, 5) : ['—']).map(t =>
              `<span style="border:1px solid var(--color-ge-border);background:var(--color-ge-surface2);color:var(--color-ge-text);border-radius:999px;padding:4px 8px;font-size:11px;">${t}</span>`
            ).join('')}
          </div>
        `);

      moveTip(event);
    };

    const moveTip = (event) => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const x = event.clientX - rect.left + 14;
      const y = event.clientY - rect.top + 14;
      tooltip.style('left', `${x}px`).style('top', `${y}px`);
    };

    const hideTip = () => tooltip.style('opacity', 0);

    // Draw lines for each category
    const categories = Object.keys(dataByCategory);
    categories.forEach((category, i) => {
      const color = colorForCategory(category);
      
      const pathData = dataByCategory[category];
      
      // Draw line
      g.append('path')
        .datum(pathData)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 2.5)
        .attr('d', line);

      // Draw circles at data points
      g.selectAll(`.dot-${i}`)
        .data(pathData)
        .enter()
        .append('circle')
        .attr('class', `dot-${i}`)
        .attr('cx', d => xScale(d.date))
        .attr('cy', d => yScale(d.value))
        .attr('r', d => {
          const key = `${category}|${d.raw?.date}`;
          return selectedKeySet.has(key) ? 6 : 4;
        })
        .attr('fill', color)
        .attr('stroke', d => {
          const key = `${category}|${d.raw?.date}`;
          return selectedKeySet.has(key) ? 'var(--color-ge-accent)' : 'var(--color-ge-bg)';
        })
        .attr('stroke-width', d => {
          const key = `${category}|${d.raw?.date}`;
          return selectedKeySet.has(key) ? 2 : 1.5;
        })
        .style('cursor', 'pointer')
        .on('pointerenter', (event, d) => showTip(event, d, category, color))
        .on('pointermove', (event) => moveTip(event))
        .on('pointerleave', hideTip)
        .on('click', (_, d) => {
          const key = `${category}|${d.raw?.date}`;
          setSelectedKeys(prev => {
            const has = prev.includes(key);
            if (has) return prev.filter(k => k !== key);
            const next = [...prev, key];
            const limit = Math.max(1, Number(maxSelected) || 1);
            if (next.length <= limit) return next;
            // evict oldest selections to stay within limit
            return next.slice(next.length - limit);
          });
        });
    });

    // Add title
    g.append('text')
      .attr('x', width / 2)
      .attr('y', -15)
      .attr('text-anchor', 'middle')
      .style('fill', 'var(--color-ge-text)')
      .style('font-size', '16px')
      .style('font-family', 'var(--font-display)')
      .style('font-weight', 'bold')
      .text(`Category Trending Appearances Over Time — ${countryName}`);

    return () => {
      // cleanup tooltip DOM
      d3.select(wrapRef.current).selectAll('.ge-chart-tip').remove();
    };
  }, [filteredData, isOpen, countryName, maxSelected, parsedTags, selectedKeySet]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-ge-panel border border-ge-border rounded-lg shadow-2xl p-6 max-w-4xl w-full mx-4 relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-7 text-ge-muted hover:text-ge-text transition-colors text-2xl leading-none"
          aria-label="Close"
        >
          ×
        </button>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-ge-muted">
            <div className="w-8 h-8 border-2 border-ge-border border-t-ge-accent rounded-full animate-spin-slow mb-4" />
            <span className="text-[0.68rem]">Loading chart data...</span>
          </div>
        )}

        {error && (
          <div className="bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.3)] rounded-lg px-4 py-3 text-[0.67rem] text-ge-red">
            ⚠ {error}
          </div>
        )}

        {!loading && !error && (
          <div ref={wrapRef} className="relative">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-ge-border/50 pb-3 pr-10">
              <div className="flex items-center gap-3">
                <div className="text-[0.6rem] tracking-[0.16em] uppercase text-ge-muted">
                  Selected
                </div>
                <div className="font-display font-black text-[0.95rem] text-ge-text">
                  {selectedKeys.length} / {Math.max(1, Number(maxSelected) || 1)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[0.58rem] uppercase tracking-widest text-ge-muted whitespace-nowrap">
                  Max selections
                </span>

                {/* Themed stepper (replaces native number input arrows) */}
                <div className="flex items-stretch h-6 bg-ge-surface border border-ge-border rounded-md overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      const cap = Math.max(1, maxSelectableDots || 1);
                      setMaxSelected(v => Math.max(1, Math.min(cap, (Number(v) || 1) - 1)));
                    }}
                    className="h-6 px-2.5 text-ge-muted hover:text-ge-text hover:bg-ge-surface2 transition-colors border-r border-ge-border font-display font-bold text-[0.8rem]"
                    aria-label="Decrease max selections"
                    title="Decrease"
                  >
                    −
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={maxSelected}
                    onChange={(e) => {
                      const cap = Math.max(1, maxSelectableDots || 1);
                      const digits = e.target.value.replace(/[^\d]/g, '');
                      const next = digits ? Number(digits) : 1;
                      setMaxSelected(Math.max(1, Math.min(cap, next)));
                    }}
                    className="h-6 w-12 text-center bg-transparent text-[0.75rem] text-ge-text font-mono focus:outline-none"
                    aria-label="Max selections"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const cap = Math.max(1, maxSelectableDots || 1);
                      setMaxSelected(v => Math.max(1, Math.min(cap, (Number(v) || 1) + 1)));
                    }}
                    className="h-6 px-2.5 text-ge-muted hover:text-ge-text hover:bg-ge-surface2 transition-colors border-l border-ge-border font-display font-bold text-[0.8rem]"
                    aria-label="Increase max selections"
                    title="Increase"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={() => setSelectedKeys([])}
                  className="h-6 bg-ge-surface border border-ge-border hover:border-ge-accent text-ge-muted hover:text-ge-text rounded-md px-2.5 py-0 text-[0.7rem] font-display font-semibold transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-4">
              {/* Left: legend + chart */}
              <div className="min-w-0 flex-1" ref={chartWrapRef}>
                {legendCategories.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2">
                    {legendCategories.map((cat) => (
                      <div key={cat} className="flex items-center gap-2">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full"
                          style={{ background: colorForCategory(cat) }}
                        />
                        <span className="text-[0.7rem] font-display font-semibold text-ge-dim">
                          {cat}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="overflow-x-auto">
                  <svg ref={svgRef} className="w-full" />
                </div>
              </div>

              {/* Right: selected cards (vertical stack) */}
              <aside className="lg:w-80 shrink-0">
                <div className="text-[0.56rem] tracking-[0.16em] uppercase text-ge-muted mb-2">
                  Selected points
                </div>

                {selectedCards.length === 0 ? (
                  <div className="bg-ge-surface border border-ge-border rounded-lg p-3 text-[0.7rem] text-ge-muted">
                    Click dots to pin multiple points here.
                  </div>
                ) : (
                  <div className="bg-ge-surface border border-ge-border rounded-lg p-2 max-h-[420px] overflow-y-auto flex flex-col gap-2">
                    {selectedCards.map((s) => (
                      <div
                        key={s.key}
                        className="bg-ge-panel/20 border border-ge-border rounded-lg p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ background: colorForCategory(s.category) }}
                            />
                            <div className="font-display font-bold text-[0.78rem] text-ge-text truncate">
                              {s.category}
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedKeys(prev => prev.filter(k => k !== s.key))}
                            className="text-ge-muted hover:text-ge-text text-[0.9rem] leading-none"
                            aria-label="Remove selection"
                            title="Remove"
                          >
                            ×
                          </button>
                        </div>

                        <div className="mt-1 text-[0.64rem] text-ge-dim flex items-center justify-between">
                          <span>{String(s.date).slice(0, 7)}</span>
                          <span className="font-display font-extrabold text-ge-accent">
                            {s.trending_appearances}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(s.top5_tags.length ? s.top5_tags : ['—']).map((t) => (
                            <span
                              key={t}
                              className="border border-ge-border bg-ge-surface2 text-ge-text rounded-full px-2 py-0.5 text-[0.68rem]"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </aside>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
