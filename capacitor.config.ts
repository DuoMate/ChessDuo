import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.navron.chessduo',
  appName: 'ChessDuo',
  webDir: 'out',
  android: {
    allowMixedContent: false,
    backgroundColor: '#0f1119',
  },
  ios: {
    backgroundColor: '#0f1119',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: '#0f1119',
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
}

export default config
