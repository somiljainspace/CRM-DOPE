# Browser SDK (Phase 3A)

## Installation

```bash
npm install @cdp/browser-sdk
```

## Initialization

```js
import { init } from '@cdp/browser-sdk';

const cdp = init({
  key: 'pk_test_...',      // publishable browser key (pk_ prefix)
  endpoint: 'https://api.example.com/v1/track/batch',
  consent: false,          // default: no collection until optIn()
  batchSize: 10,           // conservative default
});
```

- The key **must** start with `pk_`. Secret `sk_` keys are rejected at init.
- Consent defaults to **off**. No events are sent and no anonymous ID is
  created until `optIn()` is called.

## Consent

- `optIn()` — enables collection, creates the anonymous ID, starts the flush timer.
- `optOut()` — stops collection, clears the in-memory queue, stops the timer.

Each integrating company is responsible for obtaining the consent required by
its product and jurisdiction.

## API

| Method | Behavior |
|---|---|
| `track({ event, properties })` | Queues a custom event (e.g. `product_viewed`, `search_performed`, `add_to_cart`) |
| `identify({ userId, traits })` | Associates subsequent events with an app user ID |
| `reset()` | Clears the identified user and generates a new anonymous ID |
| `flush()` | Sends the queued batch immediately |

## Batching

- Bounded in-memory queue (default 10 events, max 50).
- Flushes on timer, when the batch is full, or on demand via `flush()`.
- Uses `POST /v1/track/batch` with `Authorization: Bearer pk_...`.
- Event IDs are preserved across retries; only transient failures are retried.
- 400/401/403/409/429/5xx are handled distinctly (no infinite retry).

## Identity

- Anonymous ID: `crypto.randomUUID()`, created only after `optIn()`.
- No canvas/font/hardware fingerprinting.
- No passwords, tokens, or payment data are ever stored or sent.

## Security limitations

- A `pk_` key is **publishable and extractable** from browser JavaScript.
  It is a limited identifier, not a secret. CORS is not authentication.
- The server resolves tenant/project/environment from the stored key record —
  never from client-supplied tenant IDs.
- Browser keys grant **event ingestion only**; they cannot log in or access
  `/v1/control/*`.
- Browser keys must not be used for authoritative financial events (verified
  payments, refunds); those belong to the customer's trusted backend.

## Local development

1. `npm run db:up`
2. Apply migrations (including `005_browser_keys.sql`)
3. Create a browser key via `POST /v1/control/browser-keys` (OWNER/ADMIN)
4. `cd packages/browser-sdk && npm run build`
