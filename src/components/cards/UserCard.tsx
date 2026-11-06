import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { User, UserWalletSummary } from '../../types';
import { colors } from '../../theme/colors';
import { formatPaiseToINR } from '../../utils/currency';
import { StatusBadge } from '../common/StatusBadge';

interface UserCardProps {
  user: User;
  walletSummary: UserWalletSummary;
  onPress: () => void;
}

export const UserCard: React.FC<UserCardProps> = ({
  user,
  walletSummary,
  onPress,
}) => {
  const regDate = new Date(user.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Top Header: Avatar, Name, UserID, Status */}
      <View style={styles.topRow}>
        <View style={styles.userMainInfo}>
          {user.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {user.name.slice(0, 2).toUpperCase()}
              </Text>
            </View>
          )}

          <View style={styles.nameContainer}>
            <View style={styles.nameRow}>
              <Text style={styles.nameText}>{user.name}</Text>
              {user.kycStatus === 'verified' && (
                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color={colors.primary}
                  style={styles.verifiedIcon}
                />
              )}
            </View>
            <Text style={styles.idText}>
              {user.id} • {user.phone}
            </Text>
            <Text style={styles.dateText}>Registered: {regDate}</Text>
          </View>
        </View>

        <StatusBadge status={user.status} size="sm" />
      </View>

      <View style={styles.divider} />

      {/* Financial Metrics */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricCol}>
          <Text style={styles.metricLabel}>Current Balance</Text>
          <Text style={[styles.metricValue, styles.balanceValue]}>
            {formatPaiseToINR(walletSummary.availableBalancePaise)}
          </Text>
        </View>

        <View style={styles.metricCol}>
          <Text style={styles.metricLabel}>Total Deposit</Text>
          <Text style={styles.metricValue}>
            {formatPaiseToINR(walletSummary.totalDepositPaise)}
          </Text>
        </View>

        <View style={styles.metricCol}>
          <Text style={styles.metricLabel}>Total Withdraw</Text>
          <Text style={styles.metricValue}>
            {formatPaiseToINR(walletSummary.totalWithdrawalPaise)}
          </Text>
        </View>

        <View style={styles.metricCol}>
          <Text style={styles.metricLabel}>Total Bonus</Text>
          <Text style={[styles.metricValue, styles.bonusValue]}>
            {formatPaiseToINR(walletSummary.totalBonusPaise)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  userMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  nameContainer: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  idText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  dateText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricCol: {
    alignItems: 'flex-start',
  },
  metricLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '500',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  balanceValue: {
    color: colors.primary,
  },
  bonusValue: {
    color: colors.warningDark,
  },
});

export default UserCard;

