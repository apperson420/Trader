"""Paper-safe local assistant foundation for BTC Sovereign."""

from .assistant_service import AssistantService
from .context_builder import build_safe_context
from .safety_filter import SafetyDecision, evaluate_message_safety

__all__ = [
    "AssistantService",
    "SafetyDecision",
    "build_safe_context",
    "evaluate_message_safety",
]
