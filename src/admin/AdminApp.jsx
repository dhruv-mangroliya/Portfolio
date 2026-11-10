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
import Todo from './pages/Todo.jsx';
import { COLLECTIONS } from './schema.js';
import { ConfirmProvider, ErrorBox, ToastProvider } from './ui.jsx';
import { useNoIndex } from './hooks.js';
import './admin.css';

const AdminCtx = createContext(null);
export const useAdmin = () => useContext(AdminCtx);

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
            <SideLink to="/admin/messages" icon="inbox" accent="orange" badge={unread || null}>Inbox</SideLink>

            <p className="side-label">Life tracker</p>
            <SideLink to="/admin/weight" icon="scale" accent="pink">Weight</SideLink>
            <SideLink to="/admin/diet" icon="apple" accent="lime">Diet & meals</SideLink>
            <SideLink to="/admin/todo" icon="check" accent="cyan">To-do</SideLink>

            {/* Website editing tabs, folded into one group (rarely needed day to day). */}
            <PortfolioGroup pathname={location.pathname}>
              <SideLink to="/admin" end icon="home" accent="violet">Overview</SideLink>
              <SideLink to="/admin/profile" icon="user" accent="pink">Profile</SideLink>
              {Object.entries(COLLECTIONS).map(([key, c]) => (
                <SideLink key={key} to={`/admin/c/${key}`} icon={c.icon} accent={c.accent}>{c.label}</SideLink>
              ))}
              <SideLink to="/admin/appearance" icon="palette" accent="cyan">Appearance</SideLink>
            </PortfolioGroup>
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
              <Route path="todo" element={<Todo />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </AdminCtx.Provider>
  );
}

const PORTFOLIO_PATHS = /^\/admin\/?($|profile|c\/|appearance)/;
const GROUP_KEY = 'admin-portfolio-open';

function PortfolioGroup({ pathname, children }) {
  const inside = PORTFOLIO_PATHS.test(pathname);
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(GROUP_KEY) === '1';
    } catch {
      return false;
    }
  });
  const shown = open; // stays as you left it (collapsed by default); the button lights up when you're on one of its pages
  const toggle = () => {
    const next = !shown;
    setOpen(next);
    try {
      localStorage.setItem(GROUP_KEY, next ? '1' : '0');
    } catch {
      /* storage unavailable */
    }
  };
  return (
    <div className={cx('side-group', shown && 'open')}>
      <button type="button" className={cx('side-link side-group-btn', inside && 'has-active')} onClick={toggle} aria-expanded={shown} aria-controls="side-portfolio">
        <span className="side-icon a-violet"><Icon name="globe" size={16} /></span>
        Portfolio
        <Icon name="chevron-down" size={16} className="side-group-chev" />
      </button>
      {shown && (
        <div id="side-portfolio" className="side-group-items">
          {children}
        </div>
      )}
    </div>
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
