import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const base = process.env.TRADER_LIVE_URL || 'https://trader-blush.vercel.app';
const artifactDir = resolve(process.cwd(), 'artifacts', 'qa');
mkdirSync(artifactDir, { recursive: true });

const checks = [
  { name: 'main page', path: '/', expect: (response) => response.ok },
  { name: 'app.js', path: '/app.js', expect: (response, text) => response.ok && text.includes('autonomous-engine.js') },
  { name: 'persistence-engine.js', path: '/persistence-engine.js', expect: (response, text) => response.ok && text.includes('TraderPersistence') },
  { name: 'chart-engine.js', path: '/chart-engine.js', expect: (response, text) => response.ok && text.includes('Professional Chart Engine') },
  { name: 'century-evolution.js', path: '/century-evolution.js', expect: (response, text) => response.ok && text.includes('100-generation') },
  { name: 'strategy-validation.js', path: '/strategy-validation.js', expect: (response, text) => response.ok && text.includes('Walk-Forward Validation Forge') },
  { name: 'market BTC API', path: '/api/market?symbol=BTC', expect: (response, text) => response.ok && text.includes('"mode":"read_only_market_data"') },
  { name: 'history BTC API', path: '/api/history?symbol=BTC', expect: (response, text) => response.ok && text.includes('"candles"') },
  { name: 'AI chat GET gate', path: '/api/ai-chat', expect: (response) => response.status === 405 },
  { name: 'Alpaca paper setup status', path: '/api/alpaca-paper?action=setup-status', expect: (response, text) => response.ok && text.includes('"paperOnly":true') }
];

let failed = false;
const results = [];

for (const check of checks) {
  const url = `${base}${check.path}`;
  const response = await fetch(url, { method: 'GET' });
  const text = await response.text();
  const ok = check.expect(response, text);
  const row = {
    name: check.name,
    path: check.path,
    url,
    status: response.status,
    ok,
    snippet: text.slice(0, 160).replace(/\s+/g, ' ')
  };
  results.push(row);
  if (!ok) {
    failed = true;
    console.error(`Smoke check failed ${response.status}: ${check.name} ${url}`);
  } else {
    console.log(`OK ${response.status}: ${check.name} ${url} ${row.snippet}`);
  }
}
writeFileSync(resolve(artifactDir, 'live-smoke.json'), JSON.stringify({ base, generatedAt: new Date().toISOString(), results }, null, 2));
if (failed) process.exit(1);
