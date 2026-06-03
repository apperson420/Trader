# BTC Sovereign Phase 3 - Rule-Based Paper-Safe Assistant
"""Local rule-based assistant for explaining BTC Sovereign dashboard status."""

from __future__ import annotations

from typing import Any, Dict

from .context_builder import build_safe_context
from .safety_filter import evaluate_message_safety

DISCLAIMER = "Education and paper-trading system help only. Not financial advice."


class AssistantService:
    """Small local assistant. No model dependency and no tool execution."""

    def status(self) -> Dict[str, Any]:
        return {
            "ok": True,
            "mode": "rule_based_local",
            "paper_safe": True,
            "can_execute_trades": False,
            "can_switch_strategies": False,
            "disclaimer": DISCLAIMER,
        }

    def context(self) -> Dict[str, Any]:
        return {"ok": True, "context": build_safe_context(), "disclaimer": DISCLAIMER}

    def chat(self, message: str) -> Dict[str, Any]:
        decision = evaluate_message_safety(message)
        if not decision.allowed:
            return {
                "ok": False,
                "blocked": True,
                "category": decision.category,
                "response": decision.reason,
                "disclaimer": DISCLAIMER,
            }

        context = build_safe_context()
        response = self._answer(message, context)
        return {
            "ok": True,
            "blocked": False,
            "response": response,
            "context_used": list(context.keys()),
            "disclaimer": DISCLAIMER,
        }

    def _answer(self, message: str, context: Dict[str, Any]) -> str:
        normalized = (message or "").lower()
        ack = context["strategy_acknowledgement"]
        heartbeat = context["heartbeat_status"]

        if "running" in normalized or "heartbeat" in normalized or "bot" in normalized:
            running = "running" if context["bot_running"] else "not running"
            return (
                f"The bot is currently {running}. Heartbeat status is "
                f"{heartbeat.get('bot_status', 'unknown')}, with last heartbeat at "
                f"{heartbeat.get('last_heartbeat_at') or 'not started yet'}. {DISCLAIMER}"
            )

        if "apply" in normalized or "applied" in normalized or "sync" in normalized or "pending" in normalized:
            if ack["acknowledged"]:
                return (
                    f"The requested paper strategy is applied. Requested strategy: "
                    f"{context['requested_strategy']}. Bot-applied strategy: "
                    f"{context['applied_strategy']}. State version: {context['state_version']}. {DISCLAIMER}"
                )
            return (
                f"The strategy change is pending bot acknowledgment. Requested strategy: "
                f"{context['requested_strategy']}. Bot-applied strategy: "
                f"{context['applied_strategy'] or 'none yet'}. Keep the bot running and watch for "
                f"Strategy Sync to change to Applied by bot. {DISCLAIMER}"
            )

        if "paper" in normalized or "risk" in normalized or "safe" in normalized:
            return (
                f"BTC Sovereign is in paper-safe mode: real-money trading is "
                f"{context['real_money_trading']}. Max paper risk setting is "
                f"{context['max_paper_risk_percent']}%. Strategy buttons select paper strategies only; "
                f"they do not place trades. {DISCLAIMER}"
            )

        if "what should" in normalized or "next" in normalized or "check" in normalized:
            if not context["bot_running"]:
                return f"Next best check: start the runtime with python run.py all, then confirm Bot Heartbeat turns healthy. {DISCLAIMER}"
            if not ack["acknowledged"]:
                return f"Next best check: wait for Strategy Sync to say Applied by bot before relying on the selected paper strategy. {DISCLAIMER}"
            return f"Next best check: monitor Strategy Sync, Bot Heartbeat, and Paper Safe risk state. Everything appears synchronized from the safe context. {DISCLAIMER}"

        if "explain" in normalized or "dashboard" in normalized or "simple" in normalized:
            return (
                "The dashboard has three main checks: Strategy Sync shows whether the bot applied "
                "the selected paper strategy, Bot Heartbeat shows whether the runtime is alive, "
                "and Risk State confirms the system is paper-safe. Use these before changing paper "
                f"strategies. {DISCLAIMER}"
            )

        return (
            "I can explain BTC Sovereign dashboard status, paper strategy sync, heartbeat, "
            "and paper-safe risk labels. Try asking: 'Did the strategy apply?' or "
            f"'Is the bot running?' {DISCLAIMER}"
        )
