// "The Secret": a habit you allow yourself once a day for a year (365 tickets from a start date).
// Every use spends a ticket. The balance = days so far − uses so far; using it twice in a day puts you
// below 0, and you get back by skipping later days. Locked behind the same passcode as Money.
import { useEffect, useMemo, useState } from 'react';
import { api, setMoneyPasscode } from '../../api.js';
import Icon from '../../shared/Icon.jsx';
import { cx } from '../../shared/utils.js';
import { PageHeader, useConfirm, useToast } from '../ui.jsx';
import { PasscodeLock } from './Money.jsx';

/* ------------------------------------------------------------------ dates (local calendar days) */

const pad = (n) => String(n).padStart(2, '0');
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = fromKey(k); d.setDate(d.getDate() + n); return toKey(d); };
const diffDays = (a, b) => Math.round((fromKey(b) - fromKey(a)) / 86_400_000); // b − a
const todayKey = () => toKey(new Date());
const fmt = (k, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => fromKey(k).toLocaleDateString(undefined, opts);

const SELECTED_KEY = 'admin-secret-habit';
const store = {
  get: () => { try { return localStorage.getItem(SELECTED_KEY); } catch { return null; } },
  set: (v) => { try { localStorage.setItem(SELECTED_KEY, v); } catch { /* private mode */ } },
};

/** Everything shown for a tracker, as of `today`. */
function summarize(h, today = todayKey()) {
  const end = addDays(h.startDate, h.days - 1);
  const counts = h.counts || {};
  const used = Object.values(counts).reduce((a, n) => a + n, 0);
  const upto = today < h.startDate ? null : today > end ? end : today;
  const earned = upto ? diffDays(h.startDate, upto) + 1 : 0; // tickets unlocked so far (1 per day)
  const usedSoFar = upto ? Object.entries(counts).reduce((a, [k, n]) => (k <= upto ? a + n : a), 0) : 0;
  return {
    end,
    used,
    left: h.days - used,
    earned,
    balance: earned - usedSoFar, // < 0 → over budget, skip days to get back
    usedToday: counts[today] || 0,
    status: today < h.startDate ? 'upcoming' : today > end ? 'finished' : 'active',
  };
}

/* ------------------------------------------------------------------ page */

export default function Secret() {
  const [habits, setHabits] = useState(null);
  useEffect(() => () => setMoneyPasscode(''), []); // forget the passcode when leaving
  if (!habits)
    return (
      <PasscodeLock
        title="The Secret"
        subtitle="One allowance a day for a whole year."
        icon="lock"
        accent="violet"
        load={async () => (await api.secret()).habits}
        onUnlock={setHabits}
      />
    );
  return <SecretPage habits={habits} setHabits={setHabits} onLock={() => { setMoneyPasscode(''); setHabits(null); }} />;
}

function SecretPage({ habits, setHabits, onLock }) {
  const toast = useToast();
  const [selected, setSelected] = useState(store.get);
  const [adding, setAdding] = useState(false);
  const pick = (id) => { setSelected(id); store.set(id); };
  const current = habits.find((h) => h.id === selected) ?? habits[0];
  const replace = (h) => setHabits((list) => list.map((x) => (x.id === h.id ? h : x)));

  return (
    <div className="page secret-page a-violet">
      <PageHeader
        title="The Secret"
        subtitle="One allowance a day for a whole year — use it twice and you have to save it back later."
        icon="lock"
        accent="violet"
        actions={
          <div className="page-actions">
            <button type="button" className="abtn" onClick={onLock}><Icon name="lock" size={16} /> Lock</button>
            {habits.length > 0 && !adding && (
              <button type="button" className="abtn abtn-primary" onClick={() => setAdding(true)}><Icon name="plus" size={18} /> New tracker</button>
            )}
          </div>
        }
      />

      {(adding || !habits.length) && (
        <NewTracker
          first={!habits.length}
          onClose={habits.length ? () => setAdding(false) : null}
          onAdded={(h) => {
            setHabits((list) => [...list, h]);
            pick(h.id);
            setAdding(false);
            toast(`Tracking “${h.name}” — ${h.days} tickets from ${fmt(h.startDate)}`);
          }}
        />
      )}

      {habits.length > 1 && (
        <div className="secret-tabs" role="tablist" aria-label="Trackers">
          {habits.map((h) => {
            const s = summarize(h);
            return (
              <button key={h.id} type="button" role="tab" aria-selected={h.id === current?.id} className={cx('card secret-tab', h.id === current?.id && 'on')} onClick={() => pick(h.id)}>
                <strong>{h.name}</strong>
                <span>{s.left} / {h.days} left</span>
                <Balance value={s.balance} small />
              </button>
            );
          })}
        </div>
      )}

      {current && (
        <Tracker
          key={current.id}
          habit={current}
          onChange={replace}
          onDeleted={() => { setHabits((list) => list.filter((h) => h.id !== current.id)); pick(''); }}
        />
      )}
    </div>
  );
}

function Balance({ value, small }) {
  const cls = value < 0 ? 'over' : value === 0 ? 'even' : 'saved';
  return (
    <span className={cx('secret-bal', cls, small && 'small')}>
      <Icon name={value < 0 ? 'alert' : 'check'} size={small ? 12 : 14} strokeWidth={3} />
      {value < 0 ? `${-value} over` : value === 0 ? 'Even' : `${value} saved`}
    </span>
  );
}

/* ------------------------------------------------------------------ new tracker */

function NewTracker({ first, onClose, onAdded }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', startDate: todayKey() });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr({});
    try {
      onAdded((await api.addSecret(form)).habit);
    } catch (e2) {
      setErr(e2.fields ?? {});
      toast(e2.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card secret-new" onSubmit={submit} onKeyDown={(e) => e.key === 'Escape' && onClose?.()} noValidate>
      <div className="secret-new-head">
        <h2><Icon name="plus" size={18} /> {first ? 'Create your first tracker' : 'New tracker'}</h2>
        {onClose && <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>}
      </div>
      <div className="secret-new-row">
        <div className={cx('afield', err.name && 'has-error')}>
          <label htmlFor="secret-name">Name</label>
          <input id="secret-name" className="ainput" value={form.name} onChange={set('name')} maxLength={60} placeholder="What are you limiting?" autoFocus />
          {err.name && <span className="err">{err.name}</span>}
        </div>
        <div className={cx('afield', err.startDate && 'has-error')}>
          <label htmlFor="secret-start">Start tracking from</label>
          <input id="secret-start" className="ainput" type="date" value={form.startDate} onChange={set('startDate')} />
          {err.startDate && <span className="err">{err.startDate}</span>}
        </div>
        <button className="abtn abtn-primary" disabled={busy || !form.name.trim() || !form.startDate}>{busy ? 'Creating…' : 'Create · 365 tickets'}</button>
      </div>
      {form.startDate && (
        <p className="goal-help">
          One ticket per day: {fmt(form.startDate)} → {fmt(addDays(form.startDate, 364))}. Each time you do it, tick that day — a second tick the same day has to be saved back later.
        </p>
      )}
    </form>
  );
}

/* ------------------------------------------------------------------ one tracker */

function Tracker({ habit: h, onChange, onDeleted }) {
  const toast = useToast();
  const confirm = useConfirm();
  const today = todayKey();
  const s = summarize(h, today);
  const [day, setDay] = useState(() => (s.status === 'active' ? today : s.status === 'upcoming' ? h.startDate : s.end));
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const counts = h.counts || {};

  async function bump(date, delta) {
    if (busy) return;
    setBusy(true);
    try {
      onChange((await api.secretDay(h.id, date, delta)).habit);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const ok = await confirm({ title: `Delete “${h.name}”?`, message: 'The tracker and every ticked day will be removed.', confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await api.deleteSecret(h.id);
      onDeleted();
      toast('Tracker deleted');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const dayCount = counts[day] || 0;
  const leftPct = Math.max(0, (s.left / h.days) * 100);
  const isFuture = day > today;

  return (
    <section className="card secret-card">
      <header className="secret-head">
        <div>
          <h2>{h.name}</h2>
          <p>{fmt(h.startDate)} → {fmt(s.end)} · {h.days} tickets{s.status === 'upcoming' ? ' · not started yet' : s.status === 'finished' ? ' · finished' : ''}</p>
        </div>
        <div className="sde-actions">
          <button type="button" className={cx('icon-btn', editing && 'on')} onClick={() => setEditing((v) => !v)} aria-expanded={editing} aria-label="Tracker settings" title="Tracker settings"><Icon name="settings" size={18} /></button>
          <button type="button" className="icon-btn danger" onClick={remove} aria-label="Delete tracker" title="Delete tracker"><Icon name="trash" size={18} /></button>
        </div>
      </header>

      {editing && <Settings habit={h} onSaved={(x) => { onChange(x); setEditing(false); }} />}

      <div className="secret-stats">
        <div className="secret-stat">
          <span className="k">Tickets left</span>
          <div className="goal-num"><strong>{s.left}</strong><span>/ {h.days}</span></div>
          <span className="goal-bar" role="progressbar" aria-valuemin={0} aria-valuemax={h.days} aria-valuenow={s.left} aria-label="Tickets left"><i style={{ width: `${leftPct}%` }} /></span>
          <span className="sub">{s.used} used so far</span>
        </div>
        <div className={cx('secret-stat', s.balance < 0 && 'is-over')}>
          <span className="k">Balance today</span>
          <div className="secret-balance-num">
            <strong>{s.balance > 0 ? `+${s.balance}` : s.balance}</strong>
            <Balance value={s.balance} />
          </div>
          <span className="sub">
            {s.status === 'upcoming'
              ? `Starts ${fmt(h.startDate, { day: 'numeric', month: 'short' })}.`
              : s.balance < 0
                ? `Skip the next ${-s.balance} day${s.balance === -1 ? '' : 's'} to get back to 0.`
                : s.balance === 0
                  ? 'Exactly on budget — today’s ticket is spent.'
                  : `${s.earned} tickets unlocked so far, ${s.earned - s.balance} spent.`}
          </span>
        </div>
        <div className="secret-stat secret-today">
          <span className="k">Today</span>
          {s.status === 'active' ? (
            <>
              <div className="goal-num"><strong>{s.usedToday}</strong><span>× used</span></div>
              <div className="secret-today-btns">
                <button type="button" className="abtn abtn-primary" disabled={busy} onClick={() => bump(today, 1)}><Icon name="plus" size={16} /> Used one</button>
                <button type="button" className="abtn" disabled={busy || !s.usedToday} onClick={() => bump(today, -1)}><Icon name="minus" size={16} /> Undo</button>
              </div>
            </>
          ) : (
            <span className="sub">{s.status === 'upcoming' ? 'Tracking hasn’t started.' : 'This year is over.'}</span>
          )}
        </div>
      </div>

      <div className="secret-year">
        <div className="secret-year-head">
          <h3><Icon name="calendar" size={16} /> The year</h3>
          <div className="secret-legend" aria-label="Legend">
            <span><i className="c0" /> Saved</span>
            <span><i className="c1" /> Used once</span>
            <span><i className="c2" /> More than once</span>
          </div>
        </div>
        <YearGrid habit={h} today={today} selected={day} onPick={setDay} />
        <div className="secret-day">
          <span>
            <b>{fmt(day, { weekday: 'long', day: 'numeric', month: 'long' })}</b>
            {' — '}
            {isFuture ? 'still ahead' : dayCount === 0 ? 'saved (not used)' : dayCount === 1 ? 'used once' : `used ${dayCount}×`}
          </span>
          {!isFuture && (
            <span className="secret-day-btns">
              <button type="button" className="icon-btn" disabled={busy || !dayCount} onClick={() => bump(day, -1)} aria-label="One less that day"><Icon name="minus" size={16} /></button>
              <b className="n">{dayCount}</b>
              <button type="button" className="icon-btn" disabled={busy} onClick={() => bump(day, 1)} aria-label="One more that day"><Icon name="plus" size={16} /></button>
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

/** 12-ish month calendars covering the tracker's 365 days. */
function YearGrid({ habit: h, today, selected, onPick }) {
  const end = addDays(h.startDate, h.days - 1);
  const counts = h.counts || {};
  const months = useMemo(() => {
    const out = [];
    const first = fromKey(h.startDate);
    const last = fromKey(end);
    for (let d = new Date(first.getFullYear(), first.getMonth(), 1); d <= last; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      const y = d.getFullYear();
      const m = d.getMonth();
      const lead = (new Date(y, m, 1).getDay() + 6) % 7; // Monday first
      const n = new Date(y, m + 1, 0).getDate();
      out.push({ key: `${y}-${m}`, label: d.toLocaleDateString(undefined, { month: 'short', year: m === 0 || out.length === 0 ? 'numeric' : undefined }), lead, days: Array.from({ length: n }, (_, i) => toKey(new Date(y, m, i + 1))) });
    }
    return out;
  }, [h.startDate, end]);

  return (
    <div className="secret-months">
      {months.map((mo) => (
        <div key={mo.key} className="secret-month">
          <span className="secret-month-name">{mo.label}</span>
          <div className="secret-cells">
            {Array.from({ length: mo.lead }, (_, i) => <span key={`l${i}`} className="secret-cell blank" />)}
            {mo.days.map((k) => {
              const inRange = k >= h.startDate && k <= end;
              if (!inRange) return <span key={k} className="secret-cell blank" />;
              const n = counts[k] || 0;
              const future = k > today;
              const cls = future ? 'future' : n === 0 ? 'c0' : n === 1 ? 'c1' : 'c2';
              const label = `${fmt(k, { weekday: 'short', day: 'numeric', month: 'short' })}: ${future ? 'ahead' : n === 0 ? 'saved' : `used ${n}×`}`;
              return (
                <button key={k} type="button" className={cx('secret-cell', cls, k === today && 'today', k === selected && 'sel')} onClick={() => onPick(k)} title={label} aria-label={label} aria-pressed={k === selected}>
                  {n > 1 ? n : ''}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Settings({ habit: h, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: h.name, startDate: h.startDate });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const outside = Object.keys(h.counts || {}).filter((k) => k < form.startDate || k > addDays(form.startDate, h.days - 1)).length;

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setErr({});
    try {
      onSaved((await api.updateSecret(h.id, form)).habit);
      toast('Tracker updated');
    } catch (e2) {
      setErr(e2.fields ?? {});
      toast(e2.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="sde-settings secret-settings" onSubmit={save} noValidate>
      <div className={cx('afield', err.name && 'has-error')}>
        <label htmlFor="secret-s-name">Name</label>
        <input id="secret-s-name" className="ainput" value={form.name} maxLength={60} onChange={set('name')} />
        {err.name && <span className="err">{err.name}</span>}
      </div>
      <div className={cx('afield', err.startDate && 'has-error')}>
        <label htmlFor="secret-s-start">Start date</label>
        <input id="secret-s-start" className="ainput" type="date" value={form.startDate} onChange={set('startDate')} />
        {err.startDate ? <span className="err">{err.startDate}</span> : outside > 0 && form.startDate !== h.startDate && <span className="sde-hint">{outside} ticked day{outside === 1 ? '' : 's'} fall outside — they’ll be removed.</span>}
      </div>
      <button className="abtn abtn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
    </form>
  );
}
