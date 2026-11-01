/**
 * Invite and referral links.
 *
 * Every player gets a short code. Their invite link is the game's address plus #ref-CODE, and a
 * challenge link adds a journey and a time to beat: #ref-CODE-ch-lagos-abuja-t-754.
 * (The hash form works everywhere, including hosted demos that drop query strings; ?ref=CODE is
 * accepted too.)
 *
 * A new player who opens an invite gets a welcome bonus once. Rewarding the person who invited them
 * needs a server (the game can't verify another phone), so the game emits referral events and, if
 * CONFIG.referral.claimUrl is set, asks the GreenRev backend for rewards earned from invites.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I, easy to read out loud

export function makeCode(random = Math.random) {
  let code = "";
  for (let i = 0; i < 6; i++) code += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return code;
}

/** Read an invite from the page address: #ref-CODE[-ch-ROUTE-t-SECONDS] or ?ref=CODE&ch=ROUTE&t=SECONDS. */
export function parseInvite(hash = "", search = "") {
  const h = String(hash).replace(/^#/, "");
  const m = h.match(/^ref-([A-Z0-9]{4,10})(?:-ch-([a-z0-9-]+?)-t-(\d{1,6}))?$/i);
  if (m) return { ref: m[1].toUpperCase(), challenge: m[2] ? { routeId: m[2], seconds: Number(m[3]) } : null };
  const q = new URLSearchParams(search);
  const ref = q.get("ref");
  if (!ref || !/^[A-Z0-9]{4,10}$/i.test(ref)) return null;
  const ch = q.get("ch"), t = Number(q.get("t"));
  return { ref: ref.toUpperCase(), challenge: ch && /^[a-z0-9-]+$/.test(ch) && t > 0 ? { routeId: ch, seconds: t } : null };
}

export function inviteUrl(base, code, challenge = null) {
  const clean = String(base).split("#")[0];
  const tag = challenge ? `ref-${code}-ch-${challenge.routeId}-t-${Math.round(challenge.seconds)}` : `ref-${code}`;
  return `${clean}#${tag}`;
}

/** Make sure the player has a referral record and code. */
export function ensureReferral(state, random = Math.random) {
  state.referral ??= {};
  state.referral.code ??= makeCode(random);
  state.referral.invitesSent ??= 0;
  state.referral.earned ??= 0;
  return state.referral;
}

/**
 * Apply an invite on arrival. A brand-new player (no legs driven yet) gets the welcome bonus once;
 * a challenge is remembered for anyone. Returns what happened, for the welcome screen.
 */
export function acceptInvite(state, invite, bonus) {
  const r = ensureReferral(state);
  if (!invite || invite.ref === r.code) return { welcomed: false, challenge: null, own: invite?.ref === r.code };
  let welcomed = false;
  if (!r.invitedBy && (state.stats?.legs ?? 0) === 0) {
    r.invitedBy = invite.ref;
    r.joinedOn = new Date().toISOString().slice(0, 10);
    state.coins += bonus;
    welcomed = true;
  }
  if (invite.challenge) state.challenge = { ...invite.challenge, from: invite.ref };
  return { welcomed, challenge: invite.challenge ?? null, own: false };
}

/** Did this finished journey beat a friend's challenge? Clears the challenge either way. */
export function settleChallenge(state, routeId, seconds) {
  const c = state.challenge;
  if (!c || c.routeId !== routeId) return null;
  state.challenge = null;
  return { ...c, yours: seconds, won: seconds < c.seconds };
}
