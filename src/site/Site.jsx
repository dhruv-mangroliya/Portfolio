import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Icon from '../shared/Icon.jsx';
import { applyTheme } from '../shared/theme.js';
import { registerWebMcpTools } from './webmcp.js';
import {
  About,
  Contact,
  Education,
  Experience,
  Footer,
  Hero,
  Marquee,
  Nav,
  Projects,
  Services,
  Skills,
} from './sections.jsx';
import './site.css';

// Content embedded in the page by the server (production) — used once, on the first render.
let embedded = (() => {
  try {
    const el = document.getElementById('initial-content');
    return el ? JSON.parse(el.textContent) : null;
  } catch {
    return null;
  }
})();

export default function Site({ notFound = false }) {
  const [state, setState] = useState(() => {
    const data = embedded;
    embedded = null; // later visits to this page in the same tab fetch fresh data
    return data?.profile ? { status: 'ready', data, error: null } : { status: 'loading', data: null, error: null };
  });

  const load = useCallback(() => {
    let cancelled = false;
    setState((s) => ({ ...s, status: 'loading' }));
    // The server may be waking up (cold start): retry "unavailable" a few times before showing an error.
    const attempt = (n) =>
      api
        .content()
        .then((data) => !cancelled && setState({ status: 'ready', data, error: null }))
        .catch((error) => {
          if (cancelled) return;
          if (n < 4 && (error?.status === 503 || !error?.status)) setTimeout(() => attempt(n + 1), 1500 * (n + 1));
          else setState({ status: 'error', data: null, error });
        });
    attempt(0);
    return () => (cancelled = true);
  }, []);

  useEffect(() => {
    if (state.status !== 'ready') return load();
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  const d = state.data;
  useEffect(() => {
    if (d?.theme) applyTheme(d.theme);
    if (d) registerWebMcpTools(d);
  }, [d]);

  useEffect(() => {
    const seo = d?.profile?.seo;
    if (seo?.title) document.title = seo.title;
    if (seo?.description) document.querySelector('meta[name="description"]')?.setAttribute('content', seo.description);
  }, [d]);

  if (notFound) return <NotFound />;
  if (state.status === 'loading') return <Skeleton />;
  if (state.status === 'error' || !d?.profile) return <LoadError error={state.error} onRetry={load} />;

  const sections = {
    about: d.profile.about?.length > 0 || d.stats.length > 0,
    experience: d.experience.length > 0,
    projects: d.projects.length > 0,
    services: d.services.length > 0,
    skills: d.skills.length > 0,
    education: d.education.length > 0,
  };

  return (
    <div className="site">
      <a href="#main" className="skip-link">Skip to content</a>
      <Nav profile={d.profile} sections={sections} />
      <main id="main">
        <Hero profile={d.profile} />
        <Marquee skills={d.skills} />
        {sections.about && <About profile={d.profile} stats={d.stats} />}
        {sections.experience && <Experience items={d.experience} />}
        {sections.projects && <Projects items={d.projects} />}
        {sections.services && <Services items={d.services} />}
        {sections.skills && <Skills items={d.skills} />}
        {sections.education && <Education items={d.education} />}
        <Contact profile={d.profile} />
      </main>
      <Footer profile={d.profile} />
    </div>
  );
}

function Skeleton() {
  return (
    <div className="site">
      <div className="skeleton" aria-busy="true" aria-label="Loading">
        <div className="blobs" aria-hidden="true"><span /><span /><span /></div>
        <div className="sk sk-pill" />
        <div className="sk sk-h1" />
        <div className="sk sk-h1 short" />
        <div className="sk sk-p" />
      </div>
    </div>
  );
}

function LoadError({ error, onRetry }) {
  return (
    <div className="site center-screen">
      <div className="blobs" aria-hidden="true"><span /><span /><span /></div>
      <div className="msg-card">
        <span className="msg-icon a-orange"><Icon name="alert" size={26} /></span>
        <h1>We couldn’t load this page</h1>
        <p>{error?.status === 503 ? 'The database is starting up or unavailable. Please try again in a moment.' : error?.message || 'Something went wrong.'}</p>
        <button className="btn btn-grad" onClick={onRetry}>
          <Icon name="refresh" /> Try again
        </button>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="site center-screen">
      <div className="blobs" aria-hidden="true"><span /><span /><span /></div>
      <div className="msg-card">
        <span className="big-404 grad-text">404</span>
        <h1>This page wandered off</h1>
        <p>The page you’re looking for doesn’t exist.</p>
        <Link className="btn btn-grad" to="/">
          <Icon name="arrowLeft" /> Back home
        </Link>
      </div>
    </div>
  );
}
