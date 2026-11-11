// SDE-2 prep: YouTube playlists / channels followed lesson by lesson. Each course lists L-1 … L-X
// (X is set per course) with a checkbox per lesson. Shift-click ticks a whole range.
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
const watchUrl = (t, v) => `https://www.youtube.com/watch?v=${v.videoId}${t.kind === 'playlist' && t.sourceId ? `&list=${t.sourceId}` : ''}`;
const thumb = (v) => v && `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`;
const sourceUrl = (t) =>
  t.kind === 'playlist' ? `https://www.youtube.com/playlist?list=${t.sourceId}` : t.url || (t.sourceId && `https://www.youtube.com/playlist?list=${t.sourceId}`);

export default function Sde() {
  const toast = useToast();
  const [tracks, setTracks] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(store.get);

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
      <PageHeader title="SDE-2" subtitle="YouTube courses, lesson by lesson — tick each one off as you finish it." icon="graduation" accent="blue" />
      {error && <ErrorBox error={error} onRetry={load} />}
      {!tracks && !error && <Spinner />}
      {tracks && (
        <>
          <AddCourse
            first={!tracks.length}
            onAdded={(track, warning) => {
              setTracks((list) => [...list, track]);
              pick(track.id);
              toast(warning || `Added “${track.title}” — ${track.total} lessons`, warning ? 'error' : undefined);
            }}
          />
          {tracks.length > 0 && (
            <div className="sde-courses" role="tablist" aria-label="Courses">
              {tracks.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={t.id === current?.id} className={cx('card sde-course', t.id === current?.id && 'on')} onClick={() => pick(t.id)}>
                  <span className="sde-cover">{videoFor(t, 1) ? <img src={thumb(videoFor(t, 1))} alt="" loading="lazy" /> : <Icon name="graduation" size={22} />}</span>
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

function AddCourse({ first, onAdded }) {
  const toast = useToast();
  const [form, setForm] = useState({ url: '', total: '', title: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState({});
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr({});
    try {
      const r = await api.addSde({ url: form.url, title: form.title, total: form.total || undefined });
      setForm({ url: '', total: '', title: '' });
      onAdded(r.track, r.warning);
    } catch (e2) {
      setErr(e2.fields ?? (e2.status === 502 ? { total: 'Enter the number of lessons.' } : {}));
      toast(e2.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card sde-add" onSubmit={submit} noValidate>
      <h2><Icon name="plus" size={18} /> {first ? 'Add your first course' : 'Add a course'}</h2>
      <div className="sde-add-row">
        <div className={cx('afield sde-add-url', err.url && 'has-error')}>
          <label htmlFor="sde-url">YouTube playlist or channel link</label>
          <input id="sde-url" className="ainput" value={form.url} onChange={set('url')} placeholder="youtube.com/playlist?list=…  or  youtube.com/@channel" autoComplete="off" />
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

  const nextVideo = next && videoFor(t, next);
  const link = sourceUrl(t);

  return (
    <section className="card sde-detail">
      <header className="sde-detail-head">
        <div className="sde-detail-title">
          <h2>{t.title}</h2>
          <p>
            {t.kind === 'channel' ? 'Channel' : t.kind === 'manual' ? 'Manual list' : 'Playlist'}
            {t.channel && t.channel !== t.title && ` · ${t.channel}`}
            {t.videos.length > 0 && ` · ${t.videos.length} videos on YouTube`}
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
            {nextVideo && (
              <a className="abtn abtn-sm abtn-primary" href={watchUrl(t, nextVideo)} target="_blank" rel="noreferrer">
                <Icon name="external" size={15} /> Watch
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
      <p className="sde-tip">Tip: hold Shift and click a second box to tick every lesson in between.</p>

      {lessons.length ? (
        <ol className="sde-list">
          {lessons.map(({ n, v, isDone }) => (
            <li key={n} className={cx('sde-row', isDone && 'is-done', n === next && 'is-next')}>
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
              {v ? (
                <a className="sde-title" href={watchUrl(t, v)} target="_blank" rel="noreferrer" title={v.title}>{v.title || 'Untitled video'}</a>
              ) : (
                <span className="sde-title muted">Lesson {n}</span>
              )}
              {v?.duration && <span className="sde-dur">{v.duration}</span>}
            </li>
          ))}
        </ol>
      ) : (
        <p className="sde-none">{query ? 'No lessons match that search.' : filter === 'done' ? 'Nothing ticked yet.' : 'Every lesson is done.'}</p>
      )}
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
      onSaved((await api.updateSde(t.id, { title: form.title, total: form.total, skip: form.skip || 0 })).track);
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
    <form className="sde-settings" onSubmit={save} noValidate>
      <div className={cx('afield', err.title && 'has-error')}>
        <label htmlFor="sde-s-title">Name</label>
        <input id="sde-s-title" className="ainput" value={form.title} onChange={set('title')} />
        {err.title && <span className="err">{err.title}</span>}
      </div>
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
      <button className="abtn abtn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
    </form>
  );
}
