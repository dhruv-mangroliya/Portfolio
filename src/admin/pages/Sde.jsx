// SDE-2 prep: YouTube playlists / channels followed lesson by lesson, plus your own lists (tasks or any
// video links). Each course lists L-1 … L-X with a checkbox per lesson. Shift-click ticks a whole range.
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api.js';
import Icon from '../../shared/Icon.jsx';
import { cx } from '../../shared/utils.js';
import { ErrorBox, PageHeader, Spinner, useConfirm, useToast } from '../ui.jsx';

const SELECTED_KEY = 'admin-sde-course';
const store = {
  get: () => { try { return localStorage.getItem(SELECTED_KEY); } catch { return null; } },
  set: (v) => { try { localStorage.setItem(SELECTED_KEY, v); } catch { /* private mode */ } },
};

const doneCount = (t) => t.done.filter((n) => n <= t.total).length;
const pct = (t) => Math.round((doneCount(t) / t.total) * 100);
const videoFor = (t, n) => t.videos[(t.skip || 0) + n - 1];
const isOwn = (t) => t.kind === 'manual';
const watchUrl = (t, v) =>
  v.url || (v.videoId ? `https://www.youtube.com/watch?v=${v.videoId}${t.kind === 'playlist' && t.sourceId ? `&list=${t.sourceId}` : ''}` : '');
const thumb = (v) => v?.videoId && `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`;
const coverOf = (t) => (isOwn(t) ? t.videos.find((v) => v.videoId) : videoFor(t, 1));
const sourceUrl = (t) =>
  isOwn(t) ? '' : t.kind === 'playlist' ? `https://www.youtube.com/playlist?list=${t.sourceId}` : t.url || (t.sourceId && `https://www.youtube.com/playlist?list=${t.sourceId}`);

/** One lesson per line: "Title | link", "Title link", just a link, or just a title. Leading bullets / numbers are dropped. */
export function parseLines(text) {
  return text
    .split('\n')
    .map((l) => l.trim().replace(/^([-*•]|\d+[.)]|L-?\d+[.):]?)\s+/i, '').trim())
    .filter(Boolean)
    .map((line) => {
      const bar = line.lastIndexOf('|');
      if (bar > -1 && /^https?:\/\//i.test(line.slice(bar + 1).trim())) return { title: line.slice(0, bar).trim().slice(0, 200), url: line.slice(bar + 1).trim() };
      const m = line.match(/^(.*?)\s*(https?:\/\/\S+)$/i);
      if (m) return { title: m[1].replace(/[\s:–-]+$/, '').slice(0, 200), url: m[2] };
      return { title: line.slice(0, 200), url: '' };
    });
}

export default function Sde() {
  const toast = useToast();
  const [tracks, setTracks] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(store.get);
  const [adding, setAdding] = useState(false);

  const load = () => {
    setError(null);
    api.sde().then((r) => setTracks(r.tracks), setError);
  };
  useEffect(load, []);

  const pick = (id) => { setSelected(id); store.set(id); };
  const current = tracks?.find((t) => t.id === selected) ?? tracks?.[0];
  const replace = (track) => setTracks((list) => list.map((t) => (t.id === track.id ? track : t)));

  return (
    <div className="page sde-page a-blue">
      <PageHeader title="SDE-2" subtitle="YouTube courses and your own lists, lesson by lesson — tick each one off as you finish it." icon="graduation"
        accent="blue"
        actions={tracks?.length > 0 && !adding && (
          <button type="button" className="abtn abtn-primary" onClick={() => setAdding(true)}>
            <Icon name="plus" size={18} /> Add course
          </button>
        )}
      />
      {error && <ErrorBox error={error} onRetry={load} />}
      {!tracks && !error && <Spinner />}
      {tracks && (
        <>
          {tracks.length > 0 && <Overall tracks={tracks} />}
          {(adding || !tracks.length) && <AddCourse
            first={!tracks.length}
            onClose={tracks.length ? () => setAdding(false) : null}
            onAdded={(track, warning) => {
              setAdding(false);
              setTracks((list) => [...list, track]);
              pick(track.id);
              toast(warning || `Added “${track.title}” — ${track.total} lessons`, warning ? 'error' : undefined);
            }}
          />}
          {tracks.length > 0 && (
            <div className="sde-courses" role="tablist" aria-label="Courses">
              {tracks.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={t.id === current?.id} className={cx('card sde-course', t.id === current?.id && 'on')} onClick={() => pick(t.id)}>
                  <span className="sde-cover">{thumb(coverOf(t)) ? <img src={thumb(coverOf(t))} alt="" loading="lazy" /> : <Icon name={isOwn(t) ? 'list' : 'graduation'} size={22} />}</span>
                  <span className="sde-course-body">
                    <strong>{t.title}</strong>
                    <span className="sde-course-meta">{doneCount(t)} / {t.total} lessons · {pct(t)}%</span>
                    <span className="goal-bar"><i style={{ width: `${pct(t)}%` }} /></span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {current && (
            <Course
              key={current.id}
              track={current}
              onChange={replace}
              onDeleted={() => {
                setTracks((list) => list.filter((t) => t.id !== current.id));
                pick('');
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function AddCourse({ first, onAdded, onClose }) {
  const toast = useToast();
  const [mode, setMode] = useState('youtube'); // 'youtube' | 'own'
  const [form, setForm] = useState({ url: '', total: '', title: '', lines: '' });
  const [busy, setBusy] = useState(false);
  const items = useMemo(() => parseLines(form.lines), [form.lines]);
  const [err, setErr] = useState({});
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr({});
    try {
      const r =
        mode === 'own'
          ? await api.addSde({ title: form.title, items })
          : await api.addSde({ url: form.url, title: form.title, total: form.total || undefined });
      setForm({ url: '', total: '', title: '', lines: '' });
      onAdded(r.track, r.warning);
    } catch (e2) {
      setErr(e2.fields ?? (e2.status === 502 ? { total: 'Enter the number of lessons.' } : {}));
      toast(e2.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card sde-add" onSubmit={submit} onKeyDown={(e) => e.key === 'Escape' && onClose?.()} noValidate>
      <div className="sde-add-head">
        <h2><Icon name="plus" size={18} /> {first ? 'Add your first course' : 'Add a course'}</h2>
        <div className="sde-chips" role="group" aria-label="Course type">
          <button type="button" className={cx('chip-btn', mode === 'youtube' && 'on')} aria-pressed={mode === 'youtube'} onClick={() => { setMode('youtube'); setErr({}); }}>YouTube link</button>
          <button type="button" className={cx('chip-btn', mode === 'own' && 'on')} aria-pressed={mode === 'own'} onClick={() => { setMode('own'); setErr({}); }}>My own list</button>
        </div>
        {onClose && (
          <button type="button" className="icon-btn sde-add-close" onClick={onClose} aria-label="Close" title="Close"><Icon name="x" size={18} /></button>
        )}
      </div>
      {mode === 'own' ? (
        <>
          <div className={cx('afield', err.title && 'has-error')}>
            <label htmlFor="sde-own-title">Name</label>
            <input id="sde-own-title" className="ainput" value={form.title} onChange={set('title')} placeholder="e.g. System design, LLD practice, Mock interviews" />
            {err.title && <span className="err">{err.title}</span>}
          </div>
          <div className={cx('afield', (err.items || err['items.0.title'] || err['items.0.url']) && 'has-error')}>
            <label htmlFor="sde-own-lines">Lessons — one per line</label>
            <textarea id="sde-own-lines" className="ainput sde-lines" rows={6} value={form.lines} onChange={set('lines')}
              placeholder={'Design a URL shortener\nCAP theorem | https://youtu.be/…\nhttps://www.youtube.com/watch?v=…\nRead chapter 5 of DDIA'} />
            {Object.entries(err).filter(([k]) => k.startsWith('items')).slice(0, 1).map(([k, m]) => <span key={k} className="err">{m}</span>)}
          </div>
          <div className="sde-own-foot">
            <p className="goal-help">Each line becomes the next L-number. Write a task, paste a video link, or both (“Title | link”). YouTube links get their video title when you leave the name out.</p>
            <button className="abtn abtn-primary sde-add-btn" disabled={busy || !items.length}>
              {busy ? 'Adding…' : items.length ? `Add list · ${items.length} lesson${items.length === 1 ? '' : 's'}` : 'Add list'}
            </button>
          </div>
        </>
      ) : (
      <>
      <div className="sde-add-row">
        <div className={cx('afield sde-add-url', err.url && 'has-error')}>
          <label htmlFor="sde-url">YouTube playlist or channel link</label>
          <input id="sde-url" autoFocus={!!onClose} className="ainput" value={form.url} onChange={set('url')} placeholder="youtube.com/playlist?list=…  or  youtube.com/@channel" autoComplete="off" />
          {err.url && <span className="err">{err.url}</span>}
        </div>
        <div className={cx('afield sde-add-x', err.total && 'has-error')}>
          <label htmlFor="sde-total">Lessons (X)</label>
          <input id="sde-total" className="ainput" type="number" min="1" max="5000" inputMode="numeric" value={form.total} onChange={set('total')} placeholder="All" />
          {err.total && <span className="err">{err.total}</span>}
        </div>
        <div className={cx('afield sde-add-name', err.title && 'has-error')}>
          <label htmlFor="sde-title">Name <span className="sde-opt">(optional)</span></label>
          <input id="sde-title" className="ainput" value={form.title} onChange={set('title')} placeholder="From YouTube" />
        </div>
        <button className="abtn abtn-primary sde-add-btn" disabled={busy}>
          {busy ? 'Reading videos…' : 'Add course'}
        </button>
      </div>
      <p className="goal-help">Leave Lessons empty to track every video. A channel is listed oldest video first, so L-1 is its first upload.</p>
      </>
      )}
    </form>
  );
}

function Course({ track: t, onChange, onDeleted }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState('');
  const [editLesson, setEditLesson] = useState(null); // lesson number being edited (own lists)
  const own = isOwn(t);
  const lastClicked = useRef(null);
  const shift = useRef(false);
  const latest = useRef(0); // only the newest tick request may overwrite the list

  const done = useMemo(() => new Set(t.done), [t.done]);
  const count = doneCount(t);
  const percent = pct(t);
  const next = useMemo(() => {
    for (let n = 1; n <= t.total; n++) if (!done.has(n)) return n;
    return null;
  }, [t.total, done]);

  const lessons = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = [];
    for (let n = 1; n <= t.total; n++) {
      const v = videoFor(t, n);
      const isDone = done.has(n);
      if (filter === 'todo' && isDone) continue;
      if (filter === 'done' && !isDone) continue;
      if (q && !`l-${n} l${n} ${v?.title ?? ''}`.toLowerCase().includes(q)) continue;
      out.push({ n, v, isDone });
    }
    return out;
  }, [t, done, filter, query]);

  async function mark(list, value) {
    const prev = t;
    const nextDone = value ? [...new Set([...t.done, ...list])] : t.done.filter((n) => !list.includes(n));
    onChange({ ...t, done: nextDone }); // optimistic
    const req = ++latest.current;
    try {
      const r = await api.markSde(t.id, list, value);
      if (req === latest.current) onChange(r.track);
    } catch (err) {
      if (req === latest.current) onChange(prev);
      toast(err.message, 'error');
    }
  }

  function toggle(n, value) {
    const from = lastClicked.current;
    lastClicked.current = n;
    if (shift.current && from && from !== n) {
      const [a, b] = from < n ? [from, n] : [n, from];
      const range = [];
      for (let i = a; i <= b; i++) range.push(i);
      return mark(range, value);
    }
    mark([n], value);
  }

  async function refresh() {
    setBusy('refresh');
    try {
      const r = await api.refreshSde(t.id);
      onChange(r.track);
      toast(`Updated — ${r.track.videos.length} videos on YouTube`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy('');
    }
  }

  async function remove() {
    const ok = await confirm({ title: `Delete “${t.title}”?`, message: 'The course and its ticked lessons will be removed.', confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await api.deleteSde(t.id);
      onDeleted();
      toast('Course deleted');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  /** Own-list lesson actions (move / delete); edits go through LessonEditor. */
  async function lessonOp(fn, success) {
    try {
      onChange((await fn()).track);
      if (success) toast(success);
    } catch (err) {
      toast(err.message, 'error');
    }
  }
  async function removeLesson(n, v) {
    const ok = await confirm({ title: `Delete L-${n}?`, message: `“${v?.title || `Lesson ${n}`}” will be removed and the lessons after it move up one number.`, confirmLabel: 'Delete' });
    if (ok) lessonOp(() => api.deleteSdeItem(t.id, n), `Deleted L-${n}`);
  }

  const nextVideo = next && videoFor(t, next);
  const nextLink = nextVideo && watchUrl(t, nextVideo);
  const link = sourceUrl(t);

  return (
    <section className="card sde-detail">
      <header className="sde-detail-head">
        <div className="sde-detail-title">
          <h2>{t.title}</h2>
          <p>
            {t.kind === 'channel' ? 'Channel' : own ? 'Your list' : 'Playlist'}
            {t.channel && t.channel !== t.title && ` · ${t.channel}`}
            {own ? ` · ${t.total} lessons` : t.videos.length > 0 && ` · ${t.videos.length} videos on YouTube`}
          </p>
        </div>
        <div className="sde-actions">
          {link && (
            <a className="icon-btn" href={link} target="_blank" rel="noreferrer" aria-label="Open on YouTube" title="Open on YouTube"><Icon name="external" size={18} /></a>
          )}
          {t.sourceId && (
            <button type="button" className={cx('icon-btn', busy === 'refresh' && 'spin')} onClick={refresh} disabled={!!busy} aria-label="Refresh videos from YouTube" title="Refresh videos from YouTube"><Icon name="refresh" size={18} /></button>
          )}
          <button type="button" className={cx('icon-btn', editing && 'on')} onClick={() => setEditing((v) => !v)} aria-expanded={editing} aria-label="Course settings" title="Course settings"><Icon name="settings" size={18} /></button>
          <button type="button" className="icon-btn danger" onClick={remove} aria-label="Delete course" title="Delete course"><Icon name="trash" size={18} /></button>
        </div>
      </header>

      {editing && <Settings track={t} onSaved={(track) => { onChange(track); setEditing(false); }} />}

      <div className="sde-progress">
        <div className="goal-num">
          <strong>{count}</strong>
          <span>/ {t.total} lessons</span>
          <em>{percent}%{count === t.total && ' ✓'}</em>
        </div>
        <span className="goal-bar" role="progressbar" aria-valuemin={0} aria-valuemax={t.total} aria-valuenow={count} aria-label="Lessons finished">
          <i style={{ width: `${percent}%` }} />
        </span>
        {next ? (
          <div className="sde-next">
            <span className="sde-next-label">Next up</span>
            <span className="sde-l">L-{next}</span>
            <span className="sde-next-title">{nextVideo?.title || `Lesson ${next}`}</span>
            {nextLink && (
              <a className="abtn abtn-sm abtn-primary" href={nextLink} target="_blank" rel="noreferrer">
                <Icon name="external" size={15} /> {nextVideo.videoId ? 'Watch' : 'Open'}
              </a>
            )}
          </div>
        ) : (
          <div className="sde-next sde-finished"><Icon name="check" size={18} /> All {t.total} lessons finished.</div>
        )}
      </div>

      <div className="sde-toolbar">
        <div className="sde-chips" role="group" aria-label="Show">
          {[['all', `All ${t.total}`], ['todo', `To do ${t.total - count}`], ['done', `Done ${count}`]].map(([k, label]) => (
            <button key={k} type="button" className={cx('chip-btn', filter === k && 'on')} onClick={() => setFilter(k)} aria-pressed={filter === k}>{label}</button>
          ))}
        </div>
        <input className="ainput sde-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search lessons" aria-label="Search lessons" />
      </div>
      <p className="sde-tip">Tip: hold Shift and click a second box to tick every lesson in between.{own && ' Hover a lesson to edit, move or delete it.'}</p>

      {lessons.length ? (
        <ol className="sde-list">
          {lessons.map(({ n, v, isDone }) => editLesson === n ? (
            <li key={n} className="sde-row is-editing">
              <LessonEditor
                track={t}
                n={n}
                lesson={v}
                onDone={(track) => { if (track) onChange(track); setEditLesson(null); }}
                onMove={(to) => { setEditLesson(to); lessonOp(() => api.moveSdeItem(t.id, n, to)); }}
                onDelete={() => { setEditLesson(null); removeLesson(n, v); }}
              />
            </li>
          ) : (
            <li key={n} className={cx('sde-row', isDone && 'is-done', n === next && 'is-next', own && 'is-own')}>
              <label className="sde-check">
                <input
                  type="checkbox"
                  checked={isDone}
                  onClick={(e) => { shift.current = e.shiftKey; }}
                  onChange={(e) => toggle(n, e.target.checked)}
                  aria-label={`L-${n}${v?.title ? ` ${v.title}` : ''}`}
                />
                <span className="sde-box" aria-hidden="true"><Icon name="check" size={14} /></span>
                <span className="sde-l">L-{n}</span>
              </label>
              {v && watchUrl(t, v) ? (
                <a className="sde-title" href={watchUrl(t, v)} target="_blank" rel="noreferrer" title={v.title}>
                  {v.title || 'Untitled video'}
                  {own && <Icon name="external" size={13} />}
                </a>
              ) : (
                <span className={cx('sde-title', !v && 'muted')} title={v?.title}>{v?.title || `Lesson ${n}`}</span>
              )}
              {v?.duration && <span className="sde-dur">{v.duration}</span>}
              {own && (
                <span className="sde-row-actions">
                  <button type="button" className="icon-btn sde-ra-extra" disabled={n === 1} onClick={() => lessonOp(() => api.moveSdeItem(t.id, n, n - 1))} aria-label={`Move L-${n} up`} title="Move up"><Icon name="up" size={16} /></button>
                  <button type="button" className="icon-btn sde-ra-extra" disabled={n === t.total} onClick={() => lessonOp(() => api.moveSdeItem(t.id, n, n + 1))} aria-label={`Move L-${n} down`} title="Move down"><Icon name="down" size={16} /></button>
                  <button type="button" className="icon-btn" onClick={() => setEditLesson(n)} aria-label={`Edit L-${n}`} title="Edit"><Icon name="edit" size={16} /></button>
                  <button type="button" className="icon-btn danger sde-ra-extra" disabled={t.total === 1} onClick={() => removeLesson(n, v)} aria-label={`Delete L-${n}`} title="Delete"><Icon name="trash" size={16} /></button>
                </span>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="sde-none">{query ? 'No lessons match that search.' : filter === 'done' ? 'Nothing ticked yet.' : 'Every lesson is done.'}</p>
      )}
      {own && <AddLessons track={t} onAdded={onChange} />}
    </section>
  );
}

function Settings({ track: t, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ title: t.title, total: String(t.total), skip: String(t.skip || 0) });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setErr({});
    try {
      onSaved((await api.updateSde(t.id, isOwn(t) ? { title: form.title } : { title: form.title, total: form.total, skip: form.skip || 0 })).track);
      toast('Course updated');
    } catch (e2) {
      setErr(e2.fields ?? {});
      toast(e2.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const fill = Math.max(0, t.videos.length - (Number(form.skip) || 0));
  return (
    <form className={cx('sde-settings', isOwn(t) && 'is-own')} onSubmit={save} noValidate>
      <div className={cx('afield', err.title && 'has-error')}>
        <label htmlFor="sde-s-title">Name</label>
        <input id="sde-s-title" className="ainput" value={form.title} onChange={set('title')} />
        {err.title && <span className="err">{err.title}</span>}
      </div>
      {!isOwn(t) && (<>
      <div className={cx('afield', err.total && 'has-error')}>
        <label htmlFor="sde-s-total">Lessons (X)</label>
        <input id="sde-s-total" className="ainput" type="number" min="1" max="5000" value={form.total} onChange={set('total')} />
        {err.total ? <span className="err">{err.total}</span> : t.videos.length > 0 && (
          <button type="button" className="sde-link" onClick={() => setForm((f) => ({ ...f, total: String(fill || 1) }))}>Use all {fill}</button>
        )}
      </div>
      <div className={cx('afield', err.skip && 'has-error')}>
        <label htmlFor="sde-s-skip">Skip first videos</label>
        <input id="sde-s-skip" className="ainput" type="number" min="0" max="5000" value={form.skip} onChange={set('skip')} />
        {err.skip ? <span className="err">{err.skip}</span> : <span className="sde-hint">L-1 = video #{(Number(form.skip) || 0) + 1}</span>}
      </div>
      </>)}
      <button className="abtn abtn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
    </form>
  );
}

/** Inline editor for one lesson of your own list. */
function LessonEditor({ track: t, n, lesson, onDone, onMove, onDelete }) {
  const toast = useToast();
  const [form, setForm] = useState({ title: lesson?.title ?? '', url: lesson?.url ?? '' });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      onDone((await api.updateSdeItem(t.id, n, form)).track);
    } catch (e2) {
      setErr(e2.fields ?? {});
      toast(e2.message, 'error');
      setBusy(false);
    }
  }

  return (
    <form className="sde-edit" onSubmit={save} onKeyDown={(e) => e.key === 'Escape' && onDone(null)} noValidate>
      <span className="sde-l">L-{n}</span>
      <input className={cx('ainput', err.title && 'is-bad')} value={form.title} onChange={set('title')} placeholder="Name" aria-label={`L-${n} name`} autoFocus />
      <input className={cx('ainput', err.url && 'is-bad')} value={form.url} onChange={set('url')} placeholder="Link (optional)" aria-label={`L-${n} link`} title={err.url} />
      <button className="abtn abtn-sm abtn-primary" disabled={busy}>Save</button>
      <button type="button" className="abtn abtn-sm" onClick={() => onDone(null)}>Cancel</button>
      {/* On phones the row only shows the pencil, so moving / deleting lives here too. */}
      <span className="sde-edit-more">
        <button type="button" className="icon-btn" disabled={n === 1} onClick={() => onMove(n - 1)} aria-label={`Move L-${n} up`}><Icon name="up" size={16} /></button>
        <button type="button" className="icon-btn" disabled={n === t.total} onClick={() => onMove(n + 1)} aria-label={`Move L-${n} down`}><Icon name="down" size={16} /></button>
        <button type="button" className="icon-btn danger" disabled={t.total === 1} onClick={onDelete} aria-label={`Delete L-${n}`}><Icon name="trash" size={16} /></button>
      </span>
    </form>
  );
}

/** Adds more lessons to the end of your own list. */
function AddLessons({ track: t, onAdded }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const items = useMemo(() => parseLines(text), [text]);

  async function add(e) {
    e.preventDefault();
    if (!items.length) return;
    setBusy(true);
    try {
      const r = await api.addSdeItems(t.id, items);
      onAdded(r.track);
      setText('');
      toast(items.length === 1 ? `Added L-${r.track.total}` : `Added L-${r.track.total - items.length + 1} to L-${r.track.total}`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="sde-add-lessons" onSubmit={add} noValidate>
      <label htmlFor={`sde-more-${t.id}`}><Icon name="plus" size={16} /> Add lessons <span className="sde-opt">— one per line, starting at L-{t.total + 1}</span></label>
      <div className="sde-add-lessons-row">
        <textarea
          id={`sde-more-${t.id}`}
          className="ainput sde-lines"
          rows={Math.min(6, Math.max(1, text.split('\n').length))}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add(e); }}
          placeholder="Task, video link, or “Title | link”"
        />
        <button className="abtn abtn-primary" disabled={busy || !items.length}>{busy ? 'Adding…' : items.length > 1 ? `Add ${items.length}` : 'Add'}</button>
      </div>
    </form>
  );
}

/** All courses together: lessons done / lessons in total. */
function Overall({ tracks }) {
  const total = tracks.reduce((a, t) => a + t.total, 0);
  const done = tracks.reduce((a, t) => a + doneCount(t), 0);
  const percent = total ? Math.floor((done / total) * 1000) / 10 : 0;
  const finished = tracks.filter((t) => doneCount(t) === t.total).length;
  return (
    <section className="card sde-overall" aria-label="Overall progress">
      <div className="sde-overall-head">
        <span className="sde-next-label">Overall progress</span>
        <span className="sde-course-meta">
          {tracks.length} course{tracks.length === 1 ? '' : 's'} · {finished} finished · {total - done} lessons to go
        </span>
      </div>
      <div className="goal-num">
        <strong>{done}</strong>
        <span>/ {total} lessons done</span>
        <em>{percent}%{done === total && ' ✓'}</em>
      </div>
      <span className="goal-bar sde-overall-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="All lessons finished">
        <i style={{ width: `${(done / total) * 100}%` }} />
      </span>
    </section>
  );
}
