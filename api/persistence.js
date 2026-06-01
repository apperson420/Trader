function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return {}; }
}

function cfg() {
  return {
    url: String(process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '',
    rowKey: process.env.TRADER_PERSISTENCE_KEY || 'default',
    table: process.env.TRADER_PERSISTENCE_TABLE || 'trader_persistence'
  };
}

function configured(c) {
  return Boolean(c.url && c.key);
}

function supabaseHeaders(c) {
  return {
    apikey: c.key,
    authorization: `Bearer ${c.key}`,
    'content-type': 'application/json',
    accept: 'application/json'
  };
}

async function supabase(c, path, options = {}) {
  const response = await fetch(`${c.url}/rest/v1/${path}`, { ...options, headers: { ...supabaseHeaders(c), ...(options.headers || {}) } });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text || 'null'); } catch { data = { raw: text }; }
  return { ok: response.ok, status: response.status, data };
}

function setupMessage() {
  return 'Supabase persistence is optional. To enable it, create table trader_persistence (id text primary key, payload jsonb not null, updated_at timestamptz default now()), then add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to Vercel Environment Variables. Never paste service keys into browser code.';
}

function cleanPayload(value) {
  const payload = value && typeof value === 'object' ? value : {};
  return {
    schemaVersion: Number(payload.schemaVersion || 1),
    app: 'Trader Command Center',
    savedAt: new Date().toISOString(),
    safety: 'paper only, research only, not investment advice, no real-money order was sent',
    keys: Array.isArray(payload.keys) ? payload.keys.slice(0, 80) : [],
    data: payload.data && typeof payload.data === 'object' ? payload.data : {}
  };
}

export default async function handler(req, res) {
  const action = String(req.query.action || 'status');
  const c = cfg();
  try {
    if (action === 'status') {
      return json(res, 200, {
        ok: true,
        configured: configured(c),
        mode: configured(c) ? 'supabase_ready_server_side' : 'localStorage_fallback',
        table: c.table,
        rowKey: c.rowKey,
        message: configured(c) ? 'Supabase persistence endpoint is configured server-side.' : setupMessage()
      });
    }
    if (!configured(c)) {
      return json(res, 200, { ok: false, configured: false, mode: 'localStorage_fallback', message: setupMessage() });
    }
    if (action === 'load') {
      if (req.method !== 'GET') return json(res, 405, { ok: false, message: 'GET only for persistence load.' });
      const path = `${encodeURIComponent(c.table)}?id=eq.${encodeURIComponent(c.rowKey)}&select=payload,updated_at&limit=1`;
      const result = await supabase(c, path);
      const row = Array.isArray(result.data) ? result.data[0] : null;
      return json(res, 200, { ok: result.ok, configured: true, status: result.status, payload: row?.payload || null, updatedAt: row?.updated_at || null });
    }
    if (action === 'save') {
      if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'POST only for persistence save.' });
      const payload = cleanPayload(await body(req));
      const row = { id: c.rowKey, payload, updated_at: new Date().toISOString() };
      const path = `${encodeURIComponent(c.table)}?on_conflict=id`;
      const result = await supabase(c, path, {
        method: 'POST',
        headers: { prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(row)
      });
      return json(res, 200, { ok: result.ok, configured: true, status: result.status, mode: 'supabase_ready_server_side' });
    }
    return json(res, 404, { ok: false, message: 'Unknown persistence action.' });
  } catch (error) {
    return json(res, 200, {
      ok: false,
      configured: configured(c),
      mode: configured(c) ? 'supabase_safe_failure_local_fallback' : 'localStorage_fallback',
      message: error.message || 'Persistence endpoint failed safely. The browser localStorage fallback can continue working.'
    });
  }
}
