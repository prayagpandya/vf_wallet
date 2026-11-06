import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { TransactionRow } from '../../components/cards/TransactionRow';
import { EmptyState } from '../../components/common/EmptyState';
import { useWallet } from '../../hooks/useWallet';

export const AdminTransactionHistory = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { transactions, refreshData } = useWallet();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'deposit' | 'withdrawal' | 'bonus'>(
    'all'
  );
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'approved' | 'pending' | 'rejected'
  >('all');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  const sortedTransactions = transactions
    .slice()
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  const filteredTransactions = sortedTransactions.filter((txn) => {
    if (typeFilter !== 'all' && txn.type !== typeFilter) return false;
    if (statusFilter !== 'all' && txn.status !== statusFilter) return false;
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

  return (
    <ScreenContainer
      scrollable
      refreshing={refreshing}
      onRefresh={onRefresh}
      backgroundColor={colors.background}
    >
      <Header
        title="Master Ledger"
        subtitle={`All platform transactions (${transactions.length})`}
      />

      <View style={styles.content}>
        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by User Name, ID, or TXN Ref..."
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

        {/* Type Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipRow}
          contentContainerStyle={styles.chipContainer}
        >
          {(['all', 'deposit', 'withdrawal', 'bonus'] as const).map((type) => {
            const isSelected = typeFilter === type;
            const labels = {
              all: 'All Types',
              deposit: 'Deposits',
              withdrawal: 'Withdrawals',
              bonus: 'Bonuses',
            };
            return (
              <TouchableOpacity
                key={type}
                style={[
                  styles.filterChip,
                  isSelected && styles.filterChipSelected,
                ]}
                onPress={() => setTypeFilter(type)}
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

        {/* Status Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipRow}
          contentContainerStyle={styles.chipContainer}
        >
          {(['all', 'approved', 'pending', 'rejected'] as const).map((status) => {
            const isSelected = statusFilter === status;
            const labels = {
              all: 'All Status',
              approved: 'Approved ✅',
              pending: 'Pending ⏳',
              rejected: 'Rejected ❌',
            };
            return (
              <TouchableOpacity
                key={status}
                style={[
                  styles.statusChip,
                  isSelected && styles.statusChipSelected,
                ]}
                onPress={() => setStatusFilter(status)}
              >
                <Text
                  style={[
                    styles.statusChipText,
                    isSelected && styles.statusChipTextSelected,
                  ]}
                >
                  {labels[status]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Ledger List */}
        <View style={styles.listContainer}>
          {filteredTransactions.length > 0 ? (
            filteredTransactions.map((item) => (
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
          ) : transactions.length === 0 ? (
            <EmptyState
              icon="receipt-text-outline"
              title="No Ledger Records Yet"
              description="System ledger is completely clean. User deposits and withdrawals will appear here automatically once initiated."
            />
          ) : (
            <EmptyState
              icon="receipt-text-outline"
              title="No records found"
              description="No ledger transactions matched the active filters."
              actionLabel="Clear Filters"
              onAction={() => {
                setTypeFilter('all');
                setStatusFilter('all');
                setSearchQuery('');
              }}
            />
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
  chipRow: {
    marginBottom: 8,
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
  },
  statusChip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusChipSelected: {
    backgroundColor: colors.lightBlue,
    borderColor: colors.primary,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  statusChipTextSelected: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  listContainer: {
    marginTop: 4,
  },
});

export default AdminTransactionHistory;

