import { writeFileSync, readdirSync, statSync } from 'node:fs';
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
const manifest = {
  app: 'Trader Command Center',
  generatedAt: new Date().toISOString(),
  safety: 'Paper/research mode only unless configured paper broker keys are provided. No real-money execution.',
  capabilities: [
    'AI Coach Chat',
    'Smart Analyst setup scoring',
    'Evolution Engine',
    'Scenario Lab',
    'Read-only market data',
    'Paper broker control center',
    'Alpaca paper setup wizard with server-side environment checks',
    'Browser/UI smoke fallback for npm-missing QA',
    'First-run setup wizard with beginner-safe product guidance',
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
