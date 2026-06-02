import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

expect(existsSync(join(root, "docs/GOVERNANCE_RULEBOOK_IMPLEMENTATION.md")), "Governance doc is missing.");

const readme = read("README.md").toLowerCase();
expect(readme.includes("paper-trading"), "README must keep paper-trading positioning.");
expect(readme.includes("not financial advice"), "README must include not-financial-advice framing.");
expect(!readme.includes("production-ready institutional trading platform"), "README must not overclaim production readiness.");

const governor = read("professional-governor.js").toLowerCase();
expect(governor.includes("paper-only"), "Professional governor should keep paper-only wording.");
expect(governor.includes("evidence-capped"), "Professional governor should mention evidence-capped scoring.");

console.log("Trader governance checks passed.");
