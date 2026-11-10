// Describes every editable content type. The dashboard's list pages and forms are generated from this,
// so adding a field = one line here + the matching field in the server's Zod schema & Mongoose model.
//
// Field types: text · textarea · url · email · tags · list · bool · accent · icon
// Options: required, half (two per row), placeholder, help, rows, multiline (list of paragraphs)

export const SERVICE_ICONS = ['code', 'server', 'cloud', 'layout', 'database', 'zap', 'refresh', 'shield'];

const range = (i) => [i.start, i.current ? 'Present' : i.end].filter(Boolean).join(' – ');

export const COLLECTIONS = {
  experience: {
    label: 'Experience',
    singular: 'experience',
    icon: 'briefcase',
    accent: 'violet',
    blurb: 'Jobs and roles, shown as a timeline.',
    title: (i) => i.role || 'Untitled role',
    subtitle: (i) => [i.company, range(i)].filter(Boolean).join(' · '),
    badges: (i) => [i.current && 'Current'],
    fields: [
      { name: 'role', label: 'Role / title', type: 'text', required: true, half: true, placeholder: 'Software Engineer' },
      { name: 'company', label: 'Company', type: 'text', required: true, half: true, placeholder: 'Acme Inc.' },
      { name: 'start', label: 'Start', type: 'text', required: true, half: true, placeholder: 'Sep 2025' },
      { name: 'end', label: 'End', type: 'text', half: true, placeholder: 'Leave empty if current' },
      { name: 'current', label: 'I currently work here', type: 'bool' },
      { name: 'location', label: 'Location', type: 'text', half: true, placeholder: 'Bengaluru, India' },
      { name: 'companyUrl', label: 'Company website', type: 'url', half: true },
      { name: 'summary', label: 'One-line summary', type: 'textarea', rows: 2, placeholder: 'Team / product and what you do there' },
      { name: 'points', label: 'Achievements', type: 'list', help: 'One achievement per row. Numbers make them pop: “cut latency by ~50%”.' },
      { name: 'tech', label: 'Tech used', type: 'tags', placeholder: 'Type and press Enter' },
    ],
  },
  projects: {
    label: 'Projects',
    singular: 'project',
    icon: 'folder',
    accent: 'orange',
    blurb: 'Work you want to show off. Featured projects get a wide card.',
    title: (i) => i.title || 'Untitled project',
    subtitle: (i) => [i.category, i.tech?.slice(0, 3).join(', ')].filter(Boolean).join(' · '),
    badges: (i) => [i.featured && 'Featured'],
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, half: true },
      { name: 'category', label: 'Category', type: 'text', half: true, placeholder: 'Backend · AWS' },
      { name: 'summary', label: 'Summary', type: 'textarea', required: true, rows: 3, help: 'One or two sentences — what it is and why it matters.' },
      { name: 'points', label: 'Highlights', type: 'list', help: 'Short bullet points (features, results).' },
      { name: 'tech', label: 'Tech stack', type: 'tags', placeholder: 'Type and press Enter' },
      { name: 'liveUrl', label: 'Live demo link', type: 'url', half: true },
      { name: 'repoUrl', label: 'Source code link', type: 'url', half: true },
      { name: 'images', label: 'Images', type: 'images', aspect: [16, 9], max: 10, help: 'Screenshots of the project. Visitors can click the card to browse them.' },
      { name: 'accent', label: 'Card colour', type: 'accent' },
      { name: 'featured', label: 'Featured (wide card with a ★ badge)', type: 'bool' },
    ],
  },
  skills: {
    label: 'Skills',
    singular: 'skill group',
    icon: 'layers',
    accent: 'lime',
    blurb: 'Groups of skills (Languages, Backend, Cloud…). Also feed the scrolling banner.',
    title: (i) => i.name || 'Untitled group',
    subtitle: (i) => `${i.skills?.length ?? 0} skills · ${(i.skills ?? []).slice(0, 4).join(', ')}`,
    fields: [
      { name: 'name', label: 'Group name', type: 'text', required: true, placeholder: 'Backend' },
      { name: 'skills', label: 'Skills', type: 'tags', placeholder: 'Type a skill and press Enter' },
    ],
  },
  services: {
    label: 'Services',
    singular: 'service',
    icon: 'zap',
    accent: 'cyan',
    blurb: 'What clients can hire you for.',
    title: (i) => i.title || 'Untitled service',
    subtitle: (i) => i.description,
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea', required: true, rows: 3 },
      { name: 'icon', label: 'Icon', type: 'icon', options: SERVICE_ICONS },
    ],
  },
  stats: {
    label: 'Key numbers',
    singular: 'number',
    icon: 'chart',
    accent: 'pink',
    blurb: 'Big numbers shown in the hero and About section.',
    title: (i) => i.value || '—',
    subtitle: (i) => i.label,
    fields: [
      { name: 'value', label: 'Value', type: 'text', required: true, half: true, placeholder: '20+' },
      { name: 'label', label: 'Label', type: 'text', required: true, half: true, placeholder: 'APIs shipped' },
    ],
  },
  education: {
    label: 'Education',
    singular: 'education entry',
    icon: 'graduation',
    accent: 'blue',
    blurb: 'Degrees and courses.',
    title: (i) => i.school || 'Untitled',
    subtitle: (i) => [i.degree, range(i)].filter(Boolean).join(' · '),
    fields: [
      { name: 'school', label: 'School / university', type: 'text', required: true },
      { name: 'degree', label: 'Degree', type: 'text', required: true },
      { name: 'start', label: 'Start', type: 'text', half: true, placeholder: '2021' },
      { name: 'end', label: 'End', type: 'text', half: true, placeholder: '2025' },
      { name: 'location', label: 'Location', type: 'text' },
      { name: 'points', label: 'Highlights', type: 'list', help: 'Optional: GPA, awards, coursework…' },
    ],
  },
};

export const PROFILE_SECTIONS = [
  {
    title: 'Basics',
    icon: 'user',
    fields: [
      { name: 'name', label: 'Full name', type: 'text', required: true, half: true },
      { name: 'role', label: 'Role (shown in big gradient text)', type: 'text', half: true, placeholder: 'Software Engineer' },
      { name: 'tagline', label: 'Tagline', type: 'textarea', rows: 2, help: 'The sentence under your name in the hero.' },
      { name: 'intro', label: 'Short intro', type: 'textarea', rows: 3, help: 'Used when the About section has no paragraphs.' },
    ],
  },
  {
    title: 'About section',
    icon: 'edit',
    fields: [{ name: 'about', label: 'Paragraphs', type: 'list', multiline: true, help: 'The first paragraph is shown larger.' }],
  },
  {
    title: 'Availability',
    icon: 'sparkles',
    fields: [
      { name: 'availability.open', label: 'Open to new work (green pulsing dot)', type: 'bool' },
      { name: 'availability.text', label: 'Badge text', type: 'text', placeholder: 'Open to freelance projects' },
    ],
  },
  {
    title: 'Contact details',
    icon: 'mail',
    fields: [
      { name: 'email', label: 'Email', type: 'email', half: true },
      { name: 'phone', label: 'Phone', type: 'text', half: true },
      { name: 'location', label: 'Location', type: 'text', half: true },
      { name: 'resumeUrl', label: 'Résumé link (PDF)', type: 'url', half: true },
    ],
  },
  {
    title: 'Google & sharing',
    icon: 'globe',
    fields: [
      { name: 'seo.title', label: 'Search title', type: 'text', counter: 60, help: 'The blue link on Google and the browser-tab title. About 60 characters fit.' },
      { name: 'seo.description', label: 'Search description', type: 'textarea', rows: 3, counter: 160, help: 'The text under the link on Google and in WhatsApp/LinkedIn previews. Google shows about 160 characters.' },
    ],
  },
  {
    title: 'Social links',
    icon: 'globe',
    fields: [
      { name: 'socials.github', label: 'GitHub', type: 'url', half: true, placeholder: 'https://github.com/…' },
      { name: 'socials.linkedin', label: 'LinkedIn', type: 'url', half: true, placeholder: 'https://linkedin.com/in/…' },
      { name: 'socials.twitter', label: 'X / Twitter', type: 'url', half: true },
      { name: 'socials.leetcode', label: 'LeetCode', type: 'url', half: true },
      { name: 'socials.website', label: 'Other website', type: 'url' },
    ],
  },
];

/* ----- helpers for dotted field names ('socials.github') ----- */

export const getPath = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);

export function setPath(obj, path, value) {
  const [head, ...rest] = path.split('.');
  if (!rest.length) return { ...obj, [head]: value };
  return { ...obj, [head]: setPath(obj?.[head] ?? {}, rest.join('.'), value) };
}

const emptyFor = (f) =>
  ({ bool: false, tags: [], list: [], images: [], accent: 'auto', icon: f.options?.[0] ?? '' })[f.type] ?? '';

export function emptyItem(fields) {
  return fields.reduce((o, f) => setPath(o, f.name, emptyFor(f)), { hidden: false });
}

/** Client-side check for required fields (the server validates everything again). */
export function validateRequired(fields, value) {
  const errors = {};
  for (const f of fields) {
    if (f.required && !String(getPath(value, f.name) ?? '').trim()) errors[f.name] = `${f.label.replace(/ \(.*\)$/, '')} is required.`;
  }
  return errors;
}

/** Strip server-managed fields before sending. */
export const toPayload = ({ id, createdAt, updatedAt, order, ...rest }) => rest;
