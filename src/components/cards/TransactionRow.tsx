import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Transaction } from '../../types';
import { colors } from '../../theme/colors';
import { formatPaiseToINR } from '../../utils/currency';
import { StatusBadge } from '../common/StatusBadge';

interface TransactionRowProps {
  transaction: Transaction;
  onPress: () => void;
  showUserName?: boolean;
}

export const TransactionRow: React.FC<TransactionRowProps> = ({
  transaction,
  onPress,
  showUserName = false,
}) => {
  const isDeposit = transaction.type === 'deposit';
  const isWithdrawal = transaction.type === 'withdrawal';
  const isBonus = transaction.type === 'bonus';

  const typeConfig = {
    deposit: {
      icon: 'arrow-down' as const,
      color: colors.success,
      bgColor: colors.successLight,
      sign: '+',
      label: 'Deposit',
    },
    withdrawal: {
      icon: 'arrow-up' as const,
      color: colors.danger,
      bgColor: colors.dangerLight,
      sign: '-',
      label: 'Withdrawal',
    },
    bonus: {
      icon: 'gift' as const,
      color: colors.warning,
      bgColor: colors.warningLight,
      sign: '+',
      label: 'Bonus Reward',
    },
  }[transaction.type];

  // Format date readable
  const dateObj = new Date(transaction.createdAt);
  const formattedDate = dateObj.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = dateObj.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.leftRow}>
        <View style={[styles.iconCircle, { backgroundColor: typeConfig.bgColor }]}>
          <Ionicons name={typeConfig.icon} size={20} color={typeConfig.color} />
        </View>

        <View style={styles.infoCol}>
          <Text style={styles.titleText}>
            {showUserName ? transaction.userName : typeConfig.label}
          </Text>
          <Text style={styles.dateText}>
            {formattedDate} • {formattedTime}
          </Text>
          {showUserName && (
            <Text style={styles.subText}>{typeConfig.label}</Text>
          )}
        </View>
      </View>

      <View style={styles.rightCol}>
        <Text
          style={[
            styles.amountText,
            {
              color: isWithdrawal
                ? colors.danger
                : transaction.status === 'rejected'
                ? colors.textMuted
                : colors.success,
            },
          ]}
        >
          {typeConfig.sign}
          {formatPaiseToINR(transaction.amountPaise)}
        </Text>

        {isDeposit && transaction.bonusPaise ? (
          <Text style={styles.bonusText}>
            +{formatPaiseToINR(transaction.bonusPaise)} bonus
          </Text>
        ) : null}

        <View style={styles.badgeWrapper}>
          <StatusBadge status={transaction.status} size="sm" />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoCol: {
    flex: 1,
  },
  titleText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
  },
  dateText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  subText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  rightCol: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  amountText: {
    fontSize: 15,
    fontWeight: '700',
  },
  bonusText: {
    fontSize: 11,
    color: colors.warningDark,
    fontWeight: '600',
    marginTop: 2,
  },
  badgeWrapper: {
    marginTop: 4,
  },
});

export default TransactionRow;

