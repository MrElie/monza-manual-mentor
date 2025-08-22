import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.165723e7abbf4089bada8960f50510e5',
  appName: 'monza-manual-mentor',
  webDir: 'dist',
  server: {
    url: 'https://165723e7-abbf-4089-bada-8960f50510e5.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    Camera: {
      permissions: ['camera', 'photos']
    },
    Microphone: {
      permissions: ['microphone']
    }
  }
};

export default config;