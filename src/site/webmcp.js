// WebMCP: lets AI agents running in the visitor's browser use the site directly
// (read the profile, send a message). No-op in browsers without navigator.modelContext.
import { api } from '../api.js';

let registered = false;

export function registerWebMcpTools(content) {
  const mc = typeof navigator !== 'undefined' ? navigator.modelContext : undefined;
  if (registered || !mc?.registerTool || !content?.profile) return;
  registered = true;
  const p = content.profile;
  const asText = (data) => ({ content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] });
  const safe = (fn) => async (input) => {
    try {
      return await fn(input ?? {});
    } catch (err) {
      return { ...asText(err?.message || 'Something went wrong.'), isError: true };
    }
  };

  const tools = [
    {
      name: 'get_profile',
      description: `${p.name}'s profile: role, intro, contact links, experience, education and skills.`,
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: safe(async () =>
        asText({
          name: p.name, role: p.role, tagline: p.tagline, intro: p.intro, about: p.about, location: p.location, email: p.email,
          socials: p.socials, experience: content.experience, education: content.education, skills: content.skills,
        })
      ),
    },
    {
      name: 'list_projects',
      description: `Projects ${p.name} has built, with tech stack and links.`,
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: safe(async () => asText(content.projects.map(({ title, category, summary, points, tech, liveUrl, repoUrl }) => ({ title, category, summary, points, tech, liveUrl, repoUrl })))),
    },
    {
      name: 'list_services',
      description: `Services ${p.name} offers to clients.`,
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: safe(async () => asText(content.services.map(({ title, description }) => ({ title, description })))),
    },
    {
      name: 'send_message',
      description: `Send ${p.name} a message (job, project or question) on behalf of the user. He replies by email. Confirm the details with the user first.`,
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: "Sender's name" },
          email: { type: 'string', description: "Sender's email for the reply" },
          subject: { type: 'string', description: 'Short subject (optional)' },
          message: { type: 'string', description: 'The message, at least 10 characters' },
        },
        required: ['name', 'email', 'message'],
      },
      execute: safe(async ({ name, email, subject = '', message }) => {
        await api.contact({ name, email, subject, message });
        return asText('Message sent. Dhruv will reply by email.');
      }),
    },
  ];

  for (const tool of tools) {
    try {
      mc.registerTool(tool);
    } catch {
      /* already registered or unsupported shape — ignore */
    }
  }
}
