import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // define: {
  //   global: 'globalThis',
  // },
    base: '/kimbanana/ui/',
  server: {
    host: '0.0.0.0'
  },
});

