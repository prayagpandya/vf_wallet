import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { StatCard } from '../../components/cards/StatCard';
import { TransactionRow } from '../../components/cards/TransactionRow';
import { useAuth } from '../../hooks/useAuth';
import { useWallet } from '../../hooks/useWallet';
import { formatPaiseToINR } from '../../utils/currency';

export const AdminDashboard = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { user } = useAuth();
  const { adminStats, transactions, bonusConfig, refreshData } = useWallet();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  const pendingDeposits = transactions.filter(
    (t) => t.type === 'deposit' && t.status === 'pending'
  );
  const pendingWithdrawals = transactions.filter(
    (t) => t.type === 'withdrawal' && t.status === 'pending'
  );

  const totalPendingActions =
    pendingDeposits.length + pendingWithdrawals.length;

  const recentTransactions = transactions
    .slice()
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 5);

  return (
    <ScreenContainer
      scrollable
      refreshing={refreshing}
      onRefresh={onRefresh}
      backgroundColor={colors.background}
    >
      <Header
        greeting="Admin Console"
        userName={user?.name || 'Administrator'}
        showProfile
        onProfilePress={() => navigation.navigate('AdminProfile')}
        rightAction={
          <View style={styles.adminRolePill}>
            <Ionicons name="shield-checkmark" size={14} color={colors.primary} />
            <Text style={styles.adminRoleText}>Super Admin</Text>
          </View>
        }
      />

      <View style={styles.content}>
        {/* Urgent Action Banner if pending requests exist */}
        {totalPendingActions > 0 && (
          <View style={styles.alertBanner}>
            <View style={styles.alertIconCircle}>
              <Ionicons name="alert-circle" size={20} color={colors.warningDark} />
            </View>
            <View style={styles.alertTextCol}>
              <Text style={styles.alertTitle}>
                {totalPendingActions} Requests Require Verification
              </Text>
              <Text style={styles.alertSub}>
                {pendingDeposits.length} deposits & {pendingWithdrawals.length}{' '}
                withdrawals pending.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.reviewBtn}
              onPress={() =>
                navigation.navigate(
                  pendingDeposits.length > 0 ? 'DepositRequests' : 'WithdrawalRequests'
                )
              }
            >
              <Text style={styles.reviewBtnText}>Review</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Section Title */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Key Financial Metrics</Text>
          <Text style={styles.activeBonusTag}>
            Bonus: {bonusConfig.isEnabled ? `${bonusConfig.bonusPercentage}%` : 'Disabled'}
          </Text>
        </View>

        {/* 6 Statistic Cards in Grid */}
        <View style={styles.statsGrid}>
          <StatCard
            title="Total Users"
            value={adminStats ? adminStats.totalUsers.toString() : '0'}
            subtitle="Registered demo accounts"
            icon="people"
            variant="primary"
            onPress={() => navigation.navigate('Users')}
          />

          <StatCard
            title="Wallet Liability"
            value={
              adminStats
                ? formatPaiseToINR(adminStats.totalWalletLiabilityPaise)
                : '₹0'
            }
            subtitle="Total user balances"
            icon="wallet"
            variant="info"
          />

          <StatCard
            title="Approved Deposits"
            value={
              adminStats
                ? formatPaiseToINR(adminStats.totalApprovedDepositsPaise)
                : '₹0'
            }
            subtitle="Total deposit volume"
            icon="arrow-down-circle"
            variant="success"
            onPress={() => navigation.navigate('DepositRequests')}
          />

          <StatCard
            title="Approved Withdrawals"
            value={
              adminStats
                ? formatPaiseToINR(adminStats.totalApprovedWithdrawalsPaise)
                : '₹0'
            }
            subtitle="Total disbursed"
            icon="arrow-up-circle"
            variant="danger"
            onPress={() => navigation.navigate('WithdrawalRequests')}
          />

          <StatCard
            title="Total Bonus Disbursed"
            value={
              adminStats
                ? formatPaiseToINR(adminStats.totalBonusGivenPaise)
                : '₹0'
            }
            subtitle="Promotional credit"
            icon="gift"
            variant="warning"
            onPress={() => navigation.navigate('BonusSettings')}
          />

          <StatCard
            title="Pending Requests"
            value={(
              (adminStats?.pendingDepositRequestsCount || 0) +
              (adminStats?.pendingWithdrawalRequestsCount || 0)
            ).toString()}
            subtitle={`${adminStats?.pendingDepositRequestsCount || 0} dep / ${
              adminStats?.pendingWithdrawalRequestsCount || 0
            } wdr`}
            icon="time"
            variant={totalPendingActions > 0 ? 'warning' : 'info'}
            onPress={() => navigation.navigate('DepositRequests')}
          />
        </View>

        {/* Quick Management Shortcuts */}
        <View style={styles.managementCard}>
          <Text style={styles.managementTitle}>Quick Admin Controls</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => navigation.navigate('ScreenshotVerification')}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="scan" size={20} color="#7C3AED" />
              </View>
              <Text style={styles.actionItemText}>OCR Verify</Text>
              {pendingDeposits.length > 0 && (
                <View style={styles.badgeSmall}>
                  <Text style={styles.badgeSmallText}>{pendingDeposits.length}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => navigation.navigate('DepositRequests')}
            >
              <View style={[styles.actionIconBox, { backgroundColor: colors.lightBlue }]}>
                <Ionicons name="arrow-down" size={20} color={colors.primary} />
              </View>
              <Text style={styles.actionItemText}>Deposits</Text>
              {pendingDeposits.length > 0 && (
                <View style={styles.badgeSmall}>
                  <Text style={styles.badgeSmallText}>{pendingDeposits.length}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => navigation.navigate('WithdrawalRequests')}
            >
              <View style={[styles.actionIconBox, { backgroundColor: colors.dangerLight }]}>
                <Ionicons name="arrow-up" size={20} color={colors.danger} />
              </View>
              <Text style={styles.actionItemText}>Payouts</Text>
              {pendingWithdrawals.length > 0 && (
                <View style={styles.badgeSmall}>
                  <Text style={styles.badgeSmallText}>{pendingWithdrawals.length}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => navigation.navigate('BonusSettings')}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="options" size={20} color={colors.warningDark} />
              </View>
              <Text style={styles.actionItemText}>Bonus (5%)</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Platform Transactions */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Recent Global Transactions</Text>
          {transactions.length > 0 && (
            <TouchableOpacity
              onPress={() => navigation.navigate('AdminTransactions')}
            >
              <Text style={styles.viewAllText}>View Ledger</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.transactionsContainer}>
          {recentTransactions.length > 0 ? (
            recentTransactions.map((item) => (
              <TransactionRow
                key={item.id}
                transaction={item}
                showUserName
                onPress={() =>
                  navigation.navigate('TransactionDetails', {
                    transactionId: item.id,
                  })
                }
              />
            ))
          ) : (
            <View style={styles.zeroStateBox}>
              <Ionicons
                name="wallet-outline"
                size={36}
                color={colors.textLight}
              />
              <Text style={styles.zeroStateTitle}>Zero Activity State</Text>
              <Text style={styles.zeroStateSub}>
                No platform transactions yet. New user deposits will appear here
                once submitted via screenshot OCR.
              </Text>
            </View>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  adminRolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightBlue,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
    marginRight: 6,
  },
  adminRoleText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
    marginLeft: 4,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  alertIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  alertTextCol: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  alertSub: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 2,
  },
  reviewBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  reviewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  activeBonusTag: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.lightBlue,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  managementCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  managementTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionItem: {
    alignItems: 'center',
    width: '23%',
    position: 'relative',
  },
  actionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionItemText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  badgeSmall: {
    position: 'absolute',
    top: -2,
    right: 4,
    backgroundColor: colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeSmallText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '800',
  },
  zeroStateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 20,
  },
  zeroStateTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
  },
  zeroStateSub: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  transactionsContainer: {
    marginTop: 4,
  },
});

export default AdminDashboard;

