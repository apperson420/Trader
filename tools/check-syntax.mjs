import { readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const skip = new Set(['.git', 'node_modules', '.vercel']);
const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    else if (['.js', '.mjs'].includes(extname(path))) files.push(path);
  }
}
walk(root);

let failed = false;
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (error) {
    failed = true;
    console.error(`Syntax check failed: ${file}`);
    console.error(error.stderr?.toString() || error.message);
  }
}

if (failed) process.exit(1);
console.log(`Checked ${files.length} JavaScript files. No syntax failures found.`);
