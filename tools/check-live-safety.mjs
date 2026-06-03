import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

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

function readIfExists(path) {
  const resolved = resolve(root, path);
  return existsSync(resolved) ? readFileSync(resolved, 'utf8') : '';
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
  'app.js',
  'api/alpaca-live.js',
  'live-trading-control.js',
  'mode-control-center.js',
  'persistence-engine.js',
  'owner-access-center.js',
  'ai-review-coach.js',
  'ai-live-assist.js',
  'decision-approval-center.js',
  'intelligence-memory-center.js',
  'no-loss-data-vault.js',
  'support-repair-center.js',
  'setup-status-center.js',
  'release-readiness-center.js',
  'tools/browser-ui-smoke.mjs',
  'tools/release-manifest.mjs',
  'docs/AUTONOMY_POLICY.md',
  'docs/AI_LIVE_ASSIST.md',
  'docs/LIVE_TRADING_SAFETY.md'
];

for (const file of required) record(existsSync(resolve(root, file)), `required file exists: ${file}`);

const liveApi = read('api/alpaca-live.js');
const liveUi = read('live-trading-control.js');
const mode = read('mode-control-center.js');
const persistence = read('persistence-engine.js');
const manifest = read('tools/release-manifest.mjs');
const docs = read('docs/LIVE_TRADING_SAFETY.md');
const app = read('app.js');
const aiLiveAssistExists = existsSync(resolve(root, 'ai-live-assist.js'));
const aiLiveAssist = readIfExists('ai-live-assist.js');

const expectedLoadedModules = [
  'live-trading-control.js',
  'mode-control-center.js',
  'owner-access-center.js',
  'ai-review-coach.js',
  'ai-live-assist.js',
  'decision-approval-center.js',
  'intelligence-memory-center.js',
  'no-loss-data-vault.js',
  'support-repair-center.js',
  'setup-status-center.js',
  'release-readiness-center.js'
];
for (const module of expectedLoadedModules) contains(app, `'${module}'`, `app loader includes ${module}`);
contains(app, "'ai-live-assist.js'", 'app loader includes ai-live-assist.js');

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
contains(liveUi, 'LIVE ORDER - I ACCEPT REAL MONEY RISK', 'live UI still requires exact confirmation phrase');
contains(liveUi, 'humanReviewed', 'live UI still sends human review state');
contains(liveUi, 'liveTicketHumanReviewed', 'live UI still requires human review control');
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
contains(persistence, "['ai_review_coach_notes'", 'persistence backs up AI review coach notes');
contains(persistence, "['ai_live_assist_drafts'", 'persistence backs up AI live assist drafts');
contains(persistence, "['decision_approval_log'", 'persistence backs up decision approval log');
contains(persistence, "['support_reports'", 'persistence backs up support reports');
contains(persistence, "['vault_reports'", 'persistence backs up vault reports');
contains(persistence, "['release_readiness'", 'persistence backs up release readiness state');
contains(persistence, "['guided_workflow'", 'persistence backs up guided workflow state');

contains(manifest, 'no autonomous live trading', 'manifest states no autonomous live trading');
contains(manifest, 'Server-side live trading kill switch', 'manifest documents kill switch');
contains(manifest, 'Optional live symbol allowlist', 'manifest documents symbol allowlist');
contains(manifest, 'AI Review Coach', 'manifest documents AI Review Coach');
contains(manifest, 'AI Live Assist draft-only mode', 'manifest documents AI Live Assist draft-only mode');
contains(manifest, 'Decision Approval Center', 'manifest documents Decision Approval Center');
contains(manifest, 'Owner Access Center', 'manifest documents Owner Access Center');
contains(manifest, 'Human-approved live ticket boundary', 'manifest documents human-approved live ticket boundary');

contains(docs, 'TRADER_LIVE_KILL_SWITCH=LOCK_LIVE_TRADING', 'docs include kill switch setup');
contains(docs, 'TRADER_LIVE_ALLOWED_SYMBOLS', 'docs include symbol allowlist setup');
contains(docs, 'does not allow autonomous live trading', 'docs preserve no-autonomous-live-trading rule');

if (aiLiveAssistExists) {
  contains(aiLiveAssist.toLowerCase(), 'draft only', 'ai-live-assist is draft-only by wording');
  contains(aiLiveAssist, 'AI Live Assist', 'ai-live-assist panel is named AI Live Assist');
  notContains(aiLiveAssist, '/api/alpaca-live?action=submit-order', 'AI live assist does not call live submit endpoint');
  notContains(aiLiveAssist, "action=submit-order", 'AI live assist does not build submit-order action strings');
  notContains(aiLiveAssist, 'humanReviewed: true', 'AI live assist does not set humanReviewed true');
  notContains(aiLiveAssist, '"humanReviewed":true', 'AI live assist does not serialize humanReviewed true');
  notContains(aiLiveAssist, 'liveTicketHumanReviewed', 'AI live assist does not touch the human-review checkbox');
  notContains(aiLiveAssist, 'liveTicketRiskAck', 'AI live assist does not touch the risk acknowledgement checkbox');
  notContains(aiLiveAssist, 'liveTicketSubmit', 'AI live assist does not touch the live submit button');
  notContains(aiLiveAssist, 'LIVE ORDER - I ACCEPT REAL MONEY RISK', 'AI live assist does not type exact live confirmation phrase');
  notContains(aiLiveAssist, 'alpaca-live', 'AI live assist does not call live broker endpoints');
  notContains(aiLiveAssist.toLowerCase(), 'autonomous live trading', 'AI live assist avoids autonomous live trading language');
  notContains(aiLiveAssist.toLowerCase(), 'buy now', 'AI live assist does not contain buy-now advice');
  notContains(aiLiveAssist.toLowerCase(), 'sell now', 'AI live assist does not contain sell-now advice');
  notContains(aiLiveAssist.toLowerCase(), 'guaranteed', 'AI live assist does not contain profit guarantee language');
} else {
  record(false, 'ai-live-assist.js must exist for AI Live Assist Draft Mode v1');
}

const browserSecretTokens = ['ALPACA_LIVE_SECRET_KEY', 'APCA-API-SECRET-KEY'];
const browserFiles = [];
function collectBrowserFiles(dir) {
  for (const name of readdirSync(dir)) {
    if (['.git', 'node_modules', '.vercel', 'api', 'tools', 'artifacts'].includes(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) collectBrowserFiles(path);
    else if (path.endsWith('.js') || path.endsWith('.html')) browserFiles.push(path);
  }
}
collectBrowserFiles(root);
for (const file of browserFiles) {
  const text = readFileSync(file, 'utf8');
  const relative = file.replace(root, '').replace(/^[/\\]/, '');
  for (const token of browserSecretTokens) {
    notContains(text, token, `browser file does not contain live secret token ${token}: ${relative}`);
  }
}

writeFileSync(resolve(artifactDir, 'live-trading-safety.json'), JSON.stringify(report, null, 2));
if (process.exitCode) process.exit(process.exitCode);
console.log('Live trading safety regression checks passed.');
