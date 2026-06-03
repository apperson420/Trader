# BTC Sovereign Phase 3 AI-2 - Assistant Provider Base
"""Provider contracts for optional local assistant backends."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Protocol


@dataclass(frozen=True)
class ProviderResult:
    """Normalized response from a local assistant provider."""

    ok: bool
    response: str
    provider: str
    fallback_used: bool = False
    error: str | None = None


class AssistantProvider(Protocol):
    """Small provider interface. Providers must not execute tools or trades."""

    name: str

    def is_available(self) -> bool:
        """Return whether the provider appears usable right now."""

    def generate(self, message: str, context: Dict[str, Any]) -> ProviderResult:
        """Generate a safe explanatory answer from supplied safe context only."""
