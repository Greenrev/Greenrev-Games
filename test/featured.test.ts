import { describe, expect, it } from "vitest";
import { activeFeatured, HYPE_LINES, hypeScore, listingTarget, SAMPLE_FEATURED, saveDream } from "../src/game/featured.ts";
import { VOICE_LINES } from "../src/game/voice.ts";
import * as S from "../src/game/state.ts";

const car = (o = {}) => ({ id: "a", dealer: "Ikoyi Autos", title: "Luxury saloon", body: "limo", color: "#000", ...o });

describe("featured dealer cars", () => {
  it("uses live, in-date listings and falls back to samples", () => {
    expect(activeFeatured([], "2026-11-02")).toBe(SAMPLE_FEATURED);
    const live = [car(), car({ id: "b", start: "2026-12-01" }), car({ id: "c", end: "2026-10-01" }), car({ id: "d", body: "bus" }), { id: "e", body: "limo" }];
    expect(activeFeatured(live, "2026-11-02").map((c) => c.id)).toEqual(["a"]);
  });

  it("pays more for quick hype and rarer cars", () => {
    expect(hypeScore("coupe", 1)).toBeGreaterThan(hypeScore("coupe", 5));
    expect(hypeScore("coupe", 5)).toBeGreaterThan(hypeScore("luxsuv", 5));
  });

  it("links to the listing, or searches the marketplace without one", () => {
    expect(listingTarget(car({ listingUrl: "https://www.greenrevs.com/shop/1" }))).toEqual({ url: "https://www.greenrevs.com/shop/1" });
    expect(listingTarget(car())).toEqual({ marketplace: true, query: "Luxury saloon" });
  });

  it("saves each car to the dream garage once", () => {
    const s = S.newState();
    expect(saveDream(s, car())).toBe(true);
    expect(saveDream(s, car())).toBe(false);
    expect(s.dreamGarage).toHaveLength(1);
  });

  it("never names a car brand in hype lines", () => {
    const brands = /rolls|royce|benz|mercedes|amg|bmw|bentley|lambo|ferrari|lexus|porsche|range rover|g-?wagon|toyota/i;
    for (const l of HYPE_LINES) expect(brands.test(l.text)).toBe(false);
    for (const l of HYPE_LINES) expect(VOICE_LINES[l.key]).toBe(l.text);
  });
});

describe("paint shop", () => {
  it("only accepts colours from the paint list", () => {
    const s = S.newState();
    expect(S.setPaint(s, "corolla", S.PAINTS[0].hex)).toBe(true);
    expect(s.paint.corolla).toBe(S.PAINTS[0].hex);
    expect(S.setPaint(s, "corolla", "#123456")).toBe(false);
  });

  it("old saves load with the new fields", () => {
    const store = new Map([[S.SAVE_KEY, JSON.stringify({ coins: 5, settings: { sound: false } })]]);
    const s = S.load({ getItem: (k) => store.get(k) ?? null });
    expect(s.dreamGarage).toEqual([]);
    expect(s.hype).toBe(0);
    expect(s.settings.voice).toBe(true);
    expect(s.settings.sound).toBe(false);
  });
});

import { acceptInvite, ensureReferral, inviteUrl, makeCode, parseInvite, settleChallenge } from "../src/game/referral.ts";

describe("invites and challenges", () => {
  it("builds and reads invite and challenge links", () => {
    expect(inviteUrl("https://greenrevs.com/roadtrip?x=1#old", "ABC234")).toBe("https://greenrevs.com/roadtrip?x=1#ref-ABC234");
    const ch = inviteUrl("https://greenrevs.com/roadtrip", "ABC234", { routeId: "lagos-abuja", seconds: 754.4 });
    expect(parseInvite(ch.split("#")[1])).toEqual({ ref: "ABC234", challenge: { routeId: "lagos-abuja", seconds: 754 } });
    expect(parseInvite("", "?ref=abc234")).toEqual({ ref: "ABC234", challenge: null });
    expect(parseInvite("#garage")).toBeNull();
    expect(makeCode()).toHaveLength(6);
  });

  it("gives a new player the welcome bonus once, never for their own code", () => {
    const s = S.newState();
    const own = ensureReferral(s).code;
    const coins = s.coins;
    expect(acceptInvite(s, { ref: own, challenge: null }, 200_000).welcomed).toBe(false);
    expect(acceptInvite(s, { ref: "FRND22", challenge: null }, 200_000).welcomed).toBe(true);
    expect(acceptInvite(s, { ref: "OTHER2", challenge: null }, 200_000).welcomed).toBe(false);
    expect(s.coins).toBe(coins + 200_000);
    expect(s.referral.invitedBy).toBe("FRND22");
  });

  it("settles a friend's challenge when that journey is finished", () => {
    const s = S.newState();
    acceptInvite(s, { ref: "FRND22", challenge: { routeId: "lagos-abuja", seconds: 600 } }, 0);
    expect(settleChallenge(s, "lagos-calabar", 500)).toBeNull();
    expect(settleChallenge(s, "lagos-abuja", 550)).toMatchObject({ won: true, seconds: 600 });
    expect(s.challenge).toBeNull();
  });
});
