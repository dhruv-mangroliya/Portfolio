// Reads every video of a YouTube playlist or channel through YouTube's own web API (no API key needed).
// The format is undocumented, so the parser looks for the few fields it needs anywhere in the response.

const ENDPOINT = 'https://www.youtube.com/youtubei/v1';
const CONTEXT = { client: { clientName: 'WEB', clientVersion: '2.20241101.00.00', hl: 'en', gl: 'IN' } };
const MAX_PAGES = 60; // ~100 videos per page → up to ~6000 videos

async function post(path, body) {
  const res = await fetch(`${ENDPOINT}/${path}?prettyPrint=false`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; portfolio-study-tracker)' },
    body: JSON.stringify({ context: CONTEXT, ...body }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`YouTube answered ${res.status}.`);
  return res.json();
}

function walk(node, fn) {
  if (!node || typeof node !== 'object') return;
  fn(node);
  for (const v of Object.values(node)) walk(v, fn);
}

/** Works out what a pasted link points at. Returns { kind: 'playlist', id } or { kind: 'channel', id?, url }. */
export function parseSource(input) {
  const raw = String(input || '').trim();
  if (/^(PL|UU|OL|FL|LL)[\w-]{10,}$/.test(raw)) return { kind: 'playlist', id: raw };
  if (/^UC[\w-]{22}$/.test(raw)) return { kind: 'channel', id: raw };
  if (/^@[\w.-]+$/.test(raw)) return { kind: 'channel', url: `https://www.youtube.com/${raw}` };
  let u;
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$/i.test(u.hostname)) return null;
  const list = u.searchParams.get('list');
  if (list) return { kind: 'playlist', id: list };
  const ch = u.pathname.match(/^\/channel\/(UC[\w-]{22})/);
  if (ch) return { kind: 'channel', id: ch[1] };
  if (/^\/(@[^/]+|c\/[^/]+|user\/[^/]+)/.test(u.pathname)) {
    return { kind: 'channel', url: `https://www.youtube.com${u.pathname.match(/^\/(@[^/]+|c\/[^/]+|user\/[^/]+)/)[0]}` };
  }
  return null;
}

async function channelId(url) {
  const j = await post('navigation/resolve_url', { url });
  const id = j?.endpoint?.browseEndpoint?.browseId;
  if (!/^UC/.test(id || '')) throw new Error('Couldn’t find that channel.');
  return id;
}

/** All videos of a playlist, in playlist order. */
async function playlistVideos(playlistId) {
  let page = await post('browse', { browseId: `VL${playlistId}` });
  if (page?.alerts?.length && !page.contents) throw new Error('That playlist is private or doesn’t exist.');
  let title = '';
  let owner = '';
  walk(page.header ?? page.contents, (o) => {
    const h = o.playlistHeaderRenderer;
    if (h && !title) {
      title = h.title?.simpleText || h.title?.runs?.map((r) => r.text).join('') || '';
      owner = h.ownerText?.runs?.map((r) => r.text).join('') || '';
    }
    const v = o.pageHeaderViewModel;
    if (v && !title) title = v.title?.dynamicTextViewModel?.text?.content || '';
  });
  if (!title) title = page?.metadata?.playlistMetadataRenderer?.title || '';

  const videos = [];
  const seen = new Set();
  for (let n = 0; page && n < MAX_PAGES; n++) {
    let token = null;
    walk({ c: page.contents, r: page.onResponseReceivedActions }, (o) => {
      const l = o.lockupViewModel;
      if (l && l.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO' && l.contentId && !seen.has(l.contentId)) {
        let duration = '';
        walk(l.contentImage, (x) => { if (!duration && x.thumbnailBadgeViewModel?.text) duration = x.thumbnailBadgeViewModel.text; });
        seen.add(l.contentId);
        videos.push({ videoId: l.contentId, title: l.metadata?.lockupMetadataViewModel?.title?.content || '', duration });
      }
      const p = o.playlistVideoRenderer;
      if (p?.videoId && !seen.has(p.videoId)) {
        seen.add(p.videoId);
        videos.push({ videoId: p.videoId, title: p.title?.runs?.map((r) => r.text).join('') || p.title?.simpleText || '', duration: p.lengthText?.simpleText || '' });
      }
      const t =
        o.continuationItemViewModel?.continuationCommand?.innertubeCommand?.continuationCommand?.token ??
        o.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
      if (t && !token) token = t;
    });
    if (!token) break;
    page = await post('browse', { continuation: token });
  }
  if (!videos.length) throw new Error('No videos found there.');
  return { title, owner, videos };
}

/**
 * Fetches a playlist or a channel's uploads. Channel uploads are returned oldest first,
 * so L-1 is the first video the channel ever posted.
 */
export async function fetchSource(source) {
  if (source.kind === 'playlist') {
    const r = await playlistVideos(source.id);
    return { kind: 'playlist', sourceId: source.id, title: r.title, channel: r.owner, videos: r.videos };
  }
  const id = source.id ?? (await channelId(source.url));
  const r = await playlistVideos(`UU${id.slice(2)}`);
  const name = r.title.replace(/^Uploads from\s+/i, '');
  return { kind: 'channel', sourceId: `UU${id.slice(2)}`, title: name, channel: name, videos: r.videos.reverse() };
}

/** Re-reads a saved track's source. */
export async function refetch(track) {
  const r = await playlistVideos(track.sourceId);
  return track.kind === 'channel' ? r.videos.reverse() : r.videos;
}

/** The video id in a YouTube watch / short / youtu.be link, or ''. */
export function videoIdFrom(url) {
  try {
    const u = new URL(url);
    if (/(^|\.)youtu\.be$/i.test(u.hostname)) return u.pathname.slice(1, 12);
    if (!/(^|\.)youtube\.com$/i.test(u.hostname)) return '';
    const v = u.searchParams.get('v');
    if (v) return v.slice(0, 11);
    return u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/)?.[1] ?? '';
  } catch {
    return '';
  }
}

/** A video's title through YouTube's public oEmbed endpoint ('' if it can't be read). */
export async function videoTitle(videoId) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`, {
      signal: AbortSignal.timeout(8_000),
    });
    return res.ok ? String((await res.json()).title || '') : '';
  } catch {
    return '';
  }
}
