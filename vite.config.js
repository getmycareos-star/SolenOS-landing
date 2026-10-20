import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      org: "your-org",
      project: "solenos-frontend",
      // authToken: process.env.SENTRY_AUTH_TOKEN, // Set in CI/CD or .env
      // Uncomment the following lines to enable source map upload during build
      // Note: You need to set SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT in your environment
    }),
  ],
  // Adjust base URL if needed
  // base: '/',
  // Build options
  build: {
    sourcemap: true, // Ensure source maps are generated
    // outDir: 'dist',
    // assetsDir: 'assets',
  },
});