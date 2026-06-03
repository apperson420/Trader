# AI Live Assist

AI Live Assist is a draft-only review helper for Trader Command Center.

## What it does

- Reads visible app evidence such as the current plan fields, risk calculator, checklist, journal count, decision logs, AI Review Coach notes, validation reports, and evolution reports.
- Creates a possible manual live-ticket review draft.
- Estimates quantity from the visible risk calculator only.
- Shows limit price, estimated notional, risk per unit, reward/risk, warnings, blockers, and missing evidence.
- Saves drafts in `ai_live_assist_drafts` so backups include them.
- Can copy only symbol, side, quantity, and limit price into the Manual Live Order Ticket.

## What it cannot do

- It cannot submit live trades.
- It cannot approve trades.
- It cannot check the human-review box.
- It cannot type the required live confirmation phrase.
- It cannot unlock owner access.
- It cannot bypass live setup, the emergency kill switch, symbol allowlist, account check, max-notional cap, or manual ticket gates.
- It cannot call broker order endpoints.

## Manual Live Order Ticket boundary

Copying from AI Live Assist fills draft fields only. The Manual Live Order Ticket still requires a human to review risk, check setup and account state, acknowledge real-money risk, complete human review, type the required confirmation, and manually submit if the server-side live gates allow it.

## Why human review is required

Live-money actions can lose real money. Software can miss context, stale data, broker rules, taxes, liquidity, fees, or user-specific constraints. Human review keeps the app as a coaching and drafting tool, not an unattended trading system.

## Not investment advice

AI Live Assist is not investment advice and does not guarantee profit. It drafts a review note from visible data only.
