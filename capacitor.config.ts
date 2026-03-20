import { CapacitorConfig } from '@capacitor/cli';

const LOGIN_PATH = '/crypto/login';

/**
 * Determina a URL base do app. O app sempre abre na página de login.
 * Em produção: https://sevencoins.com.br/crypto/login (basePath /crypto)
 * Para desenvolvimento: NEXT_PUBLIC_APP_URL ou APP_URL + /crypto/login
 */
const getAppUrl = (): string => {
  let base = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (!base) return 'https://sevencoins.com.br' + LOGIN_PATH;
  base = base.replace(/\/$/, '');
  return base.includes(LOGIN_PATH) ? base : base + LOGIN_PATH;
};

const appUrl = getAppUrl();
const isDev = appUrl.startsWith('http://');

const config: CapacitorConfig = {
  appId: 'com.sevencoins.biogenerator',
  appName: 'Crypto Strategy',
  webDir: 'public',
  server: {
    url: appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl,
    cleartext: isDev,
    androidScheme: isDev ? 'http' : 'https'
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
      keystoreAliasPassword: undefined,
      keystorePassword: undefined,
      releaseType: 'AAB'
    },
    allowMixedContent: process.env.NODE_ENV === 'development'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      androidSpinnerStyle: 'large',
      iosSpinnerStyle: 'small',
      spinnerColor: '#26A69A',
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};

export default config;
