import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Track Your Sales",
    short_name: "Track Sales",
    description: "تابع تارجتك ومبيعاتك اليومية في مكان واحد.",
    lang: "ar",
    dir: "rtl",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#faf7f4",
    theme_color: "#c6530b",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
