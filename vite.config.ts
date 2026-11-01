import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// `npm run build`        -> dist/        (static site: host on greenrevs.com/roadtrip or any CDN)
// `npm run build:single` -> dist-single/ (one self-contained index.html, handy for mobile WebViews)
// `npm run build:lib`    -> dist-lib/    (ES module + CSS for the Next.js app: import { mountRoadtrip })
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: mode === "single" ? [viteSingleFile()] : [],
  build:
    mode === "lib"
      ? {
          outDir: "dist-lib",
          lib: { entry: "src/mount.ts", formats: ["es"], fileName: () => "greenrev-roadtrip.js", cssFileName: "greenrev-roadtrip" },
          rollupOptions: { external: ["three", /^three\//] }, // the Next.js app installs three
          copyPublicDir: false,
        }
      : {
          outDir: mode === "single" ? "dist-single" : "dist",
          chunkSizeWarningLimit: 1200,
        },
  test: { environment: "node", include: ["test/**/*.test.ts", "server/**/*.test.ts"] },
}));
