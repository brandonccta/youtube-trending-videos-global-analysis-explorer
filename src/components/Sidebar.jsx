import { useEffect, useMemo, useState, useRef, memo, useCallback } from 'react';
import tzLookup from 'tz-lookup';
import COUNTRIES from '../data/countries';
import { formatViews } from '../utils/formatNumber';

const MOBILE_BREAKPOINT = 640;
const SHEET_SNAP_POINTS_VH = [28, 50, 55]; // peek, half, full
const SHEET_DEFAULT_VH = 50;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches
  );
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const handler = () => setIsMobile(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

function formatEngagement(rating) {
  if (rating === null || rating === undefined) return '—';
  if (typeof rating === 'number') {
    return rating.toFixed(2) + '%';
  }
  // try to parse if it's a string number
  const parsed = parseFloat(rating);
  if (!isNaN(parsed)) {
    return parsed.toFixed(2) + '%';
  }
  return String(rating);
}

export const CATEGORY_COLORS = {
  'Gaming':               { bg: 'rgba(139,92,246,0.08)',  border: 'rgba(139,92,246,0.35)', text: '#a78bfa' },
  'Sports':               { bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.35)', text: '#34d399' },
  'Music':                { bg: 'rgba(251,146,60,0.08)',  border: 'rgba(251,146,60,0.35)', text: '#fb923c' },
  'Entertainment':        { bg: 'rgba(56,189,248,0.08)',  border: 'rgba(56,189,248,0.35)', text: '#38bdf8' },
  'People & Blogs':       { bg: 'rgba(244,114,182,0.08)', border: 'rgba(244,114,182,0.35)', text: '#f472b6' },
  'News & Politics':      { bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.35)', text: '#f87171' },
  'Comedy':               { bg: 'rgba(253,224,71,0.08)',  border: 'rgba(253,224,71,0.35)',  text: '#fde047' },
  'Education':            { bg: 'rgba(45,212,191,0.08)',  border: 'rgba(45,212,191,0.35)', text: '#2dd4bf' },
  'Film & Animation':     { bg: 'rgba(129,140,248,0.08)', border: 'rgba(129,140,248,0.35)', text: '#818cf8' },
  'Science & Technology': { bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.35)', text: '#60a5fa' },
  'Howto & Style':        { bg: 'rgba(192,132,252,0.08)', border: 'rgba(192,132,252,0.35)', text: '#c084fc' },
  'Autos & Vehicles':     { bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.35)', text: '#4ade80' },
  'Travel & Events':      { bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.35)', text: '#fbbf24' },
  'Pets & Animals':       { bg: 'rgba(251,146,60,0.08)',  border: 'rgba(251,146,60,0.35)', text: '#fb923c' },
};

export const DEFAULT_CAT = { bg: 'rgba(56,189,248,0.06)', border: 'rgba(56,189,248,0.2)', text: '#38bdf8' };

const TABS = [
  { id: 'channels',   label: 'Top Channels' },
  { id: 'categories', label: 'Top Categories' },
  { id: 'videos',     label: 'Top Videos' },
];

export default function Sidebar({ selectedIso, selectedName, channels, categories, videos, loading, error }) {
  const [activeTab, setActiveTab] = useState('channels');
  const hasSelection = !!selectedIso;
  const isMobile = useIsMobile();

  // Mobile draggable sheet: height in vh, snap points
  const [sheetHeightVh, setSheetHeightVh] = useState(SHEET_DEFAULT_VH);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  const handleSheetPointerDown = useCallback((e) => {
    if (!isMobile) return;
    e.preventDefault();
    dragStartY.current = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    dragStartHeight.current = sheetHeightVh;
    setIsDraggingSheet(true);
  }, [isMobile, sheetHeightVh]);

  useEffect(() => {
    if (!isDraggingSheet) return;
    const handleMove = (e) => {
      const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
      const deltaY = dragStartY.current - clientY; // drag up = positive delta = more height
      const vhPerPx = 100 / window.innerHeight;
      let next = dragStartHeight.current + deltaY * vhPerPx;
      next = Math.max(SHEET_SNAP_POINTS_VH[0], Math.min(SHEET_SNAP_POINTS_VH[SHEET_SNAP_POINTS_VH.length - 1], next));
      setSheetHeightVh(next);
      if (e.cancelable && e.touches) e.preventDefault();
    };
    const handleUp = () => {
      setIsDraggingSheet(false);
      setSheetHeightVh((current) => {
        const nearest = SHEET_SNAP_POINTS_VH.reduce((a, b) =>
          Math.abs(a - current) < Math.abs(b - current) ? a : b
        );
        return nearest;
      });
    };
    window.addEventListener('pointermove', handleMove, { passive: true });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDraggingSheet]);
  // explicitly cap projections to the top 10 results (api *should* already do this,
  // but keeping it here prevents accidental "top 9" regressions if upstream changes).
  const topChannels = useMemo(() => channels.slice(0, 10), [channels]);
  const topCategories = useMemo(() => categories.slice(0, 10), [categories]);
  const topVideos = useMemo(() => videos.slice(0, 10), [videos]);

  const hasData = activeTab === 'channels' ? topChannels.length > 0 : 
                  activeTab === 'categories' ? topCategories.length > 0 : 
                  topVideos.length > 0;

  const countryByIso = useMemo(
    () => new Map(COUNTRIES.map(c => [c.iso, c])),
    [],
  );
  const selectedCountry = selectedIso ? (countryByIso.get(selectedIso) ?? null) : null;

  const timeZone = useMemo(() => {
    if (!selectedCountry) return null;
    try {
      return tzLookup(selectedCountry.lat, selectedCountry.lng);
    } catch {
      return null;
    }
  }, [selectedCountry]);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!hasSelection || !timeZone) return;
    // update once per second (live clock).
    const id = window.setInterval(() => setNow(new Date()), 1000);
    // ensure we don't show a stale time if the user selects a country mid-minute.
    setNow(new Date());
    return () => window.clearInterval(id);
  }, [hasSelection, timeZone]);

  const formattedTime = useMemo(() => {
    if (!timeZone) return null;
    try {
      return new Intl.DateTimeFormat(undefined, {
        timeZone,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(now);
    } catch {
      return null;
    }
  }, [now, timeZone]);

  const flagCode = useMemo(() => {
    if (!selectedCountry || !selectedCountry.alpha2) return null;
    return selectedCountry.alpha2.toLowerCase();
  }, [selectedCountry]);

  const mobileSheetStyle = isMobile
    ? { height: `${sheetHeightVh}vh`, minHeight: 0 }
    : undefined;

  return (
    <div
      className={`ge-sidebar-mobile-wrap flex flex-col overflow-hidden ${isMobile && !isDraggingSheet ? 'ge-sidebar-sheet-transition' : ''}`}
      style={mobileSheetStyle}
    >
      {isMobile && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Drag to resize panel"
          className="ge-sidebar-drag-handle shrink-0 touch-none cursor-grab active:cursor-grabbing flex items-center justify-center py-2"
          onPointerDown={handleSheetPointerDown}
        >
          <span className="w-10 h-1 rounded-full bg-ge-border" aria-hidden />
        </div>
      )}
      <aside className="ge-sidebar w-80 shrink-0 bg-ge-panel border-l border-ge-border flex flex-col overflow-hidden flex-1 min-h-0">

      {/* Header */}
      <div className={`px-6 pt-5 pb-4 border-b border-ge-border relative overflow-hidden shrink-0 ${hasSelection ? 'after:absolute after:top-0 after:left-0 after:right-0 after:h-0.5 after:bg-linear-to-r after:from-transparent after:via-ge-accent after:to-transparent' : ''}`}>
        <div className="text-[0.56rem] tracking-[0.16em] uppercase text-ge-muted mb-2">Selected Country</div>
        <div className="flex items-center justify-between gap-2">
          <div className="font-display font-black text-[1.55rem] text-ge-text leading-tight tracking-tight min-h-[1.8rem]">
            {selectedName ?? '—'}
          </div>
          {flagCode && (
            <span
              className={`fi fi-${flagCode} fi-rounded align-middle`}
              data-testid="country-flag"
              style={{ fontSize: '1.4rem', lineHeight: 1 }}
            />
          )}
        </div>
        {hasSelection && (
          <div className="mt-2 text-[0.62rem] text-ge-muted">
            <div className="flex items-center justify-between gap-3">
              <span className="tracking-wide uppercase text-[0.54rem] text-ge-muted">Local time</span>
              <span className="font-display font-semibold text-ge-text">
                {formattedTime ?? '—'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 mt-1">
              <span className="tracking-wide uppercase text-[0.54rem] text-ge-muted">Timezone</span>
              <span className="font-display font-semibold text-ge-dim">
                {timeZone ?? '—'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 mt-1">
              <span className="tracking-wide uppercase text-[0.54rem] text-ge-muted">ISO</span>
              <span className="bg-ge-surface border border-ge-border rounded px-2 py-0.5 text-[0.6rem] text-ge-accent">
                {selectedIso}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      {hasSelection && !loading && (
        <div className="flex border-b border-ge-border shrink-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 text-[0.62rem] font-display font-semibold tracking-wide uppercase transition-colors ${
                activeTab === tab.id
                  ? 'text-ge-accent border-b-2 border-ge-accent'
                  : 'text-ge-muted hover:text-ge-dim'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      <div className="ge-sidebar-body flex-1 overflow-y-auto p-5">

        {/* Empty state */}
        {!hasSelection && (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-6 text-ge-muted">
            <div className="text-4xl opacity-10 animate-globe-idle">🌍</div>
            <p className="text-[0.68rem] leading-relaxed">Spin the globe and click any country, or use the search bar to fly directly to a location.</p>
          </div>
        )}

        {/* Loading */}
        {hasSelection && loading && (
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-ge-muted text-[0.68rem]">
            <div className="w-6 h-6 border-2 border-ge-border border-t-ge-accent rounded-full animate-spin-slow" />
            <span>Fetching data...</span>
          </div>
        )}

        {/* Error */}
        {hasSelection && !loading && error && (
          <div className="bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.3)] rounded-lg px-3.5 py-3 text-[0.67rem] text-ge-red">
            ⚠ {error}
          </div>
        )}

        {/* No data */}
        {hasSelection && !loading && !error && !hasData && (
          <div className="flex flex-col items-center gap-3 py-6 text-ge-muted text-center">
            <div className="text-3xl opacity-15">🔍</div>
            <p className="text-[0.68rem]">No trending data for <strong className="text-ge-text">{selectedName}</strong>.</p>
          </div>
        )}

        {/* Channels tab */}
        {hasSelection && !loading && !error && activeTab === 'channels' && topChannels.length > 0 && (
          <ChannelList channels={topChannels} />
        )}

        {/* Categories tab */}
        {hasSelection && !loading && !error && activeTab === 'categories' && topCategories.length > 0 && (
          <CategoryList categories={topCategories} />
        )}

        {/* Videos tab */}
        {hasSelection && !loading && !error && activeTab === 'videos' && topVideos.length > 0 && (
          <VideoList videos={topVideos} />
        )}
      </div>
    </aside>
    </div>
  );
}

const ChannelList = memo(function ChannelList({ channels }) {
  return (
    <>
      <div className="text-[0.56rem] tracking-[0.14em] uppercase text-ge-muted mb-3 pb-1.5 border-b border-ge-border">
        Top Trending Channels
      </div>
      <div className="flex flex-col gap-2">
        {channels.map((ch, i) => {
          const cat = CATEGORY_COLORS[ch.video_category_id] ?? DEFAULT_CAT;
          return (
            <div
              key={`${ch.rank}-${ch.channel_title}`}
              className="bg-ge-surface border border-ge-border rounded-lg p-3 hover:border-ge-accent transition-colors animate-fade-in"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-start gap-2.5">
                <div className="shrink-0 w-7 h-7 rounded-md bg-ge-surface2 border border-ge-border flex items-center justify-center font-display font-bold text-[0.75rem] text-ge-accent">
                  {ch.rank}
                </div>
                <div className="flex-1 min-w-0">
                  {ch.channel_custom_url ? (
                    <a
                      href={
                        ch.channel_custom_url.startsWith('http') 
                          ? ch.channel_custom_url
                          : ch.channel_custom_url.startsWith('/')
                          ? `https://youtube.com${ch.channel_custom_url}`
                          : ch.channel_custom_url.startsWith('@')
                          ? `https://youtube.com/${ch.channel_custom_url}`
                          : `https://youtube.com/@${ch.channel_custom_url}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-display font-semibold text-[0.78rem] text-ge-text leading-snug truncate hover:text-ge-accent transition-colors cursor-pointer"
                      title={ch.channel_title}
                    >
                      {ch.channel_title}
                    </a>
                  ) : (
                    <div className="font-display font-semibold text-[0.78rem] text-ge-text leading-snug truncate" title={ch.channel_title}>
                      {ch.channel_title}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {ch.channel_subscribers != null && ch.channel_subscribers > 0 && (
                      <div className="text-[0.65rem] text-ge-dim font-medium">
                        {formatViews(ch.channel_subscribers)} subs
                      </div>
                    )}
                    <span
                      className="inline-block rounded px-1.5 py-0.5 text-[0.52rem] font-medium tracking-wide"
                      style={{ background: cat.bg, border: `1px solid ${cat.border}`, color: cat.text }}
                    >
                      {ch.video_category_id}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-4 mt-2.5 pt-2 border-t border-ge-border/50">
                <div>
                  <div className="text-[0.48rem] tracking-widest uppercase text-ge-muted">Total Views</div>
                  <div className="font-display font-bold text-[0.8rem] text-ge-accent">{formatViews(ch.total_views || 0)}</div>
                </div>
                <div>
                  <div className="text-[0.48rem] tracking-widest uppercase text-ge-muted">Total Videos</div>
                  <div className="font-display font-bold text-[0.8rem] text-ge-text">{formatViews(ch.total_videos || 0)}</div>
                </div>
                <div>
                  <div className="text-[0.48rem] tracking-widest uppercase text-ge-muted">Trending</div>
                  <div className="font-display font-bold text-[0.8rem] text-ge-text">{ch.trending_appearances}x</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
});

const CategoryList = memo(function CategoryList({ categories }) {
  const maxViews = useMemo(() => {
    if (!categories.length) return 1;
    return Math.max(...categories.map(c => c.total_views));
  }, [categories]);

  return (
    <>
      <div className="text-[0.56rem] tracking-[0.14em] uppercase text-ge-muted mb-3 pb-1.5 border-b border-ge-border">
        Top Trending Categories
      </div>
      <div className="flex flex-col gap-2">
        {categories.map((cat, i) => {
          const colors = CATEGORY_COLORS[cat.video_category_id] ?? DEFAULT_CAT;
          const barWidth = (cat.total_views / maxViews) * 100;
          return (
            <div
              key={`${cat.rank}-${cat.video_category_id}`}
              className="bg-ge-surface border border-ge-border rounded-lg p-3 hover:border-ge-accent transition-colors animate-fade-in"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className="shrink-0 w-7 h-7 rounded-md bg-ge-surface2 border border-ge-border flex items-center justify-center font-display font-bold text-[0.75rem] text-ge-accent">
                  {cat.rank}
                </div>
                <span
                  className="rounded px-2 py-0.5 text-[0.65rem] font-display font-semibold"
                  style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}
                >
                  {cat.video_category_id}
                </span>
              </div>

              {/* Views bar */}
              <div className="h-1.5 rounded-full bg-ge-surface2 overflow-hidden mb-2.5">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${barWidth}%`, background: colors.text }}
                />
              </div>

              <div className="flex gap-4">
                <div>
                  <div className="text-[0.48rem] tracking-widest uppercase text-ge-muted">Total Views</div>
                  <div className="font-display font-bold text-[0.8rem] text-ge-accent">{formatViews(cat.total_views)}</div>
                </div>
                <div>
                  <div className="text-[0.48rem] tracking-widest uppercase text-ge-muted">Avg Views</div>
                  <div className="font-display font-bold text-[0.8rem] text-ge-text">{formatViews(cat.avg_views)}</div>
                </div>
                <div>
                  <div className="text-[0.48rem] tracking-widest uppercase text-ge-muted">Likes</div>
                  <div className="font-display font-bold text-[0.8rem] text-ge-text">{formatViews(cat.total_likes || 0)}</div>
                </div>
                <div>
                  <div className="text-[0.48rem] tracking-widest uppercase text-ge-muted">Trending</div>
                  <div className="font-display font-bold text-[0.8rem] text-ge-text">{cat.trending_appearances}x</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
});

const VideoTitle = memo(function VideoTitle({ title }) {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [scrollDistance, setScrollDistance] = useState(0);
  const [animationDuration, setAnimationDuration] = useState(0);

  useEffect(() => {
    if (!containerRef.current || !textRef.current) return;
    const container = containerRef.current;
    const text = textRef.current;
    const containerWidth = container.offsetWidth;
    const textWidth = text.scrollWidth;
    const needsScroll = textWidth > containerWidth;
    setShouldScroll(needsScroll);
    if (needsScroll) {
      // calculate how much to scroll: negative of (textWidth - containerWidth)
      const distance = -(textWidth - containerWidth);
      setScrollDistance(distance);
      // calculate duration for consistent speed (e.g., 50px per second)
      const SPEED_PX_PER_SEC = 50;
      const duration = Math.abs(distance) / SPEED_PX_PER_SEC;
      setAnimationDuration(duration);
    }
  }, [title]);

  return (
    <div 
      ref={containerRef}
      className="video-title-scroll font-display font-semibold text-[0.78rem] text-ge-text leading-snug" 
      title={title}
    >
      <span 
        ref={textRef}
        className={`inline-block whitespace-nowrap ${shouldScroll ? 'hover-scroll' : ''}`}
        style={shouldScroll ? {
          '--scroll-distance': `${scrollDistance}px`,
          '--animation-duration': `${animationDuration}s`
        } : {}}
      >
        {title}
      </span>
    </div>
  );
});

const VideoList = memo(function VideoList({ videos }) {
  return (
    <>
      <div className="text-[0.56rem] tracking-[0.14em] uppercase text-ge-muted mb-3 pb-1.5 border-b border-ge-border">
        Top Trending Videos
      </div>
      <div className="flex flex-col gap-2">
        {videos.map((video, i) => {
          const cat = CATEGORY_COLORS[video.video_category_id] ?? DEFAULT_CAT;
          const videoTitle = video.video_title || video.title || 'Untitled Video';
          const channelTitle = video.channel_title || 'Unknown Channel';
          // handle different possible column names for view count
          const viewCount = video.video_view_count || video.view_count || video.views || video.total_views || 0;
          // handle different possible column names for engagement rating
          const engagement = video.engagement_rating || video.engagement_score || video.engagement || null;
          const displayRank = i + 1; // sequential numbering 1-10
          return (
            <div
              key={`${displayRank}-${videoTitle}`}
              className="bg-ge-surface border border-ge-border rounded-lg p-3 hover:border-ge-accent transition-colors animate-fade-in"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-start gap-2.5">
                <div className="shrink-0 w-7 h-7 rounded-md bg-ge-surface2 border border-ge-border flex items-center justify-center font-display font-bold text-[0.75rem] text-ge-accent">
                  {displayRank}
                </div>
                <div className="flex-1 min-w-0">
                  <VideoTitle title={videoTitle} />
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="text-[0.65rem] text-ge-dim truncate" title={channelTitle}>
                      {channelTitle}
                    </div>
                    <span
                      className="inline-block rounded px-1.5 py-0.5 text-[0.52rem] font-medium tracking-wide shrink-0"
                      style={{ background: cat.bg, border: `1px solid ${cat.border}`, color: cat.text }}
                    >
                      {video.video_category_id}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-4 mt-2.5 pt-2 border-t border-ge-border/50">
                <div>
                  <div className="text-[0.48rem] tracking-widest uppercase text-ge-muted">Total Views</div>
                  <div className="font-display font-bold text-[0.8rem] text-ge-accent">{formatViews(viewCount)}</div>
                </div>
                <div>
                  <div className="text-[0.48rem] tracking-widest uppercase text-ge-muted">Engagement Rating</div>
                  <div className="font-display font-bold text-[0.8rem] text-ge-text">{formatEngagement(engagement)}</div>
                </div>
                <div>
                  <div className="text-[0.48rem] tracking-widest uppercase text-ge-muted">Trending</div>
                  <div className="font-display font-bold text-[0.8rem] text-ge-text">{video.trending_appearances || 0}x</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
});
