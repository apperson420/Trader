import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const fileUrl = `file:///${resolve(root, 'index.html').replace(/\\/g, '/')}`;

const requiredHtml = [
  ['persistence loader', './persistence-engine.js'],
  ['main app loader', './app.js'],
  ['paper/research safety copy', 'no real orders placed'],
  ['watchlist form', 'id="watchForm"'],
  ['journal form', 'id="journalForm"']
];

const requiredFiles = [
  'paper-broker.js',
  'persistence-engine.js',
  'api/alpaca-paper.js',
  'api/persistence.js'
];

function fail(message) {
  console.error(`UI smoke failed: ${message}`);
  process.exitCode = 1;
}

async function tryPlaywrightSmoke() {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    return false;
  }
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/api/alpaca-paper')) {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: false, configured: false, paperOnly: true, checks: { ALPACA_PAPER_KEY_ID: false, ALPACA_PAPER_SECRET_KEY: false, ALPACA_PAPER_BASE_URL: true }, message: 'Playwright smoke: paper setup missing safely.' }) });
      return;
    }
    if (url.includes('/api/persistence')) {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, configured: false, mode: 'localStorage_fallback' }) });
      return;
    }
    if (url.includes('/api/market')) {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, symbol: 'BTC', price: 65000, source: 'smoke', mode: 'read_only_market_data', assetClass: 'crypto', time: new Date().toISOString() }) });
      return;
    }
    if (url.includes('/api/history')) {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: false, message: 'Use deterministic fallback candles.' }) });
      return;
    }
    await route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ ok: false }) });
  });
  await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
  await page.fill('#symbolInput', 'ETH');
  await page.click('#watchForm button');
  await page.fill('#journalTitle', 'Smoke note');
  await page.fill('#journalText', 'Paper only smoke note.');
  await page.click('#journalForm button');
  await page.click('#brokerSetupCheck');
  await page.waitForSelector('#paperBroker');
  const result = await page.evaluate(() => ({
    watchCount: document.getElementById('watchCount')?.textContent,
    journalCount: document.getElementById('journalCount')?.textContent,
    brokerWizard: Boolean(document.getElementById('brokerSetupOutput')?.textContent.includes('ALPACA_PAPER_KEY_ID')),
    persistencePanel: Boolean(document.getElementById('persistenceEngine'))
  }));
  await browser.close();
  if (errors.length) fail(`browser console errors: ${errors.join(' | ')}`);
  if (result.watchCount !== '1') fail(`watchlist did not update in browser smoke: ${JSON.stringify(result)}`);
  if (result.journalCount !== '1') fail(`journal did not update in browser smoke: ${JSON.stringify(result)}`);
  if (!result.brokerWizard) fail('broker setup wizard did not render setup status');
  if (!result.persistencePanel) fail('persistence panel did not render');
  if (!process.exitCode) console.log('Playwright browser/UI smoke passed.');
  return true;
}

const usedBrowser = await tryPlaywrightSmoke();
if (usedBrowser) {
  if (process.exitCode) process.exit(process.exitCode);
  process.exit(0);
}

console.log('Playwright is not installed. Running dependency-free UI smoke fallback.');

for (const [label, token] of requiredHtml) {
  if (!html.includes(token)) fail(`missing ${label}`);
  else console.log(`OK UI shell: ${label}`);
}

for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) fail(`missing file ${file}`);
  else console.log(`OK file exists: ${file}`);
}

const broker = readFileSync(resolve(root, 'paper-broker.js'), 'utf8');
const brokerApi = readFileSync(resolve(root, 'api/alpaca-paper.js'), 'utf8');
const persistence = readFileSync(resolve(root, 'persistence-engine.js'), 'utf8');
const autonomy = readFileSync(resolve(root, 'autonomous-engine.js'), 'utf8');
const hub = readFileSync(resolve(root, 'free-tools-hub.js'), 'utf8');

const behaviorChecks = [
  ['Alpaca setup wizard visible', broker.includes('Paper setup wizard')],
  ['Alpaca setup-status API call wired', broker.includes("api('setup-status')")],
  ['Paper-only base URL enforced server-side', brokerApi.includes('isPaperBase') && brokerApi.includes('paper-api.alpaca.markets')],
  ['Full backup export present', persistence.includes('Export full backup JSON')],
  ['Backup import present', persistence.includes('Import backup JSON')],
  ['Supabase fallback message present', persistence.includes('LocalStorage fallback is active')],
  ['Autonomy panel states current limits, not roadmap stages', autonomy.includes('Autonomy safety limits') && !autonomy.includes('Autonomy roadmap')],
  ['Tool hub avoids fake live integration copy', hub.includes('What is live, setup-ready, or external') && !hub.includes('represented in the product plan')]
];

for (const [label, ok] of behaviorChecks) {
  if (!ok) fail(label);
  else console.log(`OK behavior: ${label}`);
}

if (process.exitCode) process.exit(process.exitCode);
console.log('Browser/UI smoke fallback passed. For real browser rendering, run this app with Playwright installed and inspect the page.');
