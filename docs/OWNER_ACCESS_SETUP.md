# Owner Access Setup

Trader Command Center can run on a public Vercel URL, so private setup features should be protected before you use cloud backup or broker endpoints.

## Add an owner code in Vercel

In Vercel Project Settings, add this Environment Variable:

```text
TRADER_OWNER_ACCESS_CODE=choose-a-long-private-code
```

Redeploy after adding it.

## How it works

The app shows an Owner Access Center near the top of the page.

When the server variable is configured:

- enter the owner code in the Owner Access Center
- the code is kept in browser session storage only
- it is not included in app backups
- cloud persistence can require the code
- paper broker setup/status/order endpoints can require the code

## What it does not protect by itself

Owner Access is a lightweight private-use gate, not a full user account system.

For a sellable/public product, add full authentication, user accounts, per-user database rows, rate limits, audit logs, and terms/risk acceptance.

## Safe default

If no owner code is configured, the app still works locally with browser storage. Optional broker and cloud integrations remain controlled by their own server-side environment variables and safety gates.
