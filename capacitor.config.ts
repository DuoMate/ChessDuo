import type { CapacitorConfig } from '@capacitor/cli'

declare const process: {
  env: {
    NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID?: string
  }
}

const config: CapacitorConfig = {
  appId: 'com.navron.chessduo',
  appName: 'ChessDuo',
  webDir: 'out',
  server: {
    androidScheme: 'http',
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
  },
}

export default config
