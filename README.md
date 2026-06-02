# Trader

**v5.6 - governed paper-trading research build**

Trader is a local, beginner-friendly paper-trading command center for research, journaling, scenario testing, and safer decision support. It is not financial advice, not proven production trading infrastructure, and not a guarantee of returns.

Default posture:

- Paper/simulation first.
- No autonomous real-money trades.
- No money movement without explicit approval and properly reviewed broker safeguards.
- Evidence-capped confidence scores.
- Risk, fees, slippage, liquidity, and downside notes must stay visible.
- Keep journal/audit records for decisions and simulated outcomes.

See `docs/GOVERNANCE_RULEBOOK_IMPLEMENTATION.md` for the active rulebook mapping.

## Current Product State

Trader Command Center can run a beginner-safe research chain: watchlist, journal, AI Coach Chat, Smart Analyst, Market Intelligence, historical chart proof, 100-generation strategy evolution, walk-forward validation, Monte Carlo-style risk checks, paper broker practice, decision approvals, AI review notes, support reports, release readiness checks, and full local backup/export.

Safe/default behavior:

- Local browser storage works without accounts.
- Supabase backup is optional and setup-ready through server-side environment variables.
- Alpaca paper trading remains separate from optional live readiness.
- Live trading, when intentionally configured, is manual only through the locked limit-day ticket.
- AI may coach, review, score, simulate, and draft only.

Optional setup still needed for cloud or broker features:

- Supabase server variables for cloud backup.
- Alpaca paper variables for paper broker practice.
- Owner access code for private deployments.
- Alpaca live variables, kill switch review, and a small max-notional cap before using the manual live ticket.

Intentionally not allowed:

- No buy/sell advice.
- No profit guarantees.
- No browser-stored API secrets.
- No unattended autonomous live trading.
- No AI/autopilot path to submit live orders.

Before calling this a finished sellable product, add full user accounts, per-user database isolation, legal terms and risk acceptance, rate limits, deeper broker audit logs, monitored production error reporting, and independent security review.
