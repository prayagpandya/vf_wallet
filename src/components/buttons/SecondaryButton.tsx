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
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface SecondaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: 'outline' | 'subtle' | 'dangerOutline';
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export const SecondaryButton: React.FC<SecondaryButtonProps> = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  icon,
  variant = 'outline',
  size = 'md',
  style,
  textStyle,
  fullWidth = false,
}) => {
  const heights = {
    sm: 38,
    md: 48,
    lg: 56,
  };

  const fontSizes = {
    sm: 13,
    md: 15,
    lg: 16,
  };

  const isOutline = variant === 'outline';
  const isDanger = variant === 'dangerOutline';

  const borderColor = isDanger
    ? colors.danger
    : isOutline
    ? colors.primary
    : 'transparent';

  const backgroundColor = isDanger
    ? colors.dangerLight
    : isOutline
    ? colors.white
    : colors.lightBlue;

  const textColor = isDanger
    ? colors.danger
    : colors.primary;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.touchable,
        {
          height: heights[size],
          borderColor,
          backgroundColor,
          paddingHorizontal: size === 'sm' ? 14 : 20,
        },
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <View style={styles.contentRow}>
          {icon && (
            <Ionicons
              name={icon}
              size={size === 'sm' ? 16 : 18}
              color={textColor}
              style={styles.icon}
            />
          )}
          <Text
            style={[
              styles.text,
              { color: textColor, fontSize: fontSizes[size] },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  touchable: {
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
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
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default SecondaryButton;

