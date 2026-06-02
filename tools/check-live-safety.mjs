import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const artifactDir = resolve(root, 'artifacts', 'qa');
mkdirSync(artifactDir, { recursive: true });

const report = {
  name: 'live-trading-safety-regression',
  generatedAt: new Date().toISOString(),
  checks: []
};

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function record(ok, message) {
  report.checks.push({ ok, message });
  if (ok) console.log(`OK ${message}`);
  else {
    console.error(`LIVE SAFETY CHECK FAILED: ${message}`);
    process.exitCode = 1;
  }
}

function contains(text, token, message) {
  record(text.includes(token), message);
}

function notContains(text, token, message) {
  record(!text.includes(token), message);
}

const required = [
  'api/alpaca-live.js',
  'live-trading-control.js',
  'mode-control-center.js',
  'persistence-engine.js',
  'tools/browser-ui-smoke.mjs',
  'docs/LIVE_TRADING_SAFETY.md'
];

for (const file of required) record(existsSync(resolve(root, file)), `required file exists: ${file}`);

const liveApi = read('api/alpaca-live.js');
const liveUi = read('live-trading-control.js');
const mode = read('mode-control-center.js');
const persistence = read('persistence-engine.js');
const manifest = read('tools/release-manifest.mjs');
const docs = read('docs/LIVE_TRADING_SAFETY.md');

contains(liveApi, "TRADER_ENABLE_LIVE_TRADING === 'I_UNDERSTAND_LIVE_TRADING_RISK'", 'backend requires exact live unlock env var');
contains(liveApi, "TRADER_LIVE_KILL_SWITCH === 'LOCK_LIVE_TRADING'", 'backend has emergency live kill switch');
contains(liveApi, "TRADER_LIVE_ALLOWED_SYMBOLS", 'backend supports optional live symbol allowlist');
contains(liveApi, "host === 'api.alpaca.markets'", 'backend only allows Alpaca live host');
contains(liveApi, "manualSubmission !== true", 'backend rejects non-manual submissions');
contains(liveApi, "manual_live_order_ticket_v1", 'backend requires manual live ticket client context');
contains(liveApi, "confirmation !== 'LIVE ORDER - I ACCEPT REAL MONEY RISK'", 'backend requires exact live confirmation phrase');
contains(liveApi, "humanReviewed !== true", 'backend requires human review');
contains(liveApi, "type !== 'limit'", 'backend rejects non-limit orders');
contains(liveApi, "!validTimeInForce", 'backend rejects non-day time in force');
contains(liveApi, "estimatedNotional > c.maxNotional", 'backend enforces max-notional cap');
contains(liveApi, "symbolAllowed(symbol", 'backend enforces symbol allowlist when configured');

contains(liveUi, 'Manual Live Order Ticket', 'UI contains manual live order ticket');
contains(liveUi, 'Emergency kill switch', 'UI explains emergency kill switch');
contains(liveUi, 'Optional symbol allowlist', 'UI explains optional symbol allowlist');
contains(liveUi, 'AI/autopilot cannot submit live trades', 'UI states AI/autopilot cannot submit live trades');
contains(liveUi, 'Guided Workflow, AI Coach, Safe Autopilot, Strategy Evolution, Validation Forge, and AI Brain are not connected to live order submission', 'UI disconnects AI modules from live submission');
contains(liveUi, 'liveTicketSubmit', 'UI has live ticket submit control');
contains(liveUi, 'disabled>Submit manual live limit-day ticket', 'live ticket starts disabled in static markup');
contains(liveUi, 'setAcknowledged(false)', 'UI can relock live mode locally');
contains(liveUi, 'lockLiveMode', 'UI relocks after attempts');
contains(liveUi, 'TRADER_LIVE_KILL_SWITCH=LOCK_LIVE_TRADING', 'UI exports/documents kill switch');
contains(liveUi, 'TRADER_LIVE_ALLOWED_SYMBOLS', 'UI exports/documents symbol allowlist');
notContains(liveUi, 'ALPACA_LIVE_KEY_ID', 'browser UI does not reveal live key env var name');
notContains(liveUi, 'ALPACA_LIVE_SECRET_KEY', 'browser UI does not reveal live secret env var name');
notContains(liveUi, 'APCA-API-SECRET-KEY', 'browser UI does not contain Alpaca secret header');

contains(mode, 'live-readiness', 'mode control separates live-readiness from paper mode');
contains(mode, 'AI/autopilot still cannot place live trades', 'mode control blocks autonomous live trading language');
contains(persistence, "['live_broker_logs'", 'persistence backs up live broker logs');
contains(persistence, "['live_trading_acknowledged'", 'persistence backs up live acknowledgement state');
contains(persistence, "['trading_mode_control'", 'persistence backs up trading mode state');

contains(manifest, 'no autonomous live trading', 'manifest states no autonomous live trading');
contains(manifest, 'Server-side live trading kill switch', 'manifest documents kill switch');
contains(manifest, 'Optional live symbol allowlist', 'manifest documents symbol allowlist');

contains(docs, 'TRADER_LIVE_KILL_SWITCH=LOCK_LIVE_TRADING', 'docs include kill switch setup');
contains(docs, 'TRADER_LIVE_ALLOWED_SYMBOLS', 'docs include symbol allowlist setup');
contains(docs, 'does not allow autonomous live trading', 'docs preserve no-autonomous-live-trading rule');

writeFileSync(resolve(artifactDir, 'live-trading-safety.json'), JSON.stringify(report, null, 2));
if (process.exitCode) process.exit(process.exitCode);
console.log('Live trading safety regression checks passed.');
