import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rabihy.app',
  appName: 'تطبيق ربحي',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
