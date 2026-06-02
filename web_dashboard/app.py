# BTC Sovereign v1.3 - Web Dashboard Control Center
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

APP_ROOT = Path(__file__).resolve().parent
app = Flask(
    __name__,
    template_folder=str(APP_ROOT / "templates"),
    static_folder=str(APP_ROOT / "static"),
)


def _dashboard_payload() -> Dict[str, Any]:
    state = shared_state.get_strategy_state()
    strategy = state.get("strategy", "auto")
    risk_guardrails = {
        "mode": state.get("mode", "paper"),
        "real_money_trading": "disabled_by_default",
        "approval_required": True,
        "max_risk_note": "Use paper mode and define stop loss before any real-money upgrade.",
        "state_file": str(shared_state.STATE_FILE),
    }
    return {
        "ok": True,
        "system": "BTC Sovereign Trader",
        "interface": "web_dashboard",
        "strategy": strategy,
        "allowed_strategies": list(shared_state.ALLOWED_STRATEGIES),
        "state": state,
        "risk": risk_guardrails,
        "status": state.get("status", "ready"),
        "message": state.get("message", "Dashboard ready."),
    }


@app.route("/")
def index():
    return render_template(
        "index.html",
        payload=_dashboard_payload(),
        allowed_strategies=shared_state.ALLOWED_STRATEGIES,
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
    app.run(host="127.0.0.1", port=5055, debug=False, threaded=True)
