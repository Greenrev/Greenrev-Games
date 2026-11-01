"use client";

/**
 * GreenRev Roadtrip inside a Next.js page.
 *
 * The game is browser-only (WebGL, Web Audio), so it loads in an effect, never during server render.
 * It's full-screen: give it its own route (see app/roadtrip/page.tsx).
 */
import { useEffect, useRef } from "react";
import "greenrev-roadtrip/style.css";

type Handle = { destroy(): void };

export default function RoadtripGame({ config = {} }: { config?: Record<string, unknown> }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let handle: Handle | undefined;
    let cancelled = false;
    import("greenrev-roadtrip").then(async ({ mountRoadtrip }) => {
      if (cancelled || !ref.current) return;
      handle = await mountRoadtrip(ref.current, config);
      if (cancelled) handle.destroy(); // unmounted while loading (React Strict Mode does this in dev)
    });
    return () => {
      cancelled = true;
      handle?.destroy();
    };
    // the game reads its config once at start
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={ref} style={{ position: "fixed", inset: 0, zIndex: 50 }} />;
}
