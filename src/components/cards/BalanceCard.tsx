import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { formatPaiseToINR } from '../../utils/currency';
import { UserWalletSummary } from '../../types';

interface BalanceCardProps {
  wallet: UserWalletSummary | null;
  isBalanceHidden: boolean;
  onToggleHideBalance: () => void;
  onDepositPress: () => void;
  onWithdrawPress: () => void;
  bonusRate?: number;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  wallet,
  isBalanceHidden,
  onToggleHideBalance,
  onDepositPress,
  onWithdrawPress,
  bonusRate = 5,
}) => {
  const availableBalance = wallet ? wallet.availableBalancePaise : 0;
  const totalDeposit = wallet ? wallet.totalDepositPaise : 0;
  const totalWithdrawal = wallet ? wallet.totalWithdrawalPaise : 0;
  const totalBonus = wallet ? wallet.totalBonusPaise : 0;

  const displayBalance = isBalanceHidden
    ? '••••••••'
    : formatPaiseToINR(availableBalance);

  return (
    <View style={styles.shadowWrapper}>
      <LinearGradient
        colors={colors.gradientCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Top Header */}
        <View style={styles.topRow}>
          <View>
            <View style={styles.balanceLabelRow}>
              <Text style={styles.balanceLabel}>Available Balance</Text>
              <TouchableOpacity
                onPress={onToggleHideBalance}
                style={styles.eyeBtn}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isBalanceHidden ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color="rgba(255,255,255,0.8)"
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.balanceAmount}>{displayBalance}</Text>
          </View>

          {bonusRate > 0 && (
            <View style={styles.bonusBadge}>
              <MaterialCommunityIcons
                name="star-four-points"
                size={12}
                color="#F59E0B"
              />
              <Text style={styles.bonusBadgeText}>{bonusRate}% Bonus Active</Text>
            </View>
          )}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* 3 Metric Columns: Total Deposit, Total Withdrawal, Total Bonus */}
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Total Deposit</Text>
            <Text style={styles.metricValue}>
              {isBalanceHidden ? '••••' : formatPaiseToINR(totalDeposit)}
            </Text>
          </View>

          <View style={styles.verticalDivider} />

          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Total Withdrawal</Text>
            <Text style={styles.metricValue}>
              {isBalanceHidden ? '••••' : formatPaiseToINR(totalWithdrawal)}
            </Text>
          </View>

          <View style={styles.verticalDivider} />

          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Bonus Earned</Text>
            <Text style={[styles.metricValue, styles.bonusText]}>
              {isBalanceHidden ? '••••' : formatPaiseToINR(totalBonus)}
            </Text>
          </View>
        </View>

        {/* Quick Actions (Deposit & Withdraw) */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.depositBtn]}
            onPress={onDepositPress}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-down-circle" size={18} color={colors.primaryDark} />
            <Text style={styles.depositBtnText}>Deposit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.withdrawBtn]}
            onPress={onWithdrawPress}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-up-circle" size={18} color={colors.white} />
            <Text style={styles.withdrawBtnText}>Withdraw</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  shadowWrapper: {
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 22,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  card: {
    borderRadius: 22,
    padding: 20,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  balanceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  balanceLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  eyeBtn: {
    marginLeft: 8,
    padding: 2,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.5,
  },
  bonusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  bonusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
    marginLeft: 4,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginVertical: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricItem: {
    flex: 1,
  },
  verticalDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 8,
  },
  metricLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '500',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  bonusText: {
    color: '#FCD34D',
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
  },
  depositBtn: {
    backgroundColor: colors.white,
  },
  depositBtnText: {
    color: colors.primaryDark,
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 6,
  },
  withdrawBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  withdrawBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 6,
  },
});

export default BalanceCard;

