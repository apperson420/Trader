# Release Candidate Check

Date: 2026-06-01

## What Was Checked

- Local QA fallback commands:
  - `CHECK_TRADER_QA.cmd`
  - `powershell -ExecutionPolicy Bypass -File tools\qa-fallback.ps1`
- npm script availability:
  - `npm test`
  - `npm run test:ui`
  - `npm run release:manifest`
  - `npm run test:smoke`
- Live Vercel deployment at `https://trader-blush.vercel.app`.
- Required static assets:
  - `/`
  - `/app.js`
  - `/persistence-engine.js`
  - `/chart-engine.js`
  - `/century-evolution.js`
  - `/strategy-validation.js`
- Required API routes:
  - `/api/market?symbol=BTC`
  - `/api/history?symbol=BTC`
  - `/api/ai-chat`
  - `/api/alpaca-paper?action=setup-status`
- Static release blocker scan for loaded browser modules:
  - broken JavaScript parse failures
  - stale roadmap-only language in app panels
  - fake integration wording
  - browser-side `process.env` secret access
  - forbidden buy/sell/profit language
- GitHub Actions `Quality` workflow for commit `ec039c493d328c615d660396dfd3423b4601be9c` and follow-up fixes.

## What Passed

- `CHECK_TRADER_QA.cmd` passed using the PowerShell fallback path.
- `tools\qa-fallback.ps1` passed using PowerShell file/product checks.
- Live main page responded `200`.
- Live `/app.js` responded `200`.
- Live `/persistence-engine.js` responded `200`.
- Live `/chart-engine.js` responded `200`.
- Live `/century-evolution.js` responded `200`.
- Live `/strategy-validation.js` responded `200`.
- Live `/api/market?symbol=BTC` responded `200` with read-only Coinbase BTC quote data.
- Live `/api/history?symbol=BTC` responded `200` with historical BTC candles.
- Live `/api/ai-chat` responded `405` to GET as expected; chat requires POST.
- Live `/api/alpaca-paper?action=setup-status` responded `200` safely with `paperOnly: true` and missing-key setup status.
- Node REPL fallback parsed 24 JavaScript/MJS files without syntax failures.
- Static blocker scan found no forbidden phrases in loaded browser modules.
- GitHub Actions is enabled and `.github/workflows/quality.yml` is active.
- `Quality` run `26774213850` passed on commit `8a5a69c37d930bfefd84045601cefa1b0aa4ac6a`.
- The passing run completed `release-verification`, `secret-scan`, and `codeql`.
- The passing `release-verification` job completed syntax checks, release manifest generation, Playwright browser/UI smoke checks, live smoke checks, and QA artifact upload.

## What Failed

- `npm test` could not run because `npm` is not available on PATH.
- `npm run test:ui` could not run because `npm` is not available on PATH.
- `npm run release:manifest` could not run because `npm` is not available on PATH.
- `npm run test:smoke` could not run because `npm` is not available on PATH.
- Earlier `Quality` run `26770916421` for commit `ec039c493d328c615d660396dfd3423b4601be9c` failed in `release-verification` at `Browser/UI smoke checks`.
- The failure was fixed by serving the Playwright smoke test through a local HTTP harness, resetting test state through real UI controls, and waiting for the async broker setup result before asserting.

## What Could Not Be Checked

- Full browser console/runtime rendering could not be checked with Playwright from local PowerShell because this machine does not have a usable local `npm`/`node` runtime on PATH.
- Visual overlap inspection in a real browser was not available in this environment.
- Real Supabase sync was not checked because Supabase credentials are optional and were not present.
- Alpaca paper account connectivity was not checked because paper keys are optional and were not present.
- GitHub Actions emitted deprecation warnings for Node.js 20-based actions and CodeQL Action v3; these were warnings only and did not fail the passing run.

## Remaining Setup Required

- Optional Alpaca paper trading setup:
  - `ALPACA_PAPER_KEY_ID`
  - `ALPACA_PAPER_SECRET_KEY`
  - optional `ALPACA_PAPER_BASE_URL=https://paper-api.alpaca.markets`
- Optional Supabase persistence setup:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `trader_persistence` table
- Optional hosted AI setup:
  - `OPENAI_API_KEY`
  - optional `OPENAI_MODEL`
- Optional stock/ETF quote setup:
  - `ALPHA_VANTAGE_API_KEY`
- Local developer machine should install a normal Node.js/npm runtime to run npm scripts and Playwright UI smoke directly.

## Known Limitations

- The app remains paper only and research only.
- The AI coach does not provide buy/sell advice.
- Alpaca actions remain paper-only and require explicit `PAPER ONLY` confirmation.
- API keys and service credentials must stay server-side in Vercel environment variables.
- Browser localStorage remains the default persistence path when Supabase is not configured.
- Live deployment checks were HTTP-level checks, not a full interactive browser session.
