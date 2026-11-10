// Appearance: pick a preset or fine-tune every colour, with a live preview. Saved to MongoDB and
// applied to the public site and this dashboard.
import { forwardRef, useEffect, useRef, useState } from 'react';
import { api } from '../../api.js';
import Icon from '../../shared/Icon.jsx';
import { applyTheme, contrast, PRESETS, readableOn } from '../../shared/theme.js';
import { cx } from '../../shared/utils.js';
import { useUnsavedGuard } from '../hooks.js';
import { ErrorBox, PageHeader, Spinner, useConfirm, useToast } from '../ui.jsx';

const COLOR_FIELDS = [
  ['background', 'Page background', 'Behind everything on the website.'],
  ['surface', 'Cards & panels', 'Project, experience and service cards.'],
  ['text', 'Text', 'Headings and body text.'],
  ['primary', 'Primary', 'Buttons, links, highlights, timeline.'],
  ['accent', 'Accent', 'Badges, markers and highlights on dark panels.'],
  ['dark', 'Dark sections', 'Contact panel, dashboard sidebar, login page.'],
];

const fromPreset = (key) => {
  const { label, ...rest } = PRESETS[key];
  return { preset: key, ...structuredClone(rest) };
};

export default function Appearance() {
  const toast = useToast();
  const confirm = useConfirm();
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const previewRef = useRef(null);

  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(saved);
  useUnsavedGuard(dirty);

  useEffect(() => {
    api
      .theme()
      .then(({ theme }) => {
        setSaved(theme);
        setDraft(theme);
      })
      .catch(setError);
  }, []);

  // Live preview: only the preview box changes until you save.
  useEffect(() => {
    if (draft && previewRef.current) applyTheme(draft, previewRef.current, { remember: false });
  }, [draft]);

  const edit = (fn) => setDraft((d) => ({ ...fn(structuredClone(d)), preset: 'custom' }));
  const setColor = (k, v) => edit((d) => ((d.colors[k] = v), d));
  const setStop = (i, v) => edit((d) => ((d.gradient[i] = v), d));
  const setSlot = (i, v) => edit((d) => ((d.palette[i] = v), d));

  async function save() {
    setBusy(true);
    try {
      const theme = await api.saveTheme(draft);
      setSaved(theme);
      setDraft(theme);
      applyTheme(theme); // dashboard + remembered for the website
      toast('Theme saved — your website now uses these colours');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function resetDefault() {
    const ok = await confirm({
      title: 'Go back to the default theme?',
      message: 'Black · White · Navy · Yellow. You still need to save afterwards.',
      confirmLabel: 'Use default',
      danger: false,
    });
    if (ok) setDraft(fromPreset('navy-gold'));
  }

  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  if (!draft) return <div className="page"><Spinner /></div>;

  const warnings = contrastWarnings(draft);

  return (
    <div className="page">
      <PageHeader
        title="Appearance"
        subtitle="Choose your website’s colours. Changes show in the preview until you save."
        icon="palette"
        accent="cyan"
      />

      <section className="card form-card">
        <h2 className="form-section-title"><Icon name="sparkles" size={18} /> Start from a preset</h2>
        <div className="preset-grid">
          {Object.entries(PRESETS).map(([key, p]) => (
            <button
              key={key}
              type="button"
              className={cx('preset', draft.preset === key && 'on')}
              onClick={() => setDraft(fromPreset(key))}
              aria-pressed={draft.preset === key}
            >
              <span className="preset-swatch" style={{ background: p.colors.background }}>
                <i style={{ background: p.colors.text }} />
                <i style={{ background: p.colors.primary }} />
                <i style={{ background: p.colors.accent }} />
                <i style={{ background: p.colors.dark }} />
              </span>
              <span className="preset-name">{p.label}</span>
              {draft.preset === key && <Icon name="check" size={16} className="preset-check" />}
            </button>
          ))}
        </div>
        {draft.preset === 'custom' && <p className="help">Custom colours — based on your changes below.</p>}
      </section>

      <div className="appearance-grid">
        <div className="appearance-controls">
          <section className="card form-card">
            <h2 className="form-section-title"><Icon name="palette" size={18} /> Main colours</h2>
            <div className="color-list">
              {COLOR_FIELDS.map(([k, label, help]) => (
                <ColorField key={k} label={label} help={help} value={draft.colors[k]} onChange={(v) => setColor(k, v)} />
              ))}
            </div>
            {warnings.length > 0 && (
              <ul className="contrast-warn">
                {warnings.map((w) => (
                  <li key={w}><Icon name="alert" size={16} /> {w}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="card form-card">
            <h2 className="form-section-title"><Icon name="layers" size={18} /> Gradient</h2>
            <p className="help">Used for the main buttons, the logo, the scrolling banner and big headings.</p>
            <div className="grad-bar" style={{ background: `linear-gradient(110deg, ${draft.gradient.join(', ')})` }} />
            <div className="color-row-inline">
              {draft.gradient.map((c, i) => (
                <ColorField key={i} compact label={`Stop ${i + 1}`} value={c} onChange={(v) => setStop(i, v)} />
              ))}
              {draft.gradient.length === 2 ? (
                <button type="button" className="abtn abtn-dashed abtn-sm" onClick={() => edit((d) => (d.gradient.push(d.colors.accent), d))}>
                  <Icon name="plus" size={14} /> Add stop
                </button>
              ) : (
                <button type="button" className="abtn abtn-sm" onClick={() => edit((d) => (d.gradient.pop(), d))}>
                  <Icon name="trash" size={14} /> Remove stop 3
                </button>
              )}
            </div>
          </section>

          <section className="card form-card">
            <h2 className="form-section-title"><Icon name="folder" size={18} /> Card colours</h2>
            <p className="help">Projects, experience, services and skills cycle through these (or pick one per project).</p>
            <div className="color-row-inline">
              {draft.palette.map((c, i) => (
                <ColorField key={i} compact label={`Colour ${i + 1}`} value={c} onChange={(v) => setSlot(i, v)} />
              ))}
            </div>
          </section>
        </div>

        <aside className="appearance-preview">
          <p className="preview-label"><Icon name="eye" size={14} /> Live preview</p>
          <ThemePreview ref={previewRef} palette={draft.palette} />
        </aside>
      </div>

      <div className="save-bar">
        <span className="save-state">
          {dirty ? <><i className="dot warn" /> Unsaved changes</> : <><i className="dot ok" /> Saved — live on your site</>}
        </span>
        <button type="button" className="abtn" onClick={resetDefault}>Reset to default</button>
        {dirty && <button type="button" className="abtn" onClick={() => setDraft(saved)}>Discard</button>}
        <button type="button" className="abtn abtn-primary" onClick={save} disabled={busy || !dirty}>
          {busy ? 'Saving…' : <><Icon name="check" size={16} /> Save theme</>}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

function ColorField({ label, help, value, onChange, compact }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = (v) => {
    const t = v.trim().startsWith('#') ? v.trim() : `#${v.trim()}`;
    if (/^#[0-9a-f]{6}$/i.test(t)) onChange(t.toLowerCase());
    else setText(value);
  };
  return (
    <label className={cx('color-field', compact && 'compact')}>
      <span className="color-swatch" style={{ background: value }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} />
      </span>
      <span className="color-meta">
        <span className="color-label">{label}</span>
        {help && !compact && <small className="help">{help}</small>}
      </span>
      <input
        className="ainput color-hex"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), commit(e.currentTarget.value))}
        maxLength={7}
        spellCheck={false}
        aria-label={`${label} hex code`}
      />
    </label>
  );
}

function contrastWarnings({ colors }) {
  const w = [];
  if (contrast(colors.text, colors.background) < 4.5) w.push('Text is hard to read on the page background.');
  if (contrast(colors.text, colors.surface) < 4.5) w.push('Text is hard to read on cards.');
  const lightBackground = readableOn(colors.background) !== '#ffffff';
  if (lightBackground && contrast(colors.background, colors.dark) < 2) w.push('“Dark sections” look almost the same as the background.');
  return w;
}

// A miniature of the website, themed via CSS variables set on this element only.
const ThemePreview = forwardRef(function ThemePreview({ palette }, ref) {
  return (
  <div ref={ref} className="theme-scope preview">
    <div className="pv-nav">
      <span className="pv-logo">DM</span>
      <span className="pv-links"><i /><i /><i /></span>
      <span className="pv-btn">Let’s talk</span>
    </div>
    <div className="pv-hero">
      <span className="pv-pill"><b /> Open to work</span>
      <h3>Hi, I’m Dhruv.<br /><span className="grad-text">Software Engineer</span></h3>
      <p>I build fast, reliable backends and clean interfaces.</p>
      <div className="pv-actions">
        <span className="pv-btn">See my work</span>
        <span className="pv-ghost">Hire me</span>
      </div>
    </div>
    <div className="pv-banner">React ✦ Node.js ✦ AWS ✦ MongoDB</div>
    <div className="pv-cards">
      {palette.slice(0, 3).map((_, i) => (
        <div key={i} className={`pv-card a-${['violet', 'pink', 'orange'][i]}`}>
          <span className="pv-cover" />
          <strong>Project {i + 1}</strong>
          <span className="pv-chip">TypeScript</span>
        </div>
      ))}
    </div>
    <div className="pv-dark">
      <strong>Have a project in mind? <span>Let’s build it.</span></strong>
      <span className="pv-btn">Send message</span>
    </div>
  </div>
  );
});
