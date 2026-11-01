/**
 * Contracts: the job you take for a journey. Each one pays for the whole route and has its own
 * condition, so every trip is a race for money:
 *
 *   passengers  pay + tips; every pothole, hard brake and crash upsets the passengers
 *   express     big pay for beating the clock; late delivery halves it
 *   fragile     crates of tomatoes or eggs; every pothole breaks some
 *   vip         a chief's pickup; any crash or fine loses the big bonus
 *
 * Offers are deterministic per route and day, so friends see the same jobs.
 */
import { legLengthMeters } from "../data/routes.ts";
import { rng } from "./rng.ts";

const REST_ALLOWANCE = 45; // seconds per leg for stops, checkpoints and go-slow

/** Par time for a route at a difficulty's average speed. */
export function targetSeconds(route, avgSpeed = 21) {
  const metres = route.legs.reduce((a, l) => a + legLengthMeters(l.km), 0);
  return Math.round((metres / avgSpeed) * 1.15 + route.legs.length * REST_ALLOWANCE);
}

const TEMPLATES = {
  passengers: {
    icon: "🚐", title: "Full load of passengers",
    blurb: (to) => `14 passengers to ${to}. They tip for a smooth ride; potholes and crashes cost you.`,
    rate: 1_300,
  },
  express: {
    icon: "📦", title: "Express delivery",
    blurb: (to) => `Urgent parcels for ${to}. Beat the clock for a bonus. Late delivery pays half.`,
    rate: 1_900, timeFactor: 0.92,
  },
  fragile: {
    icon: "🍅", title: "Fragile cargo",
    blurb: (to) => `Crates of tomatoes and eggs for ${to} market. Every pothole breaks some.`,
    rate: 1_700,
  },
  vip: {
    icon: "🎩", title: "Chief's pickup",
    blurb: (to) => `Carry a chief to ${to}. No crashes, no fines, or the big bonus is gone.`,
    rate: 1_500, bonus: 0.8,
  },
};

export function contractOffers(route, dayKey, diff = { pay: 1, speed: 21 }) {
  const r = rng(hash(`${route.id}:${dayKey}`));
  const km = route.legs.reduce((a, l) => a + l.km, 0);
  const to = cityName(route);
  const target = targetSeconds(route, diff.speed);
  const types = shuffle(Object.keys(TEMPLATES), r).slice(0, 3);
  return types.map((type) => {
    const t = TEMPLATES[type];
    const pay = Math.round((km * t.rate * diff.pay * r.range(0.9, 1.15)) / 1000) * 1000;
    return {
      id: `${route.id}-${dayKey}-${type}`,
      type, icon: t.icon, title: t.title, blurb: t.blurb(to),
      pay,
      bonus: t.bonus ? Math.round((pay * t.bonus) / 1000) * 1000 : 0,
      target: Math.round(target * (t.timeFactor ?? 1)),
    };
  });
}

/**
 * Settle a contract at the end of the route.
 * result: { seconds, crashes, potholes, hardBrakes, fines }
 * Returns { pay, lines: [[label, amount]], rating } where rating is 0..100 (stars on the card).
 */
export function settleContract(c, result) {
  const lines = [[`${c.title}: agreed pay`, c.pay]];
  let pay = c.pay;
  const lateMin = Math.max(0, (result.seconds - c.target) / 60);
  const earlyMin = Math.max(0, (c.target - result.seconds) / 60);
  let rating = 100;

  if (c.type === "passengers") {
    rating = Math.max(0, 100 - result.potholes * 3 - result.hardBrakes * 2 - result.crashes * 20);
    const tips = Math.round((c.pay * 0.35 * rating) / 100 / 1000) * 1000;
    lines.push([`Passenger tips (${rating}% happy)`, tips]);
    pay += tips;
    if (lateMin > 0) {
      const cut = -Math.round(Math.min(c.pay * 0.4, c.pay * 0.05 * lateMin) / 1000) * 1000;
      lines.push([`Late by ${Math.ceil(lateMin)} min`, cut]);
      pay += cut;
    }
  }
  if (c.type === "express") {
    if (lateMin > 0) {
      const cut = -Math.round(c.pay * 0.5);
      lines.push([`Late by ${Math.ceil(lateMin)} min: half pay`, cut]);
      pay += cut;
      rating = 30;
    } else {
      const bonus = Math.round(Math.min(c.pay * 0.5, c.pay * 0.04 * earlyMin) / 1000) * 1000;
      lines.push([`Early by ${Math.floor(earlyMin)} min`, bonus]);
      pay += bonus;
    }
  }
  if (c.type === "fragile") {
    const broken = Math.min(0.8, result.potholes * 0.06 + result.crashes * 0.35);
    rating = Math.round((1 - broken) * 100);
    if (broken > 0) {
      const cut = -Math.round((c.pay * broken) / 1000) * 1000;
      lines.push([`Broken cargo (${Math.round(broken * 100)}%)`, cut]);
      pay += cut;
    }
  }
  if (c.type === "vip") {
    const clean = result.crashes === 0 && result.fines === 0;
    rating = clean ? 100 : 40;
    lines.push([clean ? "Chief's bonus: smooth and clean" : "Chief's bonus lost (crash or fine)", clean ? c.bonus : 0]);
    if (clean) pay += c.bonus;
  }
  return { pay: Math.max(0, Math.round(pay)), lines, rating };
}

function cityName(route) {
  return route.name.split("→").pop().trim();
}

function shuffle(a, r) {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r.next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
