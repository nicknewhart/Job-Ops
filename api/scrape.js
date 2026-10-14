export const config = {
  maxDuration: 30,
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Pages most likely to have mission/values content
const ABOUT_PATHS = ['/about', '/about-us', '/mission', '/company', '/our-story', '/values', '/'];

function stripHtml(html) {
  // Remove script, style, nav, footer, header tags and their contents
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();
  // Cap at 4000 chars to keep prompt size reasonable
  return text.slice(0, 4000);
}

async function tryFetch(url, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; research-bot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(id);
    if (!res.ok) return null;
    const html = await res.text();
    return stripHtml(html);
  } catch {
    clearTimeout(id);
    return null;
  }
}

function normalizeOrigin(website) {
  try {
    const u = new URL(website.startsWith('http') ? website : 'https://' + website);
    return u.origin;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const { website, company } = body || {};

  if (!website && !company) {
    res.writeHead(400, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify({ error: 'website or company required' }));
    return;
  }

  const origin = website ? normalizeOrigin(website) : null;

  if (!origin) {
    res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify({ text: null, source: null }));
    return;
  }

  // Try about/mission pages first, then homepage
  let text = null;
  let source = null;

  for (const path of ABOUT_PATHS) {
    const url = origin + path;
    const result = await tryFetch(url);
    if (result && result.length > 200) {
      text = result;
      source = url;
      break;
    }
  }

  res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
  res.end(JSON.stringify({ text, source }));
}
