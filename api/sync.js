export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return new Response(JSON.stringify({ error: 'Supabase not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS }
    });
  }

  const sb = (path, method = 'GET', body = null) =>
    fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': method === 'POST' ? 'resolution=merge-duplicates' : '',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

  try {
    const { action, userKey, data } = await req.json();

    // LOAD — pull all evals for this user key
    if (action === 'load') {
      if (!userKey) return new Response(JSON.stringify({ error: 'No key' }), { status: 400, headers: CORS });
      const res = await sb(`job_ops_evals?user_key=eq.${encodeURIComponent(userKey)}&order=created_at.asc`);
      const rows = await res.json();
      const evals = rows.map(r => r.eval_data);
      return new Response(JSON.stringify({ evals }), {
        status: 200, headers: { 'Content-Type': 'application/json', ...CORS }
      });
    }

    // SAVE — upsert full history for this user key
    if (action === 'save') {
      if (!userKey || !data) return new Response(JSON.stringify({ error: 'Missing params' }), { status: 400, headers: CORS });

      // Delete existing rows for this key then re-insert (simplest sync strategy)
      await sb(`job_ops_evals?user_key=eq.${encodeURIComponent(userKey)}`, 'DELETE');

      if (data.length > 0) {
        const rows = data.map((item, i) => ({
          user_key: userKey,
          eval_id: item.ts ? String(item.ts) : String(Date.now() + i),
          eval_data: item,
          created_at: item.ts ? new Date(item.ts).toISOString() : new Date().toISOString(),
        }));
        await sb('job_ops_evals', 'POST', rows);
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { 'Content-Type': 'application/json', ...CORS }
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: CORS });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS }
    });
  }
}
