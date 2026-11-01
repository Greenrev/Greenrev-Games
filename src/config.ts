import type { LinkContext } from "./types/game.ts";
/**
 * GreenRev links shown in the game. Set window.GREENREV_CONFIG before the game loads to override
 * (e.g. from the web app or a mobile WebView), or edit the defaults here.
 */
const defaults = {
  marketplaceUrl: "https://greenrevs.com",
  mechanicUrl: "https://greenrevs.com/mechanics",
  dealerSignupUrl: "https://greenrevs.com/dealers/signup",
  partsUrl: "https://greenrevs.com/parts",
  utm: "utm_source=roadtrip_game&utm_medium=game",
  // Brand: the logo is loaded from greenrevs.com; if it can't load, the GREENREV wordmark shows instead.
  logoUrl: "https://www.greenrevs.com/logo.png",
  // Featured dealer cars that drive past and get hyped (see src/game/featured.ts for the format).
  featured: {
    url: "./featured.json",
    minGapSeconds: 45,    // shortest time between two featured cars
    maxGapSeconds: 80,
  },
  // Recorded voice clips: <voiceUrl><line key>.mp3 (see public/voice/README.md).
  voiceUrl: "./voice/",
  // Car radio: licensed songs for the "Naija Hits" station ({ "tracks": [{ "title", "artist", "src" }] }).
  musicUrl: "./music/playlist.json",
  // Live radio: real FM stations' internet streams, shown first on the 📻 button.
  // [{ "name": "Station FM 100.0", "url": "https://stream.example.com/live" }] (https only)
  // Only add a station with its permission; see README, "Live radio".
  radio: { live: [] },
  // GreenRev credits (real money). The host app or a web checkout takes payment; the backend confirms
  // it, and the game claims confirmed purchases from claimUrl (see server/README.md).
  credits: {
    checkoutUrl: "",  // web checkout page, e.g. https://www.greenrevs.com/roadtrip/topup (gets ?pack=&player=)
    claimUrl: "",     // GET ?player=CODE → { "purchases": [{ "pack": "driver", "receipt": "PSK_123" }] }
  },
  // Signed-in GreenRev players: cloud saves and shared GreenRev Points (see server/README.md).
  cloud: {
    saveUrl: "",    // GET → { save }, PUT { save }
    pointsUrl: "",  // POST { delta, reason }
  },
  // Invite links: the public address of the game. Empty = the page's own address.
  playUrl: "",
  referral: {
    welcomeBonus: 200_000,  // in-game naira for a new player who opens a friend's invite
    // Optional GreenRev endpoint that credits players for friends who joined with their code:
    // GET <claimUrl>?code=ABC123 → { "reward": 150000, "joins": 3 } (reward = new, unpaid naira)
    claimUrl: "",
    // Optional: POST { code, player } here when a brand-new player joins with someone's code.
    joinUrl: "",
  },
  // "auto": post to the host app (WebView/iframe) or open a tab on the open web.
  // "link": show a tappable link card; for sandboxed embeds that block scripted navigation.
  linkMode: "auto",
  // Roadside advertising sold to businesses. Create one Paystack Payment Page per package
  // (Paystack dashboard → Payment Pages → fixed amount) and paste its link as paystackUrl.
  advertise: {
    contactUrl: "https://greenrevs.com/advertise",   // where advertisers send artwork + payment reference
    templateUrl: "./ad-template.png",                // 1024×512 billboard template
    adsUrl: "./ads.json",                            // live campaigns (see README)
    packages: [
      { id: "3d", days: 3, price: 15_000, paystackUrl: "" },
      { id: "7d", days: 7, price: 30_000, paystackUrl: "" },
      { id: "30d", days: 30, price: 100_000, paystackUrl: "" },
    ],
  },
};

const override = globalThis.GREENREV_CONFIG ?? {};
export const CONFIG = {
  ...defaults,
  ...override,
  advertise: { ...defaults.advertise, ...(override.advertise ?? {}) },
  featured: { ...defaults.featured, ...(override.featured ?? {}) },
  referral: { ...defaults.referral, ...(override.referral ?? {}) },
  credits: { ...defaults.credits, ...(override.credits ?? {}) },
  cloud: { ...defaults.cloud, ...(override.cloud ?? {}) },
  radio: { ...defaults.radio, ...(override.radio ?? {}) },
};

/**
 * Open a GreenRev destination. Inside the mobile app (React Native WebView) or an iframe, the host app
 * receives a message and navigates natively; on the open web it opens a new tab.
 */
export function openGreenRev(target: string, context: LinkContext = {}) {
  const base = {
    marketplace: CONFIG.marketplaceUrl,
    mechanic: CONFIG.mechanicUrl,
    dealer: CONFIG.dealerSignupUrl,
    parts: CONFIG.partsUrl,
  }[target] ?? CONFIG.marketplaceUrl;
  const params = new URLSearchParams(CONFIG.utm);
  if (context.query) params.set("q", context.query);
  if (context.city) params.set("city", context.city);
  params.set("utm_content", context.reason ?? target);
  const url = `${base}${base.includes("?") ? "&" : "?"}${params}`;
  const message = { type: "greenrev:navigate", target, url, context };
  track("cta_click", { target, ...context });
  if (CONFIG.linkMode === "link") return showLinkCard(LINK_LABELS[target] ?? "GreenRev", url);
  const rn = globalThis.ReactNativeWebView;
  if (rn?.postMessage) return rn.postMessage(JSON.stringify(message));
  if (window.parent && window.parent !== window) return window.parent.postMessage(message, "*");
  globalThis.open?.(url, "_blank", "noopener");
}

/** Open a specific GreenRev page (e.g. a dealer's listing), tagged with the game's UTM. */
export function openGreenRevUrl(rawUrl: string, context: LinkContext = {}) {
  let url = rawUrl;
  try {
    const u = new URL(rawUrl);
    for (const [k, v] of new URLSearchParams(CONFIG.utm)) u.searchParams.set(k, v);
    u.searchParams.set("utm_content", context.reason ?? "listing");
    url = u.toString();
  } catch {
    /* not a full URL: open as given */
  }
  const message = { type: "greenrev:navigate", target: "listing", url, context };
  track("cta_click", { target: "listing", ...context });
  if (CONFIG.linkMode === "link") return showLinkCard(context.label ?? "this car on GreenRev", url);
  const rn = globalThis.ReactNativeWebView;
  if (rn?.postMessage) return rn.postMessage(JSON.stringify(message));
  if (window.parent && window.parent !== window) return window.parent.postMessage(message, "*");
  globalThis.open?.(url, "_blank", "noopener");
}

/**
 * Start a credit-pack purchase. Inside the GreenRev app the host handles payment (Apple/Google
 * in-app purchase in the store apps); on the web it opens the checkout page. `onReturn` runs when the
 * player comes back, so the game can claim the confirmed purchase.
 */
export function requestPurchase(pack, player, onReturn) {
  const message = { type: "greenrev:purchase", pack: pack.id, price: pack.price, coins: pack.coins, player };
  track("purchase_request", { pack: pack.id, price: pack.price });
  const back = () => {
    if (document.visibilityState === "visible") {
      document.removeEventListener("visibilitychange", back);
      onReturn?.();
    }
  };
  document.addEventListener("visibilitychange", back);
  const rn = globalThis.ReactNativeWebView;
  if (rn?.postMessage) return rn.postMessage(JSON.stringify(message));
  if (window.parent && window.parent !== window && !CONFIG.credits.checkoutUrl) return window.parent.postMessage(message, "*");
  if (CONFIG.credits.checkoutUrl) {
    const u = new URL(CONFIG.credits.checkoutUrl);
    u.searchParams.set("pack", pack.id);
    if (player) u.searchParams.set("player", player);
    return globalThis.open?.(u.toString(), "_blank", "noopener");
  }
  showLinkCard("Top-ups are coming soon", "https://www.greenrevs.com");
}

// The host app can also confirm a purchase directly: postMessage({ type: "greenrev:credits", pack, receipt })
// (the game still claims from the backend when claimUrl is set; this is for hosts that verify themselves).

/** Analytics hook: host apps listen for these to measure retention (sessions, streaks, CTA clicks). */
export function track(event, props = {}) {
  const payload = { type: "greenrev:event", event, props, at: Date.now() };
  try {
    globalThis.GreenRevAnalytics?.track?.(event, props);
    const rn = globalThis.ReactNativeWebView;
    if (rn?.postMessage) rn.postMessage(JSON.stringify(payload));
    else if (window.parent && window.parent !== window) window.parent.postMessage(payload, "*");
  } catch {
    /* analytics must never break the game */
  }
}

const LINK_LABELS = { marketplace: "GreenRev Marketplace", mechanic: "GreenRev Mechanics", dealer: "GreenRev dealer sign-up", parts: "GreenRev Parts" };

/** Open any outside link (advertiser sites, Paystack) the way this embed allows. */
export function openExternal(url, label = "link") {
  if (!url) return;
  if (CONFIG.linkMode === "link") return showLinkCard(label, url);
  const rn = globalThis.ReactNativeWebView;
  const message = { type: "greenrev:open", url };
  if (rn?.postMessage) return rn.postMessage(JSON.stringify(message));
  if (window.parent && window.parent !== window) return window.parent.postMessage(message, "*");
  globalThis.open?.(url, "_blank", "noopener");
}

/** A small card with a real link the player taps to leave the game. */
function showLinkCard(label, url) {
  document.getElementById("gr-link-card")?.remove();
  const card = document.createElement("div");
  card.id = "gr-link-card";
  card.style.cssText = "position:fixed;left:50%;bottom:calc(120px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:40;background:#22c55e;color:#03200e;padding:14px 16px;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.45);display:flex;gap:10px;align-items:center;max-width:92vw;font:600 14px system-ui,sans-serif";
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = `Open ${label} →`;
  a.style.cssText = "color:#03200e;font-weight:800;text-decoration:underline";
  const close = document.createElement("button");
  close.textContent = "✕";
  close.setAttribute("aria-label", "Close");
  close.style.cssText = "background:none;border:0;color:#03200e;font-size:16px;cursor:pointer";
  close.onclick = () => card.remove();
  card.append(a, close);
  document.body.appendChild(card);
  setTimeout(() => card.remove(), 9000);
}
