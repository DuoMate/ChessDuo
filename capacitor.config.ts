import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.chessduo.app',
  appName: 'ChessDuo',
  webDir: 'out',
  server: {
    url: 'https://chessduo-fe.onrender.com',
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#0f1119',
  },
  ios: {
    backgroundColor: '#0f1119',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0f1119',
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
}

export default config
