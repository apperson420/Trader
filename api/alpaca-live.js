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

function listEnv(name) {
  return String(process.env[name] || '')
    .split(',')
    .map((item) => item.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, ''))
    .filter(Boolean)
    .slice(0, 200);
}

function cfg() {
  return {
    enabled: process.env.TRADER_ENABLE_LIVE_TRADING === 'I_UNDERSTAND_LIVE_TRADING_RISK',
    killSwitch: process.env.TRADER_LIVE_KILL_SWITCH === 'LOCK_LIVE_TRADING',
    key: process.env.ALPACA_LIVE_KEY_ID || '',
    secret: process.env.ALPACA_LIVE_SECRET_KEY || '',
    base: process.env.ALPACA_LIVE_BASE_URL || 'https://api.alpaca.markets',
    maxNotional: Number(process.env.TRADER_LIVE_MAX_NOTIONAL || 0),
    allowedSymbols: listEnv('TRADER_LIVE_ALLOWED_SYMBOLS')
  };
}

function isLiveBase(base) {
  try {
    const host = new URL(base).hostname.toLowerCase();
    return host === 'api.alpaca.markets';
  } catch {
    return false;
  }
}

function baseHost(base) {
  try { return new URL(base).hostname; } catch { return 'invalid-url'; }
}

function symbolAllowed(symbol, c = cfg()) {
  return !c.allowedSymbols.length || c.allowedSymbols.includes(symbol);
}

function setupStatus() {
  const c = cfg();
  const hasKey = Boolean(c.key);
  const hasSecret = Boolean(c.secret);
  const liveBase = isLiveBase(c.base);
  const hasLimit = Number.isFinite(c.maxNotional) && c.maxNotional > 0;
  const configured = c.enabled && !c.killSwitch && hasKey && hasSecret && liveBase && hasLimit;
  return {
    ok: configured,
    configured,
    liveTrading: true,
    autonomousLiveTrading: false,
    manualOnly: true,
    orderTypesAllowed: ['limit'],
    timeInForceAllowed: ['day'],
    checks: {
      TRADER_ENABLE_LIVE_TRADING: c.enabled,
      TRADER_LIVE_KILL_SWITCH: !c.killSwitch,
      ALPACA_LIVE_KEY_ID: hasKey,
      ALPACA_LIVE_SECRET_KEY: hasSecret,
      ALPACA_LIVE_BASE_URL: liveBase,
      TRADER_LIVE_MAX_NOTIONAL: hasLimit,
      TRADER_LIVE_ALLOWED_SYMBOLS: c.allowedSymbols.length ? true : 'not_set_all_symbols_allowed'
    },
    baseHost: baseHost(c.base),
    maxNotional: hasLimit ? c.maxNotional : 0,
    allowedSymbolsConfigured: c.allowedSymbols.length > 0,
    allowedSymbols: c.allowedSymbols,
    killSwitchLocked: c.killSwitch,
    message: configured
      ? 'Live trading is unlocked for manual limit-day tickets only. AI/autopilot cannot place live orders.'
      : c.killSwitch
        ? 'Live trading is locked by TRADER_LIVE_KILL_SWITCH. Remove or change it only when you intentionally want live readiness unlocked.'
        : 'Live trading is locked. To unlock, set server-side Vercel variables, keep the kill switch off, and use a small TRADER_LIVE_MAX_NOTIONAL. Do not put live keys in browser code.'
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

function validSide(side) { return ['buy', 'sell'].includes(String(side || '').toLowerCase()); }
function validTimeInForce(tif) { return ['day'].includes(String(tif || '').toLowerCase()); }

function disabled(message, extra = {}) {
  return { ok: false, configured: false, liveTrading: true, manualOnly: true, autonomousLiveTrading: false, message, ...extra };
}

async function alpaca(path, options = {}) {
  const c = cfg();
  if (c.killSwitch) return disabled('Live trading is locked by TRADER_LIVE_KILL_SWITCH. No broker endpoint was contacted.');
  if (!c.enabled) return disabled('Live trading is locked. Set TRADER_ENABLE_LIVE_TRADING=I_UNDERSTAND_LIVE_TRADING_RISK server-side to unlock.');
  if (!isLiveBase(c.base)) return disabled('Safety stop: ALPACA_LIVE_BASE_URL must be https://api.alpaca.markets. No broker endpoint was contacted.', { baseHost: baseHost(c.base) });
  if (!c.key || !c.secret) return disabled('Add ALPACA_LIVE_KEY_ID and ALPACA_LIVE_SECRET_KEY in Vercel Environment Variables, then redeploy.');
  if (!Number.isFinite(c.maxNotional) || c.maxNotional <= 0) return disabled('Set TRADER_LIVE_MAX_NOTIONAL to a small positive dollar limit before live order submission is allowed.');
  const response = await fetch(`${c.base}${path}`, { ...options, headers: { ...headers(c), ...(options.headers || {}) } });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { configured: true, ok: response.ok, status: response.status, liveTrading: true, manualOnly: true, autonomousLiveTrading: false, data };
}

export default async function handler(req, res) {
  try {
    const action = String(req.query.action || 'setup-status');
    if (action === 'setup-status') return json(res, 200, { ...setupStatus(), mode: 'alpaca_live_setup_status' });
    if (action === 'status') {
      const account = await alpaca('/v2/account');
      return json(res, 200, account.configured ? { ...account, mode: 'alpaca_live_status' } : account);
    }
    if (action === 'orders') {
      const orders = await alpaca('/v2/orders?status=open&limit=20&nested=true');
      return json(res, 200, { ...orders, mode: 'alpaca_live_open_orders' });
    }
    if (action === 'positions') {
      const positions = await alpaca('/v2/positions');
      return json(res, 200, { ...positions, mode: 'alpaca_live_positions' });
    }
    if (action === 'submit-order') {
      if (req.method !== 'POST') return json(res, 405, { ok: false, liveTrading: true, message: 'POST only for live order submission.' });
      const b = await body(req);
      if (b.manualSubmission !== true || String(b.clientContext || '') !== 'manual_live_order_ticket_v1') {
        return json(res, 200, disabled('Manual live order ticket is required. AI/autopilot and background workflows cannot submit live orders.'));
      }
      const confirmation = String(b.confirmation || '').trim();
      if (confirmation !== 'LIVE ORDER - I ACCEPT REAL MONEY RISK') {
        return json(res, 200, disabled('Type LIVE ORDER - I ACCEPT REAL MONEY RISK to confirm manual live trading.'));
      }
      if (b.humanReviewed !== true) return json(res, 200, disabled('Human review checkbox is required. AI/autopilot may not submit live orders.'));
      const symbol = cleanSymbol(b.symbol);
      const qty = Number(b.qty);
      const side = String(b.side || '').toLowerCase();
      const type = String(b.type || 'limit').toLowerCase();
      const time_in_force = String(b.time_in_force || 'day').toLowerCase();
      const limit_price = Number(b.limit_price || 0);
      if (!symbol || !Number.isFinite(qty) || qty <= 0 || qty > 1000 || !validSide(side) || type !== 'limit' || !validTimeInForce(time_in_force) || !Number.isFinite(limit_price) || limit_price <= 0) {
        return json(res, 200, disabled('Invalid live order. Only manual limit-day buy/sell tickets with positive quantity and limit price are allowed.'));
      }
      const c = cfg();
      if (c.killSwitch) return json(res, 200, disabled('Live order blocked by TRADER_LIVE_KILL_SWITCH.'));
      if (!symbolAllowed(symbol, c)) return json(res, 200, disabled('Live order blocked by TRADER_LIVE_ALLOWED_SYMBOLS allowlist.', { symbol, allowedSymbolsConfigured: true }));
      const estimatedNotional = qty * limit_price;
      if (!Number.isFinite(c.maxNotional) || c.maxNotional <= 0 || estimatedNotional > c.maxNotional) {
        return json(res, 200, disabled(`Live order blocked by notional cap. Estimated ${estimatedNotional.toFixed(2)} exceeds TRADER_LIVE_MAX_NOTIONAL ${Number(c.maxNotional || 0).toFixed(2)}.`));
      }
      const order = { symbol, qty: String(qty), side, type: 'limit', time_in_force: 'day', limit_price: String(limit_price) };
      const result = await alpaca('/v2/orders', { method: 'POST', body: JSON.stringify(order) });
      return json(res, 200, { ...result, mode: 'alpaca_live_submit_order', submittedOrder: order, estimatedNotional, warning: 'This was a manual live trading request. Review broker confirmation directly in Alpaca.' });
    }
    json(res, 404, { ok: false, liveTrading: true, message: 'Unknown live broker action.' });
  } catch (error) {
    json(res, 200, { ok: false, liveTrading: true, manualOnly: true, autonomousLiveTrading: false, mode: 'safe_failure_no_live_trade', message: error.message || 'Live broker call failed safely.' });
  }
}
