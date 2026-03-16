import { useEffect, useRef, useCallback, useState } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import COUNTRIES from '../data/countries';

// Pre-compute mappings once at module load
const NUM_TO_ISO = {};
const NUM_TO_NAME = {};
COUNTRIES.forEach((c) => {
  NUM_TO_ISO[c.num] = c.iso;
  NUM_TO_NAME[c.num] = c.name;
});

export default function GlobeView({
  selectedIso,
  onCountryClick,
  flyTarget,
  sensitivity = 5,
  onFlyDone,
  showHints = true,
  onFirstInteraction,
  onExploreMore,
  showExploreMore = false,
}) {
  const areaRef = useRef(null);
  const svgRef = useRef(null);
  const tipRef = useRef(null);
  const [isExiting, setIsExiting] = useState(false);
  const stateRef = useRef({
    rotation: [0, -20, 0],
    isDragging: false,
    flyTimer: null,
    autoSpinTimer: null,
    hasInteracted: false,
    hoverIso: null,
    projection: null,
    path: null,
    radius: 0,
    activeIso: null,
    centroids: {},
  });

  const stopAutoSpin = useCallback(() => {
    const s = stateRef.current;
    if (s.autoSpinTimer) {
      s.autoSpinTimer.stop();
      s.autoSpinTimer = null;
    }
  }, []);

  const noteFirstInteraction = useCallback(() => {
    const s = stateRef.current;
    if (!s.hasInteracted) s.hasInteracted = true;
    stopAutoSpin();
    onFirstInteraction?.();
  }, [onFirstInteraction, stopAutoSpin]);

  const redraw = useCallback(() => {
    const s = stateRef.current;
    if (!s.projection || !svgRef.current) return;
    s.projection.rotate(s.rotation);
    s.path = d3.geoPath().projection(s.projection);
    const svg = d3.select(svgRef.current);
    svg.select('.ge-grat').attr('d', s.path);
    svg
      .selectAll('.ge-country')
      .attr('d', s.path)
      .attr('fill', (d) => {
        const iso = NUM_TO_ISO[d.id];
        if (!iso) return 'var(--ge-globe-land)';
        if (iso === s.activeIso) return 'var(--ge-globe-land-active)';
        if (iso === s.hoverIso) return 'var(--ge-globe-land-hover)';
        return 'var(--ge-globe-land)';
      });
  }, []);

  // Consolidated fly-to function that handles both ISO-based and coordinate-based flying
  const flyTo = useCallback(
    (target, onComplete) => {
      const s = stateRef.current;
      if (!target) return;

      let end;
      if (typeof target === 'string') {
        // iso-based fly
        if (!s.centroids[target]) return;
        const { lon, lat } = s.centroids[target];
        end = [-lon, -lat, 0];
      } else {
        // coordinate-based fly
        end = [-target.lon, -target.lat, 0];
      }

      if (s.flyTimer) s.flyTimer.stop();

      const start = [...s.rotation];
      const interp = d3.interpolate(start, end);

      let t0 = null;
      s.flyTimer = d3.timer((elapsed) => {
        if (!t0) t0 = elapsed;
        const t = Math.min(1, (elapsed - t0) / 1200);
        s.rotation = interp(d3.easeCubicInOut(t));
        redraw();
        if (t >= 1) {
          s.flyTimer.stop();
          s.flyTimer = null;
          s.hoverIso = null;
          redraw();
          onComplete?.();
        }
      });
    },
    [redraw]
  );

  const setupGlobe = useCallback(() => {
    const s = stateRef.current;
    const area = areaRef.current,
      svgEl = svgRef.current;
    if (!area || !svgEl) return;
    const w = area.clientWidth,
      h = area.clientHeight;
    // reserve space at the bottom for the hint row so it doesn't overlap the globe.
    // this keeps the globe visually centered within the remaining vertical space.
    const footerReservePx = 35;
    const hEff = Math.max(0, h - footerReservePx);

    s.radius = Math.min(w, hEff) * 0.42;
    const cx = w / 2;
    const cy = hEff / 2;

    const svg = d3.select(svgEl).attr('width', w).attr('height', h);
    svg.selectAll('*').remove();

    s.projection = d3
      .geoOrthographic()
      .scale(s.radius)
      .translate([cx, cy])
      .clipAngle(90)
      .rotate(s.rotation);
    s.path = d3.geoPath().projection(s.projection);

    const defs = svg.append('defs');
    const og = defs
      .append('radialGradient')
      .attr('id', 'ge-og')
      .attr('cx', '38%')
      .attr('cy', '36%');
    og.append('stop').attr('offset', '0%').attr('stop-color', 'var(--ge-globe-ocean-0)');
    og.append('stop').attr('offset', '100%').attr('stop-color', 'var(--ge-globe-ocean-1)');
    const ag = defs
      .append('radialGradient')
      .attr('id', 'ge-ag')
      .attr('cx', '50%')
      .attr('cy', '50%');
    ag.append('stop').attr('offset', '75%').attr('stop-color', 'transparent');
    ag.append('stop').attr('offset', '100%').attr('stop-color', 'var(--ge-globe-atmo)');
    const sg = defs
      .append('radialGradient')
      .attr('id', 'ge-sg')
      .attr('cx', '32%')
      .attr('cy', '28%');
    sg.append('stop').attr('offset', '0%').attr('stop-color', 'var(--ge-globe-sheen)');
    sg.append('stop').attr('offset', '60%').attr('stop-color', 'transparent');

    svg
      .append('circle')
      .attr('cx', cx)
      .attr('cy', cy)
      .attr('r', s.radius + 18)
      .attr('fill', 'none')
      .attr('stroke', 'var(--ge-globe-ring)')
      .attr('stroke-width', 18);
    svg
      .append('circle')
      .attr('cx', cx)
      .attr('cy', cy)
      .attr('r', s.radius)
      .attr('fill', 'url(#ge-og)');
    svg
      .append('path')
      .datum(d3.geoGraticule()())
      .attr('class', 'ge-grat')
      .attr('fill', 'none')
      .attr('stroke', 'var(--ge-globe-graticule)')
      .attr('stroke-width', 0.5)
      .attr('d', s.path)
      .attr('pointer-events', 'none');

    const g = svg.append('g').attr('id', 'ge-countries');

    svg
      .append('circle')
      .attr('cx', cx)
      .attr('cy', cy)
      .attr('r', s.radius)
      .attr('fill', 'url(#ge-ag)')
      .attr('pointer-events', 'none');
    svg
      .append('circle')
      .attr('cx', cx)
      .attr('cy', cy)
      .attr('r', s.radius)
      .attr('fill', 'url(#ge-sg)')
      .attr('pointer-events', 'none');

    // d3 drag on the svg for rotation
    svg.call(
      d3
        .drag()
        .on('start', (event) => {
          noteFirstInteraction();
          if (s.flyTimer) {
            s.flyTimer.stop();
            s.flyTimer = null;
          }
          s.isDragging = false;
          s._x0 = event.x;
          s._y0 = event.y;
          s._r0 = [...s.projection.rotate()];
        })
        .on('drag', (event) => {
          s.isDragging = true;
          const sens = 0.2 * Math.pow(15, sensitivity / 10);
          const dx = (event.x - s._x0) * sens * (180 / (Math.PI * s.radius));
          const dy = (event.y - s._y0) * sens * (180 / (Math.PI * s.radius));
          s.rotation = [s._r0[0] + dx, Math.max(-90, Math.min(90, s._r0[1] - dy)), s._r0[2]];
          redraw();
          if (tipRef.current) tipRef.current.style.opacity = '0';
        })
        .on('end', () => setTimeout(() => (s.isDragging = false), 50))
    );

    d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then((world) => {
      const features = topojson.feature(world, world.objects.countries).features;

      s.centroids = {};
      features.forEach((f) => {
        const iso = NUM_TO_ISO[f.id];
        if (!iso) return;
        const [lon, lat] = d3.geoCentroid(f);
        s.centroids[iso] = { lon, lat };
      });

      g.selectAll('.ge-country')
        .data(features)
        .enter()
        .append('path')
        .attr('class', 'ge-country')
        .attr('d', s.path)
        .attr('fill', (d) =>
          NUM_TO_ISO[d.id] === s.activeIso ? 'var(--ge-globe-land-active)' : 'var(--ge-globe-land)'
        )
        .attr('stroke', 'var(--ge-globe-stroke)')
        .attr('stroke-width', 0.5)
        .style('cursor', 'pointer')
        // ── use pointer events — d3 drag does not intercept these ──
        .on('pointerover', function (event, d) {
          if (s.isDragging || s.flyTimer) return;
          const iso = NUM_TO_ISO[d.id];
          const name = NUM_TO_NAME[d.id];
          if (!iso || !name) return;
          s.hoverIso = iso;
          redraw();
          const tip = tipRef.current;
          if (tip) {
            tip.style.opacity = '1';
            tip.style.left = event.offsetX + 14 + 'px';
            tip.style.top = event.offsetY - 34 + 'px';
            tip.textContent = name;
          }
        })
        .on('pointermove', function (event, d) {
          if (s.isDragging || s.flyTimer) return;
          const tip = tipRef.current;
          if (tip) {
            tip.style.left = event.offsetX + 14 + 'px';
            tip.style.top = event.offsetY - 34 + 'px';
          }
        })
        .on('pointerout', function (event, d) {
          const iso = NUM_TO_ISO[d.id];
          if (iso && s.hoverIso === iso) s.hoverIso = null;
          redraw();
          const tip = tipRef.current;
          if (tip) tip.style.opacity = '0';
        })
        .on('pointerup', function (event, d) {
          if (s.isDragging) return;
          const iso = NUM_TO_ISO[d.id];
          const name = NUM_TO_NAME[d.id];
          if (!iso || !name) return;
          // click implies intent; clear hover so it can't "stick" mid-fly
          s.hoverIso = null;
          noteFirstInteraction();
          onCountryClick(iso, name);
          flyTo(iso);
        });
    });
  }, [sensitivity, onCountryClick, noteFirstInteraction, redraw, flyTo]);

  useEffect(() => {
    setupGlobe();
  }, [setupGlobe]);

  useEffect(() => {
    const s = stateRef.current;
    // start a gentle idle spin on first load.
    // NOTE: In React 18 dev + StrictMode, effects run twice (mount→cleanup→mount).
    // don't "latch" a started flag across cleanup; instead, only avoid starting
    // when a timer is already running or the user has interacted.
    if (s.hasInteracted || s.autoSpinTimer) return;

    // degrees per millisecond. 0.001 => ~1 deg/sec at steady 60fps.
    const SPEED_DEG_PER_MS = 0.01;
    let lastElapsed = null;

    s.autoSpinTimer = d3.timer((elapsed) => {
      // permanently stop after any user interaction.
      if (s.hasInteracted) {
        stopAutoSpin();
        return;
      }
      // don't fight dragging or fly-to animations.
      if (s.isDragging || s.flyTimer) {
        lastElapsed = elapsed;
        return;
      }
      if (lastElapsed == null) {
        lastElapsed = elapsed;
        return;
      }
      const dt = elapsed - lastElapsed;
      lastElapsed = elapsed;
      // increase lambda to rotate left-to-right.
      s.rotation = [s.rotation[0] + dt * SPEED_DEG_PER_MS, s.rotation[1], s.rotation[2]];
      redraw();
    });

    return () => stopAutoSpin();
  }, [redraw, stopAutoSpin]);

  useEffect(() => {
    if (!flyTarget) return;
    // a search-triggered fly implies interaction; stop the idle spin.
    noteFirstInteraction();
    flyTo(flyTarget, onFlyDone);
  }, [flyTarget, flyTo, onFlyDone, noteFirstInteraction]);

  useEffect(() => {
    const obs = new ResizeObserver(() => setupGlobe());
    if (areaRef.current) obs.observe(areaRef.current);
    return () => obs.disconnect();
  }, [setupGlobe]);

  // Handle selectedIso changes: update active state, redraw, and optionally fly to it
  useEffect(() => {
    stateRef.current.activeIso = selectedIso;
    redraw();
    if (selectedIso) flyTo(selectedIso);
  }, [selectedIso, redraw, flyTo]);

  useEffect(() => {
    if (!showHints && !isExiting) {
      setIsExiting(true);
      const timer = setTimeout(() => setIsExiting(false), 400);
      return () => clearTimeout(timer);
    }
    if (showHints) {
      setIsExiting(false);
    }
  }, [showHints, isExiting]);

  const shouldShowHints = showHints || isExiting;

  return (
    <div
      ref={areaRef}
      className="ge-globe relative flex-1 overflow-hidden flex items-center justify-center select-none"
      style={{ background: 'var(--ge-globe-bg)' }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 'var(--ge-globe-stars-opacity)',
          backgroundImage:
            'radial-gradient(1px 1px at 10% 20%,rgba(255,255,255,.4) 0%,transparent 100%),radial-gradient(1px 1px at 30% 70%,rgba(255,255,255,.3) 0%,transparent 100%),radial-gradient(1px 1px at 55% 15%,rgba(255,255,255,.5) 0%,transparent 100%),radial-gradient(1px 1px at 75% 55%,rgba(255,255,255,.3) 0%,transparent 100%),radial-gradient(1px 1px at 88% 30%,rgba(255,255,255,.4) 0%,transparent 100%),radial-gradient(1px 1px at 20% 85%,rgba(255,255,255,.3) 0%,transparent 100%)',
        }}
      />

      <svg
        ref={svgRef}
        style={{ cursor: 'grab', filter: 'drop-shadow(0 0 50px var(--ge-globe-shadow))' }}
      />

      <div
        ref={tipRef}
        className="absolute pointer-events-none z-50 whitespace-nowrap opacity-0 transition-opacity duration-100 bg-ge-surface border border-ge-accent rounded px-3 py-1 font-display text-[0.78rem] font-semibold text-ge-accent"
        style={{ boxShadow: '0 0 16px rgba(56,189,248,.2)' }}
      />

      {shouldShowHints && (
        <div
          className={`ge-globe-hints absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-7 text-[0.85rem] text-ge-muted tracking-widest pointer-events-none uppercase font-semibold ${isExiting ? 'animate-hint-exit' : 'animate-hint-bounce'}`}
        >
          <span className="ge-hint-item">
            <span className="ge-hint-emoji">🖱️</span>
            <span>Drag to Rotate</span>
          </span>
          <span className="ge-hint-item">
            <span className="ge-hint-emoji">👆</span>
            <span>Click to Select</span>
          </span>
          <span className="ge-hint-item">
            <span className="ge-hint-emoji">🔍</span>
            <span>Search to Fly</span>
          </span>
        </div>
      )}

      {/* Add Explore More button when country is selected and has data.
          we only animate the "enter" state to avoid any flicker caused by
          brief hide/show cycles while data is loading. */}
      {selectedIso && onExploreMore && showExploreMore && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 pointer-events-none globe-explore-wrapper">
          <button
            onClick={onExploreMore}
            className={`bg-ge-surface border border-ge-accent text-ge-accent px-7 py-3 rounded-xl font-display font-semibold text-[1.05rem] tracking-wide uppercase shadow-xl hover:shadow-2xl pointer-events-auto globe-explore-button ${'animate-explore-enter hover:bg-ge-surface2 hover:border-ge-accent/80'}`}
            style={{ boxShadow: '0 0 28px rgba(56,189,248,0.35)' }}
          >
            Explore More
          </button>
        </div>
      )}
    </div>
  );
}
