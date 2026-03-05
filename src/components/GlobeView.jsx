import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import COUNTRIES from '../data/countries';

const NUM_TO_ISO  = {};
const NUM_TO_NAME = {};
COUNTRIES.forEach(c => {
  NUM_TO_ISO[c.num]  = c.iso;
  NUM_TO_NAME[c.num] = c.name;
});

export default function GlobeView({ selectedIso, onCountryClick, flyTarget, sensitivity = 5, onFlyDone }) {
  const areaRef  = useRef(null);
  const svgRef   = useRef(null);
  const tipRef   = useRef(null);
  const stateRef = useRef({
    rotation: [0, -20, 0], isDragging: false, flyTimer: null,
    projection: null, path: null, radius: 0, activeIso: null,
  });

  const redraw = useCallback(() => {
    const s = stateRef.current;
    if (!s.projection || !svgRef.current) return;
    s.projection.rotate(s.rotation);
    s.path = d3.geoPath().projection(s.projection);
    const svg = d3.select(svgRef.current);
    svg.select('.ge-grat').attr('d', s.path);
    svg.selectAll('.ge-country')
      .attr('d', s.path)
      .attr('fill', d => NUM_TO_ISO[d.id] === s.activeIso ? '#38bdf8' : '#1a3a5c');
  }, []);

  const setupGlobe = useCallback(() => {
    const s = stateRef.current;
    const area = areaRef.current, svgEl = svgRef.current;
    if (!area || !svgEl) return;
    const w = area.clientWidth, h = area.clientHeight;
    s.radius = Math.min(w, h) * 0.42;

    const svg = d3.select(svgEl).attr('width', w).attr('height', h);
    svg.selectAll('*').remove();

    s.projection = d3.geoOrthographic()
      .scale(s.radius).translate([w/2, h/2])
      .clipAngle(90).rotate(s.rotation);
    s.path = d3.geoPath().projection(s.projection);

    const defs = svg.append('defs');
    const og = defs.append('radialGradient').attr('id','ge-og').attr('cx','38%').attr('cy','36%');
    og.append('stop').attr('offset','0%').attr('stop-color','#0d2545');
    og.append('stop').attr('offset','100%').attr('stop-color','#040d1e');
    const ag = defs.append('radialGradient').attr('id','ge-ag').attr('cx','50%').attr('cy','50%');
    ag.append('stop').attr('offset','75%').attr('stop-color','transparent');
    ag.append('stop').attr('offset','100%').attr('stop-color','rgba(56,189,248,0.13)');
    const sg = defs.append('radialGradient').attr('id','ge-sg').attr('cx','32%').attr('cy','28%');
    sg.append('stop').attr('offset','0%').attr('stop-color','rgba(255,255,255,0.07)');
    sg.append('stop').attr('offset','60%').attr('stop-color','transparent');

    svg.append('circle').attr('cx',w/2).attr('cy',h/2).attr('r',s.radius+18)
      .attr('fill','none').attr('stroke','rgba(56,189,248,0.06)').attr('stroke-width',18);
    svg.append('circle').attr('cx',w/2).attr('cy',h/2).attr('r',s.radius)
      .attr('fill','url(#ge-og)');
    svg.append('path').datum(d3.geoGraticule()())
      .attr('class','ge-grat').attr('fill','none')
      .attr('stroke','rgba(56,189,248,0.06)').attr('stroke-width',.5)
      .attr('d', s.path).attr('pointer-events','none');

    const g = svg.append('g').attr('id','ge-countries');

    svg.append('circle').attr('cx',w/2).attr('cy',h/2).attr('r',s.radius)
      .attr('fill','url(#ge-ag)').attr('pointer-events','none');
    svg.append('circle').attr('cx',w/2).attr('cy',h/2).attr('r',s.radius)
      .attr('fill','url(#ge-sg)').attr('pointer-events','none');

    // D3 drag on the SVG for rotation
    svg.call(d3.drag()
      .on('start', event => {
        if (s.flyTimer) { s.flyTimer.stop(); s.flyTimer = null; }
        s.isDragging = false;
        s._x0 = event.x; s._y0 = event.y;
        s._r0 = [...s.projection.rotate()];
      })
      .on('drag', event => {
        s.isDragging = true;
        const sens = 0.2 * Math.pow(15, (sensitivity - 1) / 9);
        const dx = (event.x - s._x0) * sens * (180 / (Math.PI * s.radius));
        const dy = (event.y - s._y0) * sens * (180 / (Math.PI * s.radius));
        s.rotation = [s._r0[0] + dx, Math.max(-90, Math.min(90, s._r0[1] - dy)), s._r0[2]];
        redraw();
        if (tipRef.current) tipRef.current.style.opacity = '0';
      })
      .on('end', () => setTimeout(() => s.isDragging = false, 50))
    );

    d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(world => {
      const features = topojson.feature(world, world.objects.countries).features;

      g.selectAll('.ge-country')
        .data(features)
        .enter().append('path')
        .attr('class','ge-country')
        .attr('d', s.path)
        .attr('fill', d => NUM_TO_ISO[d.id] === s.activeIso ? '#38bdf8' : '#1a3a5c')
        .attr('stroke','#060f1e')
        .attr('stroke-width', .5)
        .style('cursor','pointer')
        // ── Use pointer events — D3 drag does not intercept these ──
        .on('pointerover', function(event, d) {
          if (s.isDragging) return;
          const iso  = NUM_TO_ISO[d.id];
          const name = NUM_TO_NAME[d.id];
          if (!iso || !name) return;
          d3.select(this).attr('fill', iso === s.activeIso ? '#38bdf8' : '#2563eb');
          const tip = tipRef.current;
          if (tip) {
            tip.style.opacity = '1';
            tip.style.left = (event.offsetX + 14) + 'px';
            tip.style.top  = (event.offsetY - 34) + 'px';
            tip.textContent = name;
          }
        })
        .on('pointermove', function(event, d) {
          if (s.isDragging) return;
          const tip = tipRef.current;
          if (tip) {
            tip.style.left = (event.offsetX + 14) + 'px';
            tip.style.top  = (event.offsetY - 34) + 'px';
          }
        })
        .on('pointerout', function(event, d) {
          const iso = NUM_TO_ISO[d.id];
          d3.select(this).attr('fill', iso === s.activeIso ? '#38bdf8' : '#1a3a5c');
          const tip = tipRef.current;
          if (tip) tip.style.opacity = '0';
        })
        .on('pointerup', function(event, d) {
          if (s.isDragging) return;
          const iso  = NUM_TO_ISO[d.id];
          const name = NUM_TO_NAME[d.id];
          if (!iso || !name) return;
          onCountryClick(iso, name);
        });
    });
  }, [sensitivity, onCountryClick, redraw]);

  useEffect(() => { setupGlobe(); }, [setupGlobe]);

  useEffect(() => {
    stateRef.current.activeIso = selectedIso;
    redraw();
  }, [selectedIso, redraw]);

  useEffect(() => {
    if (!flyTarget) return;
    const s = stateRef.current;
    if (s.flyTimer) s.flyTimer.stop();
    const start  = [...s.rotation];
    const end    = [-flyTarget.lon, -flyTarget.lat, 0];
    const interp = d3.interpolate(start, end);
    let t0 = null;
    s.flyTimer = d3.timer(elapsed => {
      if (!t0) t0 = elapsed;
      const t = Math.min(1, (elapsed - t0) / 1200);
      s.rotation = interp(d3.easeCubicInOut(t));
      redraw();
      if (t >= 1) { s.flyTimer.stop(); s.flyTimer = null; onFlyDone?.(); }
    });
  }, [flyTarget, redraw, onFlyDone]);

  useEffect(() => {
    const obs = new ResizeObserver(() => setupGlobe());
    if (areaRef.current) obs.observe(areaRef.current);
    return () => obs.disconnect();
  }, [setupGlobe]);

  return (
    <div
      ref={areaRef}
      className="relative flex-1 overflow-hidden flex items-center justify-center select-none"
      style={{ background: 'radial-gradient(ellipse at 40% 40%, #070f1e, #02050a)' }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(1px 1px at 10% 20%,rgba(255,255,255,.4) 0%,transparent 100%),radial-gradient(1px 1px at 30% 70%,rgba(255,255,255,.3) 0%,transparent 100%),radial-gradient(1px 1px at 55% 15%,rgba(255,255,255,.5) 0%,transparent 100%),radial-gradient(1px 1px at 75% 55%,rgba(255,255,255,.3) 0%,transparent 100%),radial-gradient(1px 1px at 88% 30%,rgba(255,255,255,.4) 0%,transparent 100%),radial-gradient(1px 1px at 20% 85%,rgba(255,255,255,.3) 0%,transparent 100%)' }} />

      <svg ref={svgRef} style={{ cursor: 'grab', filter: 'drop-shadow(0 0 50px rgba(56,189,248,0.08))' }} />

      <div
        ref={tipRef}
        className="absolute pointer-events-none z-50 whitespace-nowrap opacity-0 transition-opacity duration-100 bg-ge-surface border border-ge-accent rounded px-3 py-1 font-display text-[0.78rem] font-semibold text-ge-accent"
        style={{ boxShadow: '0 0 16px rgba(56,189,248,.2)' }}
      />

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-5 text-[0.58rem] text-ge-muted tracking-widest pointer-events-none uppercase">
        <span>🖱️ Drag to Rotate</span>
        <span>👆 Click to Select</span>
        <span>🔍 Search to Fly</span>
      </div>
    </div>
  );
}