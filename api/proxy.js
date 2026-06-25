export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: { message: 'Method not allowed' } }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  try {
    const body = await req.json();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    // Read the raw text first, since Anthropic (or an intermediary)
    // can sometimes return HTML or plain text on errors instead of JSON.
    const rawText = await response.text();

    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      // Not valid JSON — wrap it so the frontend always gets parseable JSON back.
      data = {
        error: {
          message: rawText && rawText.trim()
            ? `Upstream error (status ${response.status}): ${rawText.slice(0, 300)}`
            : `Upstream error (status ${response.status}) with no response body.`,
        },
      };
    }

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: { message: err.message || 'Unknown proxy error' } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
