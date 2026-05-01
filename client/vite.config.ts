import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

// detect if we are building for electron
const isElectron = process.env.VITE_ELECTRON === 'true';

export default defineConfig({
    plugins: [react(), tsconfigPaths()],
    base: isElectron ? './' : '/',
    server: {
        port: 3000,
    },
    build: {
        outDir: 'build',
        emptyOutDir: true,
    },
});
