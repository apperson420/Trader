# BTC Sovereign Assistant

The BTC Sovereign dashboard assistant is a local, paper-safe helper for explaining system status. It is not a trader, broker, or financial advisor.

## What it can do

- Explain current dashboard status.
- Explain whether the bot is running.
- Explain whether a paper strategy has been applied or is pending acknowledgement.
- Explain Paper Safe risk labels.
- Suggest the next safe system check.
- Optionally use a local Ollama model for richer wording when explicitly enabled in `config.json`.

## What it cannot do

- Place trades.
- Buy or sell BTC.
- Enable live trading.
- Switch strategies on behalf of the user.
- Access credentials, secrets, broker keys, `.env` files, or unrelated folders.
- Change broker settings.
- Guarantee profits or provide certain financial advice.

## AI-2 optional Ollama support

Ollama is disabled by default. The rule-based assistant remains the fallback.

To enable local model wording after Ollama is installed and running, update `config.json`:

```json
"assistant": {
  "use_ollama": true,
  "ollama": {
    "model": "llama3",
    "url": "http://127.0.0.1:11434/api/generate",
    "timeout_seconds": 8.0
  }
}
```

Safety still works the same way:

1. The safety filter checks the user message first.
2. Unsafe requests are blocked before any model call.
3. The model receives only the small safe dashboard context.
4. If Ollama is unavailable, the assistant falls back to rule-based local answers.

Local model support is for explanation only. It must never be used for live trading, broker actions, secret access, or autonomous strategy changes.
