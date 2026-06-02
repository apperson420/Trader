# BTC Sovereign v1.4 - Web Dashboard Control Center
"""
Flask control center for BTC Sovereign / Trader.

This dashboard remains paper/research-first. It switches the selected strategy
through shared_state.py so a running bot can poll get_current_strategy() or call
sync_strategy_to_bot(bot) inside its loop.
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Dict

from flask import Flask, Response, jsonify, render_template, request

import shared_state
from sovereign_bot import load_config

APP_ROOT = Path(__file__).resolve().parent
app = Flask(
    __name__,
    template_folder=str(APP_ROOT / "templates"),
    static_folder=str(APP_ROOT / "static"),
)


def _dashboard_payload() -> Dict[str, Any]:
    config = load_config()
    state = shared_state.get_strategy_state(config.get("default_strategy", "auto"))
    strategy = state.get("strategy", "auto")
    runtime = state.get("runtime", {})
    risk_guardrails = {
        "mode": state.get("mode", config.get("mode", "paper")),
        "real_money_trading": "disabled_by_default",
        "approval_required": True,
        "max_risk_note": "Use paper mode and define stop loss before any real-money upgrade.",
        "state_file": str(shared_state.STATE_FILE),
        "audit_file": str(shared_state.AUDIT_FILE),
        "max_risk_per_trade_percent": config.get("risk", {}).get("max_risk_per_trade_percent", 1.0),
    }
    return {
        "ok": True,
        "system": "BTC Sovereign Trader",
        "interface": "web_dashboard",
        "strategy": strategy,
        "allowed_strategies": list(shared_state.ALLOWED_STRATEGIES),
        "state": state,
        "runtime": runtime,
        "risk": risk_guardrails,
        "status": state.get("status", "ready"),
        "message": state.get("message", "Dashboard ready."),
        "config_version": config.get("version", "unknown"),
    }


@app.route("/")
def index():
    payload = _dashboard_payload()
    return render_template(
        "index.html",
        payload=payload,
        allowed_strategies=payload["allowed_strategies"],
    )


@app.get("/api/status")
def api_status():
    return jsonify(_dashboard_payload())


@app.route("/api/switch-strategy", methods=["POST"])
def switch_strategy():
    data = request.get_json(silent=True) or {}
    requested_strategy = data.get("strategy")

    try:
        state = shared_state.set_strategy_state(
            requested_strategy,
            updated_by="dashboard",
            message=f"Dashboard requested strategy switch to {requested_strategy}.",
        )
    except shared_state.StrategyStateError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400
    except OSError as exc:
        return jsonify({"ok": False, "error": f"Could not persist strategy state: {exc}"}), 500

    return jsonify(
        {
            "ok": True,
            "status": "success",
            "message": f"Strategy switch saved: {state['strategy']}. Running bot will apply it on next sync/poll.",
            "new_strategy": state["strategy"],
            "state": state,
            "runtime": state.get("runtime", {}),
        }
    )


@app.get("/events")
def events():
    def stream():
        last_payload = None
        while True:
            payload = _dashboard_payload()
            encoded = json.dumps(payload, sort_keys=True)
            if encoded != last_payload:
                yield f"event: status\ndata: {encoded}\n\n"
                last_payload = encoded
            time.sleep(1.5)

    return Response(stream(), mimetype="text/event-stream")


if __name__ == "__main__":
    config = load_config()
    dashboard = config.get("dashboard", {})
    app.run(
        host=dashboard.get("host", "127.0.0.1"),
        port=int(dashboard.get("port", 5055)),
        debug=False,
        threaded=True,
    )
