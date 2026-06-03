# BTC Sovereign v1.8 - Web Dashboard Control Center
"""
Flask control center for BTC Sovereign / Trader.

This dashboard remains paper/research-first. It switches the selected strategy
through shared_state.py so a running bot can poll get_current_strategy() or call
sync_strategy_to_bot(bot) inside its loop.
"""

from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from flask import Flask, Response, jsonify, render_template, request

import shared_state
from ai_assistant import AssistantService
from sovereign_bot import load_config

APP_ROOT = Path(__file__).resolve().parent
app = Flask(
    __name__,
    template_folder=str(APP_ROOT / "templates"),
    static_folder=str(APP_ROOT / "static"),
)
assistant_service = AssistantService()


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _heartbeat_summary(runtime: Dict[str, Any], *, stale_seconds: int = 10) -> Dict[str, Any]:
    """Return a clear dashboard-safe heartbeat summary."""
    last_heartbeat = runtime.get("last_heartbeat_at")
    heartbeat_dt = _parse_iso(last_heartbeat)
    age_seconds = None
    if heartbeat_dt:
        age_seconds = max(0, int((datetime.now(timezone.utc) - heartbeat_dt).total_seconds()))

    bot_running = bool(runtime.get("bot_running"))
    bot_status = runtime.get("bot_status") or "unknown"
    if not last_heartbeat:
        status = "not_started"
        label = "No heartbeat yet"
        detail = "Start the runtime with python run.py all."
        healthy = False
    elif bot_status == "error":
        status = "error"
        label = "Heartbeat error"
        detail = "The bot reported an error. Check logs/sovereign_bot.log."
        healthy = False
    elif not bot_running:
        status = "stopped"
        label = "Bot stopped"
        detail = "The bot is not currently reporting as running."
        healthy = False
    elif age_seconds is not None and age_seconds > stale_seconds:
        status = "stale"
        label = "Heartbeat stale"
        detail = f"Last heartbeat was {age_seconds}s ago. Check whether the bot is still running."
        healthy = False
    else:
        status = "healthy"
        label = "Heartbeat healthy"
        detail = "The bot is reporting current runtime heartbeats."
        healthy = True

    return {
        "healthy": healthy,
        "status": status,
        "label": label,
        "detail": detail,
        "last_heartbeat_at": last_heartbeat,
        "age_seconds": age_seconds,
        "bot_status": bot_status,
        "bot_running": bot_running,
    }


def _strategy_acknowledgement(state: Dict[str, Any]) -> Dict[str, Any]:
    """Return a clear dashboard-safe acknowledgement summary."""
    runtime = state.get("runtime", {}) if isinstance(state.get("runtime"), dict) else {}
    requested_strategy = state.get("strategy", "auto")
    requested_version = int(state.get("version") or 0)
    applied_strategy = runtime.get("bot_strategy")
    applied_version = int(runtime.get("last_applied_version") or 0)
    bot_running = bool(runtime.get("bot_running"))
    acknowledged = applied_strategy == requested_strategy and applied_version == requested_version

    if acknowledged:
        status = "applied_by_bot"
        label = "Applied by bot"
        detail = f"SovereignBot applied {requested_strategy} at version {requested_version}."
    elif bot_running:
        status = "pending_bot_acknowledgment"
        label = "Pending bot acknowledgment"
        detail = f"Waiting for SovereignBot to apply {requested_strategy} version {requested_version}."
    else:
        status = "pending_bot_offline"
        label = "Pending — bot offline"
        detail = "Start the runtime with python run.py all so SovereignBot can apply the latest strategy."

    return {
        "acknowledged": acknowledged,
        "status": status,
        "label": label,
        "detail": detail,
        "requested_strategy": requested_strategy,
        "requested_version": requested_version,
        "applied_strategy": applied_strategy,
        "applied_version": applied_version,
        "bot_running": bot_running,
        "bot_acknowledged_at": state.get("bot_acknowledged_at") or runtime.get("last_heartbeat_at"),
    }


def _dashboard_payload() -> Dict[str, Any]:
    config = load_config()
    state = shared_state.get_strategy_state(config.get("default_strategy", "auto"))
    strategy = state.get("strategy", "auto")
    runtime = state.get("runtime", {})
    strategy_ack = _strategy_acknowledgement(state)
    heartbeat = _heartbeat_summary(runtime)
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
        "strategy_ack": strategy_ack,
        "heartbeat": heartbeat,
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


@app.get("/api/ai/status")
def ai_status():
    return jsonify(assistant_service.status())


@app.get("/api/ai/context")
def ai_context():
    return jsonify(assistant_service.context())


@app.post("/api/ai/chat")
def ai_chat():
    data = request.get_json(silent=True) or {}
    message = data.get("message", "")
    return jsonify(assistant_service.chat(message))


@app.route("/api/switch-strategy", methods=["POST"])
def switch_strategy():
    data = request.get_json(silent=True) or {}
    requested_strategy = data.get("strategy")

    try:
        shared_state.set_current_strategy(
            requested_strategy,
            updated_by="dashboard",
            message=f"Dashboard requested strategy switch to {requested_strategy}.",
        )
        state = shared_state.get_strategy_state()
    except shared_state.StrategyStateError as exc:
        return jsonify({"ok": False, "status": "error", "error": str(exc)}), 400
    except OSError as exc:
        return jsonify({"ok": False, "status": "error", "error": f"Could not persist strategy state: {exc}"}), 500

    runtime = state.get("runtime", {})
    strategy_ack = _strategy_acknowledgement(state)
    heartbeat = _heartbeat_summary(runtime)

    return jsonify(
        {
            "ok": True,
            "status": "success",
            "message": (
                f"Strategy switch saved: {state['strategy']}. "
                "Running bot will apply it on the next sync cycle."
            ),
            "new_strategy": state["strategy"],
            "pending_bot_ack": not strategy_ack["acknowledged"],
            "strategy_ack": strategy_ack,
            "heartbeat": heartbeat,
            "state": state,
            "runtime": runtime,
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
