import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchCategoryTrendingOverTime, fetchTopVideosOverTime } from '../services/countries';
import type { CategoryTrendRow, VideoTrendRow } from '../services/countries';
import { formatViews } from '../utils/formatNumber';
import {
  buildParsedTagsMap,
  buildSelectedCategoryCards,
  buildSelectedVideoCards,
  computeTopCategories,
  computeVideoCategories,
  formatVideoDuration,
  type SelectedCategoryCard,
  type SelectedVideoCard,
} from './CategoryTrendingModal/model';
import {
  colorForCategory,
  renderCategoryTrendingChart,
  renderVideoTrendingChart,
} from './CategoryTrendingModal/chart';

export default function CategoryTrendingModal({
  countryName,
  isOpen,
  onClose,
}: {
  countryName: string | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const chartWrapRef = useRef<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useState<'categories' | 'videos'>('categories');
  const [categoryData, setCategoryData] = useState<CategoryTrendRow[]>([]);
  const [videoData, setVideoData] = useState<VideoTrendRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSpinner, setShowSpinner] = useState(false);
  const [maxSelected, setMaxSelected] = useState(3);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  // derived: clamp maxSelected to at least 1
  const effectiveMax = useMemo(() => Math.max(1, Number(maxSelected) || 1), [maxSelected]);

  const topCategories = useMemo(() => {
    if (activeTab !== 'categories' || !categoryData.length) return [];
    return computeTopCategories(categoryData);
  }, [categoryData, activeTab]);

  const filteredData = useMemo(() => {
    if (activeTab === 'categories') {
      if (!categoryData.length || !topCategories.length) return [];
      const set = new Set(topCategories);
      return categoryData.filter((d) => (d.category ? set.has(d.category) : false));
    }
    return videoData;
  }, [categoryData, videoData, topCategories, activeTab]);

  // implicit cap: how many selectable dots exist on the chart right now
  const maxSelectableDots = useMemo(() => filteredData.length, [filteredData]);

  const selectedKeySet = useMemo(() => new Set(selectedKeys), [selectedKeys]);

  const parsedTags = useMemo(() => {
    if (activeTab !== 'categories') return new Map<string, string[]>();
    return buildParsedTagsMap(filteredData as CategoryTrendRow[]);
  }, [filteredData, activeTab]);

  const selectedCards = useMemo((): (SelectedCategoryCard | SelectedVideoCard)[] => {
    if (!selectedKeys.length) return [];
    if (activeTab === 'categories') {
      return buildSelectedCategoryCards({
        filteredCategoryData: filteredData as CategoryTrendRow[],
        selectedKeys,
        parsedTags,
      });
    }
    return buildSelectedVideoCards({
      filteredVideoData: filteredData as VideoTrendRow[],
      selectedKeys,
    });
  }, [filteredData, parsedTags, selectedKeys, activeTab]);

  const videoCategories = useMemo(() => {
    if (activeTab !== 'videos' || !videoData.length) return [];
    return computeVideoCategories(videoData);
  }, [videoData, activeTab]);

  const toggleSelectedKey = useCallback(
    (key: string) => {
      setSelectedKeys((prev) => {
        const has = prev.includes(key);
        if (has) return prev.filter((k) => k !== key);
        const next = [...prev, key];
        if (next.length <= effectiveMax) return next;
        return next.slice(next.length - effectiveMax);
      });
    },
    [effectiveMax]
  );

  // fetch both datasets when modal opens or country changes
  useEffect(() => {
    if (!isOpen || !countryName) return;

    const controller = new AbortController();
    const { signal } = controller;
    let active = true;

    setLoading(true);
    setError(null);
    setShowSpinner(false);

    const timerId = setTimeout(() => {
      if (active) setShowSpinner(true);
    }, 180);

    Promise.all([
      fetchCategoryTrendingOverTime(countryName, { signal }),
      fetchTopVideosOverTime(countryName, { signal }),
    ])
      .then(([categoryResult, videoResult]) => {
        if (!active) return;
        setCategoryData(categoryResult);
        setVideoData(videoResult);
        setLoading(false);
        setShowSpinner(false);
        clearTimeout(timerId);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if ((err as { name?: string }).name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
        setShowSpinner(false);
        clearTimeout(timerId);
      });

    return () => {
      active = false;
      controller.abort();
      clearTimeout(timerId);
      setShowSpinner(false);
    };
  }, [isOpen, countryName]);

  // reset selections when country changes, modal reopens, or tab changes
  useEffect(() => {
    if (!isOpen) return;
    setSelectedKeys([]);
  }, [isOpen, countryName, activeTab]);

  // keep maxSelected and selectedKeys within the implicit dot cap
  useEffect(() => {
    const cap = Math.max(1, maxSelectableDots || 1);
    setMaxSelected((prev) => Math.max(1, Math.min(cap, Number(prev) || 1)));
    setSelectedKeys((prev) => (prev.length <= cap ? prev : prev.slice(prev.length - cap)));
  }, [maxSelectableDots]);

  useEffect(() => {
    if (!isOpen || !filteredData.length || !svgRef.current || !wrapRef.current) return;

    const containerW =
      chartWrapRef.current?.clientWidth || svgRef.current.parentElement?.clientWidth || 900;
    const isNarrow = typeof window !== 'undefined' ? window.innerWidth <= 900 : containerW <= 900;

    if (activeTab === 'categories') {
      return renderCategoryTrendingChart({
        svgEl: svgRef.current,
        wrapEl: wrapRef.current,
        containerW,
        isNarrow,
        countryName,
        filteredData: filteredData as CategoryTrendRow[],
        selectedKeySet,
        maxSelected: effectiveMax,
        parsedTags,
        onToggleKey: toggleSelectedKey,
      });
    }

    return renderVideoTrendingChart({
      svgEl: svgRef.current,
      wrapEl: wrapRef.current,
      containerW,
      isNarrow,
      countryName,
      filteredData: filteredData as VideoTrendRow[],
      selectedKeySet,
      onToggleKey: toggleSelectedKey,
    });
  }, [
    filteredData,
    isOpen,
    countryName,
    effectiveMax,
    parsedTags,
    selectedKeySet,
    activeTab,
    toggleSelectedKey,
  ]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm ge-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="bg-ge-panel border border-ge-border rounded-lg shadow-2xl p-6 max-w-4xl w-full mx-4 relative ge-modal-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-50 inline-flex items-center justify-center w-12 h-12 rounded-full text-ge-muted hover:text-ge-text transition-colors text-2xl leading-none pointer-events-auto"
          aria-label="Close"
          type="button"
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
                type="button"
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
                type="button"
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
                  {selectedKeys.length} / {effectiveMax}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[0.58rem] uppercase tracking-widest text-ge-muted whitespace-nowrap">
                  Max selections
                </span>

                {/* Themed stepper */}
                <div className="flex items-stretch h-6 bg-ge-surface border border-ge-border rounded-md overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      const cap = Math.max(1, maxSelectableDots || 1);
                      setMaxSelected((v) => Math.max(1, Math.min(cap, (Number(v) || 1) - 1)));
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
                      setMaxSelected((v) => Math.max(1, Math.min(cap, (Number(v) || 1) + 1)));
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
                  type="button"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
              {/* Left: legend + chart */}
              <div className="min-w-0 flex-1 lg:flex lg:flex-col" ref={chartWrapRef}>
                {activeTab === 'categories' && topCategories.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 shrink-0">
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
                  <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 shrink-0">
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

                <div className="overflow-x-auto shrink-0">
                  <svg ref={svgRef} className="w-full" />
                </div>
              </div>

              {/* Right: selected points */}
              <aside className="lg:w-80 shrink-0">
                <div className="text-[0.56rem] tracking-[0.16em] uppercase text-ge-muted mb-2">
                  Selected points
                </div>

                {selectedCards.length === 0 ? (
                  <div className="bg-ge-surface border border-ge-border rounded-lg p-3 text-[0.7rem] text-ge-muted">
                    Click dots to pin multiple points here.
                  </div>
                ) : (
                  <div className="ge-modal-selected-cards bg-ge-surface border border-ge-border rounded-lg p-2 max-h-[420px] lg:max-h-[510px] overflow-y-auto flex flex-col gap-2">
                    {selectedCards.map((s) => {
                      const isVideo = activeTab === 'videos';
                      const videoCard = isVideo ? (s as SelectedVideoCard) : null;
                      const catCard = !isVideo ? (s as SelectedCategoryCard) : null;
                      const durationStr =
                        videoCard?.video_duration != null
                          ? formatVideoDuration(videoCard.video_duration)
                          : null;
                      return (
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
                                {isVideo
                                  ? videoCard?.video_title || 'Top Video'
                                  : catCard?.category}
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                setSelectedKeys((prev) => prev.filter((k) => k !== s.key))
                              }
                              className="text-ge-muted hover:text-ge-text text-[0.9rem] leading-none"
                              aria-label="Remove selection"
                              title="Remove"
                              type="button"
                            >
                              ×
                            </button>
                          </div>

                          <div className="mt-1 text-[0.64rem] text-ge-dim flex items-center justify-between">
                            <span>{String(s.date ?? '').slice(0, 7)}</span>
                            <span className="font-display font-extrabold text-ge-accent">
                              {s.trending_appearances}
                            </span>
                          </div>

                          {isVideo && videoCard ? (
                            <>
                              {(videoCard.channel_title || durationStr) && (
                                <div className="mt-2 text-[0.65rem] text-ge-dim flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                  {videoCard.channel_title && (
                                    <span>
                                      Channel:{' '}
                                      <span className="text-ge-text">
                                        {videoCard.channel_title}
                                      </span>
                                    </span>
                                  )}
                                  {durationStr && (
                                    <span>
                                      Duration: <span className="text-ge-text">{durationStr}</span>
                                    </span>
                                  )}
                                </div>
                              )}
                              <div className="mt-1 text-[0.65rem] text-ge-dim flex items-center gap-3">
                                <span>
                                  Views:{' '}
                                  <span className="text-ge-text font-semibold">
                                    {formatViews(videoCard.video_view_count)}
                                  </span>
                                </span>
                                <span>
                                  Likes:{' '}
                                  <span className="text-ge-text">
                                    {formatViews(videoCard.video_like_count)}
                                  </span>
                                </span>
                                <span>
                                  Comments:{' '}
                                  <span className="text-ge-text">
                                    {formatViews(videoCard.video_comment_count)}
                                  </span>
                                </span>
                              </div>
                            </>
                          ) : catCard ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {(catCard.top5_tags && catCard.top5_tags.length
                                ? catCard.top5_tags
                                : ['—']
                              ).map((t: string) => (
                                <span
                                  key={t}
                                  className="border border-ge-border bg-ge-surface2 text-ge-text rounded-full px-2 py-0.5 text-[0.68rem]"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
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
