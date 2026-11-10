// A small, stateless MCP server (Streamable HTTP transport, JSON responses) so AI agents can
// read the profile and send Dhruv a message — the same things a visitor can do on the website.
//   POST /mcp                                   JSON-RPC 2.0 (initialize, tools/list, tools/call, ping)
//   GET  /.well-known/mcp/server-card.json      discovery card (SEP-1649)
import { Router } from 'express';
import { contactLimiter } from '../../middleware/rateLimiters.js';
import { contactSchema } from '../contact/contact.routes.js';
import { createMessage } from '../messages/messages.service.js';
import { loadContent, renderLlmsTxt, siteUrlFor } from '../seo/crawl.service.js';

const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER_INFO = { name: 'dhruvmangroliya-portfolio', title: 'Dhruv Mangroliya — Portfolio', version: '1.0.0' };
const INSTRUCTIONS =
  'Portfolio of Dhruv Mangroliya, software engineer (IIT Guwahati). Use get_profile for a full overview, ' +
  'list_projects / list_services for details, and send_message to contact him about work or hiring.';

export const TOOLS = [
  {
    name: 'get_profile',
    title: 'Get profile',
    description: "Dhruv Mangroliya's full profile as Markdown: intro, experience, projects, services, skills, education and contact links.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'list_projects',
    title: 'List projects',
    description: 'Projects Dhruv has built, with summary, tech stack and links.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'list_services',
    title: 'List services',
    description: 'Services Dhruv offers to clients (freelance / contract work).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'send_message',
    title: 'Send a message',
    description:
      'Send Dhruv a message (job opportunity, project enquiry, question). He replies by email. Only send on behalf of a real person who asked to get in touch.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', maxLength: 100, description: 'Sender’s name' },
        email: { type: 'string', format: 'email', description: 'Sender’s email, for the reply' },
        subject: { type: 'string', maxLength: 150, description: 'Short subject (optional)' },
        message: { type: 'string', minLength: 10, maxLength: 5000, description: 'The message' },
      },
      required: ['name', 'email', 'message'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
];

const text = (t, isError = false) => ({ content: [{ type: 'text', text: t }], ...(isError && { isError: true }) });
const json = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: { items: data } });

async function callTool(req, name, args = {}) {
  switch (name) {
    case 'get_profile':
      return text(renderLlmsTxt(await loadContent(), siteUrlFor(req)));
    case 'list_projects': {
      const c = await loadContent();
      return json((c?.projects ?? []).map(({ title, category, summary, points, tech, liveUrl, repoUrl }) => ({ title, category, summary, points, tech, liveUrl, repoUrl })));
    }
    case 'list_services': {
      const c = await loadContent();
      return json((c?.services ?? []).map(({ title, description }) => ({ title, description })));
    }
    case 'send_message': {
      const parsed = contactSchema.safeParse(args);
      if (!parsed.success) return text(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'), true);
      const { website: _hp, ...data } = parsed.data;
      await createMessage({ ...data, meta: { ip: req.ip ?? '', userAgent: `MCP: ${String(req.get('user-agent') ?? '').slice(0, 290)}` } });
      return text('Message sent. Dhruv will reply by email.');
    }
    default:
      return null;
  }
}

const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

async function handle(req, msg) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return fail(msg?.id, -32600, 'Invalid request');
  const { id, method, params = {} } = msg;
  const isNotification = id === undefined;
  switch (method) {
    case 'initialize': {
      const v = PROTOCOL_VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : PROTOCOL_VERSIONS[0];
      return ok(id, { protocolVersion: v, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS });
    }
    case 'ping':
      return ok(id, {});
    case 'tools/list':
      return ok(id, { tools: TOOLS });
    case 'tools/call': {
      const result = await callTool(req, params.name, params.arguments);
      return result ? ok(id, result) : fail(id, -32602, `Unknown tool: ${params.name}`);
    }
    default:
      return isNotification ? null : fail(id, -32601, `Method not found: ${method}`);
  }
}

// Sending a message is limited exactly like the website's contact form.
const limitSends = (req, res, next) => {
  const calls = [].concat(req.body ?? []);
  const sends = calls.some((m) => m?.method === 'tools/call' && m?.params?.name === 'send_message');
  return sends ? contactLimiter(req, res, next) : next();
};

export function serverCard(req) {
  const site = siteUrlFor(req);
  return {
    $schema: 'https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json',
    version: '1.0',
    protocolVersion: PROTOCOL_VERSIONS[0],
    serverInfo: SERVER_INFO,
    name: SERVER_INFO.name,
    title: SERVER_INFO.title,
    description: INSTRUCTIONS,
    websiteUrl: site,
    endpoint: `${site}mcp`,
    transport: { type: 'streamable-http', endpoint: `${site}mcp` },
    remotes: [{ type: 'streamable-http', url: `${site}mcp` }],
    authentication: { required: false },
    capabilities: { tools: { listChanged: false } },
    tools: TOOLS.map(({ name, title, description }) => ({ name, title, description })),
  };
}

export const mcpRoutes = Router()
  .post('/mcp', limitSends, async (req, res) => {
    const body = req.body;
    const batch = Array.isArray(body);
    const replies = (await Promise.all((batch ? body : [body]).map((m) => handle(req, m)))).filter(Boolean);
    if (!replies.length) return res.status(202).end(); // notifications only
    res.set('Cache-Control', 'no-store').json(batch ? replies : replies[0]);
  })
  .get('/mcp', (_req, res) => res.status(405).set('Allow', 'POST').json(fail(null, -32000, 'Use POST (stateless Streamable HTTP; no SSE stream).')))
  .delete('/mcp', (_req, res) => res.status(405).set('Allow', 'POST').end())
  .get(['/.well-known/mcp/server-card.json', '/.well-known/mcp.json'], (req, res) =>
    res.set({ 'Cache-Control': 'public, max-age=3600', 'Access-Control-Allow-Origin': '*' }).json(serverCard(req))
  );
