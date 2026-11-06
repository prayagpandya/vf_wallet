import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  light?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showTagline = false,
  light = false,
}) => {
  const iconSizes = {
    sm: 20,
    md: 28,
    lg: 40,
  };

  const containerSizes = {
    sm: 34,
    md: 46,
    lg: 68,
  };

  const fontSizes = {
    sm: 18,
    md: 22,
    lg: 32,
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <LinearGradient
          colors={colors.gradientPrimary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.iconWrapper,
            {
              width: containerSizes[size],
              height: containerSizes[size],
              borderRadius: containerSizes[size] / 3.2,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="wallet-membership"
            size={iconSizes[size]}
            color={colors.white}
          />
        </LinearGradient>
        <View style={styles.textContainer}>
          <View style={styles.logoTextRow}>
            <Text
              style={[
                styles.logoTextBold,
                {
                  fontSize: fontSizes[size],
                  color: light ? colors.white : colors.primary,
                },
              ]}
            >
              VF
            </Text>
            <Text
              style={[
                styles.logoTextLight,
                {
                  fontSize: fontSizes[size],
                  color: light ? colors.white : colors.text,
                },
              ]}
            >
              {' '}Wallet
            </Text>
          </View>
          {showTagline && (
            <Text
              style={[
                styles.tagline,
                { color: light ? 'rgba(255,255,255,0.8)' : colors.textSecondary },
              ]}
            >
              Fast • Secure • Rewarding
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  textContainer: {
    marginLeft: 12,
  },
  logoTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoTextBold: {
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  logoTextLight: {
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 0.2,
  },
});

export default Logo;

