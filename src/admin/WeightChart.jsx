// Line chart of daily weight + 7-day average, with a crosshair tooltip (mouse, touch and keyboard).
// Plain SVG, sized to its container. Colours are a validated pair (light & dark), not theme-derived,
// so the two series always stay distinguishable — including for colour-blind readers.
import { useEffect, useMemo, useRef, useState } from 'react';

const COLORS = {
  light: { daily: '#2563eb', trend: '#c2850c' },
  dark: { daily: '#5585f0', trend: '#b8820f' },
};
const H = 320;
const M = { top: 28, right: 16, bottom: 34, left: 46 };
const DAY = 86400000;

const parse = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
};
const fmt = (t, o) => new Date(t).toLocaleDateString(undefined, o);

/** ~5 "nice" ticks covering [lo, hi]. */
function niceTicks(lo, hi, count = 5) {
  const span = hi - lo || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= raw) ?? 10 * mag;
  const start = Math.floor(lo / step) * step;
  const ticks = [];
  for (let v = start; v <= hi + step * 0.5; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

function useWidth(ref) {
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function useScheme() {
  const read = () => (getComputedStyle(document.documentElement).colorScheme.includes('dark') ? 'dark' : 'light');
  const [s, setS] = useState(read);
  useEffect(() => {
    const mo = new MutationObserver(() => setS(read()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-theme'] });
    return () => mo.disconnect();
  }, []);
  return s;
}

export default function WeightChart({ data, from, to, onPick, base = null }) {
  const wrap = useRef(null);
  const width = useWidth(wrap);
  const scheme = useScheme();
  const c = COLORS[scheme];
  const [active, setActive] = useState(null); // index into data

  const g = useMemo(() => {
    if (!width) return null;
    const pts = data.map((d) => ({ ...d, t: parse(d.date) }));
    const x0 = parse(from);
    const x1 = Math.max(parse(to), x0 + DAY);
    const vals = pts.flatMap((p) => [p.weight, p.trend]);
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    // base = null → fit the data; a number → the y-axis starts exactly there (bar height = weight − base).
    const fixedBase = base != null && base < lo ? base : null;
    const pad = Math.max(0.5, (hi - (fixedBase ?? lo)) * (fixedBase == null ? 0.15 : 0.06));
    lo = fixedBase ?? lo - pad;
    hi += pad;
    let ticks = niceTicks(lo, hi);
    if (fixedBase != null) ticks = ticks.filter((v) => v >= fixedBase - 1e-9);
    if (fixedBase == null) lo = Math.min(lo, ticks[0]);
    hi = Math.max(hi, ticks.at(-1));
    const iw = width - M.left - M.right;
    const ih = H - M.top - M.bottom;
    const sx = (t) => M.left + ((t - x0) / (x1 - x0)) * iw;
    const sy = (v) => M.top + (1 - (v - lo) / (hi - lo)) * ih;

    // Line breaks across gaps longer than 7 days, so missing weeks aren't drawn as data.
    const path = (key) => {
      let d = '';
      pts.forEach((p, i) => {
        const gap = i > 0 && p.t - pts[i - 1].t > 7 * DAY;
        d += `${i === 0 || gap ? 'M' : 'L'}${sx(p.t).toFixed(1)},${sy(p[key]).toFixed(1)}`;
      });
      return d;
    };
    // Filled area from the base up to the daily line (one shape per unbroken run).
    const area = () => {
      if (fixedBase == null) return '';
      const yb = sy(fixedBase).toFixed(1);
      let d = '';
      let run = [];
      const flush = () => {
        if (run.length) d += `M${sx(run[0].t).toFixed(1)},${yb}` + run.map((p) => `L${sx(p.t).toFixed(1)},${sy(p.weight).toFixed(1)}`).join('') + `L${sx(run.at(-1).t).toFixed(1)},${yb}Z`;
        run = [];
      };
      pts.forEach((p, i) => {
        if (i > 0 && p.t - pts[i - 1].t > 7 * DAY) flush();
        run.push(p);
      });
      flush();
      return d;
    };

    // X ticks: evenly spaced dates, as many as fit (~90px apart).
    const n = Math.max(2, Math.min(8, Math.floor(iw / 90)));
    const spanDays = (x1 - x0) / DAY;
    const xo = spanDays > 300 ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' };
    const xticks = Array.from({ length: n }, (_, i) => x0 + ((x1 - x0) * i) / (n - 1));

    return { pts, sx, sy, ticks, xticks, xo, iw, ih, daily: path('weight'), trend: path('trend'), area: area(), dense: pts.length > 90 };
  }, [data, from, to, width, base]);

  // Keep the selection valid when the range changes.
  useEffect(() => setActive(null), [from, to]);

  function nearest(clientX) {
    const rect = wrap.current.getBoundingClientRect();
    const x = clientX - rect.left;
    let best = 0;
    let bd = Infinity;
    g.pts.forEach((p, i) => {
      const dd = Math.abs(g.sx(p.t) - x);
      if (dd < bd) {
        bd = dd;
        best = i;
      }
    });
    return best;
  }

  function onKey(e) {
    if (!g) return;
    const last = g.pts.length - 1;
    const moves = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity };
    if (e.key in moves) {
      e.preventDefault();
      setActive((a) => Math.max(0, Math.min(last, (a ?? last) + moves[e.key])));
    } else if (e.key === 'Enter' && active != null) onPick?.(g.pts[active].date);
    else if (e.key === 'Escape') setActive(null);
  }

  const p = g && active != null ? g.pts[active] : null;
  const diff = p?.prev ? p.weight - p.prev.weight : null;
  const tipLeft = p ? Math.min(Math.max(g.sx(p.t), 90), width - 90) : 0;

  return (
    <div className="wchart">
      <ul className="wchart-legend" aria-label="Legend">
        <li><svg width="22" height="10" aria-hidden="true"><line x1="1" y1="5" x2="21" y2="5" stroke={c.daily} strokeWidth="2" /><circle cx="11" cy="5" r="3.5" fill={c.daily} /></svg> Daily weight</li>
        <li><svg width="22" height="10" aria-hidden="true"><line x1="1" y1="5" x2="21" y2="5" stroke={c.trend} strokeWidth="3" strokeLinecap="round" /></svg> 7-day average</li>
      </ul>

      <div
        ref={wrap}
        className="wchart-plot"
        tabIndex={0}
        role="img"
        aria-label={`Weight chart, ${data.length} entries. Use left and right arrow keys to read values.`}
        onPointerMove={(e) => g && setActive(nearest(e.clientX))}
        onPointerDown={(e) => g && setActive(nearest(e.clientX))}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
        onClick={() => p && onPick?.(p.date)}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        {g && (
          <svg width={width} height={H} className="wchart-svg">
            {/* grid + y axis */}
            {g.ticks.map((v) => (
              <g key={v}>
                <line x1={M.left} x2={width - M.right} y1={g.sy(v)} y2={g.sy(v)} className="wchart-grid" />
                <text x={M.left - 8} y={g.sy(v)} className="wchart-tick" textAnchor="end" dominantBaseline="middle">
                  {Number.isInteger(v) ? v : v.toFixed(1)}
                </text>
              </g>
            ))}
            <text x={M.left - 8} y={M.top - 16} className="wchart-tick" textAnchor="end">kg</text>
            {/* x axis */}
            {g.xticks.map((t, i) => (
              <text key={t} x={g.sx(t)} y={H - 10} className="wchart-tick" textAnchor={i === 0 ? 'start' : i === g.xticks.length - 1 ? 'end' : 'middle'}>
                {fmt(t, g.xo)}
              </text>
            ))}

            {/* series */}
            {g.area && <path d={g.area} fill={c.daily} fillOpacity="0.12" stroke="none" />}
            <path d={g.daily} fill="none" stroke={c.daily} strokeWidth="1.5" strokeOpacity="0.55" strokeLinejoin="round" />
            <path d={g.trend} fill="none" stroke={c.trend} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
            {!g.dense &&
              g.pts.map((pt) => (
                <circle key={pt.date} cx={g.sx(pt.t)} cy={g.sy(pt.weight)} r="4" fill={c.daily} className="wchart-dot" />
              ))}

            {/* crosshair */}
            {p && (
              <g pointerEvents="none">
                <line x1={g.sx(p.t)} x2={g.sx(p.t)} y1={M.top} y2={H - M.bottom} className="wchart-cross" />
                <circle cx={g.sx(p.t)} cy={g.sy(p.trend)} r="5" fill={c.trend} className="wchart-dot" />
                <circle cx={g.sx(p.t)} cy={g.sy(p.weight)} r="6" fill={c.daily} className="wchart-dot" />
              </g>
            )}

            {/* last value label */}
            {!p && g.pts.length > 0 && (
              <text x={Math.min(g.sx(g.pts.at(-1).t), width - M.right)} y={g.sy(g.pts.at(-1).weight) - 12} textAnchor="end" className="wchart-label">
                {g.pts.at(-1).weight.toFixed(1)} kg
              </text>
            )}
          </svg>
        )}

        {p && (
          <div className="wchart-tip" style={{ left: tipLeft, top: Math.max(8, g.sy(Math.max(p.weight, p.trend)) - 96) }} role="status">
            <span className="wchart-tip-date">{fmt(p.t, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <span className="row"><i style={{ background: c.daily }} /><strong>{p.weight.toFixed(1)} kg</strong> daily</span>
            <span className="row"><i style={{ background: c.trend }} /><strong>{p.trend.toFixed(1)} kg</strong> 7-day avg</span>
            {diff != null && <span className="sub">{diff > 0 ? '+' : diff < 0 ? '−' : '±'}{Math.abs(diff).toFixed(1)} kg vs {fmt(parse(p.prev.date), { day: 'numeric', month: 'short' })}</span>}
          </div>
        )}
      </div>
      <p className="wchart-hint">Hover or tap the chart to read a day · click to edit it</p>
    </div>
  );
}
