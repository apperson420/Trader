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

function ownerCode() {
  return String(process.env.TRADER_OWNER_ACCESS_CODE || '').trim();
}

function ownerVerified(req) {
  const required = Boolean(ownerCode());
  const provided = String(req.headers['x-trader-owner-code'] || '').trim();
  return { required, verified: !required || provided === ownerCode() };
}

function ownerBlock(req) {
  const owner = ownerVerified(req);
  if (owner.required && !owner.verified) {
    return { ok: false, configured: false, paperOnly: true, ownerAccessRequired: true, ownerAccessVerified: false, message: 'Owner access code required before paper broker setup/status/order endpoints can be used.' };
  }
  return null;
}

function cfg() {
  return {
    key: process.env.ALPACA_PAPER_KEY_ID || process.env.ALPACA_KEY_ID || '',
    secret: process.env.ALPACA_PAPER_SECRET_KEY || process.env.ALPACA_SECRET_KEY || '',
    base: process.env.ALPACA_PAPER_BASE_URL || 'https://paper-api.alpaca.markets'
  };
}

function isPaperBase(base) {
  try {
    const host = new URL(base).hostname.toLowerCase();
    return host === 'paper-api.alpaca.markets';
  } catch {
    return false;
  }
}

function setupStatus(req) {
  const c = cfg();
  const owner = ownerVerified(req);
  const hasKey = Boolean(c.key);
  const hasSecret = Boolean(c.secret);
  const paperBase = isPaperBase(c.base);
  return {
    configured: owner.verified && hasKey && hasSecret && paperBase,
    ok: owner.verified && hasKey && hasSecret && paperBase,
    paperOnly: true,
    ownerAccessRequired: owner.required,
    ownerAccessVerified: owner.verified,
    checks: {
      OWNER_ACCESS: owner.verified,
      ALPACA_PAPER_KEY_ID: hasKey,
      ALPACA_PAPER_SECRET_KEY: hasSecret,
      ALPACA_PAPER_BASE_URL: paperBase
    },
    baseHost: (() => { try { return new URL(c.base).hostname; } catch { return 'invalid-url'; } })(),
    message: !owner.verified
      ? 'Owner access code required before paper broker checks can use server-side broker configuration.'
      : hasKey && hasSecret && paperBase
        ? 'Alpaca paper environment variables are present and the base URL is paper-only.'
        : 'Add ALPACA_PAPER_KEY_ID and ALPACA_PAPER_SECRET_KEY in Vercel. Keep ALPACA_PAPER_BASE_URL set to https://paper-api.alpaca.markets or leave it blank.'
  };
}

function headers(c) {
  return {
    'accept': 'application/json',
    'content-type': 'application/json',
    'APCA-API-KEY-ID': c.key,
    'APCA-API-SECRET-KEY': c.secret
  };
}

function cleanSymbol(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9.\-]/g, '').slice(0, 12);
}

async function alpaca(path, options = {}) {
  const c = cfg();
  if (!isPaperBase(c.base)) {
    return {
      configured: false,
      ok: false,
      paperOnly: true,
      message: 'Safety stop: ALPACA_PAPER_BASE_URL must be https://paper-api.alpaca.markets. No real-money broker endpoint was contacted.'
    };
  }
  if (!c.key || !c.secret) {
    return {
      configured: false,
      ok: false,
      paperOnly: true,
      message: 'Add ALPACA_PAPER_KEY_ID and ALPACA_PAPER_SECRET_KEY in Vercel Environment Variables, then redeploy. This endpoint will only use the paper trading base URL.'
    };
  }
  const response = await fetch(`${c.base}${path}`, { ...options, headers: { ...headers(c), ...(options.headers || {}) } });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { configured: true, ok: response.ok, status: response.status, paperOnly: true, data };
}

function validSide(side) { return ['buy', 'sell'].includes(String(side || '').toLowerCase()); }
function validType(type) { return ['market', 'limit'].includes(String(type || '').toLowerCase()); }
function validTimeInForce(tif) { return ['day', 'gtc'].includes(String(tif || '').toLowerCase()); }

export default async function handler(req, res) {
  try {
    const action = String(req.query.action || 'status');
    if (action === 'setup-status') {
      return json(res, 200, { ...setupStatus(req), mode: 'alpaca_paper_setup_status' });
    }
    const blocked = ownerBlock(req);
    if (blocked) return json(res, 200, blocked);
    if (action === 'status') {
      const account = await alpaca('/v2/account');
      const owner = ownerVerified(req);
      return json(res, 200, account.configured ? { ...account, ownerAccessRequired: owner.required, ownerAccessVerified: owner.verified, mode: 'alpaca_paper_status' } : { ...account, ownerAccessRequired: owner.required, ownerAccessVerified: owner.verified });
    }
    if (action === 'orders') {
      const orders = await alpaca('/v2/orders?status=open&limit=20&nested=true');
      return json(res, 200, { ...orders, mode: 'alpaca_paper_open_orders' });
    }
    if (action === 'positions') {
      const positions = await alpaca('/v2/positions');
      return json(res, 200, { ...positions, mode: 'alpaca_paper_positions' });
    }
    if (action === 'submit-order') {
      if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'POST only for paper order submission.' });
      const b = await body(req);
      const confirmation = String(b.confirmation || '').trim();
      if (confirmation !== 'PAPER ONLY') return json(res, 200, { ok: false, paperOnly: true, message: 'Type PAPER ONLY to confirm this is paper trading only.' });
      const symbol = cleanSymbol(b.symbol);
      const qty = Number(b.qty);
      const side = String(b.side || '').toLowerCase();
      const type = String(b.type || 'market').toLowerCase();
      const time_in_force = String(b.time_in_force || 'day').toLowerCase();
      const limit_price = Number(b.limit_price || 0);
      if (!symbol || !Number.isFinite(qty) || qty <= 0 || qty > 1000 || !validSide(side) || !validType(type) || !validTimeInForce(time_in_force)) {
        return json(res, 200, { ok: false, paperOnly: true, message: 'Invalid paper order. Check symbol, quantity, side, type, and time-in-force.' });
      }
      if (type === 'limit' && (!Number.isFinite(limit_price) || limit_price <= 0)) {
        return json(res, 200, { ok: false, paperOnly: true, message: 'Limit orders require a positive limit price.' });
      }
      const order = { symbol, qty: String(qty), side, type, time_in_force };
      if (type === 'limit') order.limit_price = String(limit_price);
      const result = await alpaca('/v2/orders', { method: 'POST', body: JSON.stringify(order) });
      return json(res, 200, { ...result, mode: 'alpaca_paper_submit_order', submittedOrder: order });
    }
    json(res, 404, { ok: false, message: 'Unknown paper broker action.' });
  } catch (error) {
    json(res, 200, { ok: false, paperOnly: true, mode: 'safe_failure_no_trade', message: error.message || 'Paper broker call failed safely.' });
  }
}
