/**
 * Embed GreenRev Roadtrip anywhere: a Next.js page, another React app, or a plain page.
 *
 *   const game = await mountRoadtrip(document.getElementById("game")!, { linkMode: "auto" });
 *   // later: game.destroy();
 *
 * `config` is merged into window.GREENREV_CONFIG before the game loads, so it accepts everything
 * documented in src/config.ts. The game takes over the full viewport (it is a full-screen game).
 */
import { MARKUP } from "./markup.ts";
import "./styles.css";

export interface RoadtripHandle {
  destroy(): void;
}

let running: RoadtripHandle | null = null;

export async function mountRoadtrip(container: HTMLElement, config: Record<string, any> = {}): Promise<RoadtripHandle> {
  running?.destroy(); // only one game at a time
  window.GREENREV_CONFIG = { ...(window.GREENREV_CONFIG ?? {}), ...config };
  container.innerHTML = MARKUP;
  container.classList.add("greenrev-roadtrip");
  const { startGame } = await import("./main.ts");
  const game = startGame();
  const handle: RoadtripHandle = {
    destroy() {
      game?.destroy();
      container.innerHTML = "";
      if (running === handle) running = null;
    },
  };
  running = handle;
  return handle;
}
