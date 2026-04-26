import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            // All /api requests forward to Django on 8000.
            "/api": {
                target: "http://localhost:8000",
                changeOrigin: true,
            },
        },
    },
});
