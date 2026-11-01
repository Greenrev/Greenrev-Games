import { describe, expect, it } from "vitest";
import * as E from "../src/game/economy.ts";
import { contractOffers, settleContract, targetSeconds } from "../src/game/contracts.ts";
import { ROUTES } from "../src/data/routes.ts";
import { planLeg } from "../src/game/director.ts";
import * as S from "../src/game/state.ts";

describe("money", () => {
  it("fines go into the red; extras need cash; repairs stop at the overdraft limit", () => {
    const s = S.newState();
    s.coins = 10_000;
    expect(E.charge(s, 25_000, "fines", "must")).toMatchObject({ ok: true, intoDebt: true });
    expect(s.coins).toBe(-15_000);
    expect(E.charge(s, 5_000, "upgrades", "cash").ok).toBe(false);
    const limit = E.overdraftLimit(s);
    expect(E.charge(s, limit, "repairs", "overdraft").ok).toBe(false);
    expect(E.charge(s, 1_000, "repairs", "overdraft").ok).toBe(true);
  });

  it("records what a trip earned and spent", () => {
    const s = S.newState();
    E.startLedger(s, "lagos-abuja");
    E.earn(s, 100_000, "trip pay");
    E.charge(s, 30_000, "fuel", "overdraft");
    const t = E.tripSummary(s, 600);
    expect(t).toMatchObject({ earned: 100_000, spent: 30_000, net: 70_000 });
    expect(t.end - t.start).toBe(70_000);
  });

  it("loans: limit, interest per leg, automatic repayment", () => {
    const s = S.newState();
    expect(E.takeLoan(s, "large").ok).toBe(false); // above a new player's limit
    expect(E.takeLoan(s, "small").ok).toBe(true);
    const before = E.loanBalance(s);
    const out = E.settleLeg(s, 200_000);
    expect(out.loanInterest).toBe(Math.round(before * 0.03));
    expect(out.autoRepaid).toBe(50_000);
    expect(E.loanBalance(s)).toBe(before + out.loanInterest - 50_000);
  });

  it("a negative wallet pays an overdraft fee each leg", () => {
    const s = S.newState();
    s.coins = -100_000;
    expect(E.settleLeg(s, 0).overdraftFee).toBe(5_000);
    expect(s.coins).toBe(-105_000);
  });

  it("grants a credit purchase only once per receipt", () => {
    const s = S.newState();
    const c = s.coins;
    expect(E.grantCredits(s, "driver", "PSK_1").ok).toBe(true);
    expect(E.grantCredits(s, "driver", "PSK_1").ok).toBe(false);
    expect(E.grantCredits(s, "nope", "PSK_2").ok).toBe(false);
    expect(s.coins).toBe(c + 2_500_000);
  });
});

describe("contracts", () => {
  const route = ROUTES[0];

  it("offers three different jobs, the same for everyone on a day", () => {
    const a = contractOffers(route, "2026-11-01");
    expect(a).toHaveLength(3);
    expect(new Set(a.map((o) => o.type)).size).toBe(3);
    expect(contractOffers(route, "2026-11-01")).toEqual(a);
    expect(contractOffers(route, "2026-11-01", { pay: 1.45, speed: 23 })[0].pay).toBeGreaterThan(a[0].pay);
  });

  it("pays more for a clean, fast run", () => {
    const base = { id: "x", icon: "", title: "", blurb: "", pay: 500_000, bonus: 400_000, target: 900 };
    const clean = { seconds: 800, crashes: 0, potholes: 0, hardBrakes: 0, fines: 0 };
    const rough = { seconds: 1100, crashes: 2, potholes: 10, hardBrakes: 6, fines: 1 };
    for (const type of ["passengers", "express", "fragile", "vip"]) {
      const c = { ...base, type };
      expect(settleContract(c, clean).pay).toBeGreaterThan(settleContract(c, rough).pay);
    }
    expect(settleContract({ ...base, type: "vip" }, clean).pay).toBe(900_000);
    expect(settleContract({ ...base, type: "express" }, { ...clean, seconds: 1000 }).pay).toBe(250_000);
  });

  it("par time grows with distance and shrinks at higher speed", () => {
    expect(targetSeconds(ROUTES[0])).toBeGreaterThan(targetSeconds(ROUTES[2]));
    expect(targetSeconds(ROUTES[0], 23)).toBeLessThan(targetSeconds(ROUTES[0], 19));
  });
});

describe("new road challenges", () => {
  it("plans tolls on tolled roads and more events on harder levels", () => {
    const leg = ROUTES[0].legs[0];
    expect(planLeg(leg, 1).events.some((e) => e.type === "toll")).toBe(true);
    let easy = 0, hard = 0;
    for (let i = 0; i < 40; i++) {
      easy += planLeg(leg, i, { potholes: 0.6, events: 0.6 }).potholes.length;
      hard += planLeg(leg, i, { potholes: 1.5, events: 1.5 }).potholes.length;
    }
    expect(hard).toBeGreaterThan(easy);
  });

  it("every new event type shows up somewhere across the routes", () => {
    const seen = new Set();
    for (const r of ROUTES) r.legs.forEach((l, i) => { for (let k = 0; k < 6; k++) for (const e of planLeg(l, `${r.id}-${i}-${k}`).events) seen.add(e.type); });
    for (const t of ["toll", "agbero", "diversion", "flood", "wrongway", "bumps"]) expect(seen.has(t)).toBe(true);
  });
});
