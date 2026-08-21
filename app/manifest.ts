import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AI & Tech for Professionals",
    short_name: "AI & Tech",
    description:
      "Learn to do your real job with AI — short lessons and applied simulations for HR professionals.",
    start_url: "/learn",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5faf8",
    theme_color: "#0d9488",
    icons: [
      { src: "/mascot/rune-canonical.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
