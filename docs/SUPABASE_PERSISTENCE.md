# Supabase Persistence Setup

Trader Command Center works without Supabase. The default storage is the browser localStorage fallback, and the in-app backup panel can export/import a full JSON backup.

Supabase sync is optional and server-side only. Do not paste service keys into browser JavaScript.

## Vercel Environment Variables

Add these in Vercel, then redeploy:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- Optional: `TRADER_PERSISTENCE_KEY`
- Optional: `TRADER_PERSISTENCE_TABLE` if you do not use `trader_persistence`

## Table

Run this in Supabase SQL editor:

```sql
create table if not exists trader_persistence (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
```

The saved payload contains paper/research app memory only: watchlist, journal, checks, paper outcomes, playbooks, AI plans, broker audit logs, validation/evolution reports, chart proof, market logs, and real results reports.

No real-money trading is enabled by this setup.
