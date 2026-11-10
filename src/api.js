// Small fetch wrapper for the /api/v1 backend. Errors are thrown as ApiError with
// .status, .code and .fields (per-field validation messages from the server).
const BASE = '/api/v1';

export class ApiError extends Error {
  constructor(status, body) {
    super(
      body?.error?.message ??
        (status === 0 || status >= 500
          ? 'The server isn’t responding right now. Please try again in a moment.'
          : `Request failed (${status}).`)
    );
    this.status = status;
    this.code = body?.error?.code;
    this.fields = body?.error?.fields ?? {};
  }
}

let onUnauthorized = null;
/** The admin app registers a handler to redirect to the login page when a session expires. */
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0);
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login')) onUnauthorized?.();
    throw new ApiError(res.status, data);
  }
  return data;
}

const col = (c) => `/admin/collections/${encodeURIComponent(c)}`;

export const api = {
  // public
  content: () => request('GET', '/content'),
  contact: (data) => request('POST', '/contact', data),

  // Weight tracker
  weights: ({ from, to } = {}) => request('GET', `/admin/weight?${new URLSearchParams(Object.entries({ from, to }).filter(([, v]) => v))}`),
  saveWeight: (date, data) => request('PUT', `/admin/weight/${date}`, data),
  deleteWeight: (date) => request('DELETE', `/admin/weight/${date}`),

  // Diet tracker
  dietPlan: () => request('GET', '/admin/diet/plan'),
  saveDietPlan: (plan) => request('PUT', '/admin/diet/plan', plan),
  dietDays: ({ from, to } = {}) => request('GET', `/admin/diet/days?${new URLSearchParams(Object.entries({ from, to }).filter(([, v]) => v))}`),
  dietDay: (date) => request('GET', `/admin/diet/days/${date}`),
  saveDietDay: (date, day) => request('PUT', `/admin/diet/days/${date}`, day),

  // auth
  login: (username, password) => request('POST', '/auth/login', { username, password }).then((d) => d.user),
  logout: () => request('POST', '/auth/logout'),
  me: () => request('GET', '/auth/me').then((d) => d.user),
  changePassword: (currentPassword, newPassword) =>
    request('PUT', '/auth/password', { currentPassword, newPassword }),

  // admin
  dashboard: () => request('GET', '/admin/dashboard'),
  profile: () => request('GET', '/admin/profile').then((d) => d.profile),
  saveProfile: (data) => request('PUT', '/admin/profile', data).then((d) => d.profile),
  uploadPhoto: ({ image, original, crop }) =>
    request('PUT', '/admin/profile/photo', { image, original, crop }).then((d) => d.profile),
  removePhoto: () => request('DELETE', '/admin/profile/photo').then((d) => d.profile),

  uploadImage: (image) => request('POST', '/admin/media', { image }).then((d) => d.media),
  theme: () => request('GET', '/admin/theme'),
  saveTheme: (theme) => request('PUT', '/admin/theme', theme).then((d) => d.theme),

  list: (c) => request('GET', col(c)).then((d) => d.items),
  get: (c, id) => request('GET', `${col(c)}/${id}`).then((d) => d.item),
  create: (c, data) => request('POST', col(c), data).then((d) => d.item),
  update: (c, id, data) => request('PATCH', `${col(c)}/${id}`, data).then((d) => d.item),
  remove: (c, id) => request('DELETE', `${col(c)}/${id}`),
  reorder: (c, ids) => request('PUT', `${col(c)}/order`, { ids }).then((d) => d.items),

  messages: ({ status = 'all', page = 1 } = {}) => request('GET', `/admin/messages?status=${status}&page=${page}&limit=20`),
  setMessageRead: (id, read) => request('PATCH', `/admin/messages/${id}`, { read }).then((d) => d.message),
  deleteMessage: (id) => request('DELETE', `/admin/messages/${id}`),
};
