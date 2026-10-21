import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const sentryOrg = process.env.SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT || 'solenos-frontend';
const sentryEnabled = Boolean(sentryAuthToken && sentryOrg && sentryProject);

export default defineConfig({
  plugins: [
    react(),
    ...(sentryEnabled
      ? [
          sentryVitePlugin({
            authToken: sentryAuthToken,
            org: sentryOrg,
            project: sentryProject,
            telemetry: false,
            sourcemaps: {
              filesToDeleteAfterUpload: ['./dist/**/*.js.map'],
            },
          }),
        ]
      : []),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  build: {
    // Avoid publishing source maps unless authenticated Sentry upload is configured.
    sourcemap: sentryEnabled,
  },
});
