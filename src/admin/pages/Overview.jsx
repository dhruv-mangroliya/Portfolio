import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import Icon from '../../shared/Icon.jsx';
import { cx, timeAgo } from '../../shared/utils.js';
import { useAdmin } from '../AdminApp.jsx';
import { COLLECTIONS } from '../schema.js';
import { ErrorBox, Spinner } from '../ui.jsx';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export default function Overview() {
  const { user } = useAdmin();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    api.dashboard().then(setData).catch(setError);
  }, []);
  useEffect(load, [load]);

  return (
    <div className="page">
      <section className="hello">
        <div>
          <p className="hello-kicker">{greeting()},</p>
          <h1>{data?.profile?.name?.split(' ')[0] || user.username} <span aria-hidden="true">👋</span></h1>
          <p>Here’s everything on your site. Add a new experience or project in a couple of clicks.</p>
          <div className="hello-actions">
            <Link className="abtn abtn-white" to="/admin/c/projects/new"><Icon name="plus" size={16} /> New project</Link>
            <Link className="abtn abtn-glass" to="/admin/c/experience/new"><Icon name="plus" size={16} /> New experience</Link>
            <a className="abtn abtn-glass" href="/" target="_blank" rel="noopener noreferrer"><Icon name="external" size={16} /> View site</a>
          </div>
        </div>
        <div className="hello-art" aria-hidden="true"><span /><span /><span /></div>
      </section>

      {error && <ErrorBox error={error} onRetry={load} />}
      {!data && !error && <Spinner />}

      {data && (
        <>
          <h2 className="block-title">Content</h2>
          <div className="tile-grid">
            {Object.entries(COLLECTIONS).map(([key, c]) => {
              const n = data.counts[key] ?? { total: 0, hidden: 0 };
              return (
                <Link key={key} to={`/admin/c/${key}`} className={cx('tile', `a-${c.accent}`)}>
                  <span className="tile-icon"><Icon name={c.icon} size={20} /></span>
                  <strong>{n.total}</strong>
                  <span className="tile-label">{c.label}</span>
                  {n.hidden > 0 && <em className="tile-note">{n.hidden} hidden</em>}
                  <Icon name="arrowUpRight" size={18} className="tile-arrow" />
                </Link>
              );
            })}
          </div>

          <div className="two-col">
            <section className="card">
              <header className="card-head">
                <h2><Icon name="inbox" size={18} /> Latest messages</h2>
                <Link to="/admin/messages" className="link">
                  {data.messages.unread > 0 ? `${data.messages.unread} unread` : 'Open inbox'} <Icon name="arrowRight" size={14} />
                </Link>
              </header>
              {data.recentMessages.length === 0 ? (
                <p className="muted pad">No messages yet. Enquiries from your contact form will show up here.</p>
              ) : (
                <ul className="mini-list">
                  {data.recentMessages.map((m) => (
                    <li key={m.id} className={cx(!m.read && 'unread')}>
                      <Link to="/admin/messages">
                        <span className="avatar">{m.name[0]?.toUpperCase()}</span>
                        <span className="mini-main">
                          <strong>{m.name}</strong>
                          <span>{m.subject || m.message}</span>
                        </span>
                        <time>{timeAgo(m.createdAt)}</time>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card life-card">
              <header className="card-head">
                <h2><Icon name="chart" size={18} /> Life tracker</h2>
                <em className="soon">Coming next</em>
              </header>
              <p className="muted pad-x">Your spreadsheets are moving in here — log entries in seconds and see the trends as charts.</p>
              <ul className="life-list">
                <li className="a-pink"><Icon name="scale" size={20} /><span><strong>Weight</strong> daily log, goal &amp; trend line</span></li>
                <li className="a-lime"><Icon name="apple" size={20} /><span><strong>Diet</strong> meals, calories &amp; macros</span></li>
                <li className="a-cyan"><Icon name="target" size={20} /><span><strong>Habits</strong> streaks &amp; weekly view</span></li>
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
