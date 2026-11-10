// Small UI kit for the dashboard: toasts, confirm dialog, page header, empty state, spinner.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Icon from '../shared/Icon.jsx';
import { cx } from '../shared/utils.js';

/* ----------------------------------------------------------------- toasts */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === 'error' ? 6000 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cx('toast', t.type)}>
            <Icon name={t.type === 'error' ? 'alert' : 'check'} size={18} />
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ----------------------------------------------------------------- confirm dialog */
const ConfirmCtx = createContext(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const okRef = useRef(null);

  const confirm = useCallback(
    (opts) => new Promise((resolve) => setDialog({ confirmLabel: 'Delete', danger: true, ...opts, resolve })),
    []
  );
  const close = (result) => {
    dialog?.resolve(result);
    setDialog(null);
  };

  useEffect(() => {
    if (!dialog) return;
    okRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && close(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {dialog && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="modal-title">
            <span className={cx('modal-icon', dialog.danger ? 'danger' : '')}>
              <Icon name={dialog.danger ? 'trash' : 'alert'} size={22} />
            </span>
            <h2 id="modal-title">{dialog.title}</h2>
            {dialog.message && <p>{dialog.message}</p>}
            <div className="modal-actions">
              <button className="abtn" onClick={() => close(false)}>Cancel</button>
              <button ref={okRef} className={cx('abtn', dialog.danger ? 'abtn-danger' : 'abtn-primary')} onClick={() => close(true)}>
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}

/* ----------------------------------------------------------------- layout bits */
export function PageHeader({ title, subtitle, icon, accent = 'violet', actions, back }) {
  return (
    <header className="page-head">
      <div className="page-head-main">
        {back}
        {icon && (
          <span className={cx('page-icon', `a-${accent}`)}>
            <Icon name={icon} size={22} />
          </span>
        )}
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon = 'sparkles', title, children, action }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={28} /></span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export const Spinner = ({ label = 'Loading…' }) => (
  <div className="spinner-wrap" aria-busy="true">
    <span className="spinner" /> {label}
  </div>
);

export function ErrorBox({ error, onRetry }) {
  return (
    <div className="error-box">
      <Icon name="alert" size={20} />
      <span>{error?.message ?? 'Something went wrong.'}</span>
      {onRetry && <button className="abtn abtn-sm" onClick={onRetry}>Retry</button>}
    </div>
  );
}
