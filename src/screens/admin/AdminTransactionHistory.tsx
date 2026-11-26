import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { TransactionRow } from '../../components/cards/TransactionRow';
import { EmptyState } from '../../components/common/EmptyState';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { SecondaryButton } from '../../components/buttons/SecondaryButton';
import { useWallet } from '../../hooks/useWallet';
import { useAuth } from '../../hooks/useAuth';
import { adminApi } from '../../services/api';
import { formatPaiseToINR } from '../../utils/currency';
import { Transaction } from '../../types';

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

export const AdminTransactionHistory = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { transactions, refreshData } = useWallet();
  const { isSuperAdmin } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'deposit' | 'withdrawal'>('all');
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
  const [isDeletingTxnId, setIsDeletingTxnId] = useState<string | null>(null);

  // Custom date range state
  const [isCustomDateModalVisible, setIsCustomDateModalVisible] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [inputStartDate, setInputStartDate] = useState('');
  const [inputEndDate, setInputEndDate] = useState('');

  const [refreshing, setRefreshing] = useState(false);

  const handlePromptDeleteTxn = (txn: Transaction) => {
    const formattedAmt =
      txn.type === 'deposit'
        ? formatPaiseToINR(txn.amountPaise)
        : formatPaiseToINR(txn.cashPaidPaise || txn.amountPaise);

    Alert.alert(
      'Delete Transaction?',
      `Are you sure you want to remove this ${txn.type.toUpperCase()} of ${formattedAmt} for ${
        txn.userName || 'Client'
      } from the live ledger?\n\n• The transaction will be removed from the live ledger view.\n• Client balance will be adjusted accordingly.\n• It will be safely saved in Backup & Restore and can be restored at any time.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete & Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeletingTxnId(txn.id);
              const res = await adminApi.deleteTransaction(txn.id);
              if (res.success) {
                Alert.alert(
                  'Transaction Deleted',
                  'Transaction moved to Backup & Restore. Client points have been adjusted.'
                );
                await refreshData();
              } else {
                Alert.alert('Error', res.error || 'Failed to delete transaction.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Error occurred while deleting transaction.');
            } finally {
              setIsDeletingTxnId(null);
            }
          },
        },
      ]
    );
  };

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

  const sortedTransactions = transactions
    .slice()
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  const filteredTransactions = sortedTransactions.filter((txn) => {
    // 1. Type Filter (All, Deposit, Withdrawal)
    if (typeFilter !== 'all' && txn.type !== typeFilter) return false;

    // 2. Date Filter
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

    // 3. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = txn.userName.toLowerCase().includes(q);
      const matchId = txn.id.toLowerCase().includes(q);
      const matchUser = txn.userId.toLowerCase().includes(q);
      const matchPhone = txn.userPhone?.includes(q);
      return matchName || matchId || matchUser || matchPhone;
    }
    return true;
  });

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
    setIsCustomDateModalVisible(false);
  };

  const handleQuickPresetInModal = (daysAgo: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - daysAgo);
    setInputStartDate(formatDateStr(start));
    setInputEndDate(formatDateStr(end));
  };

  const handleClearAllFilters = () => {
    setTypeFilter('all');
    setDateFilter('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setSearchQuery('');
  };

  return (
    <ScreenContainer
      scrollable
      refreshing={refreshing}
      onRefresh={onRefresh}
      backgroundColor={colors.background}
    >
      <Header
        title="Processed Ledger"
        subtitle={`All verified transactions (${filteredTransactions.length} of ${transactions.length})`}
      />

      <View style={styles.content}>
        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by Client Name, Phone, or TXN Ref..."
            placeholderTextColor={colors.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* 1. Type Filter (All, Deposit, Withdrawal) */}
        <View style={styles.filterSection}>
          <Text style={styles.filterSectionLabel}>Transaction Type</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipRow}
            contentContainerStyle={styles.chipContainer}
          >
            {(['all', 'deposit', 'withdrawal'] as const).map((type) => {
              const isSelected = typeFilter === type;
              const labels = {
                all: 'All Types',
                deposit: 'Deposits 📥',
                withdrawal: 'Withdrawals 📤',
              };
              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.filterChip,
                    isSelected && styles.filterChipSelected,
                  ]}
                  onPress={() => setTypeFilter(type)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      isSelected && styles.filterChipTextSelected,
                    ]}
                  >
                    {labels[type]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* 2. Date Filter */}
        <View style={styles.filterSection}>
          <View style={styles.filterHeaderRow}>
            <Text style={styles.filterSectionLabel}>Filter by Date</Text>
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
                { key: 'custom', label: 'Custom Range 📅' },
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
                      setInputStartDate(customStartDate);
                      setInputEndDate(customEndDate);
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

        {/* Active Filters Summary Strip */}
        {(typeFilter !== 'all' || dateFilter !== 'all' || searchQuery.trim()) && (
          <View style={styles.activeFiltersStrip}>
            <Text style={styles.activeFiltersText}>
              Filtered: {filteredTransactions.length} transaction
              {filteredTransactions.length === 1 ? '' : 's'}
            </Text>
            <TouchableOpacity onPress={handleClearAllFilters}>
              <Text style={styles.resetFiltersBtnText}>Reset All</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Ledger List */}
        <View style={styles.listContainer}>
          {filteredTransactions.length > 0 ? (
            filteredTransactions.map((item) => (
              <View key={item.id} style={styles.txnRowWrap}>
                <View style={{ flex: 1 }}>
                  <TransactionRow
                    transaction={item}
                    showUserName
                    onPress={() =>
                      navigation.navigate('TransactionDetails', {
                        transactionId: item.id,
                      })
                    }
                  />
                </View>
                <TouchableOpacity
                  style={styles.deleteTxnBtn}
                  onPress={() => handlePromptDeleteTxn(item)}
                  disabled={isDeletingTxnId === item.id}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={isDeletingTxnId === item.id ? colors.textLight : colors.danger}
                  />
                </TouchableOpacity>
              </View>
            ))
          ) : transactions.length === 0 ? (
            <EmptyState
              icon="receipt-text-outline"
              title="No Ledger Records Yet"
              description="System ledger is clean. Verified deposits and withdrawals will appear here automatically."
            />
          ) : (
            <EmptyState
              icon="receipt-text-outline"
              title="No records found"
              description="No ledger transactions matched the active filters."
              actionLabel="Clear Filters"
              onAction={handleClearAllFilters}
            />
          )}
        </View>
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
                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                <Text style={styles.modalTitle}>Select Date Range</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsCustomDateModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              Filter ledger transactions between specific calendar dates.
            </Text>

            <View style={styles.dateInputsRow}>
              <View style={styles.dateInputCol}>
                <Text style={styles.inputLabel}>From Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="2026-11-01"
                  placeholderTextColor={colors.textLight}
                  value={inputStartDate}
                  onChangeText={setInputStartDate}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.dateInputCol}>
                <Text style={styles.inputLabel}>To Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="2026-11-24"
                  placeholderTextColor={colors.textLight}
                  value={inputEndDate}
                  onChangeText={setInputEndDate}
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Quick Presets */}
            <Text style={[styles.inputLabel, { marginTop: 12 }]}>Quick Select</Text>
            <View style={styles.modalPresetsRow}>
              <TouchableOpacity
                style={styles.modalPresetBtn}
                onPress={() => handleQuickPresetInModal(7)}
              >
                <Text style={styles.modalPresetText}>Last 7 Days</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalPresetBtn}
                onPress={() => handleQuickPresetInModal(30)}
              >
                <Text style={styles.modalPresetText}>Last 30 Days</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalPresetBtn}
                onPress={() => handleQuickPresetInModal(90)}
              >
                <Text style={styles.modalPresetText}>Last 90 Days</Text>
              </TouchableOpacity>
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActionsRow}>
              <SecondaryButton
                title="Clear"
                onPress={handleClearCustomDates}
                style={{ flex: 1 }}
              />
              <PrimaryButton
                title="Apply Filter"
                onPress={handleApplyCustomDates}
                style={{ flex: 1.5 }}
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: colors.text,
  },
  filterSection: {
    marginBottom: 8,
  },
  filterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  filterSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  clearDateBadge: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  clearDateBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  chipRow: {
    marginBottom: 4,
  },
  chipContainer: {
    gap: 8,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  filterChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterChipTextSelected: {
    color: colors.white,
    fontWeight: '700',
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
  activeFiltersStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeFiltersText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  resetFiltersBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.danger,
  },
  listContainer: {
    marginTop: 4,
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
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  modalSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 14,
  },
  dateInputsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateInputCol: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  modalInput: {
    height: 44,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 12,
    fontSize: 13,
    color: colors.text,
  },
  modalPresetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  modalPresetBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalPresetText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  txnRowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteTxnBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 8,
  },
});

export default AdminTransactionHistory;

