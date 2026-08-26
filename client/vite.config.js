import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Build architecture:
 *  - manualChunks splits the monolith into cacheable vendor layers so app
 *    deploys no longer invalidate the whole 2MB bundle for users.
 *  - Heavy optional libs (maplibre, face-api) are already route-lazy via
 *    dynamic page chunks.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/graphql': 'http://localhost:8080',
      '/uploads': 'http://localhost:8080',
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          // Framework core – changes least, cached longest
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Design system
          'vendor-mui': [
            '@mui/material',
            '@mui/icons-material',
            '@mui/system',
            '@emotion/react',
            '@emotion/styled',
          ],
          // Data layer
          'vendor-graphql': ['@apollo/client', 'graphql', 'graphql-ws'],
          // Feature libs
          'vendor-charts': ['recharts'],
          'vendor-dates': ['dayjs', '@mui/x-date-pickers'],
        },
      },
    },
  },
});

