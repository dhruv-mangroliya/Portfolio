import { useState } from 'react';
import { api } from '../../api.js';
import Icon from '../../shared/Icon.jsx';
import { useAdmin } from '../AdminApp.jsx';
import { PageHeader, useToast } from '../ui.jsx';

const EMPTY = { currentPassword: '', newPassword: '', confirm: '' };

export default function Settings() {
  const { user } = useAdmin();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    if (form.newPassword !== form.confirm) return setErrors({ confirm: 'Passwords don’t match.' });
    setBusy(true);
    setErrors({});
    try {
      await api.changePassword(form.currentPassword, form.newPassword);
      setForm(EMPTY);
      toast('Password changed — other devices have been signed out');
    } catch (err) {
      setErrors(err.fields ?? {});
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const field = (k, label, autoComplete) => (
    <div className={`afield full ${errors[k] ? 'has-error' : ''}`}>
      <label htmlFor={k}>{label}</label>
      <input id={k} className="ainput" type="password" value={form[k]} onChange={set(k)} autoComplete={autoComplete} required />
      {errors[k] && <small className="err">{errors[k]}</small>}
    </div>
  );

  return (
    <div className="page page-narrow">
      <PageHeader title="Settings" subtitle={`Signed in as ${user.username}`} icon="settings" accent="blue" />
      <form className="card form-card" onSubmit={submit} noValidate>
        <h2 className="form-section-title"><Icon name="shield" size={18} /> Change password</h2>
        <div className="form-grid">
          {field('currentPassword', 'Current password', 'current-password')}
          {field('newPassword', 'New password (min. 10 characters)', 'new-password')}
          {field('confirm', 'Repeat new password', 'new-password')}
        </div>
        <div className="form-foot">
          <button className="abtn abtn-primary" disabled={busy || !form.currentPassword || !form.newPassword}>
            {busy ? 'Saving…' : 'Update password'}
          </button>
        </div>
      </form>
    </div>
  );
}
