import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

export type BadgeStatus = 'pending' | 'approved' | 'rejected' | 'active' | 'blocked' | 'verified';

interface StatusBadgeProps {
  status: BadgeStatus | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
}) => {
  const normalized = status.toLowerCase() as BadgeStatus;

  const config = {
    approved: {
      bg: colors.successLight,
      color: colors.successDark,
      border: '#B3EBD0',
      label: 'Approved',
      icon: 'checkmark-circle' as const,
    },
    verified: {
      bg: colors.successLight,
      color: colors.successDark,
      border: '#B3EBD0',
      label: 'Verified',
      icon: 'checkmark-circle' as const,
    },
    active: {
      bg: colors.successLight,
      color: colors.successDark,
      border: '#B3EBD0',
      label: 'Active',
      icon: 'radio-button-on' as const,
    },
    pending: {
      bg: colors.warningLight,
      color: colors.warningDark,
      border: '#FFE380',
      label: 'Pending',
      icon: 'time' as const,
    },
    rejected: {
      bg: colors.dangerLight,
      color: colors.dangerDark,
      border: '#FFBDAD',
      label: 'Rejected',
      icon: 'close-circle' as const,
    },
    blocked: {
      bg: colors.dangerLight,
      color: colors.dangerDark,
      border: '#FFBDAD',
      label: 'Blocked',
      icon: 'ban' as const,
    },
  }[normalized] || {
    bg: colors.surfaceAlt,
    color: colors.textSecondary,
    border: colors.border,
    label: status,
    icon: 'ellipse' as const,
  };

  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
          paddingVertical: isSmall ? 2 : 4,
          paddingHorizontal: isSmall ? 6 : 10,
        },
      ]}
    >
      <Ionicons
        name={config.icon}
        size={isSmall ? 10 : 13}
        color={config.color}
        style={styles.icon}
      />
      <Text
        style={[
          styles.text,
          {
            color: config.color,
            fontSize: isSmall ? 10 : 12,
            fontWeight: '600',
          },
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 4,
  },
  text: {
    letterSpacing: 0.2,
    textTransform: 'capitalize',
  },
});

export default StatusBadge;

