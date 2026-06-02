# Autonomy Policy

Trader Command Center is paper/research-first. AI and autonomous features may coach, review, score, simulate, draft, and log, but they must not move real money on their own.

## Allowed AI behavior

- Explain evidence in beginner-safe language.
- Review journal, chart, validation, and risk information.
- Score paper/research setups.
- Draft plans for a human to inspect.
- Run paper-only or research-only checks.
- Log visible actions so the user can review what happened.

## Not allowed

- No unattended live brokerage actions.
- No autonomous live order submission.
- No auto-checking the human-review box.
- No auto-typing the live confirmation phrase.
- No hidden account actions.
- No buy/sell advice.
- No profit guarantees.

## Live-money boundary

Any real-money order must stay inside the Manual Live Order Ticket. That ticket remains locked by default and requires server-side live configuration, setup checks, notional caps, human review, exact typed confirmation, visible broker response, and a lock control after attempts.

AI Coach, AI Brain, Safe Autopilot, Guided Workflow, Strategy Evolution, Validation Forge, and any draft-only assist modules must not call live order submission endpoints.

## Default user promise

The safe default is local paper/research work with visible controls, local backup, optional server-side setup, and no browser-exposed secrets.
