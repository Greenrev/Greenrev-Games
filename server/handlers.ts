/**
 * GreenRev Roadtrip backend. Each handler takes a standard Web `Request` and returns a `Response`,
 * so the same code runs in:
 *   - Next.js route handlers (app/api/roadtrip/.../route.ts):  export const GET = handlers.featured
 *   - a Node.js server (see node-server.ts), Express (via a small adapter), Hono, Fastify, etc.
 *
 * Endpoints (paths are up to you; these match node-server.ts)
 *   GET  /roadtrip/featured                    featured dealer cars for the hype system
 *   POST /roadtrip/referral/join               { code, player } a brand-new player joined with a code
 *   GET  /roadtrip/referral/claim?code=        → { reward, joins } unpaid invite rewards (then marked paid)
 *   GET  /roadtrip/topup?pack=&player=         starts a Paystack checkout and redirects to it
 *   POST /roadtrip/paystack/webhook            Paystack calls this; records confirmed purchases
 *   GET  /roadtrip/credits/claim?player=       → { purchases: [{ pack, receipt }] } (then marked claimed)
 *   GET  /roadtrip/save   PUT /roadtrip/save   cloud save for the signed-in GreenRev user
 *   GET  /roadtrip/points POST /roadtrip/points GreenRev Points shared with the marketplace and Business Suite
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { RoadtripStore } from "./store.ts";

/** Must match CREDIT_PACKS in src/game/economy.ts (price in naira). */
export const PACK_PRICES: Record<string, number> = { starter: 500, driver: 1_000, boss: 2_500, chairman: 5_000 };

/** In-game naira paid to the inviter for each friend who joined (must be > 0 to pay anything). */
export const REFERRAL_REWARD = 150_000;

export interface RoadtripServerOptions {
  store: RoadtripStore;
  paystackSecretKey?: string;          // sk_live_... / sk_test_...
  publicBaseUrl?: string;              // where Paystack sends the player back, e.g. https://www.greenrevs.com/roadtrip
  /** Your auth: return the signed-in GreenRev user's id and email, or null. */
  getUser?: (req: Request) => Promise<{ id: string; email: string } | null>;
  /** Origins allowed to call the API from the browser (the game's page). */
  allowedOrigins?: string[];
  fetchImpl?: typeof fetch;            // for tests
}

const CODE = /^[A-Z0-9]{4,10}$/;

export function createHandlers(opts: RoadtripServerOptions) {
  const { store } = opts;
  const doFetch = opts.fetchImpl ?? fetch;

  const json = (req: Request, data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...cors(req) } });

  const cors = (req: Request): Record<string, string> => {
    const origin = req.headers.get("origin");
    if (!origin || !(opts.allowedOrigins ?? []).includes(origin)) return {};
    return { "access-control-allow-origin": origin, "access-control-allow-credentials": "true", vary: "origin" };
  };

  const param = (req: Request, name: string) => new URL(req.url).searchParams.get(name) ?? "";

  return {
    async featured(req: Request) {
      return json(req, { cars: await store.listFeatured() });
    },

    async referralJoin(req: Request) {
      const body = (await req.json().catch(() => ({}))) as { code?: string; player?: string };
      const code = String(body.code ?? "").toUpperCase();
      const player = String(body.player ?? "").toUpperCase();
      if (!CODE.test(code) || !CODE.test(player)) return json(req, { error: "bad code" }, 400);
      const ok = await store.recordJoin(code, player);
      return json(req, { ok });
    },

    async referralClaim(req: Request) {
      const code = param(req, "code").toUpperCase();
      if (!CODE.test(code)) return json(req, { error: "bad code" }, 400);
      const joins = await store.unpaidJoins(code);
      if (joins > 0) await store.markJoinsPaid(code, joins);
      return json(req, { reward: joins * REFERRAL_REWARD, joins });
    },

    /** Starts a Paystack payment for a credit pack and redirects the player to it. */
    async topup(req: Request) {
      const pack = param(req, "pack");
      const player = param(req, "player").toUpperCase();
      const price = PACK_PRICES[pack];
      if (!price || !CODE.test(player)) return json(req, { error: "bad pack or player" }, 400);
      if (!opts.paystackSecretKey) return json(req, { error: "payments not configured" }, 503);
      const user = await opts.getUser?.(req);
      if (!user) return json(req, { error: "sign in to GreenRev first" }, 401);
      const res = await doFetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: { authorization: `Bearer ${opts.paystackSecretKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          amount: price * 100, // kobo
          currency: "NGN",
          callback_url: opts.publicBaseUrl,
          metadata: { game: "roadtrip", pack, player, userId: user.id },
        }),
      });
      const data = (await res.json().catch(() => null)) as { status?: boolean; data?: { authorization_url?: string } } | null;
      const url = data?.data?.authorization_url;
      if (!res.ok || !url) return json(req, { error: "could not start payment" }, 502);
      return Response.redirect(url, 302);
    },

    /**
     * Paystack webhook. Verifies the signature (HMAC-SHA512 of the raw body with your secret key),
     * checks the amount matches the pack, and records the purchase once.
     */
    async paystackWebhook(req: Request) {
      if (!opts.paystackSecretKey) return new Response("not configured", { status: 503 });
      const raw = await req.text();
      const sig = req.headers.get("x-paystack-signature") ?? "";
      const expected = createHmac("sha512", opts.paystackSecretKey).update(raw).digest("hex");
      if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return new Response("bad signature", { status: 401 });
      const event = JSON.parse(raw) as { event: string; data: { reference: string; amount: number; currency: string; status: string; metadata?: Record<string, string> } };
      if (event.event !== "charge.success" || event.data.status !== "success") return new Response("ignored", { status: 200 });
      const { pack, player, game } = event.data.metadata ?? {};
      const price = PACK_PRICES[pack ?? ""];
      if (game !== "roadtrip" || !price || !CODE.test(player ?? "")) return new Response("not a roadtrip purchase", { status: 200 });
      if (event.data.currency !== "NGN" || event.data.amount < price * 100) return new Response("amount mismatch", { status: 200 });
      await store.recordPurchase({ receipt: event.data.reference, player: player!, pack: pack!, amountKobo: event.data.amount, provider: "paystack", createdAt: new Date().toISOString(), claimed: false });
      return new Response("ok", { status: 200 });
    },

    /** The game asks for confirmed purchases; each is handed over once. */
    async creditsClaim(req: Request) {
      const player = param(req, "player").toUpperCase();
      if (!CODE.test(player)) return json(req, { error: "bad player" }, 400);
      const list = await store.unclaimedPurchases(player);
      await store.markClaimed(list.map((p) => p.receipt));
      return json(req, { purchases: list.map((p) => ({ pack: p.pack, receipt: p.receipt })) });
    },

    async getSave(req: Request) {
      const user = await opts.getUser?.(req);
      if (!user) return json(req, { error: "sign in" }, 401);
      return json(req, { save: await store.getSave(user.id) });
    },

    async putSave(req: Request) {
      const user = await opts.getUser?.(req);
      if (!user) return json(req, { error: "sign in" }, 401);
      const raw = await req.text();
      if (raw.length > 200_000) return json(req, { error: "save too large" }, 413);
      const body = JSON.parse(raw || "{}") as { save?: unknown };
      await store.putSave(user.id, body.save ?? null);
      return json(req, { ok: true });
    },

    async getPoints(req: Request) {
      const user = await opts.getUser?.(req);
      if (!user) return json(req, { error: "sign in" }, 401);
      return json(req, { points: await store.getPoints(user.id) });
    },

    /**
     * Earn GreenRev Points from the game. Capped per call so a tampered client can't mint points;
     * the marketplace and Business Suite read and spend the same balance.
     */
    async addPoints(req: Request) {
      const user = await opts.getUser?.(req);
      if (!user) return json(req, { error: "sign in" }, 401);
      const body = (await req.json().catch(() => ({}))) as { delta?: number; reason?: string };
      const delta = Math.round(Number(body.delta) || 0);
      if (delta <= 0 || delta > 50) return json(req, { error: "points must be 1–50 per event" }, 400);
      return json(req, { points: await store.addPoints(user.id, delta, String(body.reason ?? "game").slice(0, 60)) });
    },

    preflight(req: Request) {
      return new Response(null, { status: 204, headers: { ...cors(req), "access-control-allow-methods": "GET,POST,PUT,OPTIONS", "access-control-allow-headers": "content-type" } });
    },
  };
}

export type RoadtripHandlers = ReturnType<typeof createHandlers>;
