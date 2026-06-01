# AGENTS.md — Trader Command Center

## Mission

Build Trader Command Center as a serious, production-quality, beginner-safe AI paper-trading research product. The product goal is to help a complete beginner learn, research, backtest, validate, and paper-practice trading systems without fake income claims, hidden trades, or unsafe real-money automation.

## Non-negotiable rules

1. Preserve existing working features. Do not remove or downgrade modules unless the task explicitly asks.
2. No fake integrations. A feature is either working, setup-ready with exact missing credentials, or clearly not live.
3. No real-money execution. Broker actions must remain paper-only unless a future explicit owner-approved task implements separate real-money gates.
4. No investment advice. The app may educate, simulate, backtest, validate, and coach. It must not instruct a user to buy or sell.
5. Keep the app beginner-friendly enough for a 7-year-old-level user: exact next step, simple words, no unexplained jargon.
6. Keep API keys server-side. Never expose OpenAI, Alpaca, market-data, analytics, or database secrets in browser JavaScript.
7. Every autonomous or AI action must be visible, stoppable, logged, and paper/research scoped.
8. Prefer real working modules over roadmap panels. Roadmaps belong in docs, not as fake product capability.
9. Add tests/verification whenever changing behavior.
10. Keep files small and dependency-light unless the task clearly requires a package.

## Current architecture

Static frontend modules are loaded by `app.js`:

- `autonomous-engine.js` — safe autonomous paper plan loop.
- `ai-brain.js` — cross-repo AI brain / agent council.
- `market-intel.js` — read-only market quote panel.
- `ai-chat.js` — floating AI Coach Chat.
- `free-tools-hub.js` — registry/status of free tools and setup-ready adapters.
- `paper-broker.js` — Alpaca paper broker control center.
- `chart-engine.js` — real historical candlestick charting and simple research backtest.
- `professional-governor.js` — UX cleanup, evidence-capped score, command bar.
- `century-evolution.js` — real 100-generation strategy optimizer and production self-test.
- `strategy-validation.js` — walk-forward validation and Monte Carlo-style checks.

Serverless API routes:

- `api/market.js` — read-only quote API. Crypto uses Coinbase. Stocks/ETFs can use Alpha Vantage when configured.
- `api/history.js` — historical candle API. Crypto uses Coinbase daily candles. Stocks use Stooq where available.
- `api/ai-chat.js` — governed chat endpoint with local fallback and optional server-side OpenAI.
- `api/alpaca-paper.js` — Alpaca paper-trading-only account/orders/positions endpoint.

QA / release files:

- `package.json`
- `tools/check-syntax.mjs`
- `tools/smoke-live.mjs`
- `tools/release-manifest.mjs`
- `.github/workflows/quality.yml`
- `docs/MASTER_INTEGRATION_ROADMAP.md`

## Required checks before final response

Run or update these where possible:

```bash
npm test
npm run release:manifest
npm run test:smoke
```

If Codex cannot run commands in the environment, inspect syntax carefully and state exactly what could not be run.

## Product quality bar

A $2,000-quality task result must include at least one of:

- A working user-visible feature,
- A real serverless/API integration,
- A QA/security/release improvement,
- A measurable UX improvement,
- A persistent-data or export/backup improvement,
- A safer autonomous/governed workflow.

Do not satisfy a build request by adding only a plan.

## Best next build targets

1. Supabase-ready persistence adapter with local fallback.
2. Playwright browser smoke tests.
3. GitHub Actions fixes if current workflow fails.
4. Better chart interaction: timeframe selector, chart export, validation overlay.
5. Alpaca paper setup wizard and environment-variable checker.
6. Real paper-trading dry-run ticket from validated paper strategy only.
7. SEC EDGAR and FRED read-only research panels.
8. Desktop/Tauri packaging track after the web app stabilizes.

## Safety language

Use these words in the product where relevant:

- “paper only”
- “research only”
- “not investment advice”
- “no real-money order was sent”
- “requires adult/owner approval”
- “explicit confirmation required”

Avoid:

- “guaranteed income”
- “safe profit”
- “sure trade”
- “buy now”
- “sell now”
- “autonomous real-money execution”

## Codex task handling

When assigned a Codex task, produce a concise PR/commit summary with:

- Files changed,
- Real behavior added,
- Tests run,
- Safety gates preserved,
- Setup required, if any.
