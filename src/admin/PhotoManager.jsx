// Profile photo: upload, then drag/zoom to choose which part is shown on the website's photo card.
// The cropped image (800×1000) is what visitors download; the original is kept so the crop can be changed later.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import Icon from '../shared/Icon.jsx';
import { useConfirm, useToast } from './ui.jsx';

const FRAME_W = 280;
const FRAME_H = 350; // 4:5 — same shape as the card on the website
const OUT_W = 800;
const OUT_H = 1000;
const MAX_ORIGINAL = 2000; // longest side of the stored original
const MAX_ZOOM = 4;
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];

export default function PhotoManager({ photo, name, onChange }) {
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef(null);
  const [editor, setEditor] = useState(null); // { src, isNew, crop }
  const [busy, setBusy] = useState(false);

  const hasPhoto = !!photo?.url;

  function pickFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ACCEPT.includes(file.type)) return toast('Please choose a JPG, PNG or WebP photo.', 'error');
    if (file.size > 25 * 1024 * 1024) return toast('That photo is too large (max 25 MB).', 'error');
    setEditor({ src: URL.createObjectURL(file), isNew: true, crop: null });
  }

  const closeEditor = useCallback(() => {
    setEditor((ed) => {
      if (ed?.isNew) URL.revokeObjectURL(ed.src);
      return null;
    });
  }, []);

  async function save({ image, original, crop }) {
    setBusy(true);
    try {
      const profile = await api.uploadPhoto({ image, original, crop });
      onChange(profile.photo);
      toast(editor.isNew ? 'Photo uploaded — it’s live on your site' : 'Crop updated');
      closeEditor();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const ok = await confirm({ title: 'Remove your photo?', message: 'Your initials will be shown on the website instead.', confirmLabel: 'Remove' });
    if (!ok) return;
    try {
      const profile = await api.removePhoto();
      onChange(profile.photo);
      toast('Photo removed');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <section className="card form-card">
      <h2 className="form-section-title"><Icon name="user" size={18} /> Photo</h2>
      <div className="photo-row">
        <div className="photo-preview">
          {hasPhoto ? (
            <img src={photo.url} alt="Your current profile photo" />
          ) : (
            <span className="photo-empty">{initialsOf(name)}</span>
          )}
        </div>
        <div className="photo-info">
          <p>
            {hasPhoto
              ? 'This is exactly how your photo appears on the card at the top of your website.'
              : 'Add a photo for the card at the top of your website. Until then your initials are shown.'}
          </p>
          <p className="help">JPG, PNG or WebP. After choosing a photo you’ll pick which part to show.</p>
          <div className="photo-actions">
            <button type="button" className="abtn abtn-primary" onClick={() => fileRef.current?.click()}>
              <Icon name="plus" size={16} /> {hasPhoto ? 'Upload new photo' : 'Upload photo'}
            </button>
            {hasPhoto && photo.originalId && (
              <button
                type="button"
                className="abtn"
                onClick={() => setEditor({ src: `/api/v1/media/${photo.originalId}`, isNew: false, crop: photo.crop })}
              >
                <Icon name="edit" size={16} /> Change visible area
              </button>
            )}
            {hasPhoto && (
              <button type="button" className="abtn abtn-danger-ghost" onClick={remove}>
                <Icon name="trash" size={16} /> Remove
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept={ACCEPT.join(',')} hidden onChange={pickFile} />
        </div>
      </div>

      {editor && (
        <CropDialog
          src={editor.src}
          isNew={editor.isNew}
          initialCrop={editor.crop}
          busy={busy}
          onCancel={closeEditor}
          onSave={save}
        />
      )}
    </section>
  );
}

const initialsOf = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

/* ------------------------------------------------------------------ crop dialog */

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export function CropDialog({
  src,
  isNew,
  initialCrop,
  busy,
  onCancel,
  onSave,
  frame = { w: FRAME_W, h: FRAME_H },
  out = { w: OUT_W, h: OUT_H },
  keepOriginal = true,
  title = 'Which part should be shown?',
  hint = 'Drag the photo to position it, and zoom to frame your face. What’s inside the frame is what visitors see.',
}) {
  const FW = frame.w;
  const FH = frame.h;
  const [img, setImg] = useState(null);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(initialCrop?.zoom ?? 1);
  const [center, setCenter] = useState({ x: initialCrop?.x ?? 0.5, y: initialCrop?.y ?? 0.4 });
  const frameRef = useRef(null);
  const drag = useRef(null);

  useEffect(() => {
    const image = new Image();
    image.onload = () => setImg(image);
    image.onerror = () => setError('This photo couldn’t be opened. Try a JPG or PNG (iPhone HEIC photos need converting first).');
    image.src = src;
  }, [src]);

  // Geometry: the image "covers" the frame at zoom 1; `center` is the point of the image (0–1) at the frame's centre.
  const geo = img && (() => {
    const scale = Math.max(FW / img.naturalWidth, FH / img.naturalHeight) * zoom;
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    return { scale, w, h };
  })();

  const clampCenter = useCallback(
    (c, z = zoom) => {
      if (!img) return c;
      const scale = Math.max(FW / img.naturalWidth, FH / img.naturalHeight) * z;
      const hx = FW / 2 / (img.naturalWidth * scale);
      const hy = FH / 2 / (img.naturalHeight * scale);
      return { x: clamp(c.x, hx, 1 - hx), y: clamp(c.y, hy, 1 - hy) };
    },
    [img, zoom]
  );

  // Keep the crop valid once the image is known / when zoom changes.
  useEffect(() => {
    if (img) setCenter((c) => clampCenter(c));
  }, [img, zoom, clampCenter]);

  const setZoomClamped = useCallback(
    (z) => {
      const nz = clamp(z, 1, MAX_ZOOM);
      setZoom(nz);
      setCenter((c) => clampCenter(c, nz));
    },
    [clampCenter]
  );

  // Mouse wheel / trackpad zoom (needs a non-passive listener to stop the page scrolling).
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      setZoomClamped(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoom, setZoomClamped]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  function onPointerDown(e) {
    if (!geo) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, start: center };
  }
  function onPointerMove(e) {
    if (!drag.current || !geo) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    setCenter(clampCenter({ x: drag.current.start.x - dx / geo.w, y: drag.current.start.y - dy / geo.h }));
  }
  const onPointerUp = () => (drag.current = null);

  function onKeyDown(e) {
    if (!geo) return;
    const step = 8;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      setCenter((c) => clampCenter({ x: c.x + dx / geo.w, y: c.y + dy / geo.h }));
    } else if (e.key === '+' || e.key === '=') setZoomClamped(zoom + 0.1);
    else if (e.key === '-') setZoomClamped(zoom - 0.1);
  }

  function exportImages() {
    const sw = FW / geo.scale;
    const sh = FH / geo.scale;
    const sx = center.x * img.naturalWidth - sw / 2;
    const sy = center.y * img.naturalHeight - sh / 2;

    const image = drawToJpeg(out.w, out.h, (ctx) => ctx.drawImage(img, sx, sy, sw, sh, 0, 0, out.w, out.h), 0.88);

    let original;
    if (isNew && keepOriginal) {
      const r = Math.min(1, MAX_ORIGINAL / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * r);
      const h = Math.round(img.naturalHeight * r);
      original = drawToJpeg(w, h, (ctx) => ctx.drawImage(img, 0, 0, w, h), 0.9);
    }
    const round = (n) => Math.round(n * 10000) / 10000;
    onSave({ image, original, crop: { x: round(center.x), y: round(center.y), zoom: round(zoom) } });
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div className="modal crop-modal" role="dialog" aria-modal="true" aria-labelledby="crop-title">
        <h2 id="crop-title">{title}</h2>
        <p>{hint}</p>

        {error ? (
          <div className="error-box"><Icon name="alert" size={18} /> <span>{error}</span></div>
        ) : (
          <>
            <div
              ref={frameRef}
              className="crop-frame"
              style={{ width: FW, height: FH }}
              tabIndex={0}
              role="application"
              aria-label="Photo crop area. Drag or use arrow keys to move, plus and minus to zoom."
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={onKeyDown}
            >
              {geo ? (
                <img
                  src={src}
                  alt=""
                  draggable={false}
                  style={{
                    width: geo.w,
                    height: geo.h,
                    left: FW / 2 - center.x * geo.w,
                    top: FH / 2 - center.y * geo.h,
                  }}
                />
              ) : (
                <span className="spinner" />
              )}
              <span className="crop-grid" aria-hidden="true" />
            </div>

            <label className="crop-zoom">
              <Icon name="eye" size={16} />
              <span className="sr-only">Zoom</span>
              <input
                type="range"
                min="1"
                max={MAX_ZOOM}
                step="0.01"
                value={zoom}
                onChange={(e) => setZoomClamped(Number(e.target.value))}
                disabled={!geo}
              />
              <output>{Math.round(zoom * 100)}%</output>
            </label>
          </>
        )}

        <div className="modal-actions">
          <button type="button" className="abtn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="abtn abtn-primary" onClick={exportImages} disabled={busy || !geo}>
            {busy ? 'Saving…' : <><Icon name="check" size={16} /> Use this</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function drawToJpeg(w, h, draw, quality) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // transparent PNGs get a white background
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = 'high';
  draw(ctx);
  return canvas.toDataURL('image/jpeg', quality);
}
