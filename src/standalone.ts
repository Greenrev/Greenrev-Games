/** Entry for the standalone page (index.html, `npm run dev`, the single-file build). */
import { mountRoadtrip } from "./mount.ts";

mountRoadtrip(document.getElementById("greenrev-roadtrip")!);
