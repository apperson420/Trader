# BTC Sovereign v1.7 - Verification Script
"""
Run with: python verify.py

Checks:
- shared_state strategy validation and rejection
- dashboard-to-bot strategy synchronization without placing trades
- heartbeat and acknowledgement status
- corrupted shared-state recovery
"""

from __future__ import annotations

import importlib
import json
import os
import tempfile
from pathlib import Path


def reload_runtime_modules():
    import shared_state
    import sovereign_bot
    import web_dashboard.app as dashboard_app

    importlib.reload(shared_state)
    importlib.reload(sovereign_bot)
    importlib.reload(dashboard_app)
    return shared_state, sovereign_bot, dashboard_app


def verify_dashboard_to_bot_flow(shared_state, sovereign_bot, dashboard_app) -> None:
    print("\n[1] Dashboard -> shared_state -> SovereignBot flow")
    bot = sovereign_bot.SovereignBot({"mode": "paper", "default_strategy": "auto"})
    assert bot.current_strategy == "auto", "Bot should start on auto"

    client = dashboard_app.app.test_client()
    response = client.post("/api/switch-strategy", json={"strategy": "momentum"})
    assert response.status_code == 200, response.get_data(as_text=True)
    payload = response.get_json()
    assert payload["ok"] is True
    assert payload["new_strategy"] == "momentum"
    assert payload["strategy_ack"]["acknowledged"] is False
    print("  Saved dashboard strategy request: momentum")

    state = bot.sync_once()
    assert bot.current_strategy == "momentum", "Bot did not apply momentum"
    assert state["runtime"]["bot_strategy"] == "momentum"
    assert state["runtime"]["last_applied_version"] == state["version"]
    print("  Bot applied strategy and acknowledged matching version")

    status_response = client.get("/api/status")
    assert status_response.status_code == 200
    status = status_response.get_json()
    assert status["strategy_ack"]["acknowledged"] is True
    assert status["strategy_ack"]["label"] == "Applied by bot"
    assert status["heartbeat"]["status"] in {"healthy", "stale"}
    print(f"  Dashboard status: {status['strategy_ack']['label']} / {status['heartbeat']['label']}")


def verify_invalid_strategy_rejected(shared_state, dashboard_app) -> None:
    print("\n[2] Invalid strategy rejection")
    client = dashboard_app.app.test_client()
    response = client.post("/api/switch-strategy", json={"strategy": "not_allowed"})
    assert response.status_code == 400
    payload = response.get_json()
    assert payload["ok"] is False
    assert "Allowed" in payload["error"]
    print(f"  Rejected invalid strategy with clear message: {payload['error']}")


def verify_corrupted_state_recovery(shared_state) -> None:
    print("\n[3] Corrupted shared-state recovery")
    Path(os.environ["BTC_SOVEREIGN_STATE_FILE"]).write_text("{broken json", encoding="utf-8")
    state = shared_state.get_strategy_state()
    assert state["strategy"] == "auto"
    assert state["status"] == "recovered"
    assert "corrupt_state_backup" in state
    print("  Corrupted state recovered safely and backup recorded")


def main() -> None:
    print("Starting BTC Sovereign verification...")
    with tempfile.TemporaryDirectory(prefix="btc_sovereign_verify_") as tmp:
        root = Path(tmp)
        os.environ["BTC_SOVEREIGN_STATE_FILE"] = str(root / "current_strategy.json")
        os.environ["BTC_SOVEREIGN_AUDIT_FILE"] = str(root / "logs" / "strategy_events.jsonl")
        os.environ["BTC_SOVEREIGN_LOG_FILE"] = str(root / "logs" / "sovereign_bot.log")

        shared_state, sovereign_bot, dashboard_app = reload_runtime_modules()

        verify_dashboard_to_bot_flow(shared_state, sovereign_bot, dashboard_app)
        verify_invalid_strategy_rejected(shared_state, dashboard_app)
        verify_corrupted_state_recovery(shared_state)

        log_text = Path(os.environ["BTC_SOVEREIGN_LOG_FILE"]).read_text(encoding="utf-8")
        assert "Strategy switch requested" in log_text
        assert "Strategy acknowledged" in log_text
        print("\n[4] Log verification")
        print("  Important strategy events were written to logs/sovereign_bot.log")

    print("\nAll verification checks passed.")
    print("Dashboard-to-bot strategy synchronization is working in paper-safe mode.")


if __name__ == "__main__":
    main()
