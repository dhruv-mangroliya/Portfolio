// Monthly income bar chart (one bar per month, months with nothing logged show as empty slots),
// with a dashed average line and a hover / keyboard tooltip. Plain SVG, sized to its container.
import { useEffect, useMemo, useRef, useState } from 'react';

const H = 300;
const M = { top: 20, right: 64, bottom: 34, left: 60 };

/** Round tick step (1, 2, 2.5 or 5 × 10ⁿ) giving about 4 intervals up to v. */
function niceStep(v) {
  if (v <= 0) return 1;
  const raw = v / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= raw);
}
/** ₹ in short Indian units for axis labels: 85K, 1.2L, 3Cr. */
export const inrShort = (n) => {
  const a = Math.abs(n);
  if (a >= 1e7) return `₹${+(n / 1e7).toFixed(a >= 1e8 ? 0 : 1)}Cr`;
  if (a >= 1e5) return `₹${+(n / 1e5).toFixed(a >= 1e6 ? 0 : 1)}L`;
  if (a >= 1e3) return `₹${+(n / 1e3).toFixed(a >= 1e4 ? 0 : 1)}K`;
  return `₹${Math.round(n)}`;
};

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

/** data: [{ month: 'YYYY-MM', label: 'Oct 2025', short: 'Oct', total: number, sources: [[name, amount]] }] */
export default function IncomeChart({ data, average, inr }) {
  const wrap = useRef(null);
  const width = useWidth(wrap);
  const [active, setActive] = useState(null);

  const g = useMemo(() => {
    if (!width || !data.length) return null;
    const top = Math.max(...data.map((d) => d.total), average || 0) * 1.05;
    const step = niceStep(top);
    const max = Math.ceil(top / step) * step || step;
    const iw = width - M.left - M.right;
    const ih = H - M.top - M.bottom;
    const slot = iw / data.length;
    const gap = Math.min(2 + slot * 0.25, 18);
    const bw = Math.max(2, Math.min(56, slot - gap));
    const x = (i) => M.left + i * slot + (slot - bw) / 2;
    const y = (v) => M.top + ih - (v / max) * ih;
    const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
    // Label every Nth month so labels never collide (~56px each).
    const every = Math.max(1, Math.ceil(56 / slot));
    return { max, iw, ih, slot, bw, x, y, ticks, every };
  }, [width, data, average]);

  useEffect(() => setActive(null), [data]);

  function onKey(e) {
    if (!data.length) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const d = e.key === 'ArrowRight' ? 1 : -1;
      setActive((a) => Math.max(0, Math.min(data.length - 1, (a ?? (d > 0 ? -1 : data.length)) + d)));
    } else if (e.key === 'Escape') setActive(null);
  }

  const p = g && active != null ? data[active] : null;
  const tipX = p ? Math.min(Math.max(g.x(active) + g.bw / 2, 100), width - 100) : 0;

  return (
    <div
      ref={wrap}
      className="ichart"
      tabIndex={0}
      role="img"
      aria-label={`Monthly income chart, ${data.length} months. Use left and right arrow keys to read each month.`}
      onKeyDown={onKey}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
      onBlur={() => setActive(null)}
    >
      {g && (
        <svg width={width} height={H} className="ichart-svg">
          {g.ticks.map((v) => (
            <g key={v}>
              <line x1={M.left} x2={width - M.right} y1={g.y(v)} y2={g.y(v)} className="ichart-grid" />
              <text x={M.left - 10} y={g.y(v)} className="ichart-tick" textAnchor="end" dominantBaseline="middle">{inrShort(v)}</text>
            </g>
          ))}

          {data.map((d, i) => {
            const h = Math.max(0, g.y(0) - g.y(d.total));
            const r = Math.min(4, g.bw / 2, h);
            const x0 = g.x(i);
            const yTop = g.y(d.total);
            // Rounded top corners only; square at the baseline.
            const path = h > 0
              ? `M${x0},${g.y(0)}V${yTop + r}Q${x0},${yTop} ${x0 + r},${yTop}H${x0 + g.bw - r}Q${x0 + g.bw},${yTop} ${x0 + g.bw},${yTop + r}V${g.y(0)}Z`
              : '';
            return (
              <g key={d.month}>
                {/* hit area: the whole column, wider than the bar */}
                <rect x={M.left + i * g.slot} y={M.top} width={g.slot} height={g.ih} fill="transparent" onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)} />
                {h > 0 ? (
                  <path d={path} className={`ichart-bar${active === i ? ' on' : ''}`} pointerEvents="none" />
                ) : (
                  <line x1={x0} x2={x0 + g.bw} y1={g.y(0) - 1} y2={g.y(0) - 1} className="ichart-empty" pointerEvents="none" />
                )}
                {i % g.every === 0 && (
                  <text x={x0 + g.bw / 2} y={H - 12} className="ichart-tick" textAnchor="middle">
                    {d.short}
                  </text>
                )}
              </g>
            );
          })}

          {average > 0 && (
            <g pointerEvents="none">
              <line x1={M.left} x2={width - M.right} y1={g.y(average)} y2={g.y(average)} className="ichart-avg" />
              <text x={width - M.right + 8} y={g.y(average) - 7} className="ichart-avg-label">Avg</text>
              <text x={width - M.right + 8} y={g.y(average) + 8} className="ichart-avg-label">{inrShort(average)}</text>
            </g>
          )}
          <line x1={M.left} x2={width - M.right} y1={g.y(0)} y2={g.y(0)} className="ichart-base" />
        </svg>
      )}

      {p && (
        <div className="ichart-tip" style={{ left: tipX, top: Math.max(4, g.y(p.total) - 12) }} role="status">
          <span className="d">{p.label}</span>
          <strong>{inr(p.total)}</strong>
          {p.sources.length > 1 && p.sources.map(([name, amt]) => <span key={name} className="row">{name} <b>{inr(amt)}</b></span>)}
          {p.total === 0 && <span className="row">Nothing logged</span>}
          {average > 0 && p.total > 0 && <span className="row muted">{p.total >= average ? '+' : '−'}{inr(Math.round(Math.abs(p.total - average)))} vs average</span>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ two-year comparison */

// Validated pair (CVD-safe, ≥3:1 on the surface) — light and dark variants.
const PAIR = { light: ['#2563eb', '#c2850c'], dark: ['#5585f0', '#b8820f'] };
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
export const usePairColors = () => PAIR[useScheme()];

/** rows: [{ label: 'Jan', long: 'January', a: number, b: number }] for 12 months; years: [A, B] */
export function CompareChart({ rows, years, inr }) {
  const wrap = useRef(null);
  const width = useWidth(wrap);
  const colors = usePairColors();
  const [active, setActive] = useState(null);
  const CM = { top: 16, right: 12, bottom: 34, left: 60 };

  const g = useMemo(() => {
    if (!width) return null;
    const top = Math.max(1, ...rows.flatMap((r) => [r.a, r.b])) * 1.05;
    const step = niceStep(top);
    const max = Math.ceil(top / step) * step || step;
    const iw = width - CM.left - CM.right;
    const ih = H - CM.top - CM.bottom;
    const slot = iw / rows.length;
    const groupW = Math.min(64, slot * 0.78);
    const bw = Math.max(2, (groupW - 2) / 2); // 2px gap between the pair
    const x = (i) => CM.left + i * slot + (slot - groupW) / 2;
    const y = (v) => CM.top + ih - (v / max) * ih;
    const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
    return { slot, bw, x, y, ticks, ih, every: Math.max(1, Math.ceil(36 / slot)) };
  }, [width, rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const bar = (x0, v, cls, color) => {
    const yTop = g.y(v);
    const h = g.y(0) - yTop;
    if (h <= 0) return <line x1={x0} x2={x0 + g.bw} y1={g.y(0) - 1} y2={g.y(0) - 1} className="ichart-empty" />;
    const r = Math.min(4, g.bw / 2, h);
    return (
      <path
        className={cls}
        fill={color}
        d={`M${x0},${g.y(0)}V${yTop + r}Q${x0},${yTop} ${x0 + r},${yTop}H${x0 + g.bw - r}Q${x0 + g.bw},${yTop} ${x0 + g.bw},${yTop + r}V${g.y(0)}Z`}
      />
    );
  };

  function onKey(e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const d = e.key === 'ArrowRight' ? 1 : -1;
      setActive((a) => Math.max(0, Math.min(rows.length - 1, (a ?? (d > 0 ? -1 : rows.length)) + d)));
    } else if (e.key === 'Escape') setActive(null);
  }

  const p = g && active != null ? rows[active] : null;
  const tipX = p ? Math.min(Math.max(g.x(active) + g.bw, 100), width - 100) : 0;

  return (
    <>
      <ul className="cchart-legend" aria-label="Legend">
        <li><i style={{ background: colors[0] }} /> {years[0]}</li>
        <li><i style={{ background: colors[1] }} /> {years[1]}</li>
      </ul>
      <div
        ref={wrap}
        className="ichart"
        tabIndex={0}
        role="img"
        aria-label={`Monthly income, ${years[0]} compared with ${years[1]}. Use left and right arrow keys to read each month.`}
        onKeyDown={onKey}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
        onBlur={() => setActive(null)}
      >
        {g && (
          <svg width={width} height={H} className="ichart-svg">
            {g.ticks.map((v) => (
              <g key={v}>
                <line x1={CM.left} x2={width - CM.right} y1={g.y(v)} y2={g.y(v)} className="ichart-grid" />
                <text x={CM.left - 10} y={g.y(v)} className="ichart-tick" textAnchor="end" dominantBaseline="middle">{inrShort(v)}</text>
              </g>
            ))}
            {rows.map((r, i) => (
              <g key={r.label} className={active === i ? 'cchart-on' : undefined}>
                {active === i && <rect x={CM.left + i * g.slot} y={CM.top} width={g.slot} height={g.ih} className="cchart-hover" />}
                {bar(g.x(i), r.a, 'cchart-bar', colors[0])}
                {bar(g.x(i) + g.bw + 2, r.b, 'cchart-bar', colors[1])}
                <rect x={CM.left + i * g.slot} y={CM.top} width={g.slot} height={g.ih} fill="transparent" onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)} />
                {i % g.every === 0 && <text x={g.x(i) + g.bw + 1} y={H - 12} className="ichart-tick" textAnchor="middle">{r.label}</text>}
              </g>
            ))}
            <line x1={CM.left} x2={width - CM.right} y1={g.y(0)} y2={g.y(0)} className="ichart-base" />
          </svg>
        )}
        {p && (
          <div className="ichart-tip" style={{ left: tipX, top: Math.max(4, g.y(Math.max(p.a, p.b)) - 12) }} role="status">
            <span className="d">{p.long}</span>
            <span className="row key"><span><i style={{ background: colors[0] }} />{years[0]}</span> <b>{p.a ? inr(p.a) : '—'}</b></span>
            <span className="row key"><span><i style={{ background: colors[1] }} />{years[1]}</span> <b>{p.b ? inr(p.b) : '—'}</b></span>
            {p.a > 0 && p.b > 0 && (
              <span className="row muted">
                {years[1]} vs {years[0]} <b>{p.b >= p.a ? '+' : '−'}{inr(Math.abs(p.b - p.a))}</b>
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );
}
