import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import Icon from '../../shared/Icon.jsx';
import { FormFields, Toggle } from '../fields.jsx';
import { useUnsavedGuard } from '../hooks.js';
import { COLLECTIONS, emptyItem, toPayload, validateRequired } from '../schema.js';
import { ErrorBox, PageHeader, Spinner, useConfirm, useToast } from '../ui.jsx';

export default function ItemEditor() {
  const { collection, id } = useParams();
  const def = COLLECTIONS[collection];
  const isNew = !id;
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  const blank = useMemo(() => (def ? emptyItem(def.fields) : null), [def]);
  const [saved, setSaved] = useState(isNew ? blank : null); // last saved version
  const [value, setValue] = useState(isNew ? blank : null); // what's in the form
  const [errors, setErrors] = useState({});
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);

  const dirty = !!value && JSON.stringify(value) !== JSON.stringify(saved);
  const bypassGuard = useUnsavedGuard(dirty);

  useEffect(() => {
    if (!def) return;
    if (isNew) {
      setSaved(blank);
      setValue(blank);
      return;
    }
    if (value?.id === id) return; // just created — already have it
    setValue(null);
    api
      .get(collection, id)
      .then((item) => {
        const merged = { ...blank, ...item };
        setSaved(merged);
        setValue(merged);
      })
      .catch(setLoadError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection, id]);

  if (!def) return <Navigate to="/admin" replace />;
  const listUrl = `/admin/c/${collection}`;

  async function save(e) {
    e?.preventDefault();
    const required = validateRequired(def.fields, value);
    if (Object.keys(required).length) {
      setErrors(required);
      toast('Please fill in the required fields.', 'error');
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      const payload = toPayload(value);
      const item = isNew ? await api.create(collection, payload) : await api.update(collection, id, payload);
      const merged = { ...blank, ...item };
      setSaved(merged);
      setValue(merged);
      toast(isNew ? `${capitalise(def.singular)} added — it’s live on your site` : 'Changes saved');
      if (isNew) {
        bypassGuard();
        navigate(`${listUrl}/${item.id}`, { replace: true });
      }
    } catch (err) {
      setErrors(err.fields ?? {});
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const ok = await confirm({ title: `Delete this ${def.singular}?`, message: 'This can’t be undone.' });
    if (!ok) return;
    try {
      await api.remove(collection, id);
      toast('Deleted');
      bypassGuard();
      navigate(listUrl, { replace: true });
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const back = (
    <Link to={listUrl} className="icon-btn back-btn" aria-label={`Back to ${def.label}`}>
      <Icon name="arrowLeft" size={18} />
    </Link>
  );

  if (loadError) {
    return (
      <div className="page">
        <PageHeader title={def.label} back={back} />
        <ErrorBox error={loadError} />
      </div>
    );
  }
  if (!value) return <div className="page"><Spinner /></div>;

  return (
    <form className="page page-narrow" onSubmit={save} noValidate>
      <PageHeader
        back={back}
        title={isNew ? `New ${def.singular}` : def.title(value)}
        subtitle={isNew ? `Fill in the details and save — it appears on your website immediately.` : def.subtitle(value)}
        icon={def.icon}
        accent={def.accent}
      />

      <section className="card form-card">
        <div className="publish-row">
          <Toggle
            id="published"
            checked={!value.hidden}
            onChange={(on) => setValue({ ...value, hidden: !on })}
            label={value.hidden ? 'Hidden — not shown on the website' : 'Published — visible on the website'}
          />
        </div>
        <FormFields fields={def.fields} value={value} onChange={setValue} errors={errors} />
      </section>

      <div className="save-bar">
        <span className="save-state">
          {dirty ? <><i className="dot warn" /> Unsaved changes</> : <><i className="dot ok" /> All changes saved</>}
        </span>
        {!isNew && (
          <button type="button" className="abtn abtn-danger-ghost" onClick={remove}>
            <Icon name="trash" size={16} /> Delete
          </button>
        )}
        <Link to={listUrl} className="abtn">Back</Link>
        <button className="abtn abtn-primary" disabled={saving || (!dirty && !isNew)}>
          {saving ? 'Saving…' : <><Icon name="check" size={16} /> {isNew ? `Add ${def.singular}` : 'Save changes'}</>}
        </button>
      </div>
    </form>
  );
}

const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);
