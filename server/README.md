# Roadtrip API (Node.js, TypeScript)

Request handlers for the game's online features. They use the standard Web `Request`/`Response`, so
they run in Next.js route handlers (see `nextjs/`) or any Node.js server (see `node-server.ts`).
No dependencies beyond Node itself.

```bash
npm run api            # local server on :8787 with an in-memory store
npm test               # includes server/server.test.ts
```

| Endpoint | What it does | Game setting |
|---|---|---|
| `GET /roadtrip/featured` | Featured dealer cars for the hype system | `featured.url` |
| `POST /roadtrip/referral/join` | `{ code, player }`: a brand-new player joined with an invite | `referral.joinUrl` |
| `GET /roadtrip/referral/claim?code=` | Unpaid invite rewards → `{ reward, joins }`, then marked paid | `referral.claimUrl` |
| `GET /roadtrip/topup?pack=&player=` | Starts a Paystack checkout for a credit pack (needs sign-in) | `credits.checkoutUrl` |
| `POST /roadtrip/paystack/webhook` | Paystack confirms payment; signature and amount are checked | (Paystack dashboard) |
| `GET /roadtrip/credits/claim?player=` | Confirmed purchases → `{ purchases }`, each handed over once | `credits.claimUrl` |
| `GET`/`PUT /roadtrip/save` | Cloud save for the signed-in user | `cloud.saveUrl` |
| `GET`/`POST /roadtrip/points` | GreenRev Points, max 50 per event | `cloud.pointsUrl` |

## Production checklist

- Replace `MemoryStore` with a database implementation of `RoadtripStore` (`store.ts`).
- Replace the dev `getUser` stub in `node-server.ts` with your GreenRev session lookup.
- Set `PAYSTACK_SECRET_KEY` and add the webhook URL in the Paystack dashboard.
- Keep `PACK_PRICES` in `handlers.ts` in step with `CREDIT_PACKS` in `src/game/economy.ts`.
- Credits are game money only and can never be withdrawn. Keep it that way so the game stays clear of
  gambling and payments rules.
- Store apps: verify Apple/Google receipts server-side and record them with `store.recordPurchase`.
