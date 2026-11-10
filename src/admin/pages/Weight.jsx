// Weight tracker: log one weight per day, see how it moves over a chosen time range.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api.js';
import Icon from '../../shared/Icon.jsx';
import { cx } from '../../shared/utils.js';
import WeightChart from '../WeightChart.jsx';
import { ErrorBox, PageHeader, Spinner, useConfirm, useToast } from '../ui.jsx';

/* ------------------------------------------------------------------ date helpers (local calendar days) */

const pad = (n) => String(n).padStart(2, '0');
export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromKey = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const todayKey = () => toKey(new Date());
const fmtDay = (k, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => fromKey(k).toLocaleDateString(undefined, opts);
const kg = (n, digits = 1) => (n == null ? '—' : `${n.toFixed(digits)} kg`);

const RANGES = [
  { key: '7d', label: '7D', days: 7 },
  { key: '30d', label: '30D', days: 30 },
  { key: '90d', label: '3M', days: 90 },
  { key: '180d', label: '6M', days: 182 },
  { key: '1y', label: '1Y', days: 365 },
  { key: 'all', label: 'All' },
  { key: 'custom', label: 'Custom' },
];

/** 7-day rolling average: mean of all entries in the 7 calendar days ending on each entry's day. */
function withTrend(entries) {
  return entries.map((e, i) => {
    const start = toKey(addDays(fromKey(e.date), -6));
    let sum = 0;
    let n = 0;
    for (let j = i; j >= 0 && entries[j].date >= start; j--) {
      sum += entries[j].weight;
      n++;
    }
    return { ...e, trend: sum / n, prev: i > 0 ? entries[i - 1] : null };
  });
}

const RANGE_STORE = 'weight-range';
const BASE_STORE = 'weight-axis-base';
const readBase = () => {
  try {
    return localStorage.getItem(BASE_STORE) ?? '';
  } catch {
    return '';
  }
};
const readRange = () => {
  try {
    return JSON.parse(localStorage.getItem(RANGE_STORE)) || { key: '30d' };
  } catch {
    return { key: '30d' };
  }
};

export default function Weight() {
  const toast = useToast();
  const confirm = useConfirm();
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);
  const [range, setRangeState] = useState(readRange);
  const [form, setForm] = useState({ date: todayKey(), weight: '' });
  const [fieldErr, setFieldErr] = useState({});
  const [saving, setSaving] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [baseText, setBaseText] = useState(readBase); // '' = auto
  const setBase = (v) => {
    setBaseText(v);
    try {
      localStorage.setItem(BASE_STORE, v);
    } catch {
      /* storage unavailable */
    }
  };

  const setRange = (r) => {
    setRangeState(r);
    try {
      localStorage.setItem(RANGE_STORE, JSON.stringify(r));
    } catch {
      /* storage unavailable */
    }
  };

  const load = useCallback(() => {
    setError(null);
    api.weights().then((r) => setEntries(r.entries)).catch(setError);
  }, []);
  useEffect(load, [load]);

  const all = useMemo(() => (entries ? withTrend(entries) : []), [entries]);
  const byDate = useMemo(() => new Map(all.map((e) => [e.date, e])), [all]);

  // Visible window.
  const { from, to } = useMemo(() => {
    const end = todayKey();
    if (range.key === 'custom') return { from: range.from || all[0]?.date || end, to: range.to || end };
    if (range.key === 'all') return { from: all[0]?.date || end, to: all.at(-1)?.date > end ? all.at(-1).date : end };
    const days = RANGES.find((r) => r.key === range.key)?.days ?? 30;
    return { from: toKey(addDays(new Date(), -(days - 1))), to: end };
  }, [range, all]);
  const visible = useMemo(() => all.filter((e) => e.date >= from && e.date <= to), [all, from, to]);

  const stats = useMemo(() => {
    if (!visible.length) return null;
    const ws = visible.map((e) => e.weight);
    const first = visible[0];
    const last = visible.at(-1);
    const min = visible.reduce((a, b) => (b.weight < a.weight ? b : a));
    const max = visible.reduce((a, b) => (b.weight > a.weight ? b : a));
    const spanDays = Math.max(1, Math.round((fromKey(last.date) - fromKey(first.date)) / 86400000));
    return {
      latest: last,
      // Total change since the very first entry ever logged (not just the start of the selected range).
      change: last.weight - all[0].weight,
      start: all[0],
      perWeek: visible.length > 1 ? ((last.trend - first.trend) / spanDays) * 7 : null,
      avg: ws.reduce((a, b) => a + b, 0) / ws.length,
      min,
      max,
      count: visible.length,
      first,
    };
  }, [visible, all]);

  // Picking a date that already has an entry loads it into the form (so saving edits it).
  function pickDate(date) {
    const existing = byDate.get(date);
    setForm({ date, weight: existing ? String(existing.weight) : '' });
    setFieldErr({});
  }

  async function save(e) {
    e.preventDefault();
    const w = Number(form.weight);
    if (!form.weight || !Number.isFinite(w)) return setFieldErr({ weight: 'Enter your weight in kg.' });
    if (form.date > todayKey()) return setFieldErr({ date: 'That date is in the future.' });
    setSaving(true);
    setFieldErr({});
    try {
      const r = await api.saveWeight(form.date, { weight: w });
      setEntries((list) => [...(list ?? []).filter((x) => x.date !== r.entry.date), r.entry].sort((a, b) => a.date.localeCompare(b.date)));
      toast(r.created ? `Logged ${kg(r.entry.weight)} for ${fmtDay(r.entry.date)}` : `Updated ${fmtDay(r.entry.date)}`);
      // Ready for the next day's entry.
      const next = toKey(addDays(fromKey(form.date), 1));
      if (next <= todayKey() && !byDate.has(next)) setForm({ date: next, weight: '' });
      else setForm((f) => ({ ...f, weight: String(r.entry.weight) }));
    } catch (err) {
      setFieldErr(err.fields ?? {});
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove(entry) {
    const ok = await confirm({ title: 'Delete this entry?', message: `${kg(entry.weight)} on ${fmtDay(entry.date)} will be removed.`, confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await api.deleteWeight(entry.date);
      setEntries((list) => list.filter((x) => x.date !== entry.date));
      if (form.date === entry.date) setForm({ date: entry.date, weight: '' });
      toast('Entry deleted');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const editing = byDate.has(form.date);
  const lowest = visible.length ? Math.min(...visible.flatMap((e) => [e.weight, e.trend])) : null;
  const baseNum = baseText === '' ? null : Number(baseText);
  const baseError = baseNum != null && (!Number.isFinite(baseNum) || baseNum < 0) ? 'Enter 0 or more.' : baseNum != null && lowest != null && baseNum >= lowest ? `Must be below ${Math.floor(lowest * 10) / 10} kg (your lowest in this range).` : '';
  const base = baseNum != null && !baseError ? baseNum : null;

  return (
    <div className="page weight-page">
      <PageHeader title="Weight" subtitle="Log your weight each day and watch the trend." icon="scale" accent="pink" />
      {error && <ErrorBox error={error} onRetry={load} />}
      {!entries && !error && <Spinner />}

      {entries && (
        <>
          <form className="card form-card weight-form" onSubmit={save} noValidate>
            <div className={cx('afield', fieldErr.date && 'has-error')}>
              <label htmlFor="w-date">Date</label>
              <input id="w-date" type="date" className="ainput" value={form.date} max={todayKey()} onChange={(e) => e.target.value && pickDate(e.target.value)} />
              {fieldErr.date && <span className="err">{fieldErr.date}</span>}
            </div>
            <div className={cx('afield', fieldErr.weight && 'has-error')}>
              <label htmlFor="w-kg">Weight (kg)</label>
              <input
                id="w-kg"
                className="ainput"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="20"
                max="400"
                placeholder={all.at(-1) ? String(all.at(-1).weight) : 'e.g. 72.4'}
                value={form.weight}
                onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
                autoFocus
              />
              {fieldErr.weight && <span className="err">{fieldErr.weight}</span>}
            </div>
            <button className="abtn abtn-primary weight-save" disabled={saving}>
              {saving ? 'Saving…' : <><Icon name={editing ? 'check' : 'plus'} size={16} /> {editing ? 'Update' : 'Log weight'}</>}
            </button>
          </form>

          <div className="weight-toolbar">
            <div className="tabs" role="tablist" aria-label="Time range">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  role="tab"
                  aria-selected={range.key === r.key}
                  className={cx('tab', range.key === r.key && 'on')}
                  onClick={() => setRange(r.key === 'custom' ? { key: 'custom', from, to } : { key: r.key })}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {range.key === 'custom' && (
              <div className="weight-custom">
                <input type="date" className="ainput" aria-label="From" value={from} max={to} onChange={(e) => e.target.value && setRange({ ...range, from: e.target.value })} />
                <span>to</span>
                <input type="date" className="ainput" aria-label="To" value={to} min={from} onChange={(e) => e.target.value && setRange({ ...range, to: e.target.value })} />
              </div>
            )}
            <span className="weight-span">{fmtDay(from)} – {fmtDay(to)}</span>
          </div>

          {stats ? (
            <div className="weight-stats">
              <Stat label="Latest" value={kg(stats.latest.weight)} sub={fmtDay(stats.latest.date, { day: 'numeric', month: 'short' })} />
              <Stat
                label="Change"
                value={`${stats.change > 0 ? '+' : stats.change < 0 ? '−' : '±'}${Math.abs(stats.change).toFixed(1)} kg`}
                sub={`since ${fmtDay(stats.start.date)} (${kg(stats.start.weight)})`}
                icon={stats.change > 0.05 ? 'trend-up' : stats.change < -0.05 ? 'trend-down' : null}
              />
              <Stat label="Weekly trend" value={stats.perWeek == null ? '—' : `${stats.perWeek > 0 ? '+' : stats.perWeek < 0 ? '−' : ''}${Math.abs(stats.perWeek).toFixed(2)} kg`} sub="per week (7-day avg)" />
              <Stat label="Average" value={kg(stats.avg)} sub={`${stats.count} ${stats.count === 1 ? 'entry' : 'entries'}`} />
              <Stat label="Lowest" value={kg(stats.min.weight)} sub={fmtDay(stats.min.date, { day: 'numeric', month: 'short' })} />
              <Stat label="Highest" value={kg(stats.max.weight)} sub={fmtDay(stats.max.date, { day: 'numeric', month: 'short' })} />
            </div>
          ) : null}

          <section className="card weight-chart-card">
            <div className="card-head">
              <h2><Icon name="chart" size={18} /> Daily weight</h2>
              <div className="axis-base">
                <label htmlFor="w-base">Y-axis starts at</label>
                <div className="axis-base-ctl">
                  <button type="button" className={cx('chip-btn', baseText === '' && 'on')} onClick={() => setBase('')}>Auto</button>
                  <button type="button" className={cx('chip-btn', baseText === '0' && 'on')} onClick={() => setBase('0')}>0</button>
                  <span className={cx('axis-base-input', baseError && 'has-error')}>
                    <input id="w-base" type="number" inputMode="decimal" min="0" step="1" placeholder="Auto" value={baseText} onChange={(e) => setBase(e.target.value)} aria-describedby="w-base-err" />
                    <em>kg</em>
                  </span>
                </div>
              </div>
            </div>
            {baseError && <p id="w-base-err" className="axis-base-err">{baseError} Showing auto for now.</p>}
            {visible.length ? (
              <WeightChart data={visible} from={from} to={to} base={base} onPick={(d) => pickDate(d)} />
            ) : (
              <p className="weight-empty">
                {all.length ? 'No entries in this range — pick a wider range or log a weight above.' : 'No entries yet. Log today’s weight above and your chart starts here.'}
              </p>
            )}
          </section>

          {visible.length > 0 && (
            <section className="card">
              <div className="card-head">
                <h2><Icon name="list" size={18} /> Entries</h2>
                <span className="help">{visible.length} in range</span>
              </div>
              <div className="weight-table-wrap">
                <table className="weight-table">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col" className="num">Weight</th>
                      <th scope="col" className="num">vs previous</th>
                      <th scope="col" className="num">7-day avg</th>
                      <th scope="col"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...visible].reverse().slice(0, showAll ? undefined : 14).map((e) => {
                      const diff = e.prev ? e.weight - e.prev.weight : null;
                      return (
                        <tr key={e.date} className={cx(form.date === e.date && 'on')}>
                          <td>{fmtDay(e.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</td>
                          <td className="num strong">{e.weight.toFixed(1)}</td>
                          <td className="num">{diff == null ? '—' : `${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${Math.abs(diff).toFixed(1)}`}</td>
                          <td className="num">{e.trend.toFixed(1)}</td>
                          <td className="acts">
                            <button type="button" className="icon-btn" onClick={() => { pickDate(e.date); window.scrollTo({ top: 0, behavior: 'smooth' }); }} aria-label={`Edit ${fmtDay(e.date)}`}>
                              <Icon name="edit" size={16} />
                            </button>
                            <button type="button" className="icon-btn danger" onClick={() => remove(e)} aria-label={`Delete ${fmtDay(e.date)}`}>
                              <Icon name="trash" size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {visible.length > 14 && (
                <div className="weight-more">
                  <button type="button" className="abtn abtn-sm" onClick={() => setShowAll((v) => !v)}>
                    {showAll ? 'Show latest 14' : `Show all ${visible.length} entries`}
                  </button>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub, icon }) {
  return (
    <div className="card weight-stat">
      <span className="k">{label}</span>
      <strong className="v">
        {icon && <Icon name={icon} size={18} />}
        {value}
      </strong>
      {sub && <span className="s">{sub}</span>}
    </div>
  );
}
