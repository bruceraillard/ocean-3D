import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
    plugins: [vue()],
    server: {
        proxy: {
            '/api/nc': {
                target: 'https://data.gouv.nc',
                changeOrigin: true,
                secure: true,
                rewrite: (p) => p.replace(/^\/api\/nc/, ''),
            },
        },
    },
})
