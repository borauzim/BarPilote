import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'BarPilote.barpilote',
  appName: 'BarPilote',
  webDir: 'www',
  server: {
    url: process.env.BARPILOTE_APP_URL || 'https://barpilote.example.com',
    cleartext: false
  },
  android: {
    minSdkVersion: 23
  },
  ios: {
    contentInset: 'automatic'
  }
};

export default config;
