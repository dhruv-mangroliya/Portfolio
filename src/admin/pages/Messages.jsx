import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import Icon from '../../shared/Icon.jsx';
import { cx, timeAgo } from '../../shared/utils.js';
import { useAdmin } from '../AdminApp.jsx';
import { EmptyState, ErrorBox, PageHeader, Spinner, useConfirm, useToast } from '../ui.jsx';

export default function Messages() {
  const { refreshUnread } = useAdmin();
  const toast = useToast();
  const confirm = useConfirm();
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(() => {
    setError(null);
    api.messages({ status, page }).then(setData).catch(setError);
  }, [status, page]);
  useEffect(load, [load]);

  const replace = (m) => setData((d) => ({ ...d, items: d.items.map((x) => (x.id === m.id ? m : x)) }));

  async function open(m) {
    setOpenId(openId === m.id ? null : m.id);
    if (!m.read) await setRead(m, true, true);
  }

  async function setRead(m, read, quiet = false) {
    try {
      replace(await api.setMessageRead(m.id, read));
      refreshUnread();
      if (!quiet) toast(read ? 'Marked as read' : 'Marked as unread');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function remove(m) {
    if (!(await confirm({ title: 'Delete this message?', message: `From ${m.name} — this can’t be undone.` }))) return;
    try {
      await api.deleteMessage(m.id);
      toast('Message deleted');
      refreshUnread();
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <div className="page">
      <PageHeader title="Inbox" subtitle="Messages sent through the contact form on your website." icon="inbox" accent="orange" />

      <div className="tabs" role="tablist">
        {[
          ['all', 'All'],
          ['unread', `Unread${data?.unread ? ` (${data.unread})` : ''}`],
        ].map(([k, label]) => (
          <button key={k} role="tab" aria-selected={status === k} className={cx('tab', status === k && 'on')} onClick={() => { setStatus(k); setPage(1); }}>
            {label}
          </button>
        ))}
      </div>

      {error && <ErrorBox error={error} onRetry={load} />}
      {!data && !error && <Spinner />}
      {data?.items.length === 0 && (
        <EmptyState icon="inbox" title={status === 'unread' ? 'All caught up!' : 'No messages yet'}>
          {status === 'unread' ? 'You’ve read every message.' : 'When someone uses your contact form, it lands here.'}
        </EmptyState>
      )}

      {data?.items.length > 0 && (
        <ul className="msg-list">
          {data.items.map((m) => {
            const isOpen = openId === m.id;
            return (
              <li key={m.id} className={cx('msg', !m.read && 'unread', isOpen && 'open')}>
                <button className="msg-head" onClick={() => open(m)} aria-expanded={isOpen}>
                  <span className="avatar">{m.name[0]?.toUpperCase()}</span>
                  <span className="msg-main">
                    <strong>{m.name} <span className="muted">&lt;{m.email}&gt;</span></strong>
                    <span className="msg-preview">{m.subject || m.message}</span>
                  </span>
                  <time dateTime={m.createdAt} title={new Date(m.createdAt).toLocaleString()}>{timeAgo(m.createdAt)}</time>
                </button>
                {isOpen && (
                  <div className="msg-body">
                    {m.subject && <h3>{m.subject}</h3>}
                    <p>{m.message}</p>
                    <div className="msg-actions">
                      <a className="abtn abtn-primary abtn-sm" href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject || 'Your message'}`)}`}>
                        <Icon name="mail" size={15} /> Reply by email
                      </a>
                      <button className="abtn abtn-sm" onClick={() => setRead(m, !m.read)}>
                        <Icon name={m.read ? 'eyeOff' : 'eye'} size={15} /> Mark {m.read ? 'unread' : 'read'}
                      </button>
                      <button className="abtn abtn-sm abtn-danger-ghost" onClick={() => remove(m)}>
                        <Icon name="trash" size={15} /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {data?.pages > 1 && (
        <div className="pager">
          <button className="abtn abtn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><Icon name="arrowLeft" size={14} /> Newer</button>
          <span>Page {data.page} of {data.pages}</span>
          <button className="abtn abtn-sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Older <Icon name="arrowRight" size={14} /></button>
        </div>
      )}
    </div>
  );
}
