# BTC Sovereign v1.2 - Simple Verification Script
# Run with: python verify.py

import time
import json
import os
from shared_state import set_current_strategy, get_current_strategy

print("Starting verification...")

# Test 1: Switch to Trend
print("\n[1] Switching to 'trend'...")
set_current_strategy("trend")
time.sleep(1)
current = get_current_strategy()
print(f"Current strategy after switch: {current}")
assert current == "trend", "Failed to switch to trend"

# Test 2: Switch to Breakout
print("\n[2] Switching to 'breakout'...")
set_current_strategy("breakout")
time.sleep(1)
current = get_current_strategy()
print(f"Current strategy after switch: {current}")
assert current == "breakout", "Failed to switch to breakout"

print("\nAll basic tests passed!")
print("Strategy switching is working at the shared state level.")