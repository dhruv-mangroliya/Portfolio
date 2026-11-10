import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api, setUnauthorizedHandler } from '../api.js';
import Icon from '../shared/Icon.jsx';
import { applyTheme } from '../shared/theme.js';
import { cx, initials } from '../shared/utils.js';
import CollectionList from './pages/CollectionList.jsx';
import ItemEditor from './pages/ItemEditor.jsx';
import Messages from './pages/Messages.jsx';
import Overview from './pages/Overview.jsx';
import ProfileEditor from './pages/ProfileEditor.jsx';
import Appearance from './pages/Appearance.jsx';
import Settings from './pages/Settings.jsx';
import Weight from './pages/Weight.jsx';
import Diet from './pages/Diet.jsx';
import DietPlan from './pages/DietPlan.jsx';
import { COLLECTIONS } from './schema.js';
import { ConfirmProvider, ErrorBox, ToastProvider } from './ui.jsx';
import { useNoIndex } from './hooks.js';
import './admin.css';

const AdminCtx = createContext(null);
export const useAdmin = () => useContext(AdminCtx);

// Personal trackers planned next — shown in the sidebar so the structure is ready for them.
const LIFE_TRACKERS = [
  { key: 'habits', label: 'Habits', icon: 'target', accent: 'cyan' },
];

export default function AdminApp() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <Shell />
      </ConfirmProvider>
    </ToastProvider>
  );
}

function Shell() {
  useNoIndex();
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const toLogin = useCallback(
    (expired) => navigate('/admin/login', { replace: true, state: { from: location.pathname, expired } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    setUnauthorizedHandler(() => toLogin(true));
    return () => setUnauthorizedHandler(null);
  }, [toLogin]);

  const checkSession = useCallback(() => {
    setError(null);
    api
      .me()
      .then(setUser)
      .catch((e) => (e.status === 401 ? toLogin(false) : setError(e)));
  }, [toLogin]);
  useEffect(checkSession, [checkSession]);

  const refreshUnread = useCallback(() => {
    api.messages({ status: 'unread' }).then((r) => setUnread(r.unread)).catch(() => {});
  }, []);
  useEffect(() => {
    if (user) refreshUnread();
  }, [user, refreshUnread]);

  // The dashboard uses the site's theme too.
  useEffect(() => {
    if (user) api.theme().then((r) => applyTheme(r.theme)).catch(() => {});
  }, [user]);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  async function logout() {
    await api.logout().catch(() => {});
    navigate('/admin/login', { replace: true });
  }

  if (error) {
    return (
      <div className="admin-center">
        <ErrorBox error={error} onRetry={checkSession} />
      </div>
    );
  }
  if (!user) return <div className="page-loader" aria-label="Loading" />;

  return (
    <AdminCtx.Provider value={{ user, unread, refreshUnread }}>
      <div className={cx('admin', menuOpen && 'menu-open')}>
        <aside className="sidebar">
          <div className="side-brand">
            <span className="side-logo">{initials(user.username) || 'A'}</span>
            <div>
              <strong>Control room</strong>
              <span>Signed in as {user.username}</span>
            </div>
          </div>

          <nav className="side-nav" aria-label="Dashboard">
            <p className="side-label">Portfolio</p>
            <SideLink to="/admin" end icon="home" accent="violet">Overview</SideLink>
            <SideLink to="/admin/profile" icon="user" accent="pink">Profile</SideLink>
            {Object.entries(COLLECTIONS).map(([key, c]) => (
              <SideLink key={key} to={`/admin/c/${key}`} icon={c.icon} accent={c.accent}>{c.label}</SideLink>
            ))}
            <SideLink to="/admin/messages" icon="inbox" accent="orange" badge={unread || null}>Messages</SideLink>
            <SideLink to="/admin/appearance" icon="palette" accent="cyan">Appearance</SideLink>

            <p className="side-label">Life tracker</p>
            <SideLink to="/admin/weight" icon="scale" accent="pink">Weight</SideLink>
            <SideLink to="/admin/diet" icon="apple" accent="lime">Diet & meals</SideLink>
            {LIFE_TRACKERS.map((t) => (
              <span key={t.key} className="side-link disabled" title="Coming next">
                <span className={cx('side-icon', `a-${t.accent}`)}><Icon name={t.icon} size={16} /></span>
                {t.label}
                <em className="soon">Soon</em>
              </span>
            ))}
          </nav>

          <div className="side-foot">
            <a href="/" target="_blank" rel="noopener noreferrer" className="side-link">
              <span className="side-icon a-cyan"><Icon name="external" size={16} /></span> View website
            </a>
            <SideLink to="/admin/settings" icon="settings" accent="blue">Settings</SideLink>
            <button className="side-link" onClick={logout}>
              <span className="side-icon a-orange"><Icon name="logout" size={16} /></span> Sign out
            </button>
          </div>
        </aside>

        <div className="admin-main">
          <header className="topbar">
            <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">
              <Icon name="menu" size={22} />
            </button>
            <strong>Control room</strong>
          </header>
          <div className="scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <main className="admin-content">
            <Routes>
              <Route index element={<Overview />} />
              <Route path="profile" element={<ProfileEditor />} />
              <Route path="c/:collection" element={<CollectionList />} />
              <Route path="c/:collection/new" element={<ItemEditor />} />
              <Route path="c/:collection/:id" element={<ItemEditor />} />
              <Route path="messages" element={<Messages />} />
              <Route path="appearance" element={<Appearance />} />
              <Route path="settings" element={<Settings />} />
              <Route path="weight" element={<Weight />} />
              <Route path="diet" element={<Diet />} />
              <Route path="diet/plan" element={<DietPlan />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </AdminCtx.Provider>
  );
}

function SideLink({ to, end, icon, accent, badge, children }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => cx('side-link', isActive && 'active', `a-${accent}`)}>
      <span className={cx('side-icon', `a-${accent}`)}><Icon name={icon} size={16} /></span>
      {children}
      {badge != null && <em className="badge">{badge}</em>}
    </NavLink>
  );
}
