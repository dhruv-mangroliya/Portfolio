// Schema-driven form fields for the dashboard.
import { useId, useRef, useState } from 'react';
import { api } from '../api.js';
import { CropDialog } from './PhotoManager.jsx';
import { useToast } from './ui.jsx';
import Icon from '../shared/Icon.jsx';
import { ACCENTS, cx } from '../shared/utils.js';
import { getPath, setPath } from './schema.js';

/** Renders a list of field definitions bound to `value`; calls onChange(newValue). */
export function FormFields({ fields, value, onChange, errors = {} }) {
  return (
    <div className="form-grid">
      {fields.map((f) => (
        <Field
          key={f.name}
          def={f}
          value={getPath(value, f.name)}
          error={errors[f.name]}
          onChange={(v) => onChange(setPath(value, f.name, v))}
        />
      ))}
    </div>
  );
}

function Field({ def, value, onChange, error }) {
  const id = useId();
  const Control = CONTROLS[def.type] ?? TextControl;

  if (def.type === 'bool') {
    return (
      <div className={cx('afield', 'full')}>
        <Toggle id={id} checked={!!value} onChange={onChange} label={def.label} />
        {def.help && <small className="help">{def.help}</small>}
      </div>
    );
  }

  return (
    <div className={cx('afield', def.half ? 'half' : 'full', error && 'has-error')}>
      <label htmlFor={id}>
        {def.label}
        {def.required && <span className="req" aria-hidden="true"> *</span>}
      </label>
      <Control id={id} def={def} value={value} onChange={onChange} invalid={!!error} />
      {error ? <small className="err">{error}</small> : def.help && <small className="help">{def.help}</small>}
      {def.counter && <CharCount value={value} limit={def.counter} />}
    </div>
  );
}

/* ---------------------------------------------------------------- controls */

function TextControl({ id, def, value, onChange, invalid }) {
  const type = def.type === 'url' ? 'url' : def.type === 'email' ? 'email' : 'text';
  return (
    <input
      id={id}
      className="ainput"
      type={type}
      value={value ?? ''}
      placeholder={def.placeholder ?? (def.type === 'url' ? 'https://' : '')}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid || undefined}
      autoComplete="off"
    />
  );
}

function TextareaControl({ id, def, value, onChange, invalid }) {
  return (
    <textarea
      id={id}
      className="ainput"
      rows={def.rows ?? 4}
      value={value ?? ''}
      placeholder={def.placeholder}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid || undefined}
    />
  );
}

export function Toggle({ id, checked, onChange, label }) {
  return (
    <label className="toggle" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true"><span className="toggle-thumb" /></span>
      <span>{label}</span>
    </label>
  );
}

/** Chips input: Enter or comma adds, Backspace on empty input removes the last chip. */
function TagsControl({ id, def, value = [], onChange }) {
  const [draft, setDraft] = useState('');
  const tags = value ?? [];
  const add = (raw) => {
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean).filter((t) => !tags.includes(t));
    if (parts.length) onChange([...tags, ...parts]);
    setDraft('');
  };
  return (
    <div className="tags-input" onClick={(e) => e.currentTarget.querySelector('input')?.focus()}>
      {tags.map((t, i) => (
        <span key={t} className={cx('tag', `a-${ACCENTS[i % ACCENTS.length]}`)}>
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))}>
            <Icon name="close" size={12} strokeWidth={3} />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        placeholder={tags.length ? '' : def.placeholder}
        onChange={(e) => (e.target.value.includes(',') ? add(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add(draft);
          } else if (e.key === 'Backspace' && !draft && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={() => draft && add(draft)}
      />
    </div>
  );
}

/** Editable list of rows (bullet points or paragraphs) with add / remove / move. */
function ListControl({ id, def, value = [], onChange }) {
  const rows = value ?? [];
  const refs = useRef([]);
  const focusRow = (i) => setTimeout(() => refs.current[i]?.focus(), 0);

  const update = (i, v) => onChange(rows.map((r, j) => (j === i ? v : r)));
  const insertAfter = (i) => {
    const next = [...rows];
    next.splice(i + 1, 0, '');
    onChange(next);
    focusRow(i + 1);
  };
  const remove = (i) => {
    onChange(rows.filter((_, j) => j !== i));
    focusRow(Math.max(0, i - 1));
  };
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const Input = def.multiline ? 'textarea' : 'input';
  return (
    <div className="list-input" id={id}>
      {rows.map((r, i) => (
        <div key={i} className="list-row">
          <span className="list-num">{i + 1}</span>
          <Input
            ref={(el) => (refs.current[i] = el)}
            className="ainput"
            value={r}
            rows={def.multiline ? 3 : undefined}
            aria-label={`${def.label} ${i + 1}`}
            onChange={(e) => update(i, e.target.value)}
            onKeyDown={(e) => {
              if (!def.multiline && e.key === 'Enter') {
                e.preventDefault();
                insertAfter(i);
              } else if (e.key === 'Backspace' && !r && rows.length > 0) {
                e.preventDefault();
                remove(i);
              }
            }}
          />
          <div className="list-actions">
            <button type="button" className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><Icon name="up" size={16} /></button>
            <button type="button" className="icon-btn" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down"><Icon name="down" size={16} /></button>
            <button type="button" className="icon-btn danger" onClick={() => remove(i)} aria-label="Remove"><Icon name="trash" size={16} /></button>
          </div>
        </div>
      ))}
      <button type="button" className="abtn abtn-dashed" onClick={() => insertAfter(rows.length - 1)}>
        <Icon name="plus" size={16} /> Add {def.multiline ? 'paragraph' : 'row'}
      </button>
    </div>
  );
}

/**
 * Image gallery (stored in MongoDB): pick one or more files — each is cropped in turn — then
 * reorder or remove. The value is a list of image URLs; the first is the cover.
 */
function ImagesControl({ id, def, value, onChange }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const [queue, setQueue] = useState([]); // object URLs waiting to be cropped
  const [busy, setBusy] = useState(false);
  const images = value ?? [];
  const max = def.max ?? 10;
  const [w, h] = def.aspect ?? [16, 9];
  const frame = { w: 320, h: Math.round((320 * h) / w) };
  const out = { w: 1600, h: Math.round((1600 * h) / w) };
  const latest = useRef(images);
  latest.current = images;

  function pick(e) {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    const ok = files.filter((f) => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type) && f.size <= 25 * 1024 * 1024);
    if (ok.length < files.length) toast('Some files were skipped (JPG, PNG or WebP up to 25 MB only).', 'error');
    const room = max - images.length;
    if (ok.length > room) toast(`Only ${room} more image${room === 1 ? '' : 's'} can be added (max ${max}).`, 'error');
    setQueue(ok.slice(0, room).map((f) => URL.createObjectURL(f)));
  }
  const next = () =>
    setQueue(([first, ...rest]) => {
      if (first) URL.revokeObjectURL(first);
      return rest;
    });
  async function save({ image }) {
    setBusy(true);
    try {
      const media = await api.uploadImage(image);
      onChange([...latest.current, media.url]);
      if (queue.length === 1) toast('Images added — save the form to publish them');
      next();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }
  const move = (i, d) => {
    const list = [...images];
    [list[i], list[i + d]] = [list[i + d], list[i]];
    onChange(list);
  };

  return (
    <div className="images-field" id={id}>
      {images.length > 0 && (
        <ul className="images-grid">
          {images.map((url, i) => (
            <li key={url} className="images-item">
              <div className="image-preview" style={{ aspectRatio: `${w} / ${h}` }}>
                <img src={url} alt={`Image ${i + 1}`} />
                {i === 0 && <em className="cover-badge">Cover</em>}
              </div>
              <div className="images-item-actions">
                <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move left" title={i === 1 ? 'Make cover' : 'Move left'}><Icon name="arrowLeft" size={16} /></button>
                <button type="button" className="icon-btn" disabled={i === images.length - 1} onClick={() => move(i, 1)} aria-label="Move right"><Icon name="arrowRight" size={16} /></button>
                <button type="button" className="icon-btn danger" onClick={() => onChange(images.filter((_, j) => j !== i))} aria-label="Remove image"><Icon name="trash" size={16} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {images.length === 0 && (
        <div className="image-preview empty" style={{ aspectRatio: `${w} / ${h}` }}>
          <span><Icon name="layout" size={26} /> No images — a colourful cover is used</span>
        </div>
      )}
      <div className="image-actions">
        <button type="button" className="abtn abtn-sm" onClick={() => fileRef.current?.click()} disabled={images.length >= max}>
          <Icon name="plus" size={15} /> {images.length ? 'Add more images' : 'Upload images'}
        </button>
        <small className="help">{images.length}/{max} · You can select several files at once. The first image is the cover.</small>
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={pick} />
      {queue[0] && (
        <CropDialog
          key={queue[0]}
          src={queue[0]}
          isNew
          keepOriginal={false}
          busy={busy}
          frame={frame}
          out={out}
          title={queue.length > 1 ? `Frame image (${queue.length} left)` : 'Frame your image'}
          hint="Drag to position and zoom to choose what shows. Cancel skips this one."
          onCancel={next}
          onSave={save}
        />
      )}
    </div>
  );
}

function AccentControl({ value = 'auto', onChange }) {
  return (
    <div className="swatches" role="radiogroup">
      {['auto', ...ACCENTS].map((a) => (
        <button
          key={a}
          type="button"
          role="radio"
          aria-checked={value === a}
          className={cx('swatch', `a-${a}`, value === a && 'on')}
          onClick={() => onChange(a)}
          title={a === 'auto' ? 'Automatic (cycles through the theme colours)' : `Theme colour ${ACCENTS.indexOf(a) + 1}`}
        >
          {a === 'auto' ? 'Auto' : <span className="sr-only">{`Theme colour ${ACCENTS.indexOf(a) + 1}`}</span>}
        </button>
      ))}
    </div>
  );
}

function IconControl({ def, value, onChange }) {
  return (
    <div className="icon-picker" role="radiogroup">
      {def.options.map((name) => (
        <button
          key={name}
          type="button"
          role="radio"
          aria-checked={value === name}
          aria-label={name}
          className={cx('icon-choice', value === name && 'on')}
          onClick={() => onChange(name)}
        >
          <Icon name={name} size={22} />
        </button>
      ))}
    </div>
  );
}

const CONTROLS = {
  text: TextControl,
  url: TextControl,
  email: TextControl,
  textarea: TextareaControl,
  tags: TagsControl,
  list: ListControl,
  accent: AccentControl,
  icon: IconControl,
  images: ImagesControl,
};

function CharCount({ value, limit }) {
  const n = String(value ?? '').length;
  return (
    <small className={cx('char-count', n > limit && 'over')}>
      {n} / ~{limit} characters{n > limit ? ' — search results will cut it off with “…”' : ''}
    </small>
  );
}
