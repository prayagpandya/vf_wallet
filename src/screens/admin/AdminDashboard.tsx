import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { StatCard } from '../../components/cards/StatCard';
import { TransactionRow } from '../../components/cards/TransactionRow';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { SecondaryButton } from '../../components/buttons/SecondaryButton';
import { useAuth } from '../../hooks/useAuth';
import { useWallet } from '../../hooks/useWallet';
import { formatPaiseToINR } from '../../utils/currency';

type DateFilterType = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom';

// Helpers for clean date comparisons
const getStartOfDay = (date: Date): number => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const getEndOfDay = (date: Date): number => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
};

const formatDateStr = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatPoints = (paise?: number) => {
  if (paise === undefined || paise === null) return '0 Pts';
  return `${(paise / 100).toLocaleString('en-IN')} Pts`;
};

export const AdminDashboard = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { user, isSuperAdmin, permissions } = useAuth();
  const { adminStats, transactions, refreshData } = useWallet();

  const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
  const [isCustomDateModalVisible, setIsCustomDateModalVisible] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [inputStartDate, setInputStartDate] = useState('');
  const [inputEndDate, setInputEndDate] = useState('');

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  const now = new Date();
  const todayStart = getStartOfDay(now);
  const todayEnd = getEndOfDay(now);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStart = getStartOfDay(yesterday);
  const yesterdayEnd = getEndOfDay(yesterday);

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const sevenDaysStart = getStartOfDay(sevenDaysAgo);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  // Filter transactions by selected date range
  const filteredTransactions = useMemo(() => {
    return transactions.filter((txn) => {
      const txnTime = new Date(txn.createdAt).getTime();
      if (dateFilter === 'today') {
        if (txnTime < todayStart || txnTime > todayEnd) return false;
      } else if (dateFilter === 'yesterday') {
        if (txnTime < yesterdayStart || txnTime > yesterdayEnd) return false;
      } else if (dateFilter === 'week') {
        if (txnTime < sevenDaysStart) return false;
      } else if (dateFilter === 'month') {
        if (txnTime < startOfMonth) return false;
      } else if (dateFilter === 'custom') {
        if (customStartDate) {
          const start = getStartOfDay(new Date(customStartDate));
          if (!isNaN(start) && txnTime < start) return false;
        }
        if (customEndDate) {
          const end = getEndOfDay(new Date(customEndDate));
          if (!isNaN(end) && txnTime > end) return false;
        }
      }
      return true;
    });
  }, [
    transactions,
    dateFilter,
    todayStart,
    todayEnd,
    yesterdayStart,
    yesterdayEnd,
    sevenDaysStart,
    startOfMonth,
    customStartDate,
    customEndDate,
  ]);

  // Compute the 4 metrics dynamically from filtered transactions
  const computedMetrics = useMemo(() => {
    if (dateFilter === 'all' && adminStats) {
      return {
        totalCashDepositedPaise:
          adminStats.totalCashDepositedPaise ??
          adminStats.totalApprovedDepositsPaise ??
          0,
        totalPointsDepositedPaise:
          adminStats.totalPointsDepositedPaise ??
          (adminStats.totalApprovedDepositsPaise + adminStats.totalBonusGivenPaise),
        totalPointsWithdrawnPaise:
          adminStats.totalPointsWithdrawnPaise ??
          adminStats.totalApprovedWithdrawalsPaise ??
          0,
        totalCashWithdrawnPaise:
          adminStats.totalCashWithdrawnPaise ??
          adminStats.totalApprovedWithdrawalsPaise ??
          0,
      };
    }

    let cashDeposited = 0;
    let pointsDeposited = 0;
    let pointsWithdrawn = 0;
    let cashWithdrawn = 0;

    for (const t of filteredTransactions) {
      if (t.status === 'approved') {
        if (t.type === 'deposit') {
          cashDeposited += t.amountPaise || 0;
          pointsDeposited +=
            t.totalCreditPaise ?? (t.amountPaise + (t.bonusPaise || 0));
        } else if (t.type === 'withdrawal') {
          pointsWithdrawn += t.amountPaise || 0;
          cashWithdrawn +=
            t.cashPaidPaise ??
            Math.max(0, (t.amountPaise || 0) - (t.bonusPaise || 0));
        }
      }
    }

    return {
      totalCashDepositedPaise: cashDeposited,
      totalPointsDepositedPaise: pointsDeposited,
      totalPointsWithdrawnPaise: pointsWithdrawn,
      totalCashWithdrawnPaise: cashWithdrawn,
    };
  }, [dateFilter, adminStats, filteredTransactions]);

  const recentTransactions = useMemo(() => {
    return filteredTransactions
      .slice()
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 6);
  }, [filteredTransactions]);

  const handleApplyCustomDates = () => {
    const s = inputStartDate.trim();
    const e = inputEndDate.trim();

    if (s && isNaN(new Date(s).getTime())) {
      Alert.alert('Invalid Date', 'Please enter a valid Start Date (YYYY-MM-DD).');
      return;
    }
    if (e && isNaN(new Date(e).getTime())) {
      Alert.alert('Invalid Date', 'Please enter a valid End Date (YYYY-MM-DD).');
      return;
    }

    setCustomStartDate(s);
    setCustomEndDate(e);
    setDateFilter('custom');
    setIsCustomDateModalVisible(false);
  };

  const handleClearCustomDates = () => {
    setInputStartDate('');
    setInputEndDate('');
    setCustomStartDate('');
    setCustomEndDate('');
    setDateFilter('all');
  };

  const setShortcutRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setInputStartDate(formatDateStr(start));
    setInputEndDate(formatDateStr(end));
  };

  const canDepositAny =
    isSuperAdmin || permissions.canOcrUpload || permissions.canDeposit;
  const canWithdraw = isSuperAdmin || permissions.canWithdraw;
  const canViewClients = true; // All staff and superadmin can view and manage clients
  const canManageDailyRules =
    isSuperAdmin || permissions.canSetBonus;

  const activePermissionTags = [
    permissions.canOcrUpload && 'OCR Upload',
    permissions.canDeposit && 'Deposit',
    permissions.canWithdraw && 'Withdraw',
    permissions.canSetBonus && 'Bonus %',
    permissions.canManageClients && 'Client Data',
  ].filter(Boolean) as string[];

  return (
    <ScreenContainer
      scrollable
      refreshing={refreshing}
      onRefresh={onRefresh}
      backgroundColor={colors.background}
    >
      <Header
        greeting={isSuperAdmin ? 'Super Admin Console' : 'Employee Portal'}
        userName={user?.name || 'Staff Member'}
        showProfile
        onProfilePress={() => navigation.navigate('AdminProfile')}
        rightAction={
          <View
            style={[
              styles.rolePill,
              !isSuperAdmin && { backgroundColor: '#EDE9FE' },
            ]}
          >
            <Ionicons
              name={isSuperAdmin ? 'shield-checkmark' : 'person-circle'}
              size={14}
              color={isSuperAdmin ? colors.primary : '#7C3AED'}
            />
            <Text
              style={[
                styles.rolePillText,
                !isSuperAdmin && { color: '#6D28D9' },
              ]}
            >
              {isSuperAdmin ? 'Super Admin' : 'Employee'}
            </Text>
          </View>
        }
      />

      <View style={styles.content}>
        {/* Auto-Accept Operational Mode Strip */}
        <View style={styles.autoAcceptStrip}>
          <View style={styles.greenDot} />
          <Text style={styles.autoAcceptStripText}>
            Auto-Accept Mode Active • Instant Verified Processing
          </Text>
        </View>

        {/* Employee Assigned Permissions Card (for Employees) */}
        {!isSuperAdmin && (
          <View style={styles.empPermsBanner}>
            <Text style={styles.empPermsTitle}>Your Assigned Permissions</Text>
            <View style={styles.empPermsRow}>
              {activePermissionTags.length > 0 ? (
                activePermissionTags.map((tag) => (
                  <View key={tag} style={styles.empPermPill}>
                    <Ionicons name="checkmark-circle" size={12} color="#6D28D9" />
                    <Text style={styles.empPermPillText}>{tag}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noPermHint}>
                  No operational permissions assigned yet. Contact Super Admin.
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Date Filter Bar */}
        <View style={styles.filterSection}>
          <View style={styles.filterHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="calendar-outline" size={15} color={colors.text} />
              <Text style={styles.filterSectionLabel}>Filter Dashboard by Date</Text>
            </View>
            {dateFilter === 'custom' && (customStartDate || customEndDate) && (
              <TouchableOpacity
                onPress={handleClearCustomDates}
                style={styles.clearDateBadge}
              >
                <Text style={styles.clearDateBadgeText}>
                  {customStartDate || 'Any'} → {customEndDate || 'Today'} ✕
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipRow}
            contentContainerStyle={styles.chipContainer}
          >
            {(
              [
                { key: 'all', label: 'All Dates' },
                { key: 'today', label: 'Today' },
                { key: 'yesterday', label: 'Yesterday' },
                { key: 'week', label: 'Last 7 Days' },
                { key: 'month', label: 'This Month' },
                {
                  key: 'custom',
                  label:
                    dateFilter === 'custom' && (customStartDate || customEndDate)
                      ? `Range: ${customStartDate || '…'} - ${customEndDate || '…'}`
                      : 'Custom Range 📅',
                },
              ] as const
            ).map((item) => {
              const isSelected = dateFilter === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.dateChip,
                    isSelected && styles.dateChipSelected,
                  ]}
                  onPress={() => {
                    if (item.key === 'custom') {
                      setIsCustomDateModalVisible(true);
                    } else {
                      setDateFilter(item.key);
                    }
                  }}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.dateChipText,
                      isSelected && styles.dateChipTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Section Title */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Points & Cash Ledger</Text>
          {dateFilter !== 'all' && (
            <View style={styles.activeFilterPill}>
              <Text style={styles.activeFilterPillText}>
                {dateFilter === 'today'
                  ? 'Showing: Today'
                  : dateFilter === 'yesterday'
                    ? 'Showing: Yesterday'
                    : dateFilter === 'week'
                      ? 'Showing: Last 7 Days'
                      : dateFilter === 'month'
                        ? 'Showing: This Month'
                        : `Showing: ${customStartDate || 'Start'} to ${customEndDate || 'Now'}`}
              </Text>
            </View>
          )}
        </View>

        {/* The 4 Core Metrics Grid */}
        <View style={styles.statsGrid}>
          <StatCard
            title="Total Cash Deposited"
            value={formatPaiseToINR(computedMetrics.totalCashDepositedPaise)}
            subtitle="Actual cash principal received"
            icon="cash-outline"
            variant="success"
            onPress={
              canDepositAny
                ? () => navigation.navigate('ClientOcrDeposit')
                : undefined
            }
          />

          <StatCard
            title="Total Points Deposited"
            value={formatPoints(computedMetrics.totalPointsDepositedPaise)}
            subtitle="Cash + bonus points allocated"
            icon="sparkles"
            variant="primary"
          />

          <StatCard
            title="Total Points Withdrawn"
            value={formatPoints(computedMetrics.totalPointsWithdrawnPaise)}
            subtitle="Gross points redeemed"
            icon="arrow-up-circle"
            variant="danger"
            onPress={
              canWithdraw
                ? () => navigation.navigate('ClientWithdraw')
                : undefined
            }
          />

          <StatCard
            title="Total Cash Withdrawn"
            value={formatPaiseToINR(computedMetrics.totalCashWithdrawnPaise)}
            subtitle="Actual cash payouts sent"
            icon="wallet-outline"
            variant="warning"
            onPress={
              canWithdraw
                ? () => navigation.navigate('ClientWithdraw')
                : undefined
            }
          />

          <StatCard
            title="Total Clients"
            value={(adminStats?.totalClients ?? adminStats?.totalUsers ?? 0).toString()}
            subtitle="Managed client accounts"
            icon="people"
            variant="primary"
            onPress={canViewClients ? () => navigation.navigate('Users') : undefined}
          />

          {isSuperAdmin && (
            <StatCard
              title="Staff Employees"
              value={(adminStats?.totalEmployees ?? 0).toString()}
              subtitle="Active login staff"
              icon="shield-checkmark"
              variant="info"
              onPress={() =>
                navigation.navigate('Users', { initialTab: 'EMPLOYEE' })
              }
            />
          )}

          <StatCard
            title="Processed Ledger"
            value={(adminStats?.totalTransactionsCount ?? transactions.length).toString()}
            subtitle="All verified entries"
            icon="document-text"
            variant="info"
            onPress={() => navigation.navigate('AdminTransactions')}
          />
        </View>
        {/* 
        <StatCard
          title="Processed Ledger"
          value={(adminStats?.totalTransactionsCount ?? transactions.length).toString()}
          subtitle="All verified entries"
          icon="document-text"
          variant="info"
          onPress={() => navigation.navigate('AdminTransactions')}
        /> */}
      </View>

      {/* Permission-Gated Quick Actions */}
      <View style={styles.managementCard}>
        <Text style={styles.managementTitle}>Quick Operations</Text>
        <View style={styles.actionsGrid}>
          {canDepositAny && (
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => navigation.navigate('ClientOcrDeposit')}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="scan" size={20} color="#7C3AED" />
              </View>
              <Text style={styles.actionItemText}>OCR Deposit</Text>
            </TouchableOpacity>
          )}

          {canWithdraw && (
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => navigation.navigate('ClientWithdraw')}
            >
              <View
                style={[styles.actionIconBox, { backgroundColor: colors.dangerLight }]}
              >
                <Ionicons name="arrow-up" size={20} color={colors.danger} />
              </View>
              <Text style={styles.actionItemText}>Withdraw</Text>
            </TouchableOpacity>
          )}

          {canViewClients && (
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() =>
                navigation.navigate('Users', { initialTab: 'CLIENT' })
              }
            >
              <View
                style={[styles.actionIconBox, { backgroundColor: colors.lightBlue }]}
              >
                <Ionicons name="people" size={20} color={colors.primary} />
              </View>
              <Text style={styles.actionItemText}>Clients</Text>
            </TouchableOpacity>
          )}

          {canManageDailyRules && (
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => navigation.navigate('BonusSettings')}
            >
              <View
                style={[styles.actionIconBox, { backgroundColor: '#FEF3C7' }]}
              >
                <Ionicons name="options-outline" size={20} color={colors.warningDark} />
              </View>
              <Text style={styles.actionItemText}>Daily Rules</Text>
            </TouchableOpacity>
          )}

          {isSuperAdmin ? (
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() =>
                navigation.navigate('Users', { initialTab: 'EMPLOYEE' })
              }
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="key" size={20} color={colors.warningDark} />
              </View>
              <Text style={styles.actionItemText}>Employees</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => navigation.navigate('AdminTransactions')}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="list" size={20} color="#15803D" />
              </View>
              <Text style={styles.actionItemText}>Ledger</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => navigation.navigate('BackupRestore')}
          >
            <View style={[styles.actionIconBox, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="archive-outline" size={20} color="#7C3AED" />
            </View>
            <Text style={styles.actionItemText}>Backup</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Backup & Restore Console Banner */}
      <TouchableOpacity
        style={styles.backupBanner}
        onPress={() => navigation.navigate('BackupRestore')}
        activeOpacity={0.85}
      >
        <View style={styles.backupBannerLeft}>
          <View style={styles.backupBannerIcon}>
            <Ionicons name="archive" size={22} color="#7C3AED" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.backupBannerTitle}>
              {isSuperAdmin ? 'Backup & Zero-State Reset Console' : 'Backup & Restore Center'}
            </Text>
            <Text style={styles.backupBannerSub}>
              {isSuperAdmin
                ? 'One-click app data soft reset, restore archived files, or manage deletions'
                : 'Select archived data files and restore ledger snapshots'}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#7C3AED" />
      </TouchableOpacity>

      {/* Recent Auto-Approved Transactions */}
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        {transactions.length > 0 && (
          <TouchableOpacity
            onPress={() => navigation.navigate('AdminTransactions')}
          >
            <Text style={styles.viewAllText}>View All</Text>
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
            <Text style={styles.zeroStateTitle}>No Activity Yet</Text>
            <Text style={styles.zeroStateSub}>
              Create a client account and scan a verified receipt screenshot to
              auto-credit their wallet.
            </Text>
          </View>
        )}
      </View>


      {/* Custom Date Range Modal */}
      <Modal
        visible={isCustomDateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCustomDateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <Ionicons name="calendar" size={20} color={colors.primary} />
                <Text style={styles.modalTitle}>Custom Date Range</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsCustomDateModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              Filter dashboard statistics & transactions by a specific date window (YYYY-MM-DD).
            </Text>

            {/* Quick Range Presets */}
            <View style={styles.shortcutRow}>
              <TouchableOpacity
                style={styles.shortcutChip}
                onPress={() => setShortcutRange(7)}
              >
                <Text style={styles.shortcutChipText}>Last 7 Days</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shortcutChip}
                onPress={() => setShortcutRange(30)}
              >
                <Text style={styles.shortcutChipText}>Last 30 Days</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shortcutChip}
                onPress={() => setShortcutRange(90)}
              >
                <Text style={styles.shortcutChipText}>Last 90 Days</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Start Date (From)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="YYYY-MM-DD (e.g. 2026-11-01)"
                placeholderTextColor={colors.textLight}
                value={inputStartDate}
                onChangeText={setInputStartDate}
                maxLength={10}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>End Date (To)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="YYYY-MM-DD (e.g. 2026-11-24)"
                placeholderTextColor={colors.textLight}
                value={inputEndDate}
                onChangeText={setInputEndDate}
                maxLength={10}
              />
            </View>

            <View style={styles.modalBtnRow}>
              <SecondaryButton
                title="Cancel"
                onPress={() => setIsCustomDateModalVisible(false)}
                style={{ flex: 1 }}
              />
              <PrimaryButton
                title="Apply Range"
                onPress={handleApplyCustomDates}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightBlue,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
    marginRight: 6,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
    marginLeft: 4,
  },
  autoAcceptStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 8,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  autoAcceptStripText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  empPermsBanner: {
    backgroundColor: '#F5F3FF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  empPermsTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#5B21B6',
    marginBottom: 8,
  },
  empPermsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  empPermPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  empPermPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6D28D9',
  },
  noPermHint: {
    fontSize: 12,
    color: '#6D28D9',
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
    flexWrap: 'wrap',
    gap: 10,
  },
  actionItem: {
    alignItems: 'center',
    width: '22%',
    minWidth: 72,
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
  filterSection: {
    marginBottom: 12,
  },
  filterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  filterSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clearDateBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  clearDateBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#991B1B',
  },
  chipRow: {
    marginBottom: 2,
  },
  chipContainer: {
    gap: 8,
  },
  dateChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  dateChipSelected: {
    backgroundColor: '#1E293B',
    borderColor: '#1E293B',
  },
  dateChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  dateChipTextSelected: {
    color: colors.white,
    fontWeight: '700',
  },
  activeFilterPill: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activeFilterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6D28D9',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 18,
  },
  shortcutRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  shortcutChip: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  shortcutChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  backupBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F3FF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
  },
  backupBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  backupBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backupBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#5B21B6',
  },
  backupBannerSub: {
    fontSize: 11,
    color: '#6D28D9',
    marginTop: 2,
    lineHeight: 15,
  },
});

export default AdminDashboard;
