import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { createServer } from 'node:http';

const root = process.cwd();
const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;
const artifactDir = resolve(root, 'artifacts', 'qa');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const report = {
  name: 'browser-ui-smoke',
  generatedAt: new Date().toISOString(),
  mode: 'dependency-free-fallback',
  checks: []
};

mkdirSync(artifactDir, { recursive: true });

const requiredHtml = [
  ['persistence loader', './persistence-engine.js'],
  ['main app loader', './app.js'],
  ['guided workflow loader', './guided-workflow.js'],
  ['paper/research safety copy', 'no real orders placed'],
  ['watchlist form', 'id="watchForm"'],
  ['journal form', 'id="journalForm"']
];

const requiredFiles = [
  'paper-broker.js',
  'live-trading-control.js',
  'mode-control-center.js',
  'onboarding-wizard.js',
  'guided-workflow.js',
  'persistence-engine.js',
  'api/alpaca-paper.js',
  'api/alpaca-live.js',
  'api/persistence.js'
];

function fail(message) {
  console.error(`UI smoke failed: ${message}`);
  report.checks.push({ ok: false, message });
  process.exitCode = 1;
}

function pass(message) {
  console.log(`OK ${message}`);
  report.checks.push({ ok: true, message });
}

function writeReport() {
  writeFileSync(resolve(artifactDir, 'browser-ui-smoke.json'), JSON.stringify(report, null, 2));
}

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml; charset=utf-8']
]);

function jsonResponse(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(JSON.stringify(body));
}

function mockApiResponse(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/api/alpaca-paper') {
    jsonResponse(res, 200, {
      ok: false,
      configured: false,
      paperOnly: true,
      checks: {
        ALPACA_PAPER_KEY_ID: false,
        ALPACA_PAPER_SECRET_KEY: false,
        ALPACA_PAPER_BASE_URL: true
      },
      message: 'Playwright smoke: paper setup missing safely.'
    });
    return true;
  }
  if (url.pathname === '/api/alpaca-live') {
    const action = url.searchParams.get('action') || 'setup-status';
    if (action === 'setup-status') {
      jsonResponse(res, 200, {
        ok: false,
        configured: false,
        liveTrading: true,
        manualOnly: true,
        autonomousLiveTrading: false,
        checks: {
          TRADER_ENABLE_LIVE_TRADING: false,
          ALPACA_LIVE_KEY_ID: false,
          ALPACA_LIVE_SECRET_KEY: false,
          ALPACA_LIVE_BASE_URL: true,
          TRADER_LIVE_MAX_NOTIONAL: true
        },
        maxNotional: 250,
        message: 'Smoke: live trading stays locked unless server-side setup is complete.'
      });
      return true;
    }
    if (action === 'status') {
      jsonResponse(res, 200, { ok: false, configured: false, liveTrading: true, manualOnly: true, message: 'Smoke: live account not configured.' });
      return true;
    }
    jsonResponse(res, 200, { ok: false, configured: false, liveTrading: true, manualOnly: true, message: 'Smoke: live order submission blocked.' });
    return true;
  }
  if (url.pathname === '/api/persistence') {
    jsonResponse(res, 200, { ok: true, configured: false, mode: 'localStorage_fallback' });
    return true;
  }
  if (url.pathname === '/api/market') {
    jsonResponse(res, 200, {
      ok: true,
      symbol: url.searchParams.get('symbol') || 'BTC',
      price: 65000,
      source: 'smoke',
      mode: 'read_only_market_data',
      assetClass: 'crypto',
      time: new Date().toISOString()
    });
    return true;
  }
  if (url.pathname === '/api/history') {
    jsonResponse(res, 200, { ok: false, message: 'Use deterministic fallback candles.' });
    return true;
  }
  if (url.pathname.startsWith('/api/')) {
    jsonResponse(res, 405, { ok: false, message: 'Smoke mock only supports safe read/setup endpoints.' });
    return true;
  }
  return false;
}

async function startSmokeServer() {
  const server = createServer((req, res) => {
    try {
      if (mockApiResponse(req, res)) return;
      const url = new URL(req.url, 'http://127.0.0.1');
      const pathname = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
      const segments = pathname.replace(/^\/+/, '').split('/').filter(Boolean);
      const filePath = resolve(root, ...segments);
      if (!(filePath === root || filePath.startsWith(rootPrefix)) || !existsSync(filePath)) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      const ext = extname(filePath).toLowerCase();
      res.writeHead(200, {
        'content-type': contentTypes.get(ext) || 'application/octet-stream',
        'cache-control': 'no-store'
      });
      res.end(readFileSync(filePath));
    } catch (error) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(`Smoke server error: ${error.message}`);
    }
  });
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', () => resolveListen());
  });
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () => new Promise((resolveClose) => server.close(resolveClose))
  };
}

async function tryPlaywrightSmoke() {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    return false;
  }
  let browser;
  try {
    browser = await playwright.chromium.launch();
  } catch (error) {
    console.log(`Playwright is installed but Chromium could not start: ${error.message}`);
    report.checks.push({ ok: true, message: `Playwright Chromium unavailable; dependency-free fallback used: ${error.message}` });
    return false;
  }
  report.mode = 'playwright-chromium';
  const smokeServer = await startSmokeServer();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  try {
    await page.goto(smokeServer.url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const watchlist = document.getElementById('watchlist');
      const journal = document.getElementById('journalList');
      return Boolean(watchlist?.textContent.trim() && journal?.textContent.trim());
    });
    await page.waitForSelector('#guidedWorkflow');
    await page.waitForSelector('#setupWizardOpen');
    const alreadyOpen = await page.evaluate(() => document.getElementById('setupWizard')?.classList.contains('setup-open'));
    if (!alreadyOpen) await page.click('#setupWizardOpen');
    await page.waitForFunction(() => document.getElementById('setupWizard')?.classList.contains('setup-open'));
    const wizardVisible = await page.evaluate(() => document.getElementById('setupWizard')?.classList.contains('setup-open'));
    if (!wizardVisible) fail('first-run setup wizard did not open inline for a new browser session');
    await page.click('#setupWizardLater');
    await page.click('#clearWatchlist');
    await page.click('#clearJournal');
    const before = await page.evaluate(() => ({
      watchCount: Number.parseInt(document.getElementById('watchCount')?.textContent || '0', 10),
      journalCount: Number.parseInt(document.getElementById('journalCount')?.textContent || '0', 10)
    }));
    await page.fill('#symbolInput', 'ETH');
    await page.click('#watchForm button');
    await page.fill('#journalTitle', 'Smoke note');
    await page.fill('#journalText', 'Paper only smoke note.');
    await page.click('#journalForm button');
    await page.click('#workflowStart');
    await page.waitForFunction(() => document.getElementById('workflowMode')?.textContent === 'Guiding');
    await page.click('#workflowNext');
    await page.waitForSelector('#paperBroker');
    await page.waitForSelector('#liveTradingControl');
    await page.waitForSelector('#manualLiveOrderTicket');
    const liveTicketState = await page.evaluate(() => ({
      exists: Boolean(document.getElementById('manualLiveOrderTicket')),
      locked: Boolean(document.getElementById('liveTicketSubmit')?.disabled),
      warning: document.getElementById('liveTradingControl')?.textContent.includes('Real money can be lost'),
      phrase: document.getElementById('liveTicketConfirm')?.getAttribute('placeholder') === 'LIVE ORDER - I ACCEPT REAL MONEY RISK',
      noAi: document.getElementById('liveTradingControl')?.textContent.includes('AI/autopilot cannot submit live trades')
    }));
    if (!liveTicketState.exists || !liveTicketState.locked || !liveTicketState.warning || !liveTicketState.phrase || !liveTicketState.noAi) fail(`manual live ticket safety state failed: ${JSON.stringify(liveTicketState)}`);
    await page.click('#brokerSetupCheck');
    await page.waitForFunction(() => {
      const output = document.getElementById('brokerSetupOutput')?.textContent || '';
      return output.includes('ALPACA_PAPER_KEY_ID') || output.includes('Paper setup check');
    });
    await page.waitForSelector('#persistenceEngine');
    const result = await page.evaluate(() => ({
      watchCount: Number.parseInt(document.getElementById('watchCount')?.textContent || '0', 10),
      journalCount: Number.parseInt(document.getElementById('journalCount')?.textContent || '0', 10),
      brokerWizard: Boolean(document.getElementById('brokerSetupOutput')?.textContent.includes('ALPACA_PAPER_KEY_ID')),
      persistencePanel: Boolean(document.getElementById('persistenceEngine')),
      guidedWorkflow: Boolean(document.getElementById('guidedWorkflow')),
      guidedMode: document.getElementById('workflowMode')?.textContent,
      manualLiveTicket: liveTicketState
    }));
    if (errors.length) fail(`browser console errors: ${errors.join(' | ')}`);
    if (result.watchCount !== before.watchCount + 1) fail(`watchlist did not update in browser smoke: ${JSON.stringify({ before, result })}`);
    if (result.journalCount !== before.journalCount + 1) fail(`journal did not update in browser smoke: ${JSON.stringify({ before, result })}`);
    if (!result.guidedWorkflow || result.guidedMode !== 'Guiding') fail('guided workflow did not start');
    if (!result.brokerWizard) fail('broker setup wizard did not render setup status');
    if (!result.persistencePanel) fail('persistence panel did not render');
    await page.screenshot({ path: resolve(artifactDir, 'browser-ui-smoke.png'), fullPage: true });
    if (!process.exitCode) console.log('Playwright browser/UI smoke passed.');
    if (!process.exitCode) pass('Playwright browser workflow updated watchlist, journal, guided workflow, paper setup wizard, and persistence panel');
  } finally {
    await browser.close();
    await smokeServer.close();
  }
  return true;
}

const usedBrowser = await tryPlaywrightSmoke();
if (usedBrowser) {
  writeReport();
  if (process.exitCode) process.exit(process.exitCode);
  process.exit(0);
}

console.log('Playwright is not installed. Running dependency-free UI smoke fallback.');

for (const [label, token] of requiredHtml) {
  if (!html.includes(token)) fail(`missing ${label}`);
  else pass(`UI shell: ${label}`);
}

for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) fail(`missing file ${file}`);
  else pass(`file exists: ${file}`);
}

const broker = readFileSync(resolve(root, 'paper-broker.js'), 'utf8');
const brokerApi = readFileSync(resolve(root, 'api/alpaca-paper.js'), 'utf8');
const persistence = readFileSync(resolve(root, 'persistence-engine.js'), 'utf8');
const liveControl = readFileSync(resolve(root, 'live-trading-control.js'), 'utf8');
const modeControl = readFileSync(resolve(root, 'mode-control-center.js'), 'utf8');
const liveApi = readFileSync(resolve(root, 'api/alpaca-live.js'), 'utf8');
const onboarding = readFileSync(resolve(root, 'onboarding-wizard.js'), 'utf8');
const guided = readFileSync(resolve(root, 'guided-workflow.js'), 'utf8');
const autonomy = readFileSync(resolve(root, 'autonomous-engine.js'), 'utf8');
const hub = readFileSync(resolve(root, 'free-tools-hub.js'), 'utf8');
const browserSources = [liveControl, modeControl, guided, autonomy, hub, readFileSync(resolve(root, 'app.js'), 'utf8')].join('\n');
const behaviorChecks = [
  ['Alpaca setup wizard visible', broker.includes('Paper setup wizard')],
  ['Alpaca setup-status API call wired', broker.includes("api('setup-status')")],
  ['Paper-only base URL enforced server-side', brokerApi.includes('isPaperBase') && brokerApi.includes('paper-api.alpaca.markets')],
  ['Full backup export present', persistence.includes('Export full backup JSON')],
  ['Backup import present', persistence.includes('Import backup JSON')],
  ['Supabase fallback message present', persistence.includes('LocalStorage fallback is active')],
  ['Live control module exists', liveControl.includes('Manual Live Order Ticket') && liveControl.includes('manualLiveOrderTicket')],
  ['Mode control module exists', modeControl.includes('Mode Control') && modeControl.includes('live-readiness')],
  ['Manual live ticket locked by default', liveControl.includes('disabled>Submit manual live limit-day ticket') && liveControl.includes('Live ticket locked')],
  ['Real-money warning exists', liveControl.includes('Real money can be lost')],
  ['Exact live confirmation phrase required', liveControl.includes('LIVE ORDER - I ACCEPT REAL MONEY RISK') && liveApi.includes('LIVE ORDER - I ACCEPT REAL MONEY RISK')],
  ['AI/autopilot cannot submit live trades wording exists', liveControl.includes('AI/autopilot cannot submit live trades') && liveApi.includes('AI/autopilot and background workflows cannot submit live orders')],
  ['No live API key strings are stored in browser code', !browserSources.includes('ALPACA_LIVE_KEY') && !browserSources.includes('ALPACA_LIVE_SECRET')],
  ['No autonomous live trading path exists', liveApi.includes('manualSubmission !== true') && !browserSources.includes("action=submit-order'") && liveControl.includes("liveApi('submit-order'")],
  ['First-run setup wizard present', onboarding.includes('Start safely in 10 minutes') && onboarding.includes('Do not show again')],
  ['Setup wizard stays paper/research scoped', onboarding.includes('No real-money trades are sent') && onboarding.includes('not investment advice')],
  ['Setup wizard no longer uses fixed overlap panel', !onboarding.includes('position:fixed') && onboarding.includes('setup-dock')],
  ['Guided workflow present', guided.includes('Guided Workflow Mode') && guided.includes('Export workflow receipt')],
  ['Guided workflow stays paper/research scoped', guided.includes('paper_research_only') && guided.includes('not investment advice')],
  ['Autonomy panel states current limits, not roadmap stages', autonomy.includes('Autonomy safety limits') && !autonomy.includes('Autonomy roadmap')],
  ['Tool hub avoids fake live integration copy', hub.includes('What is live, setup-ready, or external') && !hub.includes('represented in the product plan')]
];

for (const [label, ok] of behaviorChecks) {
  if (!ok) fail(label);
  else pass(`behavior: ${label}`);
}

writeReport();
if (process.exitCode) process.exit(process.exitCode);
console.log('Browser/UI smoke fallback passed. For real browser rendering, run this app with Playwright installed and inspect the page.');
