import { defineConfig } from 'vite';

export default defineConfig({
    root: './',
    build: {
        outDir: 'dist',
    },
    server: {
        port: 3000,
        open: true,
        proxy: {
            '/api': {
                target: process.env.VITE_PROXY_TARGET || 'http://localhost:5000',
                changeOrigin: true,
            },
            '/uploads': {
                target: process.env.VITE_PROXY_TARGET || 'http://localhost:5000',
                changeOrigin: true,
            },
        },
    },
});
