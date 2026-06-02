# Governance Rulebook Implementation

Updated: 2026-06-01

This root is a finance/trading decision-support project. Matthew's no-loss operating core applies here as a paper-first, risk-first trading assistant rule set.

## Implemented Project Rules

- Keep Trader separate from SingularityOS, IncomeOS, AetherForge, and BTC Sovereign roots.
- Treat the app as decision support, not financial advice.
- Keep real-money trading disabled unless Matthew explicitly requests a broker-backed upgrade with approval gates.
- Require approval before trades, money movement, credential use, external writes, publishing, or dependency changes.
- Keep paper mode, scenario lab, journal, checklist, and evidence-capped scoring as the safe default workflow.
- Do not claim guaranteed returns, production readiness, institutional readiness, or live-trading safety without evidence.
- Track risk, fees, slippage, liquidity, position sizing, and max-loss assumptions.

## Verification

Run:

```powershell
.\CHECK_TRADER_QA.cmd
node tools/check-governance.mjs
```

The governance check is static. It does not prove trading strategy quality or broker safety.
