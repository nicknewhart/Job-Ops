export const config = {
  maxDuration: 60,
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify({ error: { message: 'Method not allowed' } }));
    return;
  }

  // Parse body (Node functions on Vercel auto-parse JSON bodies into req.body)
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55000);

  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (fetchErr) {
    clearTimeout(timeoutId);
    const isAbort = fetchErr.name === 'AbortError';
    res.writeHead(504, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify({
      error: {
        message: isAbort
          ? 'Request to Claude timed out after 55 seconds. Try again, or shorten the job description.'
          : 'Network error reaching Claude API: ' + fetchErr.message,
      },
    }));
    return;
  }
  clearTimeout(timeoutId);

  const rawText = await response.text();

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    data = {
      error: {
        message: rawText && rawText.trim()
          ? `Upstream error (status ${response.status}): ${rawText.slice(0, 300)}`
          : `Upstream error (status ${response.status}) with no response body.`,
      },
    };
  }

  res.writeHead(response.status, { 'Content-Type': 'application/json', ...CORS });
  res.end(JSON.stringify(data));
}
