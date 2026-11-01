# Using GreenRev Roadtrip in the Next.js app

The game ships as an ES module (`mountRoadtrip`) plus a stylesheet. These files show how to put it
on a route in the GreenRev Next.js app, with the API as a route handler.

## 1. Build and install the game package

In this repo:

```bash
npm install
npm run build:lib      # → dist-lib/greenrev-roadtrip.js + greenrev-roadtrip.css
```

In the Next.js app, install it from the repo (or publish it to a private registry):

```bash
npm install three ../gaming/greenrev-roadtrip    # path to this folder
```

`three` is a peer the app provides. Because the API handlers are TypeScript source, tell Next.js to
compile the package:

```js
// next.config.mjs
export default { transpilePackages: ["greenrev-roadtrip"] };
```

## 2. Copy these files into the app

| File | Goes to |
|---|---|
| `components/RoadtripGame.tsx` | `components/RoadtripGame.tsx` (client component; loads the game in an effect) |
| `app/roadtrip/page.tsx` | `app/roadtrip/page.tsx` (full-screen route at `/roadtrip`) |
| `app/api/roadtrip/[...path]/route.ts` | same path (the API; skip if your separate Node backend serves it) |

Copy `public/voice/` and `public/music/` from this repo to `public/roadtrip/voice/` and
`public/roadtrip/music/` in the app.

## 3. Wire your parts

- `@/lib/auth` → `getSessionUser(req)`: return `{ id, email }` for the signed-in GreenRev user, or `null`.
- `@/lib/roadtrip-store` → a `RoadtripStore` backed by your database (interface in `server/store.ts`;
  `MemoryStore` there is a working reference).
- Environment: `PAYSTACK_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL`.
- In the Paystack dashboard, set the webhook URL to `https://<your-site>/api/roadtrip/paystack/webhook`.

## Notes

- The game is full-screen and browser-only. It never renders on the server, and `destroy()` runs when
  the route unmounts (React Strict Mode mounts twice in development; that's handled).
- The stylesheet styles `html` and `body` for a full-screen game. Keep the game on its own route.
- Inside the iOS and Android store apps, Apple and Google require their in-app purchase systems for
  game credits. Verify those receipts in your backend and call `store.recordPurchase(...)` with
  `provider: "apple" | "google"`; the game claims them the same way.
