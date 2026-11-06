import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  onPress?: () => void;
  fullWidth?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  variant = 'primary',
  onPress,
  fullWidth = false,
}) => {
  const colorMap = {
    primary: {
      color: colors.primary,
      bg: colors.lightBlue,
      border: '#D0E2FF',
    },
    success: {
      color: colors.success,
      bg: colors.successLight,
      border: '#B3EBD0',
    },
    warning: {
      color: colors.warningDark,
      bg: colors.warningLight,
      border: '#FFE380',
    },
    danger: {
      color: colors.danger,
      bg: colors.dangerLight,
      border: '#FFBDAD',
    },
    info: {
      color: colors.info,
      bg: colors.infoLight,
      border: '#B3D4FF',
    },
  }[variant];

  const content = (
    <View
      style={[
        styles.card,
        { borderColor: colorMap.border },
        fullWidth && styles.fullWidth,
      ]}
    >
      <View style={styles.topRow}>
        <View style={[styles.iconCircle, { backgroundColor: colorMap.bg }]}>
          <Ionicons name={icon} size={20} color={colorMap.color} />
        </View>
        {onPress && (
          <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
        )}
      </View>

      <Text style={styles.valueText}>{value}</Text>
      <Text style={styles.titleText}>{title}</Text>

      {subtitle && <Text style={styles.subtitleText}>{subtitle}</Text>}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={fullWidth ? styles.touchableFull : styles.touchableHalf}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={fullWidth ? styles.touchableFull : styles.touchableHalf}>
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  touchableHalf: {
    width: '48%',
    marginBottom: 12,
  },
  touchableFull: {
    width: '100%',
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.2,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  fullWidth: {
    width: '100%',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  titleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 4,
  },
  subtitleText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
});

export default StatCard;

