import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["favicon.svg"],
            manifest: {
                name: "NosyPet · AI Companion",
                short_name: "NosyPet",
                description: "Adopt a unique AI companion. Watch them grow into someone real.",
                theme_color: "#7b3da3",
                background_color: "#1a1230",
                display: "standalone",
                orientation: "portrait",
                start_url: "/",
                scope: "/",
                icons: [
                    { src: "icon-192.png", sizes: "192x192", type: "image/png" },
                    { src: "icon-512.png", sizes: "512x512", type: "image/png" },
                    { src: "icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
                ],
            },
            workbox: {
                globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
                navigateFallback: "/index.html",
                navigateFallbackDenylist: [/^\/api/, /^\/admin/],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/,
                        handler: "CacheFirst",
                        options: {
                            cacheName: "fonts",
                            expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 30 },
                        },
                    },
                    {
                        urlPattern: /\/api\/companion\/me\//,
                        handler: "NetworkFirst",
                        options: {
                            cacheName: "companion-state",
                            networkTimeoutSeconds: 4,
                            expiration: { maxEntries: 1, maxAgeSeconds: 60 },
                        },
                    },
                ],
            },
            devOptions: { enabled: false },
        }),
    ],
    server: {
        port: 5173,
        proxy: {
            "/api": { target: "http://localhost:8000", changeOrigin: true },
        },
    },
});
