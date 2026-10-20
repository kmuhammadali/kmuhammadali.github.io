import { defineConfig, type Plugin } from "vite";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

function figmaAssetResolver(): Plugin {
  return {
    name: "figma-asset-resolver",
    resolveId(id) {
      if (id.startsWith("figma:asset/")) {
        const filename = id.replace("figma:asset/", "");
        return path.resolve(__dirname, "src/assets", filename);
      }
    },
  };
}

export default defineConfig({
  // Relative asset URLs work at both / and /repository/ on GitHub Pages.
  base: "./",
  build: {
    rollupOptions: {
      input: {
        public: path.resolve(__dirname, "index.html"),
        admin: path.resolve(__dirname, "admin/index.html"),
      },
    },
  },
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@/styles": path.resolve(__dirname, "./src/styles"),
      "@": path.resolve(__dirname, "./src/app"),
    },
  },
});
