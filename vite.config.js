import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/ztrack/",
  plugins: [react()],
  assetsInclude: ["**/*.png", "**/*.jpg", "**/*.svg"],
});
