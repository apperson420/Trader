# Live Trading Safety Setup

Trader Command Center is paper/research-first. Optional live trading exists only as a manual, locked, server-gated limit-ticket flow.

## Default state

Live trading is locked by default.

AI Coach, Safe Autopilot, Guided Workflow, Strategy Evolution, Validation Forge, and AI Brain must not submit live trades.

## Required Vercel environment variables

Set these only when you intentionally want live-readiness available:

```text
TRADER_ENABLE_LIVE_TRADING=I_UNDERSTAND_LIVE_TRADING_RISK
ALPACA_LIVE_KEY_ID=your_live_key_id
ALPACA_LIVE_SECRET_KEY=your_live_secret_key
ALPACA_LIVE_BASE_URL=https://api.alpaca.markets
TRADER_LIVE_MAX_NOTIONAL=25
```

Use a small `TRADER_LIVE_MAX_NOTIONAL` first.

## Emergency kill switch

To immediately lock live order submission without deleting keys, set:

```text
TRADER_LIVE_KILL_SWITCH=LOCK_LIVE_TRADING
```

When this is set, the live API returns locked status and does not contact the broker for live requests.

## Optional symbol allowlist

To restrict live tickets to specific symbols, set a comma-separated allowlist:

```text
TRADER_LIVE_ALLOWED_SYMBOLS=AAPL,SPY,BTCUSD
```

If this value is omitted, the app still relies on the max-notional cap and all other gates.

## Manual ticket requirements

A live ticket must be:

- manual submission only
- limit order only
- day order only
- positive symbol, quantity, and limit price
- under the server-side max-notional cap
- checked against setup status
- checked against account status when configured
- human-reviewed
- confirmed with the exact phrase:

```text
LIVE ORDER - I ACCEPT REAL MONEY RISK
```

## What this does not do

This system does not guarantee profit, does not provide financial advice, does not make buy/sell recommendations, and does not allow autonomous live trading.

Always verify broker status, account status, buying power, orders, fees, tax consequences, and risk directly with the broker.
