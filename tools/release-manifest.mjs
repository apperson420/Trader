import { writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const skip = new Set(['.git', 'node_modules', '.vercel']);
const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    else files.push({ path: path.replace(process.cwd() + '/', ''), bytes: stat.size });
  }
}
walk(process.cwd());
const hasAiLiveAssist = existsSync(join(process.cwd(), 'ai-live-assist.js'));
const manifest = {
  app: 'Trader Command Center',
  generatedAt: new Date().toISOString(),
  safety: 'Paper/research mode by default. Optional manual live trading is disabled unless server-side env vars are configured; no autonomous live trading. Live mode also supports a server kill switch and optional symbol allowlist.',
  capabilities: [
    'AI Coach Chat',
    'AI Review Coach',
    ...(hasAiLiveAssist ? ['AI Live Assist draft-only mode'] : []),
    'Decision Approval Center',
    'Intelligence Memory Center',
    'No-Loss Data Vault',
    'Support/Repair Center',
    'Owner Access Center',
    'Smart Analyst setup scoring',
    'Evolution Engine',
    'Scenario Lab',
    'Read-only market data',
    'Paper broker control center',
    'Alpaca paper setup wizard with server-side environment checks',
    'Optional manual live trading readiness and manual limit-ticket flow, disabled unless server-side env vars are configured',
    'Manual live trading remains human-approved only',
    'Human-approved live ticket boundary',
    'No unattended autonomous live trading',
    'Server-side live trading kill switch via TRADER_LIVE_KILL_SWITCH=LOCK_LIVE_TRADING',
    'Optional live symbol allowlist via TRADER_LIVE_ALLOWED_SYMBOLS',
    'Browser/UI smoke fallback for npm-missing QA',
    'First-run setup wizard with beginner-safe product guidance',
    'Final Product State panel with beginner setup order and locked capability boundaries',
    'Professional chart engine',
    'Supabase-ready persistence with localStorage fallback and full JSON backup',
    'Full free tools integration hub',
    '7-year-old beginner coach',
    'Audit logs and local memory export'
  ],
  files
};
writeFileSync('RELEASE_MANIFEST.json', JSON.stringify(manifest, null, 2));
console.log(`Release manifest written with ${files.length} files.`);
