import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
    },
    define: {
        global: 'globalThis',
    },
    resolve: {
        alias: {
            buffer: 'buffer',
            events: 'events',
            util: 'util',
        },
    },
    optimizeDeps: {
        include: ['buffer', 'events', 'util', 'simple-peer'],
    },
})
