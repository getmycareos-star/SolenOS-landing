import { defineConfig } from '@capacitor/cli'

export default defineConfig({
  appId: 'com.solenos.care',
  appName: 'SolenOS',
  webDir: 'dist',
  server: {
    url: 'http://10.0.2.2:5173',
    cleartext: true,
  },
})
