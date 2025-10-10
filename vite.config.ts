import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // define: {
  //   global: 'globalThis',
  // },
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'https://daisy.wisoft.io/kimbanana/app',
        changeOrigin: true,
        secure: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
      '/ws-api': {
        target: 'wss://daisy.wisoft.io/kimbanana/app',
        changeOrigin: true,
        secure: true,
        ws: true,
      }
    }
  },
});

