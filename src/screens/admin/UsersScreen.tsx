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
import { UserCard } from '../../components/cards/UserCard';
import { EmptyState } from '../../components/common/EmptyState';
import { useWallet } from '../../hooks/useWallet';
import { calculateUserWallet } from '../../utils/calculations';

export const UsersScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { users, transactions, refreshData } = useWallet();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>(
    'all'
  );
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  const filteredUsers = users.filter((u) => {
    if (statusFilter !== 'all' && u.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = u.name.toLowerCase().includes(q);
      const matchId = u.id.toLowerCase().includes(q);
      const matchPhone = u.phone.includes(q);
      const matchEmail = u.email.toLowerCase().includes(q);
      return matchName || matchId || matchPhone || matchEmail;
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
        title="User Management"
        subtitle={`${users.length} registered demo accounts`}
      />

      <View style={styles.content}>
        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by Name, User ID or Phone..."
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

        {/* Status Filters */}
        <View style={styles.filterRow}>
          {(['all', 'active', 'blocked'] as const).map((filter) => {
            const isSelected = statusFilter === filter;
            const labels = {
              all: `All Users (${users.length})`,
              active: `Active (${users.filter((u) => u.status === 'active').length})`,
              blocked: `Blocked (${users.filter((u) => u.status === 'blocked').length})`,
            };
            return (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterChip,
                  isSelected && styles.filterChipSelected,
                ]}
                onPress={() => setStatusFilter(filter)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected && styles.filterChipTextSelected,
                  ]}
                >
                  {labels[filter]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Users List */}
        <View style={styles.listContainer}>
          {filteredUsers.length > 0 ? (
            filteredUsers.map((user) => {
              const walletSummary = calculateUserWallet(user.id, transactions);
              return (
                <UserCard
                  key={user.id}
                  user={user}
                  walletSummary={walletSummary}
                  onPress={() =>
                    navigation.navigate('UserDetails', { userId: user.id })
                  }
                />
              );
            })
          ) : (
            <EmptyState
              icon="account-search-outline"
              title="No users match your search"
              description="Try adjusting your keyword or reset filters to view all accounts."
              actionLabel="Reset Search"
              onAction={() => {
                setSearchQuery('');
                setStatusFilter('all');
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
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: colors.text,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
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
  listContainer: {
    marginTop: 4,
  },
});

export default UsersScreen;

