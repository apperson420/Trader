# CI QA

GitHub Actions now runs the release verification work that this Windows machine cannot run locally when `npm` is missing.

## What GitHub Actions Checks

The `Quality` workflow runs on pushes, pull requests to `main`, and manual dispatch.

The release verification job uses Ubuntu with Node 20 and npm, then runs:

- `npm test` for JavaScript syntax checks.
- `npm run release:manifest` to generate `RELEASE_MANIFEST.json`.
- `npm run test:ui` for browser/UI smoke checks.
- `npm run test:smoke` for live Vercel smoke checks.

The workflow installs Playwright as CI tooling and installs Chromium before `npm run test:ui`. If Playwright cannot run in another environment, `tools/browser-ui-smoke.mjs` still has dependency-free fallback checks.

The workflow uploads:

- `RELEASE_MANIFEST.json`
- `artifacts/qa/browser-ui-smoke.json`
- `artifacts/qa/browser-ui-smoke.png` when Playwright runs
- `artifacts/qa/live-smoke.json`

The existing secret scan and CodeQL jobs remain in place.

## How To Read A Failed Run

Open the failed GitHub Actions run and check the first failed step:

- Syntax failure: inspect the file path printed by `tools/check-syntax.mjs`.
- UI smoke failure: download the `trader-release-verification` artifact and inspect `browser-ui-smoke.json` plus the screenshot if present.
- Live smoke failure: inspect `live-smoke.json` to see the failing URL, status code, and response snippet.
- Release manifest failure: confirm the repository files can be walked and `RELEASE_MANIFEST.json` can be written.
- Secret scan failure: treat it as high priority and remove the exposed secret rather than suppressing the alert.

## Why Local npm Missing Is No Longer A Blocker

Local fallback QA still exists:

- `CHECK_TRADER_QA.cmd`
- `powershell -ExecutionPolicy Bypass -File tools\qa-fallback.ps1`

Those commands verify important files and product checks when npm is unavailable. Full Node/npm, Playwright, release manifest, and live smoke verification now run in GitHub Actions after push.

## What Still Requires Vercel Environment Variables

These features are setup-ready and remain safe when credentials are missing:

- Alpaca paper broker: `ALPACA_PAPER_KEY_ID`, `ALPACA_PAPER_SECRET_KEY`, optional `ALPACA_PAPER_BASE_URL=https://paper-api.alpaca.markets`.
- Supabase persistence: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, optional `TRADER_PERSISTENCE_KEY`, optional `TRADER_PERSISTENCE_TABLE`.
- Hosted AI coach: `OPENAI_API_KEY`, optional `OPENAI_MODEL`.
- Stock/ETF quotes: `ALPHA_VANTAGE_API_KEY`.

Never put service keys in browser JavaScript. Broker actions remain Alpaca paper-only and require explicit `PAPER ONLY` confirmation.
