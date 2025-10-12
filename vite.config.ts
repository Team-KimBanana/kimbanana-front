import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
    // TS2580 'process' 오류 해결: tsconfig.json에 "node" 타입이 로드되지 않을 경우 필요
    // @ts-ignore
    const env = loadEnv(mode, process.cwd(), '');

    const targetUrl = env.VITE_PROXY_TARGET || 'http://localhost:8080/default';

    return {
        base: '/kimbanana/ui/',
        server: {
            host: '0.0.0.0',
            proxy: {
                '/api': {
                    target: targetUrl,
                    changeOrigin: true,
                    secure: true,
                    configure: (proxy, _options) => {
                        proxy.on('error', (err, _req, _res) => {
                            // TS2584 'console' 오류 해결
                            // @ts-ignore
                            console.log('proxy error', err);
                        });
                        // TS6133 'proxyReq' 오류 해결: _proxyReq로 이름 변경
                        proxy.on('proxyReq', (_proxyReq, req, _res) => {
                            // TS2584 'console' 오류 해결
                            // @ts-ignore
                            console.log('Sending Request to the Target:', req.method, req.url);
                        });
                        proxy.on('proxyRes', (proxyRes, req, _res) => {
                            // TS2584 'console' 오류 해결
                            // @ts-ignore
                            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
                        });
                    },
                },
                '/ws-api': {
                    target: targetUrl.replace('https:', 'wss:'),
                    changeOrigin: true,
                    secure: true,
                    ws: true,
                }
            }
        },
    }
});