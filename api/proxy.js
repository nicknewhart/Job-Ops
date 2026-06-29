export const config = {
  runtime: 'edge',
  maxDuration: 60,
};

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

    // Give Anthropic up to 55s to respond before we give up ourselves,
    // so we always return valid JSON instead of letting Vercel kill the function cold.
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
      return new Response(JSON.stringify({
        error: {
          message: isAbort
            ? 'Request to Claude timed out after 55 seconds. Try again, or shorten the job description.'
            : 'Network error reaching Claude API: ' + fetchErr.message,
        },
      }), {
        status: 504,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
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
