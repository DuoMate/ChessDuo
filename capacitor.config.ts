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
    allowMixedContent: true,
  },
  plugins: {
    SocialLogin: {
      logLevel: 1,
    },
  },
}

export default config
