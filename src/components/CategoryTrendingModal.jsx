import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { fetchCategoryTrendingOverTime, fetchTopVideosOverTime } from '../services/countries';
import { CATEGORY_COLORS, DEFAULT_CAT } from './Sidebar';

const CATEGORY_LINE_COLORS = {
  'Entertainment': '#38bdf8',      // blue
  'Gaming': '#fb923c',              // orange
  'Music': '#34d399',               // green
  'People & Blogs': '#f472b6',     // red/pink
  'Sports': '#a78bfa',              // purple
};

// Helper function moved outside component to avoid recreation on every render
const colorForCategory = (category) =>
  CATEGORY_LINE_COLORS[category] ||
  (CATEGORY_COLORS[category]?.text) ||
  DEFAULT_CAT.text;

// normalize date to YYYY-MM-DD format for consistent key matching
const normalizeDate = (dateStr) => {
  if (!dateStr) return '';
  // extract date part from ISO string or use as-is if already in YYYY-MM-DD format
  return String(dateStr).split('T')[0];
};

// Parse top5_tags from TEXT column (handles JSON arrays, pipe-separated strings, or arrays)
const parseTags = (tagsRaw) => {
  if (tagsRaw == null || tagsRaw === '' || (typeof tagsRaw === 'string' && !tagsRaw.trim())) {
    return [];
  }
  
  // If already an array, filter and return
  if (Array.isArray(tagsRaw)) {
    return tagsRaw
      .filter(t => t != null && String(t).trim())
      .map(t => String(t).trim())
      .filter(t => t.length > 0);
  }
  
  // If string, try to parse as JSON first, then fall back to pipe-separated
  if (typeof tagsRaw === 'string') {
    const trimmed = tagsRaw.trim();
    if (!trimmed) return [];
    
    // Try parsing as JSON array (e.g., '["tag1","tag2"]')
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .filter(t => t != null && String(t).trim())
            .map(t => String(t).trim())
            .filter(t => t.length > 0);
        }
      } catch (e) {
        // Not valid JSON, fall through to pipe-separated parsing
      }
    }
    
    // Fall back to pipe-separated string (e.g., 'tag1|tag2|tag3')
    return trimmed
      .split('|')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
  
  return [];
};

export default function CategoryTrendingModal({ countryName, isOpen, onClose }) {
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const chartWrapRef = useRef(null);
  const [activeTab, setActiveTab] = useState('categories'); // 'categories' or 'videos'
  const [categoryData, setCategoryData] = useState([]);
  const [videoData, setVideoData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const spinnerDelayRef = useRef(null);
  const [showSpinner, setShowSpinner] = useState(false);
  const [maxSelected, setMaxSelected] = useState(3);
  // Keep order so we can evict oldest when exceeding maxSelected
  const [selectedKeys, setSelectedKeys] = useState([]); // ["<category>|<dateStr>" or "<dateStr>", ...]
  
  // Use appropriate data based on active tab
  const data = activeTab === 'categories' ? categoryData : videoData;

  const topCategories = useMemo(() => {
    if (activeTab !== 'categories' || !categoryData?.length) return [];
    const totals = new Map();
    for (const row of categoryData) {
      const cat = row.category;
      if (!cat) continue;
      const v = Number(row.trending_appearances) || 0;
      totals.set(cat, (totals.get(cat) || 0) + v);
    }
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat]) => cat);
  }, [categoryData, activeTab]);

  const filteredData = useMemo(() => {
    if (activeTab === 'categories') {
      if (!categoryData?.length) return [];
      if (!topCategories.length) return [];
      const set = new Set(topCategories);
      return categoryData.filter(d => set.has(d.category));
    } else {
      // For videos tab, return all video data
      return videoData || [];
    }
  }, [categoryData, videoData, topCategories, activeTab]);

  // Implicit cap: how many selectable dots exist on the chart right now
  const maxSelectableDots = useMemo(() => {
    // Each row corresponds to one dot (category + month)
    return filteredData.length;
  }, [filteredData]);

  const selectedKeySet = useMemo(() => new Set(selectedKeys), [selectedKeys]);

  const parsedTags = useMemo(() => {
    if (activeTab !== 'categories') return new Map(); // Only categories have tags
    const map = new Map(); // key => tags[]
    for (const row of filteredData) {
      const dateKey = normalizeDate(row.date);
      const key = `${row.category}|${dateKey}`;
      const tagsRaw = row?.top5_tags;
      
      const tags = parseTags(tagsRaw);
      map.set(key, tags.slice(0, 5));
    }
    
    return map;
  }, [filteredData, activeTab]);

  const selectedCards = useMemo(() => {
    if (!selectedKeys.length) return [];
    if (activeTab === 'categories') {
      const byKey = new Map(filteredData.map(r => {
        const dateKey = normalizeDate(r.date);
        return [`${r.category}|${dateKey}`, r];
      }));
      return selectedKeys
        .map(key => {
          const row = byKey.get(key);
          if (!row) return null;
          
          // get tags from parsedTags map, with fallback to raw data
          let tags = parsedTags.get(key) || [];
          if (tags.length === 0 && row.top5_tags) {
            const tagsRaw = row.top5_tags;
            if (typeof tagsRaw === 'string' && tagsRaw.trim()) {
              tags = tagsRaw.trim().split('|')
                .map(s => s.trim())
                .filter(Boolean)
                .slice(0, 5);
            } else if (Array.isArray(tagsRaw)) {
              tags = tagsRaw.slice(0, 5);
            }
          }
          
          return {
            key,
            category: row.category,
            date: row.date,
            trending_appearances: Number(row.trending_appearances) || 0,
            top5_tags: tags,
          };
        })
        .filter(Boolean);
    } else {
      // For videos tab
      const byKey = new Map(filteredData.map(r => {
        const dateKey = normalizeDate(r.date);
        return [dateKey, r];
      }));
      return selectedKeys
        .map(key => {
          const row = byKey.get(key);
          if (!row) return null;
          
          return {
            key,
            video_title: row.video_title,
            category: row.category,
            channel_title: row.channel_title,
            date: row.date,
            video_view_count: Number(row.video_view_count) || 0,
            video_like_count: Number(row.video_like_count) || 0,
            video_comment_count: Number(row.video_comment_count) || 0,
            video_duration: row.video_duration,
            trending_appearances: Number(row.trending_appearances) || 0,
          };
        })
        .filter(Boolean);
    }
  }, [filteredData, parsedTags, selectedKeys, activeTab]);

  // Get unique categories from video data for legend
  const videoCategories = useMemo(() => {
    if (activeTab !== 'videos' || !videoData?.length) return [];
    const categories = new Set();
    videoData.forEach(row => {
      if (row.category) categories.add(row.category);
    });
    return Array.from(categories).sort();
  }, [videoData, activeTab]);

  useEffect(() => {
    if (!isOpen || !countryName) return;
    
    setLoading(true);
    setError(null);
    setShowSpinner(false);

    if (spinnerDelayRef.current) {
      clearTimeout(spinnerDelayRef.current);
    }
    spinnerDelayRef.current = setTimeout(() => {
      setShowSpinner(true);
    }, 180);

    // Fetch both datasets in parallel
    Promise.all([
      fetchCategoryTrendingOverTime(countryName),
      fetchTopVideosOverTime(countryName)
    ])
      .then(([categoryResult, videoResult]) => {
        setCategoryData(categoryResult);
        setVideoData(videoResult);
        setLoading(false);
        setShowSpinner(false);
        if (spinnerDelayRef.current) {
          clearTimeout(spinnerDelayRef.current);
          spinnerDelayRef.current = null;
        }
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
        setShowSpinner(false);
        if (spinnerDelayRef.current) {
          clearTimeout(spinnerDelayRef.current);
          spinnerDelayRef.current = null;
        }
      });
    
    return () => {
      if (spinnerDelayRef.current) {
        clearTimeout(spinnerDelayRef.current);
        spinnerDelayRef.current = null;
      }
      setShowSpinner(false);
    };
  }, [isOpen, countryName]);

  // Reset selections when country changes, modal reopens, or tab changes
  useEffect(() => {
    if (!isOpen) return;
    setSelectedKeys([]);
  }, [isOpen, countryName, activeTab]);

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

    // Parse dates
    const parseDate = (dateStr) => {
      if (!dateStr) return null;
      const dateOnly = String(dateStr).split('T')[0];
      return d3.timeParse('%Y-%m-%d')(dateOnly);
    };

    // Set up scales
    const allDates = filteredData.map(d => {
      const dateOnly = d.date ? String(d.date).split('T')[0] : null;
      return d3.timeParse('%Y-%m-%d')(dateOnly);
    }).filter(Boolean);
    const xScale = d3.scaleTime()
      .domain(d3.extent(allDates))
      .range([0, width]);

    const maxValue = d3.max(filteredData, d => Number(d.trending_appearances) || 0) || 1;
    const yScale = d3.scaleLinear()
      .domain([0, maxValue * 1.1])
      .range([height, 0]);

    // Create line generator (only for categories)
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
      .style('padding', '12px')
      .style('box-shadow', '0 10px 30px rgba(0,0,0,0.35)')
      .style('max-width', '360px')
      .style('z-index', 60);

    const fmtMonth = d3.timeFormat('%Y-%m');
    const fmtNumber = (n) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n;

    const showTip = (event, d, category, color, isVideo = false) => {
      if (isVideo) {
        // Video tooltip - match dimensions of categories tooltip
        const rawDateStr = d.raw?.date;
        const dateKey = normalizeDate(rawDateStr);
        const key = dateKey;
        
        tooltip
          .style('opacity', 1)
          .html(`
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
              <span style="display:inline-block;width:10px;height:10px;border-radius:999px;background:${color};"></span>
              <div style="font-family:var(--font-display);font-weight:800;color:var(--color-ge-text);font-size:12px;">
                ${d.raw?.video_title || 'Top Video'}
              </div>
            </div>
            <div style="color:var(--color-ge-dim);font-size:11px;margin-bottom:8px;">
              ${fmtMonth(d.date)} · <span style="color:var(--color-ge-text);font-weight:700;">${d.value}</span> appearances
            </div>
            <div style="color:var(--color-ge-muted);font-size:10px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px;">
              Video Details
            </div>
            <div style="color:var(--color-ge-dim);font-size:10px;margin-bottom:4px;">
              Channel: <span style="color:var(--color-ge-text);">${d.raw?.channel_title || '—'}</span> | 
              Category: <span style="color:var(--color-ge-text);">${category || '—'}</span>
            </div>
            <div style="color:var(--color-ge-dim);font-size:10px;">
              Views: <span style="color:var(--color-ge-text);font-weight:700;">${fmtNumber(Number(d.raw?.video_view_count) || 0)}</span> | 
              Likes: <span style="color:var(--color-ge-text);">${fmtNumber(Number(d.raw?.video_like_count) || 0)}</span> | 
              Comments: <span style="color:var(--color-ge-text);">${fmtNumber(Number(d.raw?.video_comment_count) || 0)}</span>
            </div>
          `);
      } else {
        // Category tooltip
        const rawDateStr = d.raw?.date;
        const dateKey = normalizeDate(rawDateStr);
        const key = `${category}|${dateKey}`;
        
        // try to get tags from parsedTags map first
        let tags = parsedTags.get(key) || [];
        
        // if not found, try direct lookup with alternative keys
        if (tags.length === 0) {
          const altKey1 = `${category}|${rawDateStr}`;
          tags = parsedTags.get(altKey1) || [];
        }
        
        // fallback: try to get tags directly from raw data
        if (tags.length === 0 && d.raw?.top5_tags) {
          tags = parseTags(d.raw.top5_tags).slice(0, 5);
        }
        
        const finalTags = tags;

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
              ${(finalTags.length ? finalTags.slice(0, 5) : ['—']).map(t =>
                `<span style="border:1px solid var(--color-ge-border);background:var(--color-ge-surface2);color:var(--color-ge-text);border-radius:999px;padding:4px 8px;font-size:11px;">${t}</span>`
              ).join('')}
            </div>
          `);
      }

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

    if (activeTab === 'categories') {
      // Categories tab: draw lines and points
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

      // Draw lines for each category
      // Original size is 4, selected should be 2x = 8
      const baseRadius = 4;
      const selectedRadius = baseRadius * 2; // 8
      
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
            const dateKey = normalizeDate(d.raw?.date);
            const key = `${category}|${dateKey}`;
            return selectedKeySet.has(key) ? selectedRadius : baseRadius;
          })
          .attr('fill', color)
          .attr('stroke', 'var(--color-ge-bg)')
          .attr('stroke-width', 1.5)
          .style('cursor', 'pointer')
          .on('pointerenter', (event, d) => showTip(event, d, category, color, false))
          .on('pointermove', (event) => moveTip(event))
          .on('pointerleave', hideTip)
          .on('click', (_, d) => {
            const dateKey = normalizeDate(d.raw?.date);
            const key = `${category}|${dateKey}`;
            setSelectedKeys(prev => {
              const has = prev.includes(key);
              if (has) return prev.filter(k => k !== key);
              const next = [...prev, key];
              const limit = Math.max(1, Number(maxSelected) || 1);
              if (next.length <= limit) return next;
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
    } else {
      // Videos tab: draw single points only (no lines)
      const videoPoints = filteredData.map(d => {
        const date = parseDate(d.date);
        if (!date) return null;
        return {
          date,
          value: Number(d.trending_appearances) || 0,
          raw: d,
          category: d.category,
        };
      }).filter(Boolean);

      // Draw circles for each video point
      // Original size is 4, selected should be 2x = 8
      const baseRadius = 4;
      const selectedRadius = baseRadius * 2; // 8
      
      videoPoints.forEach((d, i) => {
        const dateKey = normalizeDate(d.raw?.date);
        const key = dateKey;
        const category = d.category;
        const color = colorForCategory(category);
        const isSelected = selectedKeySet.has(key);

        g.append('circle')
          .attr('class', `video-dot-${i}`)
          .attr('cx', xScale(d.date))
          .attr('cy', yScale(d.value))
          .attr('r', isSelected ? selectedRadius : baseRadius)
          .attr('fill', color)
          .attr('stroke', 'var(--color-ge-bg)')
          .attr('stroke-width', 1.5)
          .style('cursor', 'pointer')
          .on('pointerenter', (event) => showTip(event, d, category, color, true))
          .on('pointermove', (event) => moveTip(event))
          .on('pointerleave', hideTip)
          .on('click', () => {
            setSelectedKeys(prev => {
              const has = prev.includes(key);
              if (has) return prev.filter(k => k !== key);
              const next = [...prev, key];
              const limit = Math.max(1, Number(maxSelected) || 1);
              if (next.length <= limit) return next;
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
        .text(`Top Trending Videos Over Time — ${countryName}`);
    }

    return () => {
      // cleanup tooltip DOM
      d3.select(wrapRef.current).selectAll('.ge-chart-tip').remove();
    };
  }, [filteredData, isOpen, countryName, maxSelected, parsedTags, selectedKeySet, activeTab, videoCategories]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm ge-modal-backdrop"
      onClick={onClose}
    >
      <div 
        className="bg-ge-panel border border-ge-border rounded-lg shadow-2xl p-6 max-w-4xl w-full mx-4 relative ge-modal-panel"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-50 inline-flex items-center justify-center w-12 h-12 rounded-full text-ge-muted hover:text-ge-text transition-colors text-2xl leading-none pointer-events-auto"
          aria-label="Close"
        >
          ×
        </button>

        {showSpinner && loading && (
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
            {/* Tabs */}
            <div className="mb-4 flex gap-2 border-b border-ge-border/50">
              <button
                onClick={() => setActiveTab('categories')}
                className={`px-4 py-2 text-sm font-display font-semibold transition-colors border-b-2 ${
                  activeTab === 'categories'
                    ? 'border-ge-accent text-ge-accent'
                    : 'border-transparent text-ge-muted hover:text-ge-text'
                }`}
              >
                Categories Over Time
              </button>
              <button
                onClick={() => setActiveTab('videos')}
                className={`px-4 py-2 text-sm font-display font-semibold transition-colors border-b-2 ${
                  activeTab === 'videos'
                    ? 'border-ge-accent text-ge-accent'
                    : 'border-transparent text-ge-muted hover:text-ge-text'
                }`}
              >
                Videos Over Time
              </button>
            </div>

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-ge-border/50 pb-3 pr-10 mt-4">
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
                {activeTab === 'categories' && topCategories.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2">
                    {topCategories.map((cat) => (
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
                {activeTab === 'videos' && videoCategories.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2">
                    {videoCategories.map((cat) => (
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
                              {activeTab === 'videos' ? (s.video_title || 'Top Video') : s.category}
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

                        {activeTab === 'videos' ? (
                          <>
                            {s.channel_title && (
                              <div className="mt-2 text-[0.65rem] text-ge-dim">
                                Channel: <span className="text-ge-text">{s.channel_title}</span>
                              </div>
                            )}
                            <div className="mt-1 text-[0.65rem] text-ge-dim flex items-center gap-3">
                              <span>Views: <span className="text-ge-text font-semibold">{s.video_view_count >= 1000000 ? `${(s.video_view_count / 1000000).toFixed(1)}M` : s.video_view_count >= 1000 ? `${(s.video_view_count / 1000).toFixed(1)}K` : s.video_view_count}</span></span>
                              <span>Likes: <span className="text-ge-text">{s.video_like_count >= 1000 ? `${(s.video_like_count / 1000).toFixed(1)}K` : s.video_like_count}</span></span>
                              <span>Comments: <span className="text-ge-text">{s.video_comment_count >= 1000 ? `${(s.video_comment_count / 1000).toFixed(1)}K` : s.video_comment_count}</span></span>
                            </div>
                          </>
                        ) : (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {(s.top5_tags && s.top5_tags.length ? s.top5_tags : ['—']).map((t) => (
                              <span
                                key={t}
                                className="border border-ge-border bg-ge-surface2 text-ge-text rounded-full px-2 py-0.5 text-[0.68rem]"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
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
