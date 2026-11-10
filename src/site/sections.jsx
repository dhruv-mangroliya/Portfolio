import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import Icon from '../shared/Icon.jsx';
import { accentFor, cx, initials, safeUrl } from '../shared/utils.js';

/* ------------------------------------------------------------------ helpers */

/** Adds `.in` to an element when it scrolls into view (for reveal animations). */
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return el?.classList.add('in');
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('in');
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

function Section({ id, label, title, accent = 'violet', children, className }) {
  const ref = useReveal();
  return (
    <section id={id} className={cx('section reveal', className)} ref={ref} aria-labelledby={`${id}-title`}>
      <div className="container">
        <header className="section-head">
          <span className={cx('eyebrow', `a-${accent}`)}>
            <Icon name="sparkles" size={14} /> {label}
          </span>
          <h2 id={`${id}-title`}>{title}</h2>
        </header>
        {children}
      </div>
    </section>
  );
}

const Chips = ({ items, className }) =>
  items?.length > 0 && (
    <ul className={cx('chips', className)}>
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );

const SOCIALS = [
  ['github', 'GitHub'],
  ['linkedin', 'LinkedIn'],
  ['twitter', 'X / Twitter'],
  ['leetcode', 'LeetCode'],
  ['website', 'Website'],
];

export function Socials({ socials = {}, className }) {
  const links = SOCIALS.filter(([k]) => safeUrl(socials[k]));
  if (!links.length) return null;
  return (
    <ul className={cx('socials', className)}>
      {links.map(([k, label]) => (
        <li key={k}>
          <a href={safeUrl(socials[k])} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}>
            <Icon name={k === 'website' ? 'globe' : k} size={18} />
          </a>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ nav */

export function Nav({ profile, sections }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const linkedin = safeUrl(profile.socials?.linkedin);

  const links = [
    ['about', 'About'],
    ['experience', 'Experience'],
    ['projects', 'Projects'],
    ['services', 'Services'],
    ['skills', 'Skills'],
  ].filter(([id]) => sections[id]);

  return (
    <header className={cx('nav', scrolled && 'scrolled', open && 'open')}>
      <div className="nav-inner">
        <a href="#top" className="logo" onClick={() => setOpen(false)} aria-label={`${profile.name} — back to top`}>
          <span className="logo-mark">{initials(profile.name)}</span>
        </a>
        <nav aria-label="Main">
          <ul className="nav-links">
            {links.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} onClick={() => setOpen(false)}>{label}</a>
              </li>
            ))}
          </ul>
        </nav>
        {linkedin && (
          <a href={linkedin} className="nav-social" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn profile" title="LinkedIn">
            <Icon name="linkedin" size={18} />
          </a>
        )}
        <a href="#contact" className="btn btn-grad btn-sm nav-cta" onClick={() => setOpen(false)}>
          Let’s talk <Icon name="arrowUpRight" size={16} />
        </a>
        <button className="nav-toggle" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <Icon name={open ? 'close' : 'menu'} size={22} />
        </button>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ hero */

export function Hero({ profile }) {
  const first = profile.name.split(' ')[0];
  const photo = safeUrl(profile.photoUrl);

  return (
    <section className="hero" id="top">
      <div className="blobs" aria-hidden="true"><span /><span /><span /><span /></div>
      <div className="grid-bg" aria-hidden="true" />
      <div className="container hero-grid">
        <div className="hero-copy">
          {profile.availability?.text && (
            <span className={cx('status-pill', profile.availability.open ? 'on' : 'off')}>
              <i aria-hidden="true" /> {profile.availability.text}
            </span>
          )}
          <h1>
            Hi, I’m {first}.
            {profile.role && (
              <>
                <br />
                <span className="grad-text">{profile.role}</span>
              </>
            )}
          </h1>
          {profile.tagline && <p className="lead">{profile.tagline}</p>}
          <div className="hero-actions">
            <a href="#projects" className="btn btn-grad btn-lg">
              See my work <Icon name="arrowRight" />
            </a>
            <a href="#contact" className="btn btn-ghost btn-lg">
              Hire me
            </a>
            {safeUrl(profile.resumeUrl) && (
              <a href={safeUrl(profile.resumeUrl)} className="btn btn-link" target="_blank" rel="noopener noreferrer">
                <Icon name="download" /> Résumé
              </a>
            )}
          </div>
          <Socials socials={profile.socials} />
        </div>

        <div className={cx('hero-art', photo && 'has-photo')}>
          <div className="id-stack">
            <div className="id-back" aria-hidden="true" />
            <div className="id-card">
              {photo ? (
                <div className="id-photo">
                  <img src={photo} alt={`Photo of ${profile.name}`} />
                </div>
              ) : (
                <div className="id-ring" aria-hidden="true">
                  <span>{initials(profile.name)}</span>
                </div>
              )}
              <strong>{profile.name}</strong>
              {profile.role && <span className="id-role">{profile.role}</span>}
              {profile.location && (
                <span className="id-loc">
                  <Icon name="pin" size={14} /> {profile.location}
                </span>
              )}
              {!photo && <div className="id-bars" aria-hidden="true"><i /><i /><i /></div>}
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}

/* ------------------------------------------------------------------ marquee */

export function Marquee({ skills }) {
  const words = skills.flatMap((g) => g.skills);
  if (words.length < 3) return null;
  const row = (hidden) => (
    <div className="marquee-row" aria-hidden={hidden || undefined}>
      {words.map((w, i) => (
        <span key={w + i}>
          {w} <Icon name="sparkles" size={18} />
        </span>
      ))}
    </div>
  );
  return (
    <div className="marquee" role="region" aria-label="Technologies">
      <div className="marquee-track">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ about */

export function About({ profile, stats }) {
  const paragraphs = profile.about?.length ? profile.about : [profile.intro].filter(Boolean);
  return (
    <Section id="about" label="About me" title={<>A little about <span className="grad-text">me</span></>} accent="pink">
      <div className="about-grid">
        <div className="about-copy">
          {paragraphs.map((p, i) => (
            <p key={i} className={i === 0 ? 'about-lead' : undefined}>{p}</p>
          ))}
          <div className="about-meta">
            {profile.location && <span><Icon name="pin" size={16} /> {profile.location}</span>}
            {profile.email && (
              <a href={`mailto:${profile.email}`}><Icon name="mail" size={16} /> {profile.email}</a>
            )}
          </div>
        </div>
        {stats.length > 0 && (
          <ul className="about-stats">
            {stats.map((s, i) => (
              <li key={s.id} className={`a-${accentFor(s, i)}`}>
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ experience */

export function Experience({ items }) {
  return (
    <Section id="experience" label="Experience" title={<>Where I’ve <span className="grad-text">worked</span></>} accent="violet">
      <ol className="timeline">
        {items.map((x, i) => {
          const url = safeUrl(x.companyUrl);
          return (
            <li key={x.id} className={cx('tl-item', `a-${accentFor(x, i)}`)}>
              <div className="tl-dot" aria-hidden="true" />
              <article className="tl-card">
                <header>
                  <div>
                    <h3>{x.role}</h3>
                    <p className="tl-company">
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          {x.company} <Icon name="arrowUpRight" size={14} />
                        </a>
                      ) : (
                        x.company
                      )}
                      {x.location && <span> · {x.location}</span>}
                    </p>
                  </div>
                  <span className="tl-date">
                    {x.start} — {x.current ? 'Present' : x.end || 'Present'}
                    {x.current && <i className="now">Now</i>}
                  </span>
                </header>
                {x.summary && <p className="tl-summary">{x.summary}</p>}
                {x.points?.length > 0 && (
                  <ul className="ticks">
                    {x.points.map((p, j) => (
                      <li key={j}><Icon name="check" size={16} /> <span>{p}</span></li>
                    ))}
                  </ul>
                )}
                <Chips items={x.tech} />
              </article>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

/* ------------------------------------------------------------------ projects */

export function Projects({ items }) {
  const [gallery, setGallery] = useState(null); // { title, images, index }
  return (
    <Section id="projects" label="Projects" title={<>Things I’ve <span className="grad-text">built</span></>} accent="orange">
      <div className="project-grid">
        {items.map((p, i) => {
          const live = safeUrl(p.liveUrl);
          const repo = safeUrl(p.repoUrl);
          const images = (p.images ?? []).map(safeUrl).filter(Boolean);
          const img = images[0];
          return (
            <article key={p.id} className={cx('project', `a-${accentFor(p, i)}`, p.featured && 'featured')}>
              <div className="project-cover">
                {img ? (
                  <button
                    type="button"
                    className="cover-btn"
                    onClick={() => setGallery({ title: p.title, images, index: 0 })}
                    aria-label={`View ${images.length} image${images.length > 1 ? 's' : ''} of ${p.title}`}
                  >
                    <img src={img} alt="" loading="lazy" />
                    {images.length > 1 && <span className="photo-count"><Icon name="layout" size={13} /> {images.length} photos</span>}
                  </button>
                ) : (
                  <span className="cover-mono" aria-hidden="true">{initials(p.title)}</span>
                )}
                {p.category && <span className="project-cat">{p.category}</span>}
                {p.featured && <span className="project-star"><Icon name="star" size={13} /> Featured</span>}
              </div>
              <div className="project-body">
                <h3>{p.title}</h3>
                <p>{p.summary}</p>
                {p.points?.length > 0 && (
                  <ul className="ticks small">
                    {p.points.map((pt, j) => (
                      <li key={j}><Icon name="check" size={15} /> <span>{pt}</span></li>
                    ))}
                  </ul>
                )}
                <Chips items={p.tech} />
                {(live || repo) && (
                  <div className="project-links">
                    {live && (
                      <a href={live} target="_blank" rel="noopener noreferrer" className="btn btn-accent btn-sm">
                        Live <Icon name="arrowUpRight" size={15} />
                      </a>
                    )}
                    {repo && (
                      <a href={repo} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                        <Icon name="github" size={15} /> Code
                      </a>
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {gallery && <Lightbox {...gallery} onClose={() => setGallery(null)} />}
    </Section>
  );
}

/** Full-screen image viewer: arrows / keyboard / swipe, thumbnails, Esc or backdrop to close. */
function Lightbox({ title, images, index: start, onClose }) {
  const [index, setIndex] = useState(start);
  const touch = useRef(null);
  const closeRef = useRef(null);
  const go = (d) => setIndex((i) => (i + d + images.length) % images.length);

  useEffect(() => {
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} — image ${index + 1} of ${images.length}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - (touch.current ?? 0);
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="lb-top">
        <strong>{title}</strong>
        <span>{index + 1} / {images.length}</span>
        <button ref={closeRef} className="lb-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={22} /></button>
      </div>
      <div className="lb-stage" onClick={(e) => e.target === e.currentTarget && onClose()}>
        {images.length > 1 && <button className="lb-btn lb-prev" onClick={() => go(-1)} aria-label="Previous image"><Icon name="arrowLeft" size={22} /></button>}
        <img key={images[index]} src={images[index]} alt={`${title} — image ${index + 1}`} />
        {images.length > 1 && <button className="lb-btn lb-next" onClick={() => go(1)} aria-label="Next image"><Icon name="arrowRight" size={22} /></button>}
      </div>
      {images.length > 1 && (
        <div className="lb-thumbs">
          {images.map((src, i) => (
            <button key={src} className={cx('lb-thumb', i === index && 'on')} onClick={() => setIndex(i)} aria-label={`Image ${i + 1}`} aria-current={i === index}>
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ services */

export function Services({ items }) {
  return (
    <Section id="services" label="Services" title={<>How I can <span className="grad-text">help you</span></>} accent="cyan" className="section-tint">
      <ul className="service-grid">
        {items.map((s, i) => (
          <li key={s.id} className={cx('service', `a-${accentFor(s, i)}`)}>
            <span className="service-icon"><Icon name={s.icon} size={24} /></span>
            <h3>{s.title}</h3>
            <p>{s.description}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ------------------------------------------------------------------ skills */

export function Skills({ items }) {
  return (
    <Section id="skills" label="Skills" title={<>My <span className="grad-text">toolbox</span></>} accent="lime">
      <div className="skill-grid">
        {items.map((g, i) => (
          <div key={g.id} className={cx('skill-card', `a-${accentFor(g, i)}`)}>
            <h3><Icon name="layers" size={18} /> {g.name}</h3>
            <Chips items={g.skills} className="chips-solid" />
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ education */

export function Education({ items }) {
  return (
    <Section id="education" label="Education" title={<>Where I <span className="grad-text">learned</span></>} accent="blue">
      <div className="edu-grid">
        {items.map((e, i) => (
          <article key={e.id} className={cx('edu', `a-${accentFor(e, i + 5)}`)}>
            <span className="edu-icon"><Icon name="graduation" size={26} /></span>
            <div>
              <h3>{e.school}</h3>
              <p className="edu-degree">{e.degree}</p>
              <p className="edu-meta">
                {[e.start && e.end ? `${e.start} — ${e.end}` : e.start || e.end, e.location].filter(Boolean).join(' · ')}
              </p>
              {e.points?.length > 0 && (
                <ul className="ticks small">
                  {e.points.map((p, j) => (
                    <li key={j}><Icon name="check" size={15} /> <span>{p}</span></li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ contact */

const EMPTY = { name: '', email: '', subject: '', message: '', website: '' };

export function Contact({ profile }) {
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState({ state: 'idle', message: '', fields: {} });
  const ref = useReveal();

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setStatus({ state: 'sending', message: '', fields: {} });
    try {
      await api.contact(form);
      setForm(EMPTY);
      setStatus({ state: 'sent', message: 'Thanks! Your message is on its way — I’ll get back to you soon.', fields: {} });
    } catch (err) {
      setStatus({ state: 'error', message: err.message, fields: err.fields ?? {} });
    }
  }

  const fe = status.fields;
  return (
    <section id="contact" className="contact reveal" ref={ref} aria-labelledby="contact-title">
      <div className="container">
        <div className="contact-panel">
          <div className="contact-glow" aria-hidden="true" />
          <div className="contact-copy">
            <span className="eyebrow on-dark"><Icon name="sparkles" size={14} /> Contact</span>
            <h2 id="contact-title">Have a project in mind? <span className="grad-text">Let’s build it.</span></h2>
            <p>
              Whether it’s an API, a dashboard, a cloud migration or a full product — tell me what you’re working on
              and I’ll reply within a day or two.
            </p>
            <ul className="contact-list">
              {profile.email && (
                <li><a href={`mailto:${profile.email}`}><Icon name="mail" /> {profile.email}</a></li>
              )}
              {profile.phone && (
                <li><a href={`tel:${profile.phone.replace(/\s/g, '')}`}><Icon name="phone" /> {profile.phone}</a></li>
              )}
              {profile.location && <li><span><Icon name="pin" /> {profile.location}</span></li>}
            </ul>
            <Socials socials={profile.socials} className="on-dark" />
          </div>

          <form
            className="contact-form"
            onSubmit={submit}
            noValidate
            toolname="send_message_to_dhruv"
            tooldescription="Send Dhruv Mangroliya a message about a job, project or question. He replies by email."
          >
            <div className="row-2">
              <Field label="Your name" error={fe.name}>
                <input value={form.name} onChange={set('name')} autoComplete="name" required maxLength={100} />
              </Field>
              <Field label="Email" error={fe.email}>
                <input type="email" value={form.email} onChange={set('email')} autoComplete="email" required maxLength={200} />
              </Field>
            </div>
            <Field label="Subject (optional)" error={fe.subject}>
              <input value={form.subject} onChange={set('subject')} maxLength={150} placeholder="e.g. Admin dashboard for my startup" />
            </Field>
            <Field label="Message" error={fe.message}>
              <textarea rows={5} value={form.message} onChange={set('message')} required maxLength={5000} placeholder="What are you building? Timeline, budget, anything useful…" />
            </Field>
            {/* Honeypot — invisible to people, bots fill it in */}
            <label className="hp" aria-hidden="true">
              Website <input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
            </label>
            <button className="btn btn-grad btn-lg btn-block" disabled={status.state === 'sending'}>
              {status.state === 'sending' ? 'Sending…' : <>Send message <Icon name="send" /></>}
            </button>
            {status.message && (
              <p className={cx('form-status', status.state)} role="status">{status.message}</p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}

function Field({ label, error, children }) {
  return (
    <label className={cx('field', error && 'has-error')}>
      <span>{label}</span>
      {children}
      {error && <small>{error}</small>}
    </label>
  );
}

/* ------------------------------------------------------------------ footer */

export function Footer({ profile }) {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <a href="#top" className="logo">
          <span className="logo-mark">{initials(profile.name)}</span>
          <span className="logo-name">{profile.name}</span>
        </a>
        <p>© {new Date().getFullYear()} {profile.name}. All rights reserved.</p>
        <nav className="footer-links" aria-label="About and legal">
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </nav>
        <Socials socials={profile.socials} />
      </div>
    </footer>
  );
}
