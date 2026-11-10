import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import Icon from '../../shared/Icon.jsx';
import { FormFields } from '../fields.jsx';
import PhotoManager from '../PhotoManager.jsx';
import { useUnsavedGuard } from '../hooks.js';
import { PROFILE_SECTIONS, emptyItem, toPayload, validateRequired } from '../schema.js';
import { ErrorBox, PageHeader, Spinner, useToast } from '../ui.jsx';

const ALL_FIELDS = PROFILE_SECTIONS.flatMap((s) => s.fields);
const BLANK = (() => {
  const { hidden, ...rest } = emptyItem(ALL_FIELDS);
  return rest;
})();

export default function ProfileEditor() {
  const toast = useToast();
  const [saved, setSaved] = useState(null);
  const [value, setValue] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const dirty = !!value && JSON.stringify(value) !== JSON.stringify(saved);
  useUnsavedGuard(dirty);

  const load = useCallback(() => {
    setError(null);
    api
      .profile()
      .then((p) => {
        const merged = mergeDeep(BLANK, p ?? {});
        setSaved(merged);
        setValue(merged);
      })
      .catch(setError);
  }, []);
  useEffect(load, [load]);

  async function save(e) {
    e.preventDefault();
    const required = validateRequired(ALL_FIELDS, value);
    if (Object.keys(required).length) {
      setErrors(required);
      toast('Please fill in the required fields.', 'error');
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      const p = mergeDeep(BLANK, await api.saveProfile(toPayload(value)));
      setSaved(p);
      setValue(p);
      toast('Profile saved');
    } catch (err) {
      setErrors(err.fields ?? {});
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="page page-narrow" onSubmit={save} noValidate>
      <PageHeader title="Profile" subtitle="Your name, intro, contact details and links." icon="user" accent="pink" />
      {error && <ErrorBox error={error} onRetry={load} />}
      {!value && !error && <Spinner />}
      {value && (
        <>
          {/* Photo saves on its own (upload + crop), separately from the form below. */}
          <PhotoManager
            photo={value.photo}
            name={value.name}
            onChange={(photo) => {
              setSaved((s) => ({ ...s, photo }));
              setValue((v) => ({ ...v, photo }));
            }}
          />
          {PROFILE_SECTIONS.map((s) => (
            <section key={s.title} className="card form-card">
              <h2 className="form-section-title"><Icon name={s.icon} size={18} /> {s.title}</h2>
              <FormFields fields={s.fields} value={value} onChange={setValue} errors={errors} />
              {s.title === 'Google & sharing' && <SearchPreview seo={value.seo} />}
            </section>
          ))}
          <div className="save-bar">
            <span className="save-state">
              {dirty ? <><i className="dot warn" /> Unsaved changes</> : <><i className="dot ok" /> All changes saved</>}
            </span>
            <button className="abtn abtn-primary" disabled={saving || !dirty}>
              {saving ? 'Saving…' : <><Icon name="check" size={16} /> Save profile</>}
            </button>
          </div>
        </>
      )}
    </form>
  );
}

function mergeDeep(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' ? mergeDeep(base[k], v) : v;
  }
  return out;
}

/** Roughly how the site appears in Google results. */
function SearchPreview({ seo = {} }) {
  const cut = (t, n) => (t.length > n ? `${t.slice(0, n).trimEnd()}…` : t);
  return (
    <div className="serp" aria-label="Google search preview">
      <span className="serp-label">Google preview</span>
      <span className="serp-site">
        <span className="serp-favicon" aria-hidden="true">DM</span>
        <span>
          <strong>Dhruv Mangroliya</strong>
          <small>{window.location.host}</small>
        </span>
      </span>
      <span className="serp-title">{cut(seo.title || 'Untitled', 60)}</span>
      <span className="serp-desc">{cut(seo.description || '', 160)}</span>
    </div>
  );
}
