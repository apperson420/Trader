# BTC Sovereign Phase 3 - Assistant Safety Filter
"""Safety checks for the paper-safe dashboard assistant."""

from __future__ import annotations

from dataclasses import dataclass


UNSAFE_TERMS = (
    "buy btc",
    "sell btc",
    "place trade",
    "execute trade",
    "live trading",
    "enable live",
    "real money",
    "bypass approval",
    "guarantee profit",
    "guaranteed profit",
    "make me money",
    "access credentials",
    "show credentials",
    "api key",
    "secret",
    "broker settings",
    "financial advice",
)


@dataclass(frozen=True)
class SafetyDecision:
    allowed: bool
    reason: str
    category: str = "safe"


def evaluate_message_safety(message: str) -> SafetyDecision:
    """Return whether a chat message is allowed for the assistant to answer."""
    normalized = (message or "").strip().lower()
    if not normalized:
        return SafetyDecision(False, "Please type a question about the dashboard status.", "empty")

    for term in UNSAFE_TERMS:
        if term in normalized:
            return SafetyDecision(
                False,
                (
                    "I can help explain paper-mode dashboard status, risk labels, "
                    "strategy sync, and bot heartbeat. I cannot place trades, enable "
                    "live trading, access secrets, bypass approvals, or give guaranteed "
                    "financial advice."
                ),
                "blocked_trading_or_secret_request",
            )

    return SafetyDecision(True, "Message is safe for paper-mode dashboard assistance.")
