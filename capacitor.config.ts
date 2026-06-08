import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.navron.chessduo',
  appName: 'ChessDuo',
  webDir: 'out',
  server: {
    androidScheme: 'http',
    hostname: 'localhost',
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
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: '#0f1119',
      splashFullScreen: true,
      splashImmersive: true,
    },
    SocialLogin: {
      google: {
        webClientId: process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
        mode: 'online',
      },
    },
    Browser: {
      // Capacitor Browser plugin for in-app OAuth
    },
  },
}

export default config
