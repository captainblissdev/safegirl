import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// PWA configuration supports NFR-06 by providing an installable,
// responsive application shell that can remain available during
// intermittent connectivity. User conversation content is not cached.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",

      workbox: {
        // Cache the generated application shell and static assets.
        // Do not add runtime caching for /api because responses may
        // contain sensitive health-related conversation content.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },

      manifest: {
        name: "SafeGirl",
        short_name: "SafeGirl",
        description: "Anonymous, confidential SRH information support",
        theme_color: "#6e39c8",
        background_color: "#ffffff",
        display: "standalone",
        icons: [],
      },
    }),
  ],

  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
