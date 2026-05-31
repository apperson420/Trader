const base = process.env.TRADER_LIVE_URL || 'https://trader-blush.vercel.app';
const paths = ['/', '/app.js', '/api/market?symbol=BTC', '/api/ai-chat'];
let failed = false;
for (const path of paths) {
  const url = `${base}${path}`;
  const response = await fetch(url, path === '/api/ai-chat' ? { method: 'GET' } : undefined);
  const text = await response.text();
  const ok = path === '/api/ai-chat' ? response.status === 405 : response.ok;
  if (!ok) {
    failed = true;
    console.error(`Smoke check failed ${response.status}: ${url}`);
  } else {
    console.log(`OK ${response.status}: ${url} ${text.slice(0, 80).replace(/\s+/g, ' ')}`);
  }
}
if (failed) process.exit(1);
