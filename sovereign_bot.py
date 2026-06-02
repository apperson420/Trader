# BTC Sovereign v1.4 - Runtime Strategy Sync Bot
"""
Real runtime bridge for dashboard strategy switching.

This is intentionally paper/research-first. It does not place broker orders.
Its job is to keep a running SovereignBot runtime synchronized with the
dashboard-selected strategy in shared_state.py.
"""

from __future__ import annotations

import json
import signal
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Optional

import shared_state


@dataclass
class StrategyManager:
    """Minimal production-minded strategy manager for active strategy state."""

    active_strategy: str = "auto"
    history: list[Dict[str, Any]] = field(default_factory=list)

    def set_active_strategy(self, strategy: str) -> None:
        normalized = shared_state.normalize_strategy(strategy)
        if normalized == self.active_strategy:
            return
        self.history.append(
            {
                "time": time.time(),
                "previous_strategy": self.active_strategy,
                "new_strategy": normalized,
            }
        )
        self.active_strategy = normalized

    def switch_strategy(self, strategy: str) -> None:
        self.set_active_strategy(strategy)


class SovereignBot:
    """
    Paper-safe runtime shell that consumes dashboard strategy changes.

    If a richer backend StrategyManager is added later, this class can wrap it
    without changing the dashboard contract.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None) -> None:
        self.config = config or {}
        runtime_config = self.config.get("runtime", {})
        self.poll_seconds = float(runtime_config.get("strategy_poll_seconds", 1.0))
        initial_strategy = shared_state.get_current_strategy(
            self.config.get("default_strategy", "auto")
        )
        self.strategy_manager = StrategyManager(active_strategy=initial_strategy)
        self.current_strategy = initial_strategy
        self.running = False
        self.last_seen_version = 0

    def switch_strategy(self, strategy: str) -> None:
        self.strategy_manager.set_active_strategy(strategy)
        self.current_strategy = self.strategy_manager.active_strategy

    def set_strategy(self, strategy: str) -> None:
        self.switch_strategy(strategy)

    def sync_once(self) -> Dict[str, Any]:
        """Apply the latest dashboard strategy once and return shared state."""
        state = shared_state.get_strategy_state(default=self.current_strategy)
        requested_strategy = state["strategy"]
        requested_version = int(state.get("version") or 0)

        if requested_strategy != self.current_strategy or requested_version != self.last_seen_version:
            self.switch_strategy(requested_strategy)
            self.last_seen_version = requested_version
            state = shared_state.acknowledge_strategy(
                self.current_strategy,
                updated_by="SovereignBot",
            )
        else:
            state = shared_state.record_runtime_heartbeat(
                bot_strategy=self.current_strategy,
                bot_status="running",
                message=f"SovereignBot running with strategy: {self.current_strategy}",
            )
        return state

    def snapshot(self) -> Dict[str, Any]:
        return {
            "running": self.running,
            "current_strategy": self.current_strategy,
            "poll_seconds": self.poll_seconds,
            "last_seen_version": self.last_seen_version,
            "strategy_history": self.strategy_manager.history[-25:],
            "mode": self.config.get("mode", "paper"),
        }

    def run_forever(self) -> None:
        """Run until Ctrl+C or process stop."""
        self.running = True
        shared_state.record_runtime_heartbeat(
            bot_strategy=self.current_strategy,
            bot_status="starting",
            message="SovereignBot runtime starting.",
        )

        stop_requested = {"value": False}

        def _stop(_signum: int, _frame: Any) -> None:
            stop_requested["value"] = True

        previous_sigint = signal.getsignal(signal.SIGINT)
        previous_sigterm = signal.getsignal(signal.SIGTERM)
        signal.signal(signal.SIGINT, _stop)
        signal.signal(signal.SIGTERM, _stop)

        try:
            while not stop_requested["value"]:
                self.sync_once()
                time.sleep(max(0.25, self.poll_seconds))
        finally:
            self.running = False
            shared_state.mark_runtime_stopped("SovereignBot runtime stopped.")
            signal.signal(signal.SIGINT, previous_sigint)
            signal.signal(signal.SIGTERM, previous_sigterm)


def load_config(path: str | Path = "config.json") -> Dict[str, Any]:
    """Load config.json if present; return safe paper defaults otherwise."""
    config_path = Path(path)
    default = {
        "mode": "paper",
        "default_strategy": "auto",
        "runtime": {"strategy_poll_seconds": 1.0},
        "dashboard": {"host": "127.0.0.1", "port": 5055},
    }
    if not config_path.exists():
        return default
    try:
        with config_path.open("r", encoding="utf-8") as handle:
            loaded = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return default
    if isinstance(loaded, dict):
        merged = dict(default)
        merged.update(loaded)
        merged["runtime"] = {**default["runtime"], **loaded.get("runtime", {})}
        merged["dashboard"] = {**default["dashboard"], **loaded.get("dashboard", {})}
        return merged
    return default
