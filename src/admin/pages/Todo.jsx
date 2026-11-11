// Weekly to-do board: Monday–Sunday columns, drag cards between days, categories with weekly targets.
// Unfinished cards from earlier weeks are moved to this week's Monday ("carried over") automatically.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api.js';
import Icon from '../../shared/Icon.jsx';
import { readableOn } from '../../shared/theme.js';
import { cx } from '../../shared/utils.js';
import { ErrorBox, PageHeader, Spinner, useConfirm, useToast } from '../ui.jsx';
import { fromKey, toKey } from './Weight.jsx';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
// Category colours: a fixed set of named colours (any hex is also allowed via "Custom").
// Older categories may still hold a theme slot name ('lime', 'violet', …) — those keep working.
const PALETTE = [
  ['#ef4444', 'Red'], ['#f43f5e', 'Rose'], ['#ec4899', 'Pink'], ['#d946ef', 'Fuchsia'],
  ['#a855f7', 'Purple'], ['#8b5cf6', 'Violet'], ['#6366f1', 'Indigo'], ['#0f2c6b', 'Navy'],
  ['#3b82f6', 'Blue'], ['#0ea5e9', 'Sky'], ['#06b6d4', 'Cyan'], ['#14b8a6', 'Teal'],
  ['#10b981', 'Emerald'], ['#22c55e', 'Green'], ['#84cc16', 'Lime'], ['#eab308', 'Yellow'],
  ['#f59e0b', 'Amber'], ['#f97316', 'Orange'], ['#a16207', 'Brown'], ['#64748b', 'Slate'],
];
const COLORS = PALETTE.map(([hex]) => hex);
const colorName = (c) => PALETTE.find(([hex]) => hex === c)?.[1] ?? (c?.startsWith('#') ? `Custom ${c}` : 'Theme colour');
const PRIORITIES = [
  { key: 'high', label: 'High', icon: 'arrow-up' },
  { key: 'medium', label: 'Medium', icon: 'minus' },
  { key: 'low', label: 'Low', icon: 'arrow-down' },
];
const isHex = (c) => /^#[0-9a-f]{6}$/i.test(c || '');
/** className + style that set --a / --a-soft / --a-ink / --a-on for a category colour. */
const catColor = (color) =>
  isHex(color)
    ? {
        className: 'a-custom',
        style: {
          '--a': color,
          '--a-soft': `color-mix(in srgb, ${color} 16%, var(--surface))`,
          '--a-ink': `color-mix(in srgb, ${color} 72%, var(--ink))`,
          '--a-on': readableOn(color),
        },
      }
    : { className: `a-${color}`, style: undefined };

const addDays = (k, n) => {
  const d = fromKey(k);
  return toKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
};
const mondayOf = (date = new Date()) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toKey(d);
};
const short = (k, o = { day: 'numeric', month: 'short' }) => fromKey(k).toLocaleDateString(undefined, o);

export default function Todo() {
  const toast = useToast();
  const confirm = useConfirm();
  const thisWeek = mondayOf();
  const [week, setWeek] = useState(thisWeek);
  const [data, setData] = useState(null); // { categories, tasks }
  const [error, setError] = useState(null);
  const [managing, setManaging] = useState(false);
  const [filter, setFilter] = useState(null); // categoryId | null
  const [view, setViewState] = useState(() => {
    try {
      return localStorage.getItem('todo-view') || 'board';
    } catch {
      return 'board';
    }
  });
  const setView = (v) => {
    setViewState(v);
    try {
      localStorage.setItem('todo-view', v);
    } catch {
      /* ignore */
    }
  };
  const [goalsKey, setGoalsKey] = useState(0);
  const rolled = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      if (week === thisWeek && !rolled.current) {
        rolled.current = true;
        const r = await api.todoRollover(thisWeek);
        if (r.moved) toast(`${r.moved} unfinished ${r.moved === 1 ? 'task' : 'tasks'} carried over to Monday`);
      }
      setData(await api.todoWeek(week));
    } catch (e) {
      setError(e);
    }
  }, [week, thisWeek, toast]);
  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  const cats = useMemo(() => new Map((data?.categories ?? []).map((c) => [c.id, c])), [data]);

  /** Optimistic task update + PATCH; rolls back on failure. */
  async function patchTask(id, patch) {
    const before = data;
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)).filter((t) => t.weekStart === week) }));
    try {
      const { task } = await api.updateTask(id, patch);
      setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? task : t)).filter((t) => t.weekStart === week) }));
    } catch (err) {
      setData(before);
      toast(err.message, 'error');
    }
  }

  async function addTask(day, title, categoryId, priority) {
    try {
      const { task } = await api.addTask({ title, categoryId, priority, weekStart: week, day });
      setData((d) => ({ ...d, tasks: [...d.tasks, task] }));
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function removeTask(t) {
    const ok = await confirm({ title: 'Delete this task?', message: `“${t.title}” will be removed.`, confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await api.deleteTask(t.id);
      setData((d) => ({ ...d, tasks: d.tasks.filter((x) => x.id !== t.id) }));
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // Drop a card into a day's priority section at a position (index among that section's visible cards,
  // excluding the dragged card). Dropping into another section changes the card's priority.
  function moveTo(id, day, prio, index, visibleIds) {
    const t = data.tasks.find((x) => x.id === id);
    if (!t) return;
    // The Finished section: dropping there completes the task (it keeps its priority).
    if (prio === 'done') {
      const patch = {};
      if (t.day !== day) patch.day = day;
      if (!t.done) patch.done = true;
      if (Object.keys(patch).length) patchTask(id, patch);
      return;
    }
    const inSection = data.tasks
      .filter((x) => x.day === day && x.id !== id && !x.done && (x.priority ?? null) === prio && (!visibleIds || visibleIds.has(x.id)))
      .sort((a, b) => a.order - b.order);
    if (index > inSection.length) index = inSection.length; // e.g. Infinity = end of section
    const prev = inSection[index - 1]?.order;
    const next = inSection[index]?.order;
    const order = prev == null && next == null ? (t.day === day ? t.order : 1) : prev == null ? next - 1 : next == null ? prev + 1 : (prev + next) / 2;
    const patch = {};
    if (t.day !== day) patch.day = day;
    if (t.order !== order) patch.order = order;
    if ((t.priority ?? null) !== prio) patch.priority = prio;
    if (t.done) patch.done = false; // dragged out of Finished → open again
    if (Object.keys(patch).length) patchTask(id, patch);
  }

  const stats = useMemo(() => {
    if (!data) return null;
    const by = (cid) => data.tasks.filter((t) => (t.categoryId ?? null) === cid);
    return {
      total: data.tasks.length,
      done: data.tasks.filter((t) => t.done).length,
      cats: data.categories.map((c) => ({ ...c, done: by(c.id).filter((t) => t.done).length, planned: by(c.id).length })),
    };
  }, [data]);

  const weekEnd = addDays(week, 6);

  return (
    <div className="page todo-page">
      <PageHeader
        title="To-do"
        subtitle="Plan your week, drag tasks between days, and hit your targets."
        icon="check"
        accent="cyan"
        actions={<button type="button" className="abtn" onClick={() => load().then(() => setManaging(true))}><Icon name="settings" size={16} /> Categories</button>}
      />

      <div className="tabs" role="tablist" aria-label="To-do views">
        <button type="button" role="tab" aria-selected={view === 'board'} className={cx('tab', view === 'board' && 'on')} onClick={() => { setView('board'); load(); }}>Weekly board</button>
        <button type="button" role="tab" aria-selected={view === 'goals'} className={cx('tab', view === 'goals' && 'on')} onClick={() => setView('goals')}>Yearly goals</button>
      </div>

      {view === 'goals' ? (
        <YearlyGoals refreshKey={goalsKey} onManage={() => load().then(() => setManaging(true))} />
      ) : (
      <>
      <div className="card todo-weekbar">
        <button type="button" className="icon-btn" onClick={() => setWeek((w) => addDays(w, -7))} aria-label="Previous week"><Icon name="chevron-left" size={20} /></button>
        <div className="todo-weektitle">
          <strong>{week === thisWeek ? 'This week' : week === addDays(thisWeek, 7) ? 'Next week' : week === addDays(thisWeek, -7) ? 'Last week' : `Week of ${short(week)}`}</strong>
          <span>{short(week)} – {short(weekEnd, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>
        <button type="button" className="icon-btn" onClick={() => setWeek((w) => addDays(w, 7))} aria-label="Next week"><Icon name="chevron-right" size={20} /></button>
        {week !== thisWeek && <button type="button" className="abtn abtn-sm" onClick={() => setWeek(thisWeek)}>This week</button>}
        {stats && (
          <span className="todo-weekdone">
            <b>{stats.done}</b> / {stats.total} done
          </span>
        )}
      </div>

      {error && <ErrorBox error={error} onRetry={load} />}
      {!data && !error && <Spinner />}

      {data && (
        <>
          {stats.cats.length > 0 ? (
            <div className="todo-progress">
              {stats.cats.map((c) => (
                <CategoryProgress key={c.id} c={c} active={filter === c.id} onClick={() => setFilter((f) => (f === c.id ? null : c.id))} />
              ))}
            </div>
          ) : (
            <div className="card todo-hint">
              <Icon name="sparkles" size={18} />
              <span>Create categories like <b>Gym</b> or <b>Design</b> with a weekly target to track your progress.</span>
              <button type="button" className="abtn abtn-sm abtn-primary" onClick={() => setManaging(true)}><Icon name="plus" size={15} /> Add categories</button>
            </div>
          )}
          {filter && (
            <p className="todo-filtering">
              Showing only <b>{cats.get(filter)?.name}</b> · <button type="button" onClick={() => setFilter(null)}>Show all</button>
            </p>
          )}

          <Board
            week={week}
            thisWeek={thisWeek}
            tasks={data.tasks}
            cats={cats}
            categories={data.categories}
            filter={filter}
            onMove={moveTo}
            onToggle={(t) => patchTask(t.id, { done: !t.done })}
            onEdit={(t, patch) => patchTask(t.id, patch)}
            onDelete={removeTask}
            onAdd={addTask}
          />
        </>
      )}
      </>
      )}

      {managing && data && (
        <CategoryManager
          categories={data.categories}
          onClose={() => {
            setManaging(false);
            setGoalsKey((k) => k + 1);
          }}
          onChange={(categories) => setData((d) => ({ ...d, categories, tasks: d.tasks.map((t) => (t.categoryId && !categories.some((c) => c.id === t.categoryId) ? { ...t, categoryId: null } : t)) }))}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ yearly goals */

function YearlyGoals({ refreshKey, onManage }) {
  const toast = useToast();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState({ name: '', color: COLORS[3], target: '' });

  const load = useCallback(() => {
    setError(null);
    api.todoGoals(year, mondayOf()).then(setData).catch(setError);
  }, [year]);
  useEffect(() => {
    setData(null);
    load();
  }, [load, refreshKey]);

  async function saveWeekly(categoryId, weeklyTarget) {
    try {
      const { category } = await api.updateTodoCategory(categoryId, { weeklyTarget });
      setData((d) => ({ ...d, categories: d.categories.map((c) => (c.id === categoryId ? category : c)) }));
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function saveTarget(categoryId, target) {
    try {
      const { goal } = await api.setTodoGoal(year, categoryId, target);
      setData((d) => ({ ...d, goals: [...d.goals.filter((g) => g.categoryId !== categoryId), ...(goal ? [goal] : [])] }));
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function addCategory(e) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    try {
      const { category } = await api.addTodoCategory({ name: draft.name.trim(), color: draft.color, weeklyTarget: 0 });
      const target = Math.max(0, Math.round(Number(draft.target) || 0));
      let goals = data.goals;
      if (target > 0) {
        const { goal } = await api.setTodoGoal(year, category.id, target);
        goals = [...goals, goal];
      }
      setData((d) => ({ ...d, categories: [...d.categories, category], goals }));
      setDraft({ name: '', color: COLORS[(data.categories.length * 7 + 3) % COLORS.length], target: '' });
      toast(`Added ${category.name}`);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // How far through the year we are (for "on pace" hints) — only meaningful for the current year.
  const now = new Date();
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const elapsed = year < thisYear ? 1 : year > thisYear ? 0 : (now - start) / (end - start);
  const weeksLeft = year === thisYear ? Math.max(1, (end - now) / (7 * 86400000)) : year > thisYear ? 52 : 0;

  const goalOf = (id) => data?.goals.find((g) => g.categoryId === id);
  const rows = (data?.categories ?? []).map((c) => ({ c, target: goalOf(c.id)?.target ?? 0, since: goalOf(c.id)?.since, done: data.done[c.id] ?? 0 }));
  const withGoal = rows.filter((r) => r.target > 0);
  const totalTarget = withGoal.reduce((a, r) => a + r.target, 0);
  const totalDone = withGoal.reduce((a, r) => a + Math.min(r.done, r.target), 0);

  return (
    <>
      <div className="card todo-weekbar">
        <button type="button" className="icon-btn" onClick={() => setYear((y) => y - 1)} aria-label="Previous year"><Icon name="chevron-left" size={20} /></button>
        <div className="todo-weektitle">
          <strong>{year === thisYear ? `This year · ${year}` : year}</strong>
          <span>{year === thisYear ? `${Math.round(elapsed * 100)}% of the year gone` : year < thisYear ? 'Finished year' : 'Upcoming year'}</span>
        </div>
        <button type="button" className="icon-btn" onClick={() => setYear((y) => y + 1)} aria-label="Next year"><Icon name="chevron-right" size={20} /></button>
        {year !== thisYear && <button type="button" className="abtn abtn-sm" onClick={() => setYear(thisYear)}>This year</button>}
        {totalTarget > 0 && (
          <span className="todo-weekdone"><b>{totalDone}</b> / {totalTarget} goal cards done</span>
        )}
      </div>

      {error && <ErrorBox error={error} onRetry={load} />}
      {!data && !error && <Spinner />}

      {data && (
        <>
          <p className="goal-help">Every finished card counts +1 towards its category’s goal for the year it was finished. Unticking or deleting a finished card takes the point back.</p>
          {rows.length > 0 && (
            <div className="goal-grid">
              {rows.map(({ c, target, since, done }) => {
                // Pace runs from when the goal was set (or 1 Jan if set before the year began) to 31 Dec.
                const from = Math.max(start.getTime(), since ? new Date(since).getTime() : start.getTime());
                const goalElapsed = year < thisYear ? 1 : year > thisYear ? 0 : Math.min(1, Math.max(0, (now - from) / (end - from)));
                return (
                  <GoalCard
                    key={c.id}
                    c={c}
                    target={target}
                    done={done}
                    weekDone={data.weekDone?.[c.id] ?? 0}
                    elapsed={goalElapsed}
                    since={since && new Date(since) > start ? new Date(since) : null}
                    weeksLeft={weeksLeft}
                    isPast={year < thisYear}
                    onTarget={(t) => saveTarget(c.id, t)}
                    onWeekly={(t) => saveWeekly(c.id, t)}
                  />
                );
              })}
            </div>
          )}

          <form className="card goal-add" onSubmit={addCategory}>
            <h2><Icon name="plus" size={18} /> New category & goal</h2>
            <div className="goal-add-row">
              <ColorPick value={draft.color} onChange={(color) => setDraft((d) => ({ ...d, color }))} />
              <input className="ainput" maxLength={40} placeholder="Category, e.g. Gym" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} aria-label="Category name" />
              <label className="goal-target-in">
                <input className="ainput" type="number" min="0" inputMode="numeric" placeholder="250" value={draft.target} onChange={(e) => setDraft((d) => ({ ...d, target: e.target.value }))} aria-label={`Goal for ${year} (cards)`} />
                <span>cards in {year}</span>
              </label>
              <button className="abtn abtn-primary" disabled={!draft.name.trim()}><Icon name="plus" size={16} /> Add</button>
            </div>
            <button type="button" className="goal-manage" onClick={onManage}>Rename, recolour or delete categories…</button>
          </form>
        </>
      )}
    </>
  );
}

function GoalCard({ c, target, done, weekDone, elapsed, since, weeksLeft, isPast, onTarget, onWeekly }) {
  const [value, setValue] = useState(target ? String(target) : '');
  useEffect(() => setValue(target ? String(target) : ''), [target]);
  const weekly = c.weeklyTarget || 0;
  const [weekValue, setWeekValue] = useState(weekly ? String(weekly) : '');
  useEffect(() => setWeekValue(weekly ? String(weekly) : ''), [weekly]);
  const weekPct = weekly > 0 ? Math.min(100, (weekDone / weekly) * 100) : 100; // 0 target = achieved
  const commitWeekly = () => {
    const n = Math.min(100, Math.max(0, Math.round(Number(weekValue) || 0)));
    if (n !== weekly) onWeekly(n);
  };
  const cc = catColor(c.color);
  // A goal of 0 (or none) is always met.
  const pct = target > 0 ? Math.min(100, (done / target) * 100) : 100;
  const expected = Math.round(target * elapsed);
  const left = Math.max(0, target - done);
  const commit = () => {
    const n = Math.max(0, Math.round(Number(value) || 0));
    if (n !== target) onTarget(n);
  };

  let pace = target > 0 ? null : { cls: 'good', text: 'Achieved · no target set' };
  if (target > 0) {
    if (done >= target) pace = { cls: 'good', text: 'Goal reached 🎉' };
    else if (isPast) pace = { cls: 'bad', text: `Finished ${left} short` };
    else if (elapsed > 0) {
      const diff = done - expected;
      pace = diff >= 0 ? { cls: 'good', text: `On track${diff > 0 ? ` · ${diff} ahead` : ''}` } : { cls: 'bad', text: `${-diff} behind schedule` };
    }
  }

  return (
    <section className={cx('card goal-card', cc.className)} style={cc.style}>
      <header>
        <span className="goal-dot" />
        <h3>{c.name}</h3>
        {done >= target && <Icon name="check" size={16} strokeWidth={3} className="goal-hit" />}
      </header>
      <div className="goal-num">
        <strong>{done}</strong>
        <span>{target > 0 ? `/ ${target}` : '/ 0'}</span>
        <em>{Math.round(pct)}%</em>
      </div>
      <span className="goal-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={`${c.name} yearly progress`}>
        <i style={{ width: `${pct}%` }} />
        {target > 0 && elapsed > 0 && elapsed < 1 && <b style={{ left: `${elapsed * 100}%` }} title={`Expected by today: ${expected} of ${target}${since ? ` (counting from ${since.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, when the goal was set)` : ''}`} />}
      </span>
      <div className="goal-meta">
        {pace && <span className={cx('goal-pace', pace.cls)}>{pace.text}</span>}
        {target > 0 && left > 0 && !isPast && weeksLeft > 0 && <span>{left} to go · ~{Math.ceil(left / weeksLeft)}/week</span>}
        {target > 0 && since && !isPast && <span className="goal-since">Pace from {since.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>}
      </div>
      <div className="goal-week">
        <div className="goal-week-head">
          <span className="k">This week</span>
          <span className="n"><b>{weekDone}</b> / {weekly}</span>
          <em>{Math.round(weekPct)}%</em>
          {weekDone >= weekly && <Icon name="check" size={14} strokeWidth={3} className="goal-hit" />}
        </div>
        <span className="goal-bar small" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(weekPct)} aria-label={`${c.name} progress this week`}>
          <i style={{ width: `${weekPct}%` }} />
        </span>
        {weekly > 0 && weekDone < weekly && <span className="goal-week-left">{weekly - weekDone} to go this week</span>}
      </div>
      <div className="goal-edit">
        <label>
          <span>Year</span>
          <input
            className="ainput"
            type="number"
            min="0"
            inputMode="numeric"
            placeholder="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), e.currentTarget.blur())}
            aria-label={`${c.name} yearly goal (cards)`}
          />
        </label>
        <label>
          <span>Week</span>
          <input
            className="ainput"
            type="number"
            min="0"
            max="100"
            inputMode="numeric"
            placeholder="0"
            value={weekValue}
            onChange={(e) => setWeekValue(e.target.value)}
            onBlur={commitWeekly}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), e.currentTarget.blur())}
            aria-label={`${c.name} weekly goal (cards)`}
          />
        </label>
        <span className="goal-edit-unit">cards</span>
      </div>
    </section>
  );
}

function CategoryProgress({ c, active, onClick }) {
  const target = c.weeklyTarget;
  const pct = target > 0 ? Math.min(100, (c.done / target) * 100) : 0;
  const hit = target > 0 && c.done >= target;
  return (
    <button type="button" className={cx('card todo-cat', catColor(c.color).className, active && 'on')} style={catColor(c.color).style} onClick={onClick} aria-pressed={active} title="Click to show only this category">
      <span className="todo-cat-head">
        <span className="todo-cat-dot" />
        <span className="todo-cat-name">{c.name}</span>
        {hit && <Icon name="check" size={14} strokeWidth={3} className="todo-cat-hit" />}
      </span>
      <strong>
        {c.done}
        <small>{target > 0 ? ` / ${target}` : ''} done</small>
      </strong>
      {target > 0 ? (
        <span className="todo-cat-bar" role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={c.done} aria-label={`${c.name} progress`}>
          <i style={{ width: `${pct}%` }} />
        </span>
      ) : (
        <span className="todo-cat-bar empty" />
      )}
      <span className="todo-cat-sub">{target > 0 ? (hit ? 'Target reached' : `${Math.round(pct)}% · ${target - c.done} to go`) : 'No target'} · {c.planned} planned</span>
    </button>
  );
}

/* ------------------------------------------------------------------ board + drag and drop */

const SECTIONS = [
  { key: 'high', label: 'High priority', icon: 'arrow-up' },
  { key: 'medium', label: 'Medium', icon: 'minus' },
  { key: 'low', label: 'Low', icon: 'arrow-down' },
  { key: null, label: 'No priority', icon: null },
  { key: 'done', label: 'Finished', icon: 'check' },
];

function Board({ week, thisWeek, tasks, cats, categories, filter, onMove, onToggle, onEdit, onDelete, onAdd }) {
  const [drag, setDrag] = useState(null); // { id }
  const [over, setOver] = useState(null); // { day, prio, index }
  const today = toKey(new Date());
  const colRefs = useRef([]);

  // Phones (board scrolls sideways): start at today's column. Wider screens show the whole week.
  const boardRef = useRef(null);
  useEffect(() => {
    const board = boardRef.current;
    if (!board || board.scrollWidth <= board.clientWidth) return;
    const i = week === thisWeek ? (new Date().getDay() + 6) % 7 : 0;
    board.scrollLeft = (colRefs.current[i]?.offsetLeft ?? 0) - board.offsetLeft;
  }, [week, thisWeek]);

  const dragged = drag && tasks.find((t) => t.id === drag.id);

  function indexAt(el, y) {
    const cards = [...el.querySelectorAll('.todo-card:not(.dragging)')];
    const i = cards.findIndex((c) => {
      const r = c.getBoundingClientRect();
      return y < r.top + r.height / 2;
    });
    return i === -1 ? cards.length : i;
  }
  const setOverIfChanged = (o) => (over?.day !== o.day || over?.prio !== o.prio || over?.index !== o.index) && setOver(o);
  const endDrag = () => {
    setDrag(null);
    setOver(null);
  };

  return (
    <div ref={boardRef} className={cx('todo-board', drag && 'dragging')} role="list" aria-label="Week board">
      {DAYS.map((name, day) => {
        const date = addDays(week, day);
        const list = tasks.filter((t) => t.day === day);
        const shown = (filter ? list.filter((t) => t.categoryId === filter) : list).sort((a, b) => a.order - b.order);
        const visibleIds = new Set(shown.map((t) => t.id));
        const done = list.filter((t) => t.done).length;
        const colOver = over?.day === day;
        return (
          <section
            key={day}
            ref={(el) => (colRefs.current[day] = el)}
            role="listitem"
            className={cx('todo-col', date === today && 'today', colOver && 'over')}
            // Dropping on the column itself (not inside a section): keep the card's priority, add at the end.
            onDragOver={(e) => {
              if (!dragged) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (!e.target.closest('.todo-sec')) {
                const prio = dragged.done ? 'done' : dragged.priority ?? null;
                setOverIfChanged({ day, prio, index: shown.filter((t) => !t.done && (t.priority ?? null) === prio && t.id !== dragged.id).length });
              }
            }}
            onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget) && setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              if (dragged && over) onMove(dragged.id, day, over.prio, over.index, filter ? visibleIds : null);
              endDrag();
            }}
          >
            <header className="todo-col-head">
              <span>
                <strong>{name}</strong>
                <small>{short(date)}{date === today && ' · Today'}</small>
              </span>
              {list.length > 0 && <em className={cx(done === list.length && 'all')}>{done}/{list.length}</em>}
            </header>

            {SECTIONS.map((sec) => {
              const cards =
                sec.key === 'done'
                  ? shown.filter((t) => t.done).sort((a, b) => new Date(b.doneAt || 0) - new Date(a.doneAt || 0)) // latest first
                  : shown.filter((t) => !t.done && (t.priority ?? null) === sec.key);
              const isOver = colOver && over.prio === sec.key;
              // Empty sections only appear while dragging, so a card can be dropped into them.
              if (!cards.length && !(drag && sec.key !== null)) return null;
              return (
                <div
                  key={sec.key ?? 'none'}
                  className={cx('todo-sec', `sec-${sec.key ?? 'none'}`, isOver && 'over', !cards.length && 'empty')}
                  onDragOver={(e) => {
                    if (!dragged) return;
                    e.preventDefault();
                    setOverIfChanged({ day, prio: sec.key, index: indexAt(e.currentTarget, e.clientY) });
                  }}
                >
                  <p className="todo-sec-head">
                    {sec.icon && <Icon name={sec.icon} size={11} strokeWidth={3} />} {sec.label}
                    {cards.length > 0 && <span>{cards.length}</span>}
                  </p>
                  <ul className="todo-cards">
                    {cards.map((t, i) => (
                      <li key={t.id} className="todo-slot">
                        {isOver && over.index === i && <span className="todo-drop" aria-hidden="true" />}
                        <Card
                          t={t}
                          cat={cats.get(t.categoryId)}
                          categories={categories}
                          dragging={drag?.id === t.id}
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', t.id);
                            setDrag({ id: t.id });
                          }}
                          onDragEnd={endDrag}
                          onToggle={() => onToggle(t)}
                          onEdit={(patch) => onEdit(t, patch)}
                          onDelete={() => onDelete(t)}
                          onMoveDay={(d) => onMove(t.id, d, t.done ? 'done' : t.priority ?? null, Infinity)}
                        />
                      </li>
                    ))}
                    {isOver && over.index >= cards.filter((c) => c.id !== drag?.id).length && <li className="todo-slot"><span className="todo-drop" aria-hidden="true" /></li>}
                    {!cards.length && !isOver && <li className="todo-sec-empty">{sec.key === 'done' ? 'Drop here to finish' : 'Drop here'}</li>}
                  </ul>
                </div>
              );
            })}

            <AddTask categories={categories} defaultCategory={filter} onAdd={(title, cid, prio) => onAdd(day, title, cid, prio)} />
          </section>
        );
      })}
    </div>
  );
}

function Card({ t, cat, categories, dragging, onDragStart, onDragEnd, onToggle, onEdit, onDelete, onMoveDay }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(t.title);
  const [cid, setCid] = useState(t.categoryId ?? '');
  const [prio, setPrio] = useState(t.priority ?? null);

  function save() {
    const patch = {};
    if (title.trim() && title.trim() !== t.title) patch.title = title.trim();
    if ((cid || null) !== (t.categoryId ?? null)) patch.categoryId = cid || null;
    if (prio !== (t.priority ?? null)) patch.priority = prio;
    if (Object.keys(patch).length) onEdit(patch);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="todo-card editing">
        <textarea className="ainput" rows={2} maxLength={200} value={title} autoFocus onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } if (e.key === 'Escape') setEditing(false); }} aria-label="Task" />
        <select className="ainput" value={cid} onChange={(e) => setCid(e.target.value)} aria-label="Category">
          <option value="">No category</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <PriorityPick value={prio} onChange={setPrio} />
        <div className="todo-card-editbar">
          <button type="button" className="abtn abtn-sm" onClick={() => setEditing(false)}>Cancel</button>
          <button type="button" className="abtn abtn-sm abtn-primary" onClick={save}>Save</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cx('todo-card', t.done && 'done', dragging && 'dragging', t.priority && `prio-${t.priority}`, cat && catColor(cat.color).className)}
      style={cat ? catColor(cat.color).style : undefined}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <button type="button" className="todo-check" onClick={onToggle} aria-pressed={t.done} aria-label={t.done ? `Mark “${t.title}” as not done` : `Mark “${t.title}” as done`}>
        {t.done && <Icon name="check" size={13} strokeWidth={3} />}
      </button>
      <div className="todo-card-body" onDoubleClick={() => setEditing(true)}>
        <p>{t.title}</p>
        {t.done && (
          <span className="todo-done-row" title={t.doneAt ? `Finished ${new Date(t.doneAt).toLocaleString()}` : 'Finished'}>
            Done{t.doneAt && <> · {new Date(t.doneAt).toLocaleDateString(undefined, { weekday: 'short' })} {new Date(t.doneAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</>}
          </span>
        )}
        <div className="todo-meta">
          {t.priority && <PriorityBadge p={t.priority} onClick={() => onEdit({ priority: PRIORITIES[(PRIORITIES.findIndex((x) => x.key === t.priority) + 1) % 3].key })} />}
          {cat && <span className="todo-pill">{cat.name}</span>}
          {t.carriedFrom && <span className="todo-carried" title={`First planned for the week of ${short(t.carriedFrom)}`}><Icon name="clock" size={11} /> Carried over</span>}
        </div>
      </div>
      <div className="todo-card-tools">
        <label className="icon-btn todo-move" title="Move to day">
          <Icon name="calendar" size={14} />
          <select value={t.day} onChange={(e) => onMoveDay(Number(e.target.value))} aria-label={`Move “${t.title}” to another day`}>
            {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        </label>
        <button type="button" className="icon-btn" onClick={() => setEditing(true)} aria-label={`Edit “${t.title}”`}><Icon name="edit" size={14} /></button>
        <button type="button" className="icon-btn danger" onClick={onDelete} aria-label={`Delete “${t.title}”`}><Icon name="trash" size={14} /></button>
      </div>
    </div>
  );
}

function AddTask({ categories, defaultCategory, onAdd }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [cid, setCid] = useState(defaultCategory ?? '');
  const [prio, setPrio] = useState('medium');
  useEffect(() => setCid(defaultCategory ?? ''), [defaultCategory]);

  function submit(e) {
    e?.preventDefault();
    if (!title.trim()) return;
    onAdd(title.trim(), cid || null, prio);
    setTitle('');
  }

  if (!open) {
    return (
      <button type="button" className="todo-add-btn" onClick={() => setOpen(true)}>
        <Icon name="plus" size={15} /> Add task
      </button>
    );
  }
  return (
    <form className="todo-add" onSubmit={submit}>
      <textarea
        className="ainput"
        rows={2}
        maxLength={200}
        placeholder="What needs doing?"
        value={title}
        autoFocus
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) submit(e);
          if (e.key === 'Escape') setOpen(false);
        }}
        aria-label="New task"
      />
      <select className="ainput" value={cid} onChange={(e) => setCid(e.target.value)} aria-label="Category">
        <option value="">No category</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <PriorityPick value={prio} onChange={setPrio} />
      <div className="todo-card-editbar">
        <button type="button" className="abtn abtn-sm" onClick={() => setOpen(false)}>Done</button>
        <button className="abtn abtn-sm abtn-primary" disabled={!title.trim()}><Icon name="plus" size={14} /> Add</button>
      </div>
    </form>
  );
}

function PriorityBadge({ p, onClick }) {
  const meta = PRIORITIES.find((x) => x.key === p);
  return (
    <button type="button" className={cx('todo-prio', p)} onClick={onClick} title="Click to change priority" aria-label={`Priority: ${meta.label}. Click to change`}>
      <Icon name={meta.icon} size={11} strokeWidth={3} /> {meta.label}
    </button>
  );
}

function PriorityPick({ value, onChange }) {
  return (
    <div className="todo-prio-pick" role="radiogroup" aria-label="Priority">
      {PRIORITIES.map((x) => (
        <button key={x.key} type="button" role="radio" aria-checked={value === x.key} className={cx('todo-prio', x.key, value === x.key && 'on')} onClick={() => onChange(value === x.key ? null : x.key)}>
          <Icon name={x.icon} size={11} strokeWidth={3} /> {x.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ categories */

function CategoryManager({ categories, onClose, onChange }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [list, setList] = useState(categories);
  const [draft, setDraft] = useState({ name: '', color: COLORS[(categories.length * 7) % COLORS.length], weeklyTarget: '' });

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const commit = (next) => {
    setList(next);
    onChange(next);
  };

  async function add(e) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    try {
      const { category } = await api.addTodoCategory({ name: draft.name.trim(), color: draft.color, weeklyTarget: Number(draft.weeklyTarget) || 0 });
      const next = [...list, category];
      commit(next);
      setDraft({ name: '', color: COLORS[(next.length * 7) % COLORS.length], weeklyTarget: '' });
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function update(c, patch) {
    const next = list.map((x) => (x.id === c.id ? { ...x, ...patch } : x));
    commit(next);
    try {
      await api.updateTodoCategory(c.id, patch);
    } catch (err) {
      commit(list);
      toast(err.message, 'error');
    }
  }

  async function remove(c) {
    const ok = await confirm({ title: `Delete “${c.name}”?`, message: 'Its tasks stay on your board, just without a category.', confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await api.deleteTodoCategory(c.id);
      commit(list.filter((x) => x.id !== c.id));
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal todo-cat-modal" role="dialog" aria-modal="true" aria-labelledby="cat-title">
        <h2 id="cat-title">Categories</h2>
        <p>Each finished card counts as 1 towards its category’s weekly target.</p>
        <div className="todo-cat-list">
          {list.length > 0 && (
            <div className="todo-cat-row head" aria-hidden="true"><span>Name</span><span>Colour</span><span>Weekly target</span><span /></div>
          )}
          {list.map((c) => (
            <CategoryRow key={c.id} c={c} onSave={(patch) => update(c, patch)} onDelete={() => remove(c)} />
          ))}
        </div>
        <form className="todo-cat-row add" onSubmit={add}>
          <input className="ainput" placeholder="New category, e.g. Gym" maxLength={40} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} aria-label="Category name" />
          <ColorPick value={draft.color} onChange={(color) => setDraft({ ...draft, color })} />
          <input className="ainput" type="number" min="0" max="100" placeholder="e.g. 5" value={draft.weeklyTarget} onChange={(e) => setDraft({ ...draft, weeklyTarget: e.target.value })} aria-label="Weekly target (cards)" />
          <button className="abtn abtn-primary" disabled={!draft.name.trim()}><Icon name="plus" size={15} /> Add</button>
        </form>
        <div className="modal-actions">
          <button type="button" className="abtn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function CategoryRow({ c, onSave, onDelete }) {
  const [name, setName] = useState(c.name);
  const [target, setTarget] = useState(String(c.weeklyTarget));
  return (
    <div className="todo-cat-row">
      <input className="ainput" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name.trim() !== c.name && onSave({ name: name.trim() })} aria-label="Category name" />
      <ColorPick value={c.color} onChange={(color) => onSave({ color })} />
      <input className="ainput" type="number" min="0" max="100" value={target} onChange={(e) => setTarget(e.target.value)} onBlur={() => Number(target) !== c.weeklyTarget && onSave({ weeklyTarget: Math.max(0, Math.round(Number(target) || 0)) })} aria-label={`${c.name} weekly target (cards)`} />
      <button type="button" className="icon-btn danger" onClick={onDelete} aria-label={`Delete ${c.name}`}><Icon name="trash" size={16} /></button>
    </div>
  );
}

function ColorPick({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const cur = catColor(value);

  useEffect(() => {
    if (!open) return;
    const away = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && (e.stopPropagation(), setOpen(false));
    document.addEventListener('pointerdown', away);
    ref.current?.addEventListener('keydown', esc);
    const el = ref.current;
    return () => {
      document.removeEventListener('pointerdown', away);
      el?.removeEventListener('keydown', esc);
    };
  }, [open]);

  const pick = (c) => {
    onChange(c);
    setOpen(false);
  };

  return (
    <div className="todo-colorpick" ref={ref}>
      <button type="button" className="todo-colorbtn" onClick={() => setOpen((o) => !o)} aria-haspopup="true" aria-expanded={open} aria-label={`Colour: ${colorName(value)}. Change colour`}>
        <span className={cx('todo-color', cur.className)} style={cur.style} />
        <Icon name="chevron-down" size={14} />
      </button>
      {open && (
        <div className="todo-colorpop" role="radiogroup" aria-label="Colour">
          <div className="todo-swatches">
            {PALETTE.map(([hex, name]) => (
              <button key={hex} type="button" role="radio" aria-checked={value === hex} className={cx('todo-color', 'a-custom', value === hex && 'on')} style={{ '--a': hex }} onClick={() => pick(hex)} aria-label={name} title={name} />
            ))}
          </div>
          <label className="todo-custom">
            <span className={cx('todo-color', 'a-custom', isHex(value) && !COLORS.includes(value) && 'on')} style={{ '--a': isHex(value) ? value : '#888888' }} />
            Custom colour…
            <input type="color" value={isHex(value) ? value : '#3b82f6'} onChange={(e) => onChange(e.target.value)} aria-label="Pick any colour" />
          </label>
        </div>
      )}
    </div>
  );
}
