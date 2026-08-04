import type { MetadataRoute } from "next";

// s10 plan decisions 5, 6, 7: the single, non-mediatable manifest color
// is the DARK theme's own --background (oklch(0.145 0 0)), sRGB-
// converted — declared in docs/design-system.md § Identité PWA, not
// invented here. `id` fixed at "/" once and for all: without it, the
// installed app's identity would drift from `start_url`, and a future
// change of the home route would trigger a SECOND install.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "morpho",
    short_name: "morpho",
    description: "Suivi de poids et de mensurations corporelles",
    start_url: "/",
    scope: "/",
    id: "/",
    display: "standalone",
    lang: "fr",
    dir: "ltr",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
