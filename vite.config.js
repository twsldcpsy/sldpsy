import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/sldpsy/', // 加入這行讓 GitHub Pages 知道專案在子目錄
  build: {
    outDir: 'dist', // 改回標準的 dist
    emptyOutDir: true
  }
})
