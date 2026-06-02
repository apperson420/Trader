function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

function ownerCode() {
  return String(process.env.TRADER_OWNER_ACCESS_CODE || '').trim();
}

function providedCode(req) {
  return String(req.headers['x-trader-owner-code'] || '').trim();
}

export default async function handler(req, res) {
  const required = Boolean(ownerCode());
  const verified = !required || providedCode(req) === ownerCode();
  return json(res, 200, {
    ok: verified,
    required,
    verified,
    mode: required ? 'owner_access_code_required' : 'owner_access_not_configured',
    message: required
      ? (verified ? 'Owner access verified for this browser session.' : 'Owner access code is required before private setup, backup sync, or broker endpoints can be used.')
      : 'Owner access code is not configured on the server. Add TRADER_OWNER_ACCESS_CODE in Vercel for private-use protection.'
  });
}
