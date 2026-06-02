# BTC Sovereign v1.3 - Atomic Shared Strategy State
"""
Small, dependency-free synchronization layer used by the web dashboard and any
running SovereignBot process.

Design goals:
- Paper/research safe by default.
- Atomic writes so the bot never reads a half-written JSON file.
- Strict strategy allowlist so dashboard input cannot request arbitrary actions.
- Backward compatible get_current_strategy()/set_current_strategy() helpers.
"""

from __future__ import annotations

import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

STATE_FILE = Path(os.environ.get("BTC_SOVEREIGN_STATE_FILE", "current_strategy.json"))

ALLOWED_STRATEGIES = (
    "auto",
    "trend",
    "mean_reversion",
    "breakout",
    "momentum",
)

DEFAULT_STATE: Dict[str, Any] = {
    "strategy": "auto",
    "previous_strategy": None,
    "updated_at": None,
    "updated_by": "system",
    "version": 1,
    "mode": "paper",
    "status": "ready",
    "message": "Strategy state initialized.",
}


class StrategyStateError(ValueError):
    """Raised when a requested strategy state change is invalid."""


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def normalize_strategy(strategy: Optional[str]) -> str:
    """Normalize and validate a strategy name from UI/API/bot callers."""
    value = (strategy or "").strip().lower().replace("-", "_").replace(" ", "_")
    if value not in ALLOWED_STRATEGIES:
        allowed = ", ".join(ALLOWED_STRATEGIES)
        raise StrategyStateError(f"Unsupported strategy '{strategy}'. Allowed: {allowed}.")
    return value


def _merge_state(raw: Any) -> Dict[str, Any]:
    state = dict(DEFAULT_STATE)
    if isinstance(raw, dict):
        state.update(raw)
    try:
        state["strategy"] = normalize_strategy(state.get("strategy", "auto"))
    except StrategyStateError:
        state["strategy"] = "auto"
        state["status"] = "recovered"
        state["message"] = "Recovered from invalid saved strategy."
    return state


def get_strategy_state(default: str = "auto") -> Dict[str, Any]:
    """Return the full state document with safe defaults."""
    if STATE_FILE.exists():
        try:
            with STATE_FILE.open("r", encoding="utf-8") as handle:
                return _merge_state(json.load(handle))
        except (OSError, json.JSONDecodeError):
            state = dict(DEFAULT_STATE)
            state["strategy"] = normalize_strategy(default)
            state["status"] = "recovered"
            state["message"] = "State file was unreadable; using safe default."
            return state

    state = dict(DEFAULT_STATE)
    state["strategy"] = normalize_strategy(default)
    return state


def _atomic_write(payload: Dict[str, Any]) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w",
        encoding="utf-8",
        dir=str(STATE_FILE.parent),
        delete=False,
    ) as handle:
        json.dump(payload, handle, indent=2, sort_keys=True)
        handle.write("\n")
        temp_name = handle.name
    os.replace(temp_name, STATE_FILE)


def set_strategy_state(
    strategy: str,
    *,
    updated_by: str = "dashboard",
    message: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Persist a strategy change and return the updated state."""
    normalized = normalize_strategy(strategy)
    previous = get_strategy_state()
    state = dict(previous)
    state.update(
        {
            "strategy": normalized,
            "previous_strategy": previous.get("strategy"),
            "updated_at": _now_iso(),
            "updated_by": updated_by,
            "version": int(previous.get("version") or 0) + 1,
            "mode": previous.get("mode", "paper"),
            "status": "strategy_switch_pending_bot_ack",
            "message": message or f"Strategy switch requested: {normalized}",
        }
    )
    if extra:
        state.update(extra)
    _atomic_write(state)
    return state


def acknowledge_strategy(strategy: Optional[str] = None, *, updated_by: str = "bot") -> Dict[str, Any]:
    """Let a running bot mark the current strategy as applied."""
    state = get_strategy_state()
    if strategy is not None:
        state["strategy"] = normalize_strategy(strategy)
    state["status"] = "active"
    state["bot_acknowledged_at"] = _now_iso()
    state["bot_acknowledged_by"] = updated_by
    state["message"] = f"Strategy active in runtime: {state['strategy']}"
    _atomic_write(state)
    return state


def get_current_strategy(default: str = "auto") -> str:
    """Backward-compatible helper used by older bot loops."""
    return get_strategy_state(default=default).get("strategy", default)


def set_current_strategy(strategy: str) -> bool:
    """Backward-compatible helper used by older dashboard code."""
    set_strategy_state(strategy)
    return True


def sync_strategy_to_bot(bot: Any, *, acknowledge: bool = True) -> Dict[str, Any]:
    """
    Apply the shared strategy to a running bot object when possible.

    Supported bot shapes are intentionally broad so this works with existing
    SovereignBot variants without forcing a rebuild:
    - bot.switch_strategy(strategy)
    - bot.set_strategy(strategy)
    - bot.strategy_manager.set_active_strategy(strategy)
    - bot.strategy_manager.switch_strategy(strategy)
    - bot.current_strategy = strategy
    """
    state = get_strategy_state()
    strategy = state["strategy"]

    if hasattr(bot, "switch_strategy") and callable(bot.switch_strategy):
        bot.switch_strategy(strategy)
    elif hasattr(bot, "set_strategy") and callable(bot.set_strategy):
        bot.set_strategy(strategy)
    elif hasattr(bot, "strategy_manager"):
        manager = bot.strategy_manager
        if hasattr(manager, "set_active_strategy") and callable(manager.set_active_strategy):
            manager.set_active_strategy(strategy)
        elif hasattr(manager, "switch_strategy") and callable(manager.switch_strategy):
            manager.switch_strategy(strategy)
        else:
            setattr(bot, "current_strategy", strategy)
    else:
        setattr(bot, "current_strategy", strategy)

    if acknowledge:
        state = acknowledge_strategy(strategy, updated_by="bot")
    return state
