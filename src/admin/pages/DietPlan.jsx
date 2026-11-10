// Customise the diet plan: sessions (with targets) and their food items, supplements, preparations.
// Changes apply to future ticks; days already logged keep the values they were ticked with.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import Icon from '../../shared/Icon.jsx';
import { useUnsavedGuard } from '../hooks.js';
import { ErrorBox, PageHeader, Spinner, useConfirm, useToast } from '../ui.jsx';

const newId = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).slice(0, 36);
const move = (list, i, d) => {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
};
const num = (v) => (v === '' ? '' : Number(v));

export default function DietPlan() {
  const toast = useToast();
  const confirm = useConfirm();
  const [saved, setSaved] = useState(null);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const dirty = !!plan && JSON.stringify(plan) !== JSON.stringify(saved);
  useUnsavedGuard(dirty);

  const load = useCallback(() => {
    setError(null);
    api
      .dietPlan()
      .then(({ plan: { sessions, supplements, preparations } }) => {
        const p = { sessions, supplements, preparations };
        setSaved(p);
        setPlan(p);
      })
      .catch(setError);
  }, []);
  useEffect(load, [load]);

  const setSession = (i, fn) => setPlan((p) => ({ ...p, sessions: p.sessions.map((s, k) => (k === i ? fn(s) : s)) }));
  const setItem = (si, ii, patch) => setSession(si, (s) => ({ ...s, items: s.items.map((it, k) => (k === ii ? { ...it, ...patch } : it)) }));

  async function removeSession(i) {
    const s = plan.sessions[i];
    const ok = await confirm({ title: `Delete “${s.name}”?`, message: `Its ${s.items.length} item(s) will be removed from the plan. Days you already logged are not affected.`, confirmLabel: 'Delete' });
    if (ok) setPlan((p) => ({ ...p, sessions: p.sessions.filter((_, k) => k !== i) }));
  }

  async function save(e) {
    e.preventDefault();
    const clean = {
      sessions: plan.sessions.map((s) => ({
        ...s,
        name: s.name.trim(),
        target: { protein: Number(s.target.protein) || 0, calories: Number(s.target.calories) || 0 },
        items: s.items.filter((it) => it.name.trim()).map((it) => ({ ...it, name: it.name.trim(), protein: Number(it.protein) || 0, calories: Number(it.calories) || 0 })),
      })),
      supplements: plan.supplements.filter((x) => x.name.trim()),
      preparations: plan.preparations.filter((x) => x.name.trim()),
    };
    if (clean.sessions.some((s) => !s.name)) return toast('Every session needs a name.', 'error');
    setSaving(true);
    try {
      const { plan: p } = await api.saveDietPlan(clean);
      const next = { sessions: p.sessions, supplements: p.supplements, preparations: p.preparations };
      setSaved(next);
      setPlan(next);
      toast('Plan saved');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const totals = plan && plan.sessions.reduce((a, s) => ({ p: a.p + (Number(s.target.protein) || 0), c: a.c + (Number(s.target.calories) || 0) }), { p: 0, c: 0 });

  return (
    <form className="page page-narrow diet-plan" onSubmit={save} noValidate>
      <PageHeader
        title="Customise diet plan"
        subtitle="Your sessions, foods, supplements and prep — the checklist you tick each day."
        icon="apple"
        accent="lime"
        back={<Link to="/admin/diet" className="icon-btn" aria-label="Back to today"><Icon name="arrow-left" size={20} /></Link>}
      />
      {error && <ErrorBox error={error} onRetry={load} />}
      {!plan && !error && <Spinner />}
      {plan && (
        <>
          <div className="card diet-plan-sum">
            <Icon name="target" size={18} />
            <span>Daily target (sum of session targets): <b>{totals.p} g protein</b> · <b>{totals.c.toLocaleString()} kcal</b></span>
          </div>

          {plan.sessions.map((s, si) => (
            <section key={s.id} className="card form-card plan-session">
              <div className="plan-session-head">
                <input className="ainput plan-session-name" value={s.name} maxLength={80} placeholder="Session name" aria-label="Session name" onChange={(e) => setSession(si, (x) => ({ ...x, name: e.target.value }))} />
                <div className="plan-tools">
                  <button type="button" className="icon-btn" onClick={() => setPlan((p) => ({ ...p, sessions: move(p.sessions, si, -1) }))} disabled={si === 0} aria-label="Move session up"><Icon name="arrow-up" size={16} /></button>
                  <button type="button" className="icon-btn" onClick={() => setPlan((p) => ({ ...p, sessions: move(p.sessions, si, 1) }))} disabled={si === plan.sessions.length - 1} aria-label="Move session down"><Icon name="arrow-down" size={16} /></button>
                  <button type="button" className="icon-btn danger" onClick={() => removeSession(si)} aria-label={`Delete ${s.name}`}><Icon name="trash" size={16} /></button>
                </div>
              </div>
              <div className="plan-target">
                <span>Target</span>
                <label><input className="ainput" type="number" min="0" inputMode="decimal" value={s.target.protein} onChange={(e) => setSession(si, (x) => ({ ...x, target: { ...x.target, protein: num(e.target.value) } }))} /> g protein</label>
                <label><input className="ainput" type="number" min="0" inputMode="decimal" value={s.target.calories} onChange={(e) => setSession(si, (x) => ({ ...x, target: { ...x.target, calories: num(e.target.value) } }))} /> kcal</label>
                <span className="help">0 = no target</span>
              </div>

              <div className="plan-items">
                <div className="plan-item plan-item-head" aria-hidden="true">
                  <span>Food</span><span>Quantity</span><span>Protein g</span><span>kcal</span><span />
                </div>
                {s.items.map((it, ii) => (
                  <div key={it.id} className="plan-item">
                    <input className="ainput" value={it.name} maxLength={80} placeholder="Food" aria-label="Food name" onChange={(e) => setItem(si, ii, { name: e.target.value })} />
                    <input className="ainput" value={it.quantity} maxLength={60} placeholder="e.g. 100 g" aria-label="Quantity" onChange={(e) => setItem(si, ii, { quantity: e.target.value })} />
                    <input className="ainput" type="number" min="0" inputMode="decimal" value={it.protein} aria-label="Protein in grams" onChange={(e) => setItem(si, ii, { protein: num(e.target.value) })} />
                    <input className="ainput" type="number" min="0" inputMode="decimal" value={it.calories} aria-label="Calories" onChange={(e) => setItem(si, ii, { calories: num(e.target.value) })} />
                    <div className="plan-tools">
                      <button type="button" className="icon-btn" onClick={() => setSession(si, (x) => ({ ...x, items: move(x.items, ii, -1) }))} disabled={ii === 0} aria-label="Move up"><Icon name="arrow-up" size={15} /></button>
                      <button type="button" className="icon-btn" onClick={() => setSession(si, (x) => ({ ...x, items: move(x.items, ii, 1) }))} disabled={ii === s.items.length - 1} aria-label="Move down"><Icon name="arrow-down" size={15} /></button>
                      <button type="button" className="icon-btn danger" onClick={() => setSession(si, (x) => ({ ...x, items: x.items.filter((_, k) => k !== ii) }))} aria-label={`Remove ${it.name || 'item'}`}><Icon name="trash" size={15} /></button>
                    </div>
                  </div>
                ))}
                <button type="button" className="abtn abtn-sm plan-add" onClick={() => setSession(si, (x) => ({ ...x, items: [...x.items, { id: newId(), name: '', quantity: '', protein: 0, calories: 0 }] }))}>
                  <Icon name="plus" size={15} /> Add food
                </button>
              </div>
            </section>
          ))}

          <button
            type="button"
            className="abtn plan-add-session"
            onClick={() => setPlan((p) => ({ ...p, sessions: [...p.sessions, { id: newId(), name: `Session ${p.sessions.length + 1}`, target: { protein: 0, calories: 0 }, items: [] }] }))}
          >
            <Icon name="plus" size={16} /> Add session
          </button>

          <SimpleList title="Supplements & medicines" icon="pill" placeholder="e.g. Vitamin C" list={plan.supplements} onChange={(supplements) => setPlan((p) => ({ ...p, supplements }))} />
          <SimpleList title="Preparations" icon="clock" placeholder="e.g. Soak chana" list={plan.preparations} onChange={(preparations) => setPlan((p) => ({ ...p, preparations }))} />

          <div className="save-bar">
            <span className="save-state">{dirty ? <><i className="dot warn" /> Unsaved changes</> : <><i className="dot ok" /> All changes saved</>}</span>
            <button className="abtn abtn-primary" disabled={saving || !dirty}>{saving ? 'Saving…' : <><Icon name="check" size={16} /> Save plan</>}</button>
          </div>
        </>
      )}
    </form>
  );
}

function SimpleList({ title, icon, placeholder, list, onChange }) {
  return (
    <section className="card form-card">
      <h2 className="form-section-title"><Icon name={icon} size={18} /> {title}</h2>
      <div className="plan-simple">
        {list.map((x, i) => (
          <div key={x.id} className="plan-simple-row">
            <input className="ainput" value={x.name} maxLength={60} placeholder={placeholder} aria-label={`${title} name`} onChange={(e) => onChange(list.map((y, k) => (k === i ? { ...y, name: e.target.value } : y)))} />
            <button type="button" className="icon-btn" onClick={() => onChange(move(list, i, -1))} disabled={i === 0} aria-label="Move up"><Icon name="arrow-up" size={15} /></button>
            <button type="button" className="icon-btn" onClick={() => onChange(move(list, i, 1))} disabled={i === list.length - 1} aria-label="Move down"><Icon name="arrow-down" size={15} /></button>
            <button type="button" className="icon-btn danger" onClick={() => onChange(list.filter((_, k) => k !== i))} aria-label={`Remove ${x.name || 'entry'}`}><Icon name="trash" size={15} /></button>
          </div>
        ))}
        <button type="button" className="abtn abtn-sm plan-add" onClick={() => onChange([...list, { id: newId(), name: '' }])}><Icon name="plus" size={15} /> Add</button>
      </div>
    </section>
  );
}
