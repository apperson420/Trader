const CRYPTO_MAP = {
  BTC: 'BTC-USD',
  ETH: 'ETH-USD',
  SOL: 'SOL-USD',
  DOGE: 'DOGE-USD',
  ADA: 'ADA-USD',
  XRP: 'XRP-USD',
  LTC: 'LTC-USD'
};

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 's-maxage=20, stale-while-revalidate=60');
  res.end(JSON.stringify(body));
}

function cleanSymbol(value) {
  return String(value || 'BTC').toUpperCase().replace(/[^A-Z0-9.-]/g, '').slice(0, 12) || 'BTC';
}

async function coinbaseQuote(symbol) {
  const product = CRYPTO_MAP[symbol] || (symbol.includes('-') ? symbol : `${symbol}-USD`);
  const url = `https://api.exchange.coinbase.com/products/${encodeURIComponent(product)}/ticker`;
  const response = await fetch(url, { headers: { 'accept': 'application/json', 'user-agent': 'TraderCommandCenter/1.0' } });
  if (!response.ok) throw new Error(`Coinbase quote failed: ${response.status}`);
  const data = await response.json();
  const price = Number(data.price);
  if (!Number.isFinite(price)) throw new Error('Coinbase quote did not include a numeric price.');
  return {
    ok: true,
    assetClass: 'crypto',
    symbol,
    product,
    price,
    bid: Number(data.bid || price),
    ask: Number(data.ask || price),
    volume: Number(data.volume || 0),
    time: data.time || new Date().toISOString(),
    source: 'Coinbase Exchange public ticker',
    mode: 'read_only_market_data'
  };
}

async function alphaVantageQuote(symbol) {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      needsConfiguration: true,
      assetClass: 'equity',
      symbol,
      message: 'Stock and ETF quotes require ALPHA_VANTAGE_API_KEY in Vercel Environment Variables. Crypto can use the no-key public Coinbase read-only source.',
      mode: 'configuration_required'
    };
  }
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, { headers: { 'accept': 'application/json' } });
  if (!response.ok) throw new Error(`Alpha Vantage quote failed: ${response.status}`);
  const data = await response.json();
  const quote = data['Global Quote'] || {};
  const price = Number(quote['05. price']);
  if (!Number.isFinite(price)) {
    return { ok: false, assetClass: 'equity', symbol, message: 'No usable quote returned. Check the symbol or API key.', mode: 'read_only_market_data' };
  }
  return {
    ok: true,
    assetClass: 'equity',
    symbol,
    price,
    changePercent: quote['10. change percent'] || '',
    volume: Number(quote['06. volume'] || 0),
    time: quote['07. latest trading day'] || new Date().toISOString(),
    source: 'Alpha Vantage GLOBAL_QUOTE',
    mode: 'read_only_market_data'
  };
}

export default async function handler(req, res) {
  try {
    const symbol = cleanSymbol(req.query.symbol);
    const isLikelyCrypto = Boolean(CRYPTO_MAP[symbol]) || ['BTC-USD','ETH-USD','SOL-USD'].includes(symbol);
    const result = isLikelyCrypto ? await coinbaseQuote(symbol) : await alphaVantageQuote(symbol);
    json(res, 200, result);
  } catch (error) {
    json(res, 200, {
      ok: false,
      message: error.message || 'Market data lookup failed.',
      mode: 'safe_failure_no_trade',
      source: 'read_only_market_data_api'
    });
  }
}
