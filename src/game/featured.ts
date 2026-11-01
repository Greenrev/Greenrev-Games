/**
 * Featured dealer cars: real GreenRev listings that drive past the player as luxury traffic.
 * Roadside hype men shout them out, the player taps HYPE, and the car links to its listing.
 * Dealers can pay for this placement, like the roadside billboards.
 *
 * The game reads CONFIG.featured.url (a static featured.json, or a GreenRev backend endpoint):
 *
 * { "cars": [ { "id": "ikoyi-autos-saloon-1", "dealer": "Ikoyi Autos", "city": "Lagos",
 *     "title": "Black luxury saloon, 2024", "body": "limo", "color": "#0d0d0f",
 *     "price": 185000000, "listingUrl": "https://www.greenrevs.com/shop/...",
 *     "start": "2026-11-01", "end": "2026-11-30" } ] }
 *
 * body: "limo" (luxury saloon), "luxsuv" (luxury 4x4) or "coupe" (sports coupe).
 * No brand names or logos appear in the game; the title is shown on the listing card only.
 * start/end are optional (inclusive, YYYY-MM-DD). listingUrl is optional: without it the card
 * searches GreenRev Marketplace for the title.
 */

export const FEATURED_BODIES = ["limo", "luxsuv", "coupe"];

/** Shown until real listings are configured, so the hype loop works from day one. */
export const SAMPLE_FEATURED = [
  { id: "sample-saloon", dealer: "Featured GreenRev dealer", city: "Lagos", title: "Luxury saloon", body: "limo", color: "#0d0d0f", sample: true },
  { id: "sample-4x4", dealer: "Featured GreenRev dealer", city: "Abuja", title: "Luxury 4x4", body: "luxsuv", color: "#f2f2f0", sample: true },
  { id: "sample-coupe", dealer: "Featured GreenRev dealer", city: "Lagos", title: "Sports coupe", body: "coupe", color: "#d00000", sample: true },
  { id: "sample-4x4-green", dealer: "Featured GreenRev dealer", city: "Port Harcourt", title: "Luxury 4x4", body: "luxsuv", color: "#1faa59", sample: true },
];

export async function loadFeatured(url) {
  if (!url) return [];
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.cars) ? data.cars : [];
  } catch {
    return []; // offline: the samples keep the hype loop alive
  }
}

/** Valid, in-date listings; falls back to the samples when none are live. */
export function activeFeatured(list, today) {
  const live = (list ?? []).filter((c) => c && c.id && c.dealer && FEATURED_BODIES.includes(c.body) && (!c.start || c.start <= today) && (!c.end || today <= c.end));
  return live.length ? live : SAMPLE_FEATURED;
}

/** Roadside hype. Brand-free on purpose: hype the car and the money, never the badge. */
export const HYPE_LINES = [
  { key: "hype_1", text: "This luxury don land! Who get am?!" },
  { key: "hype_2", text: "Ehn ehn! See money!" },
  { key: "hype_3", text: "Clear road! Big man dey pass!" },
  { key: "hype_4", text: "This one na correct whip o!" },
  { key: "hype_5", text: "Who get this ride? E too clean!" },
  { key: "hype_6", text: "Oga, bless us small!" },
];

/** Hype points for a tap: faster reactions and rarer bodies pay more. */
export function hypeScore(body, reactionSeconds) {
  const base = body === "coupe" ? 30 : body === "limo" ? 25 : 20;
  const quick = reactionSeconds < 1.5 ? 2 : reactionSeconds < 3 ? 1.5 : 1;
  return Math.round(base * quick);
}

/** Where the "View this car" button goes. */
export function listingTarget(car) {
  if (car.listingUrl) return { url: car.listingUrl };
  return { marketplace: true, query: car.title };
}

/** Save to the dream garage once; returns true if it was new. */
export function saveDream(state, car) {
  state.dreamGarage ??= [];
  if (state.dreamGarage.some((d) => d.id === car.id)) return false;
  state.dreamGarage.push({ id: car.id, dealer: car.dealer, city: car.city, title: car.title, price: car.price ?? null, listingUrl: car.listingUrl ?? "", savedOn: new Date().toISOString().slice(0, 10) });
  return true;
}
