import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base './' để bản build mở được cả khi đặt sau một đường dẫn con.
// proxy: máy chủ Python (serve.py) vẫn giữ khoá API và toàn bộ /api/* —
// React chỉ là lớp giao diện, không bao giờ cầm khoá Gemini.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:8765", changeOrigin: true },
    },
  },
  build: { outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 900 },
});
