import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'danger' | 'success' | 'warning';
  icon?: keyof typeof Ionicons.glyphMap;
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  icon,
  size = 'md',
  style,
  textStyle,
  fullWidth = false,
}) => {
  const gradientMap = {
    primary: colors.gradientPrimary,
    danger: [colors.danger, colors.dangerDark] as const,
    success: colors.gradientSuccess,
    warning: colors.gradientBonus,
  };

  const heights = {
    sm: 38,
    md: 48,
    lg: 56,
  };

  const fontSizes = {
    sm: 13,
    md: 15,
    lg: 17,
  };

  const iconSizes = {
    sm: 16,
    md: 18,
    lg: 20,
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.touchable,
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        style,
      ]}
    >
      <LinearGradient
        colors={
          disabled
            ? ['#B0B8C4', '#97A0AF']
            : (gradientMap[variant] as unknown as [string, string])
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.gradient,
          {
            height: heights[size],
            paddingHorizontal: size === 'sm' ? 14 : 20,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <View style={styles.contentRow}>
            {icon && (
              <Ionicons
                name={icon}
                size={iconSizes[size]}
                color={colors.white}
                style={styles.icon}
              />
            )}
            <Text
              style={[
                styles.text,
                { fontSize: fontSizes[size] },
                textStyle,
              ]}
            >
              {title}
            </Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  touchable: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  fullWidth: {
    width: '100%',
  },
  gradient: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 8,
  },
  text: {
    color: colors.white,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  disabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
});

export default PrimaryButton;

