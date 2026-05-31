const CRYPTO_MAP = {
  BTC: 'BTC-USD', ETH: 'ETH-USD', SOL: 'SOL-USD', DOGE: 'DOGE-USD', ADA: 'ADA-USD', XRP: 'XRP-USD', LTC: 'LTC-USD'
};

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 's-maxage=300, stale-while-revalidate=900');
  res.end(JSON.stringify(body));
}

function cleanSymbol(value) {
  return String(value || 'BTC').toUpperCase().replace(/[^A-Z0-9.\-]/g, '').slice(0, 14) || 'BTC';
}

function isoDaysAgo(days) {
  const d = new Date(Date.now() - days * 86400000);
  return d.toISOString();
}

async function coinbaseCandles(symbol) {
  const product = CRYPTO_MAP[symbol] || (symbol.includes('-') ? symbol : `${symbol}-USD`);
  const end = new Date().toISOString();
  const start = isoDaysAgo(290);
  const url = `https://api.exchange.coinbase.com/products/${encodeURIComponent(product)}/candles?granularity=86400&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
  const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'TraderCommandCenter/1.0' } });
  if (!response.ok) throw new Error(`Coinbase candles failed: ${response.status}`);
  const data = await response.json();
  const candles = data.map((row) => ({ time: row[0] * 1000, low: row[1], high: row[2], open: row[3], close: row[4], volume: row[5] })).sort((a, b) => a.time - b.time);
  return { ok: true, symbol, product, source: 'Coinbase Exchange daily candles', candles };
}

async function stooqCandles(symbol) {
  const s = symbol.includes('.') ? symbol.toLowerCase() : `${symbol.toLowerCase()}.us`;
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(s)}&i=d`;
  const response = await fetch(url, { headers: { accept: 'text/csv', 'user-agent': 'TraderCommandCenter/1.0' } });
  if (!response.ok) throw new Error(`Stooq candles failed: ${response.status}`);
  const csv = await response.text();
  const lines = csv.trim().split(/\r?\n/).slice(1);
  const candles = lines.map((line) => {
    const [date, open, high, low, close, volume] = line.split(',');
    return { time: new Date(`${date}T00:00:00Z`).getTime(), open: Number(open), high: Number(high), low: Number(low), close: Number(close), volume: Number(volume || 0) };
  }).filter((x) => Number.isFinite(x.close)).slice(-600);
  if (!candles.length) throw new Error('No usable Stooq candles returned.');
  return { ok: true, symbol, product: s, source: 'Stooq daily candles', candles };
}

export default async function handler(req, res) {
  try {
    const symbol = cleanSymbol(req.query.symbol);
    const isCrypto = Boolean(CRYPTO_MAP[symbol]) || symbol.endsWith('-USD');
    const result = isCrypto ? await coinbaseCandles(symbol) : await stooqCandles(symbol);
    json(res, 200, { ...result, count: result.candles.length, mode: 'read_only_historical_data' });
  } catch (error) {
    json(res, 200, { ok: false, message: error.message || 'Historical lookup failed safely.', candles: [], mode: 'safe_failure_no_trade' });
  }
}
