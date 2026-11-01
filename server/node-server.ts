/**
 * Plain Node.js server for the Roadtrip API (no dependencies). Good for local development and as a
 * reference for wiring the handlers into your existing Node backend.
 *
 *   PAYSTACK_SECRET_KEY=sk_test_... node server/node-server.ts      (Node 22.18+ runs TypeScript)
 */
import { createServer } from "node:http";
import { createHandlers } from "./handlers.ts";
import { MemoryStore } from "./store.ts";

const store = new MemoryStore();
const h = createHandlers({
  store,
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY,
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "http://localhost:5173",
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173").split(","),
  // Replace with your GreenRev session lookup. This dev stub trusts an x-user header.
  getUser: async (req) => {
    const id = req.headers.get("x-user");
    return id ? { id, email: `${id}@example.com` } : null;
  },
});

const routes: Record<string, (req: Request) => Promise<Response> | Response> = {
  "GET /roadtrip/featured": h.featured,
  "POST /roadtrip/referral/join": h.referralJoin,
  "GET /roadtrip/referral/claim": h.referralClaim,
  "GET /roadtrip/topup": h.topup,
  "POST /roadtrip/paystack/webhook": h.paystackWebhook,
  "GET /roadtrip/credits/claim": h.creditsClaim,
  "GET /roadtrip/save": h.getSave,
  "PUT /roadtrip/save": h.putSave,
  "GET /roadtrip/points": h.getPoints,
  "POST /roadtrip/points": h.addPoints,
};

export function route(req: Request): Promise<Response> | Response {
  const { pathname } = new URL(req.url);
  if (req.method === "OPTIONS") return h.preflight(req);
  const fn = routes[`${req.method} ${pathname}`];
  return fn ? fn(req) : new Response("not found", { status: 404 });
}

// Node http <-> Web Request/Response
const server = createServer(async (nreq, nres) => {
  const chunks: Buffer[] = [];
  for await (const c of nreq) chunks.push(c as Buffer);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const req = new Request(`http://${nreq.headers.host}${nreq.url}`, {
    method: nreq.method,
    headers: nreq.headers as Record<string, string>,
    body: nreq.method === "GET" || nreq.method === "HEAD" ? undefined : body,
  });
  const res = await route(req);
  nres.writeHead(res.status, Object.fromEntries(res.headers));
  nres.end(Buffer.from(await res.arrayBuffer()));
});

if (process.argv[1]?.endsWith("node-server.ts")) {
  const port = Number(process.env.PORT ?? 8787);
  server.listen(port, () => console.log(`Roadtrip API on http://localhost:${port}`));
}
