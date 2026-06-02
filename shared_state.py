# BTC Sovereign v1.2 - Simple Shared State

import json
import os

STATE_FILE = 'current_strategy.json'

def get_current_strategy(default='auto'):
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, 'r') as f:
                data = json.load(f)
            return data.get('strategy', default)
        except:
            pass
    return default

def set_current_strategy(strategy):
    with open(STATE_FILE, 'w') as f:
        json.dump({'strategy': strategy}, f)
    return True