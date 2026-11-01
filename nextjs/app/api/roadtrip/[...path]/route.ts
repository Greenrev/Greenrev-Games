/**
 * Roadtrip API as a Next.js route handler: /api/roadtrip/<endpoint>.
 * If the API lives in your separate Node backend instead, mount server/handlers.ts there and point
 * the URLs in app/roadtrip/page.tsx at it.
 */
import { createHandlers } from "greenrev-roadtrip/server";
import { store } from "@/lib/roadtrip-store"; // your RoadtripStore (database-backed)
import { getSessionUser } from "@/lib/auth"; // your auth: returns { id, email } or null

const h = createHandlers({
  store,
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY,
  publicBaseUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/roadtrip`,
  getUser: getSessionUser,
});

const GET_ROUTES: Record<string, (req: Request) => Promise<Response>> = {
  featured: h.featured,
  "referral/claim": h.referralClaim,
  topup: h.topup,
  "credits/claim": h.creditsClaim,
  save: h.getSave,
  points: h.getPoints,
};
const POST_ROUTES: Record<string, (req: Request) => Promise<Response>> = {
  "referral/join": h.referralJoin,
  "paystack/webhook": h.paystackWebhook,
  points: h.addPoints,
};

type Ctx = { params: Promise<{ path: string[] }> };
const pick = async (table: Record<string, (req: Request) => Promise<Response>>, req: Request, ctx: Ctx) => {
  const key = (await ctx.params).path.join("/");
  return table[key]?.(req) ?? new Response("not found", { status: 404 });
};

export const GET = (req: Request, ctx: Ctx) => pick(GET_ROUTES, req, ctx);
export const POST = (req: Request, ctx: Ctx) => pick(POST_ROUTES, req, ctx);
export const PUT = (req: Request, ctx: Ctx) => pick({ save: h.putSave }, req, ctx);
