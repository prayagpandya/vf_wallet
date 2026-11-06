import { TextStyle, Platform } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const typography: { [key: string]: TextStyle } = {
  h1: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
    fontFamily,
  },
  h2: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    fontFamily,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
    fontFamily,
  },
  h4: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    fontFamily,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    fontFamily,
  },
  body: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    fontFamily,
  },
  bodySmall: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    fontFamily,
  },
  caption: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 14,
    fontFamily,
  },
  currencyLarge: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontFamily,
  },
  currencyMedium: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.3,
    fontFamily,
  },
  button: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
    fontFamily,
  },
};

export default typography;

