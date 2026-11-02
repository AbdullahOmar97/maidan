import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MAIDAN — Sports Club Management System",
    short_name: "MAIDAN",
    description: "Professional martial arts academy & sports club management platform for the MENA region.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#050811",
    theme_color: "#050811",
    dir: "rtl",
    lang: "ar",
    orientation: "any",
    categories: ["business", "sports", "productivity"],
    icons: [
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
