import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { createHandlers, PACK_PRICES, REFERRAL_REWARD } from "./handlers.ts";
import { MemoryStore } from "./store.ts";

const SECRET = "sk_test_123";
const setup = () => {
  const store = new MemoryStore();
  const h = createHandlers({ store, paystackSecretKey: SECRET, getUser: async (r) => (r.headers.get("x-user") ? { id: "u1", email: "a@b.com" } : null) });
  return { store, h };
};
const webhook = (body: object, secret = SECRET) => {
  const raw = JSON.stringify(body);
  return new Request("http://x/roadtrip/paystack/webhook", { method: "POST", body: raw, headers: { "x-paystack-signature": createHmac("sha512", secret).update(raw).digest("hex") } });
};
const charge = (reference: string, pack = "driver", amount = PACK_PRICES.driver * 100) => ({
  event: "charge.success",
  data: { reference, amount, currency: "NGN", status: "success", metadata: { game: "roadtrip", pack, player: "ABC234" } },
});

describe("credits", () => {
  it("records a signed Paystack payment once and hands it to the game once", async () => {
    const { h } = setup();
    expect((await h.paystackWebhook(webhook(charge("REF1")))).status).toBe(200);
    await h.paystackWebhook(webhook(charge("REF1"))); // Paystack retries: no double credit
    const first = await (await h.creditsClaim(new Request("http://x/c?player=ABC234"))).json();
    expect(first.purchases).toEqual([{ pack: "driver", receipt: "REF1" }]);
    const again = await (await h.creditsClaim(new Request("http://x/c?player=ABC234"))).json();
    expect(again.purchases).toEqual([]);
  });

  it("rejects forged signatures and underpaid amounts", async () => {
    const { h, store } = setup();
    expect((await h.paystackWebhook(webhook(charge("REF2"), "wrong"))).status).toBe(401);
    await h.paystackWebhook(webhook(charge("REF3", "chairman", 100)));
    expect(store.purchases.size).toBe(0);
  });
});

describe("referrals", () => {
  it("pays the inviter once per new player", async () => {
    const { h } = setup();
    const join = (player: string) => h.referralJoin(new Request("http://x", { method: "POST", body: JSON.stringify({ code: "INVITE", player }) }));
    await join("NEWONE");
    await join("NEWONE"); // same player again: ignored
    await join("NEWTWO");
    const claim = await (await h.referralClaim(new Request("http://x/r?code=INVITE"))).json();
    expect(claim).toEqual({ reward: 2 * REFERRAL_REWARD, joins: 2 });
    expect((await (await h.referralClaim(new Request("http://x/r?code=INVITE"))).json()).joins).toBe(0);
  });
});

describe("saves and points", () => {
  it("needs a signed-in user, caps points per event", async () => {
    const { h } = setup();
    expect((await h.getSave(new Request("http://x"))).status).toBe(401);
    const put = new Request("http://x", { method: "PUT", headers: { "x-user": "1" }, body: JSON.stringify({ save: { coins: 5 } }) });
    expect((await h.putSave(put)).status).toBe(200);
    expect((await (await h.getSave(new Request("http://x", { headers: { "x-user": "1" } }))).json()).save).toEqual({ coins: 5 });
    const pts = (delta: number) => h.addPoints(new Request("http://x", { method: "POST", headers: { "x-user": "1" }, body: JSON.stringify({ delta, reason: "hype" }) }));
    expect((await pts(500)).status).toBe(400);
    expect((await (await pts(10)).json()).points).toBe(10);
  });
});
