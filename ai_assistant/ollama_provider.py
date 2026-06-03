# BTC Sovereign Phase 3 AI-2 - Optional Ollama Provider
"""Optional local Ollama provider for the paper-safe dashboard assistant.

This provider only receives the deliberately small safe context from
context_builder.py. It has no tool execution, no broker access, and no ability
to switch strategies or place trades.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any, Dict

from .provider_base import ProviderResult

DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
DEFAULT_MODEL = "llama3"
DISCLAIMER = "Education and paper-trading system help only. Not financial advice."


class OllamaProvider:
    """Small stdlib-only Ollama client with strict paper-safe prompting."""

    name = "ollama_local"

    def __init__(self, *, model: str = DEFAULT_MODEL, url: str = DEFAULT_OLLAMA_URL, timeout_seconds: float = 8.0) -> None:
        self.model = model
        self.url = url
        self.timeout_seconds = timeout_seconds

    def is_available(self) -> bool:
        try:
            request = urllib.request.Request(
                self.url,
                data=json.dumps({"model": self.model, "prompt": "status", "stream": False}).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=2.0) as response:
                return 200 <= response.status < 300
        except (OSError, urllib.error.URLError, TimeoutError):
            return False

    def generate(self, message: str, context: Dict[str, Any]) -> ProviderResult:
        prompt = self._build_prompt(message, context)
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.2,
                "num_predict": 220,
            },
        }
        try:
            request = urllib.request.Request(
                self.url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                body = json.loads(response.read().decode("utf-8"))
        except (OSError, urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            return ProviderResult(
                ok=False,
                response="",
                provider=self.name,
                fallback_used=True,
                error=f"Ollama unavailable or returned an invalid response: {exc}",
            )

        answer = str(body.get("response") or "").strip()
        if not answer:
            return ProviderResult(
                ok=False,
                response="",
                provider=self.name,
                fallback_used=True,
                error="Ollama returned an empty response.",
            )
        return ProviderResult(ok=True, response=self._enforce_disclaimer(answer), provider=self.name)

    def _build_prompt(self, message: str, context: Dict[str, Any]) -> str:
        safe_context = json.dumps(context, indent=2, sort_keys=True)
        return f"""
You are the BTC Sovereign dashboard assistant.
You are local, paper-safe, and read-only.
You may explain only the supplied dashboard context.
You must not place trades, recommend buy/sell actions, switch strategies, enable live trading, access secrets, or guarantee profits.
You must be concise and beginner-friendly.
Always mention that this is education and paper-trading system help only, not financial advice.

Safe dashboard context:
{safe_context}

User question:
{message}

Answer:
""".strip()

    def _enforce_disclaimer(self, answer: str) -> str:
        if "not financial advice" in answer.lower():
            return answer
        return f"{answer}\n\n{DISCLAIMER}"
