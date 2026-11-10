import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Icon from '../shared/Icon.jsx';
import { useNoIndex } from './hooks.js';
import './admin.css';

export default function Login() {
  useNoIndex();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [form, setForm] = useState({ username: '', password: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(state?.expired ? 'Your session expired — please sign in again.' : '');

  const target = state?.from?.startsWith('/admin') && state.from !== '/admin/login' ? state.from : '/admin';

  // Already signed in? Skip the form.
  useEffect(() => {
    api.me().then(() => navigate(target, { replace: true })).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.login(form.username.trim(), form.password);
      navigate(target, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login-art" aria-hidden="true">
        <span /><span /><span />
      </div>
      <form className="login-card" onSubmit={submit}>
        <span className="login-logo"><Icon name="sparkles" size={26} /></span>
        <h1>Welcome back</h1>
        <p className="login-sub">Sign in to manage your site.</p>

        <label className="afield full">
          <span className="lbl">Username</span>
          <input
            className="ainput"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            autoComplete="username"
            autoFocus
            required
          />
        </label>
        <label className="afield full">
          <span className="lbl">Password</span>
          <span className="pw-wrap">
            <input
              className="ainput"
              type={show ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="current-password"
              required
            />
            <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
              <Icon name={show ? 'eyeOff' : 'eye'} size={18} />
            </button>
          </span>
        </label>

        {error && (
          <p className="login-error" role="alert"><Icon name="alert" size={16} /> {error}</p>
        )}

        <button className="abtn abtn-primary abtn-lg" disabled={busy}>
          {busy ? 'Signing in…' : <>Sign in <Icon name="arrowRight" size={18} /></>}
        </button>
        <Link to="/" className="login-back"><Icon name="arrowLeft" size={14} /> Back to website</Link>
      </form>
    </div>
  );
}
