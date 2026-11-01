import type { Metadata, Viewport } from "next";
import RoadtripGame from "@/components/RoadtripGame";

export const metadata: Metadata = {
  title: "GreenRev Roadtrip",
  description: "Drive Nigeria's highways city to city: potholes, checkpoints, go-slow and luxury cars to hype.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b6e4f",
};

const api = "/api/roadtrip";

export default function RoadtripPage() {
  return (
    <RoadtripGame
      config={{
        playUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.greenrevs.com"}/roadtrip`,
        logoUrl: "/logo.png",
        marketplaceUrl: "/shop",
        mechanicUrl: "/experts",
        partsUrl: "/parts",
        featured: { url: `${api}/featured` },
        referral: { claimUrl: `${api}/referral/claim`, joinUrl: `${api}/referral/join` },
        credits: { checkoutUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}${api}/topup`, claimUrl: `${api}/credits/claim` },
        cloud: { saveUrl: `${api}/save`, pointsUrl: `${api}/points` },
        voiceUrl: "/roadtrip/voice/",
        musicUrl: "/roadtrip/music/playlist.json",
      }}
    />
  );
}
