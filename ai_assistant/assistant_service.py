# BTC Sovereign Phase 3 AI-2 - Paper-Safe Assistant Service
"""Local assistant for explaining BTC Sovereign dashboard status.

AI-2 keeps the rule-based assistant as the dependable default and can optionally
use a local Ollama model for richer wording. Safety filtering and safe-context
construction always happen before any model call.
"""

from __future__ import annotations

from typing import Any, Dict

from sovereign_bot import load_config

from .context_builder import build_safe_context
from .ollama_provider import OllamaProvider
from .safety_filter import evaluate_message_safety

DISCLAIMER = "Education and paper-trading system help only. Not financial advice."


class AssistantService:
    """Paper-safe assistant. No tool execution and no trading actions."""

    def __init__(self) -> None:
        config = load_config()
        assistant_config = config.get("assistant", {}) if isinstance(config.get("assistant"), dict) else {}
        ollama_config = assistant_config.get("ollama", {}) if isinstance(assistant_config.get("ollama"), dict) else {}
        self.use_ollama = bool(assistant_config.get("use_ollama", False))
        self.provider = OllamaProvider(
            model=str(ollama_config.get("model", "llama3")),
            url=str(ollama_config.get("url", "http://127.0.0.1:11434/api/generate")),
            timeout_seconds=float(ollama_config.get("timeout_seconds", 8.0)),
        )

    def status(self) -> Dict[str, Any]:
        provider_available = self.provider.is_available() if self.use_ollama else False
        return {
            "ok": True,
            "mode": "ollama_local" if self.use_ollama and provider_available else "rule_based_local",
            "paper_safe": True,
            "can_execute_trades": False,
            "can_switch_strategies": False,
            "model_provider_enabled": self.use_ollama,
            "model_provider": self.provider.name,
            "model_available": provider_available,
            "fallback": "rule_based_local",
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
                "provider": "safety_filter",
                "fallback_used": False,
                "disclaimer": DISCLAIMER,
            }

        context = build_safe_context()
        if self.use_ollama:
            provider_result = self.provider.generate(message, context)
            if provider_result.ok:
                return {
                    "ok": True,
                    "blocked": False,
                    "response": provider_result.response,
                    "provider": provider_result.provider,
                    "fallback_used": False,
                    "context_used": list(context.keys()),
                    "disclaimer": DISCLAIMER,
                }

            response = self._answer(message, context)
            return {
                "ok": True,
                "blocked": False,
                "response": f"{response}\n\nLocal model fallback note: {provider_result.error}",
                "provider": "rule_based_local",
                "fallback_used": True,
                "model_error": provider_result.error,
                "context_used": list(context.keys()),
                "disclaimer": DISCLAIMER,
            }

        response = self._answer(message, context)
        return {
            "ok": True,
            "blocked": False,
            "response": response,
            "provider": "rule_based_local",
            "fallback_used": False,
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
