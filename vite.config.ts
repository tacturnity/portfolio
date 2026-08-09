import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Use /portfolio/ consistently for both local development and production
  base: '/portfolio/', 
  plugins: [react()],
  assetsInclude: ['**/*.glb'], 
  server: {
    host: true,
    watch: {
      usePolling: true,
    },
  },
});