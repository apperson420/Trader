# BTC Sovereign Phase 3 - Safe Assistant Context Builder
"""Build a deliberately small, secret-free context for the dashboard assistant."""

from __future__ import annotations

from typing import Any, Dict

import shared_state
from sovereign_bot import load_config

SAFE_CONTEXT_KEYS = {
    "requested_strategy",
    "applied_strategy",
    "strategy_acknowledgement",
    "heartbeat_status",
    "bot_running",
    "paper_mode",
    "real_money_trading",
    "max_paper_risk_percent",
    "state_version",
    "recent_status_message",
}


def build_safe_context() -> Dict[str, Any]:
    """
    Return only safe local dashboard status fields.

    This function must not read credentials, .env files, broker keys, unrelated
    folders, or raw log files. It is intentionally status-only.
    """
    config = load_config()
    state = shared_state.get_strategy_state(config.get("default_strategy", "auto"))
    runtime = state.get("runtime", {}) if isinstance(state.get("runtime"), dict) else {}
    risk = config.get("risk", {}) if isinstance(config.get("risk"), dict) else {}
    mode = state.get("mode", config.get("mode", "paper"))

    applied_strategy = runtime.get("bot_strategy")
    requested_strategy = state.get("strategy", "auto")
    state_version = int(state.get("version") or 0)
    applied_version = int(runtime.get("last_applied_version") or 0)
    acknowledged = applied_strategy == requested_strategy and applied_version == state_version

    return {
        "requested_strategy": requested_strategy,
        "applied_strategy": applied_strategy,
        "strategy_acknowledgement": {
            "acknowledged": acknowledged,
            "requested_version": state_version,
            "applied_version": applied_version,
            "label": "Applied by bot" if acknowledged else "Pending bot acknowledgment",
        },
        "heartbeat_status": {
            "bot_status": runtime.get("bot_status", "unknown"),
            "last_heartbeat_at": runtime.get("last_heartbeat_at"),
        },
        "bot_running": bool(runtime.get("bot_running")),
        "paper_mode": mode == "paper",
        "real_money_trading": "disabled_by_default",
        "max_paper_risk_percent": risk.get("max_risk_per_trade_percent", 1.0),
        "state_version": state_version,
        "recent_status_message": state.get("message", "Dashboard ready."),
    }


def assert_context_is_safe(context: Dict[str, Any]) -> None:
    """Defensive check used by verify.py and future tests."""
    unsafe_terms = ("secret", "token", "password", "api_key", "private_key", "credential")
    unexpected = set(context) - SAFE_CONTEXT_KEYS
    if unexpected:
        raise AssertionError(f"Unexpected assistant context keys: {sorted(unexpected)}")
    lowered = repr(context).lower()
    for term in unsafe_terms:
        if term in lowered:
            raise AssertionError(f"Unsafe term leaked into assistant context: {term}")
