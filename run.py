# BTC Sovereign v1.4 - Unified Launcher
"""
Beginner-friendly launcher.

Commands:
  python run.py dashboard   # web dashboard only
  python run.py bot         # strategy-sync runtime only
  python run.py all         # dashboard + runtime together
  python run.py status      # print current shared strategy state
"""

from __future__ import annotations

import argparse
import json
import threading
from typing import Any, Dict

import shared_state
from sovereign_bot import SovereignBot, load_config
from web_dashboard.app import app as dashboard_app


def print_json(payload: Dict[str, Any]) -> None:
    print(json.dumps(payload, indent=2, sort_keys=True))


def run_dashboard(config: Dict[str, Any]) -> None:
    dashboard = config.get("dashboard", {})
    host = dashboard.get("host", "127.0.0.1")
    port = int(dashboard.get("port", 5055))
    print(f"BTC Sovereign dashboard: http://{host}:{port}")
    dashboard_app.run(host=host, port=port, debug=False, threaded=True)


def run_bot(config: Dict[str, Any]) -> None:
    bot = SovereignBot(config)
    print("SovereignBot runtime started in paper-safe strategy-sync mode.")
    print("Use the dashboard strategy buttons to change the active strategy.")
    bot.run_forever()


def run_all(config: Dict[str, Any]) -> None:
    thread = threading.Thread(target=run_bot, args=(config,), daemon=True)
    thread.start()
    run_dashboard(config)


def main() -> None:
    parser = argparse.ArgumentParser(description="BTC Sovereign unified launcher")
    parser.add_argument(
        "command",
        choices=("dashboard", "bot", "all", "status"),
        nargs="?",
        default="all",
        help="What to launch. Default: all.",
    )
    parser.add_argument(
        "--config",
        default="config.json",
        help="Path to config.json. Default: config.json",
    )
    args = parser.parse_args()

    config = load_config(args.config)

    if config.get("mode", "paper") != "paper":
        raise SystemExit(
            "Safety stop: this launcher currently supports paper mode only. "
            "Real-money mode needs explicit broker approval gates first."
        )

    if args.command == "status":
        print_json(shared_state.get_strategy_state())
    elif args.command == "dashboard":
        run_dashboard(config)
    elif args.command == "bot":
        run_bot(config)
    else:
        run_all(config)


if __name__ == "__main__":
    main()
