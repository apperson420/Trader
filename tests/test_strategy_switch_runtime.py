# BTC Sovereign v1.5 - Strategy Switch Runtime Verification
"""Regression check: dashboard strategy changes are applied by SovereignBot."""

from __future__ import annotations

import importlib
import os
from pathlib import Path


def test_dashboard_strategy_switch_reaches_running_bot(tmp_path):
    state_file = tmp_path / "current_strategy.json"
    audit_file = tmp_path / "strategy_events.jsonl"
    os.environ["BTC_SOVEREIGN_STATE_FILE"] = str(state_file)
    os.environ["BTC_SOVEREIGN_AUDIT_FILE"] = str(audit_file)

    import shared_state
    import sovereign_bot

    importlib.reload(shared_state)
    importlib.reload(sovereign_bot)

    bot = sovereign_bot.SovereignBot({"mode": "paper", "default_strategy": "auto"})
    assert bot.current_strategy == "auto"

    assert shared_state.set_current_strategy("momentum", updated_by="test-dashboard") is True
    pending = shared_state.get_strategy_state()
    assert pending["strategy"] == "momentum"
    assert pending["status"] == "strategy_switch_pending_bot_ack"

    applied = bot.sync_once()
    assert bot.current_strategy == "momentum"
    assert applied["runtime"]["bot_strategy"] == "momentum"
    assert applied["runtime"]["last_applied_version"] == applied["version"]
    assert applied["status"] == "active"

    audit_text = audit_file.read_text(encoding="utf-8")
    assert "strategy_switch_requested" in audit_text
    assert "strategy_applied_by_runtime" in audit_text


def test_invalid_dashboard_strategy_is_rejected(tmp_path):
    os.environ["BTC_SOVEREIGN_STATE_FILE"] = str(tmp_path / "current_strategy.json")
    os.environ["BTC_SOVEREIGN_AUDIT_FILE"] = str(tmp_path / "strategy_events.jsonl")

    import shared_state

    importlib.reload(shared_state)

    try:
        shared_state.set_current_strategy("not_allowed", updated_by="test-dashboard")
    except shared_state.StrategyStateError:
        pass
    else:
        raise AssertionError("Invalid strategy should be rejected")
