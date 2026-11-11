// Diet tracker — the day view. Tick what you ate; protein and calories add up for the day.
// Ticks save automatically. The plan itself is edited on /admin/diet/plan.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import Icon from '../../shared/Icon.jsx';
import { cx } from '../../shared/utils.js';
import { ErrorBox, PageHeader, Spinner, useToast } from '../ui.jsx';
import { fromKey, toKey } from './Weight.jsx';

const todayKey = () => toKey(new Date());
const shift = (k, n) => {
  const d = fromKey(k);
  return toKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
};
const fmtDay = (k) => fromKey(k).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const newId = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).slice(0, 36);
const sum = (list, key) => list.reduce((a, x) => a + (Number(x[key]) || 0), 0);
const n0 = (n) => Math.round(n).toLocaleString();

/** Daily goal, always the same whatever the plan adds up to. */
export const DAILY_TARGET = { protein: 100, calories: 2000 };

export default function Diet() {
  const toast = useToast();
  const [plan, setPlan] = useState(null);
  const [date, setDate] = useState(todayKey);
  const [day, setDay] = useState(null);
  const [error, setError] = useState(null);
  const [saveState, setSaveState] = useState('saved'); // saved | saving | error
  const [week, setWeek] = useState([]);
  const timer = useRef(null);
  const pending = useRef(null);

  const loadPlan = useCallback(() => {
    setError(null);
    api.dietPlan().then((r) => setPlan(r.plan)).catch(setError);
  }, []);
  useEffect(loadPlan, [loadPlan]);

  const loadWeek = useCallback(() => {
    api.dietDays({ from: shift(todayKey(), -6), to: todayKey() }).then((r) => setWeek(r.days)).catch(() => {});
  }, []);
  useEffect(loadWeek, [loadWeek]);

  // Load the selected day (flush any unsaved ticks for the previous day first).
  useEffect(() => {
    let cancelled = false;
    setDay(null);
    api
      .dietDay(date)
      .then((r) => !cancelled && setDay(r.day))
      .catch((e) => !cancelled && setError(e));
    return () => {
      cancelled = true;
    };
  }, [date]);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    setSaveState('saving');
    try {
      const { date: d, ...body } = p;
      await api.saveDietDay(d, { items: body.items, extras: body.extras, supplements: body.supplements, preparations: body.preparations });
      setSaveState(pending.current ? 'saving' : 'saved');
      loadWeek();
    } catch (err) {
      setSaveState('error');
      toast(err.message, 'error');
    }
  }, [toast, loadWeek]);

  useEffect(() => () => flush(), [date, flush]);
  useEffect(() => {
    const onLeave = () => flush();
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [flush]);

  /** Update the day locally and save shortly after (batches quick ticks into one request). */
  function update(fn) {
    setDay((d) => {
      const next = fn(d);
      pending.current = next;
      setSaveState('saving');
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, 500);
      return next;
    });
  }

  const ticked = useMemo(() => new Set(day?.items.map((i) => i.itemId)), [day]);

  function toggleItem(session, item) {
    update((d) =>
      ticked.has(item.id)
        ? { ...d, items: d.items.filter((i) => i.itemId !== item.id) }
        : { ...d, items: [...d.items, { itemId: item.id, sessionId: session.id, name: item.name, protein: item.protein, calories: item.calories, quantity: item.quantity }] }
    );
  }
  const toggleIn = (key, id) => update((d) => ({ ...d, [key]: d[key].includes(id) ? d[key].filter((x) => x !== id) : [...d[key], id] }));

  const target = DAILY_TARGET; // fixed — the plan's session targets are only a guide

  // Weekly supplement reminder: due on its weekday; if it wasn't ticked then, it carries forward
  // to each following day until it is (and resets on the next due day).
  const rem = plan ? dueReminder(date, plan.supplements) : null;
  const [takenEarlier, setTakenEarlier] = useState(null);
  const remItemId = rem?.item?.id;
  const remDue = rem?.dueDate;
  useEffect(() => {
    setTakenEarlier(null);
    if (!remItemId || remDue === date) return undefined;
    let cancelled = false;
    api
      .dietDays({ from: remDue, to: shift(date, -1) })
      .then((r) => !cancelled && setTakenEarlier(r.days.some((d) => d.supplementIds?.includes(remItemId))))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [date, remItemId, remDue]);
  const reminder = !rem ? null : rem.dueDate === date ? rem : takenEarlier === false ? { ...rem, missed: true } : null;

  if (error) return <div className="page"><PageHeader title="Diet & meals" icon="apple" accent="lime" /><ErrorBox error={error} onRetry={loadPlan} /></div>;

  const eaten = day ? [...day.items, ...day.extras] : [];
  const total = { protein: sum(eaten, 'protein'), calories: sum(eaten, 'calories') };
  const planIds = new Set(plan?.sessions.flatMap((s) => s.items.map((i) => i.id)));
  const orphans = day?.items.filter((i) => !planIds.has(i.itemId)) ?? []; // ticked, but since removed from the plan

  return (
    <div className="page diet-page">
      <PageHeader
        title="Diet & meals"
        subtitle="Tick what you eat — protein and calories add up for the day."
        icon="apple"
        accent="lime"
        actions={<Link to="/admin/diet/plan" className="abtn"><Icon name="edit" size={16} /> Customise plan</Link>}
      />

      <div className="diet-datebar card">
        <button type="button" className="icon-btn" onClick={() => setDate((d) => shift(d, -1))} aria-label="Previous day"><Icon name="chevron-left" size={20} /></button>
        <div className="diet-date">
          <strong>{date === todayKey() ? 'Today' : date === shift(todayKey(), -1) ? 'Yesterday' : fromKey(date).toLocaleDateString(undefined, { weekday: 'long' })}</strong>
          <span>{fmtDay(date)}</span>
        </div>
        <button type="button" className="icon-btn" onClick={() => setDate((d) => shift(d, 1))} disabled={date >= todayKey()} aria-label="Next day"><Icon name="chevron-right" size={20} /></button>
        <input type="date" className="ainput diet-date-input" value={date} max={todayKey()} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Pick a date" />
        {date !== todayKey() && <button type="button" className="abtn abtn-sm" onClick={() => setDate(todayKey())}>Today</button>}
        <span className={cx('diet-save', saveState)} role="status">
          {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Not saved' : <><Icon name="check" size={14} /> Saved</>}
        </span>
      </div>

      {!plan || !day ? (
        <Spinner />
      ) : (
        <>
          <div className="diet-totals">
            <Meter label="Protein" unit="g" value={total.protein} target={target.protein} tone="protein" />
            <Meter label="Calories" unit="kcal" value={total.calories} target={target.calories} tone="calories" />
            <div className="card diet-mini">
              <span className="k">Supplements</span>
              <strong>{day.supplements.filter((id) => plan.supplements.some((s) => s.id === id)).length} / {plan.supplements.length}</strong>
              <span className="s">taken</span>
            </div>
          </div>

          <div className="diet-grid">
            <div className="diet-sessions">
              {plan.sessions.map((s) => {
                const got = day.items.filter((i) => i.sessionId === s.id && planIds.has(i.itemId));
                const sp = sum(got, 'protein');
                const sc = sum(got, 'calories');
                const hasTarget = s.target.protein > 0 || s.target.calories > 0;
                return (
                  <section key={s.id} className="card diet-session">
                    <header>
                      <h2>{s.name}</h2>
                      <span className={cx('diet-sub', got.length && 'on')}>
                        <b>{n0(sp)}</b>g · <b>{n0(sc)}</b> kcal{hasTarget && <em> / {n0(s.target.protein)}g · {n0(s.target.calories)}</em>}
                      </span>
                    </header>
                    {s.items.length ? (
                      <ul className="diet-items">
                        {s.items.map((it) => {
                          const on = ticked.has(it.id);
                          return (
                            <li key={it.id}>
                              <label className={cx('diet-item', on && 'on')}>
                                <input type="checkbox" checked={on} onChange={() => toggleItem(s, it)} />
                                <span className="tick" aria-hidden="true"><Icon name="check" size={14} strokeWidth={3} /></span>
                                <span className="name">{it.name}{it.quantity && <small>{it.quantity}</small>}</span>
                                <span className="nums"><b>{n0(it.protein)}</b>g</span>
                                <span className="nums"><b>{n0(it.calories)}</b> kcal</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="diet-none">No items — add some in <Link to="/admin/diet/plan">Customise plan</Link>.</p>
                    )}
                  </section>
                );
              })}

              {orphans.length > 0 && (
                <section className="card diet-session">
                  <header><h2>Ticked, no longer in your plan</h2></header>
                  <ul className="diet-items">
                    {orphans.map((it) => (
                      <li key={it.itemId}>
                        <label className="diet-item on">
                          <input type="checkbox" checked onChange={() => update((d) => ({ ...d, items: d.items.filter((i) => i.itemId !== it.itemId) }))} />
                          <span className="tick" aria-hidden="true"><Icon name="check" size={14} strokeWidth={3} /></span>
                          <span className="name">{it.name}{it.quantity && <small>{it.quantity}</small>}</span>
                          <span className="nums"><b>{n0(it.protein)}</b>g</span>
                          <span className="nums"><b>{n0(it.calories)}</b> kcal</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <Extras day={day} update={update} />
            </div>

            <aside className="diet-side">
              <Checklist title="Supplements" icon="pill" items={plan.supplements} done={day.supplements} onToggle={(id) => toggleIn('supplements', id)}
                reminder={reminder} />
              <Checklist title="Preparations" icon="clock" items={plan.preparations} done={day.preparations} onToggle={(id) => toggleIn('preparations', id)} />
              <Week days={week} target={target} today={todayKey()} onPick={setDate} selected={date} />
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function Meter({ label, unit, value, target, tone }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const left = target - value;
  return (
    <div className={cx('card diet-meter', tone)}>
      <span className="k">{label}</span>
      <strong>
        {Math.round(value).toLocaleString()} <small>{target > 0 ? `/ ${Math.round(target).toLocaleString()} ${unit}` : unit}</small>
      </strong>
      {target > 0 && (
        <>
          <span className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={Math.round(target)} aria-valuenow={Math.round(value)} aria-label={`${label} progress`}>
            <i style={{ width: `${pct}%` }} />
          </span>
          <span className="s">{left > 0 ? `${Math.round(left).toLocaleString()} ${unit} to go` : left === 0 ? 'Target reached' : `${Math.round(-left).toLocaleString()} ${unit} over target`}</span>
        </>
      )}
    </div>
  );
}

/** Weekly supplement reminder (weekday: 0 = Sunday … 3 = Wednesday). `match` finds the item in your plan. */
const WEEKLY_REMINDER = { weekday: 3, name: 'D3', match: /\bd3\b|vitamin\s*d/i };
const WEEKDAY = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d).getDay(); };
const dayName = (key, opts = { weekday: 'long' }) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, opts); };

/** The most recent due day on or before this date, with the plan item it refers to. */
function dueReminder(dateKey, supplements) {
  const r = WEEKLY_REMINDER;
  const back = (WEEKDAY(dateKey) - r.weekday + 7) % 7;
  return { ...r, dueDate: shift(dateKey, -back), item: supplements.find((s) => r.match.test(s.name)) };
}

function Checklist({ title, icon, items, done, onToggle, reminder }) {
  if (!items.length && !reminder) return null;
  const reminderDone = reminder?.item && done.includes(reminder.item.id);
  return (
    <section className="card diet-check">
      <h2><Icon name={icon} size={16} /> {title}</h2>
      {reminder && (
        <div className={cx('diet-remind', reminderDone && 'done', reminder.missed && !reminderDone && 'late')} role="status">
          <Icon name={reminderDone ? 'check' : reminder.missed ? 'alert' : 'clock'} size={16} />
          <span>
            <strong>
              {reminderDone
                ? `${reminder.item.name} taken${reminder.missed ? ' — caught up' : ''}`
                : reminder.missed ? `${reminder.name} missed on ${dayName(reminder.dueDate)}` : `Take ${reminder.name} supplement`}
            </strong>
            <small>
              {reminderDone
                ? reminder.missed ? `Missed on ${dayName(reminder.dueDate)}, taken today.` : `Weekly dose done for this ${dayName(reminder.dueDate)}.`
                : reminder.missed
                  ? `Not ticked since ${dayName(reminder.dueDate, { weekday: 'short', day: 'numeric', month: 'short' })} — take it today.`
                  : `Weekly reminder — every ${dayName(reminder.dueDate)}.`}
            </small>
          </span>
          {reminder.item && !reminderDone && (
            <button type="button" className="abtn abtn-sm" onClick={() => onToggle(reminder.item.id)}>Mark taken</button>
          )}
        </div>
      )}
      <div className="diet-chips">
        {items.map((s) => {
          const on = done.includes(s.id);
          return (
            <button key={s.id} type="button" className={cx('diet-chip', on && 'on', reminder?.item?.id === s.id && !on && 'due')} aria-pressed={on} onClick={() => onToggle(s.id)}>
              <span className="tick" aria-hidden="true">{on && <Icon name="check" size={12} strokeWidth={3} />}</span>
              {s.name}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Extras({ day, update }) {
  const [f, setF] = useState({ name: '', protein: '', calories: '' });
  const [err, setErr] = useState('');
  function add(e) {
    e.preventDefault();
    if (!f.name.trim()) return setErr('Give it a name.');
    const protein = Number(f.protein || 0);
    const calories = Number(f.calories || 0);
    if (!(protein >= 0) || !(calories >= 0)) return setErr('Use positive numbers.');
    setErr('');
    update((d) => ({ ...d, extras: [...d.extras, { id: newId(), name: f.name.trim(), protein, calories }] }));
    setF({ name: '', protein: '', calories: '' });
  }
  return (
    <section className="card diet-session">
      <header>
        <h2>Extra food today</h2>
        <span className="help">One-off items, just for this day</span>
      </header>
      {day.extras.length > 0 && (
        <ul className="diet-items">
          {day.extras.map((x) => (
            <li key={x.id} className="diet-item on extra">
              <span className="tick" aria-hidden="true"><Icon name="plus" size={14} strokeWidth={3} /></span>
              <span className="name">{x.name}</span>
              <span className="nums"><b>{n0(x.protein)}</b>g</span>
              <span className="nums"><b>{n0(x.calories)}</b> kcal</span>
              <button type="button" className="icon-btn danger" onClick={() => update((d) => ({ ...d, extras: d.extras.filter((e) => e.id !== x.id) }))} aria-label={`Remove ${x.name}`}>
                <Icon name="trash" size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="diet-extra-form" onSubmit={add}>
        <input className="ainput" placeholder="e.g. Pizza slice" maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Food name" />
        <input className="ainput" type="number" min="0" inputMode="decimal" placeholder="Protein g" value={f.protein} onChange={(e) => setF({ ...f, protein: e.target.value })} aria-label="Protein in grams" />
        <input className="ainput" type="number" min="0" inputMode="decimal" placeholder="kcal" value={f.calories} onChange={(e) => setF({ ...f, calories: e.target.value })} aria-label="Calories" />
        <button className="abtn"><Icon name="plus" size={16} /> Add</button>
      </form>
      {err && <p className="err diet-extra-err">{err}</p>}
    </section>
  );
}

function Week({ days, target, today, onPick, selected }) {
  const map = new Map(days.map((d) => [d.date, d]));
  const list = Array.from({ length: 7 }, (_, i) => shift(today, i - 6));
  return (
    <section className="card diet-week">
      <h2><Icon name="calendar" size={16} /> Last 7 days</h2>
      <table>
        <thead>
          <tr><th scope="col">Day</th><th scope="col" className="num">Protein</th><th scope="col" className="num">kcal</th></tr>
        </thead>
        <tbody>
          {list.map((k) => {
            const d = map.get(k);
            const hitP = d && target.protein > 0 && d.protein >= target.protein;
            return (
              <tr key={k} className={cx(k === selected && 'on')} onClick={() => onPick(k)}>
                <td><button type="button" onClick={() => onPick(k)}>{fromKey(k).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</button></td>
                <td className="num">{d ? <>{n0(d.protein)}g{hitP && <Icon name="check" size={12} strokeWidth={3} className="hit" />}</> : '—'}</td>
                <td className="num">{d ? n0(d.calories) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
