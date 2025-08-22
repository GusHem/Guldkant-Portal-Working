import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  base: "/Guldkant-Portal-Working/",
  plugins: [react()],
  build: {
    outDir: "docs"
  }
})
