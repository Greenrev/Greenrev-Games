/**
 * Cloud saves and GreenRev Points, for players signed in to GreenRev.
 *
 * - Saves: every local save is also sent (debounced) to CONFIG.cloud.saveUrl. On launch the game
 *   fetches the cloud copy and keeps whichever is newer, so progress follows the player across
 *   phones and the website.
 * - Points: game moments award GreenRev Points through CONFIG.cloud.pointsUrl. The backend caps them
 *   per event; the marketplace and Business Suite read and spend the same balance.
 *
 * Both need the player's GreenRev session (cookies are sent with credentials: "include").
 */
let timer: ReturnType<typeof setTimeout> | null = null;

export function queueCloudSave(url: string, state: { updatedAt?: number }) {
  if (!url) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    fetch(url, { method: "PUT", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ save: state }) }).catch(() => {});
  }, 4000);
}

/** Returns the cloud save if it is newer than the local one, else null. */
export async function newerCloudSave<T extends { updatedAt?: number }>(url: string, local: T): Promise<T | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    const { save } = (await res.json()) as { save: T | null };
    return save && (save.updatedAt ?? 0) > (local.updatedAt ?? 0) ? save : null;
  } catch {
    return null;
  }
}

/** Award GreenRev Points for a game moment (1–50; the server enforces the cap). */
export function awardPoints(url: string, delta: number, reason: string) {
  if (!url || delta <= 0) return;
  fetch(url, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ delta: Math.min(50, Math.round(delta)), reason }) }).catch(() => {});
}
