import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { UserCard } from '../../components/cards/UserCard';
import { EmptyState } from '../../components/common/EmptyState';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { SecondaryButton } from '../../components/buttons/SecondaryButton';
import { adminApi } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useWallet } from '../../hooks/useWallet';
import { User, EmployeePermissions, UserWalletSummary } from '../../types';

const PERMISSION_DEFINITIONS: Array<{
  key: keyof EmployeePermissions;
  title: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  {
    key: 'canOcrUpload',
    title: 'OCR Upload (Selected Client)',
    desc: 'Scan client payment screenshot & auto-credit deposit',
    icon: 'scan-outline',
  },
  {
    key: 'canDeposit',
    title: 'Direct Deposit',
    desc: 'Credit manual deposits directly to clients',
    icon: 'arrow-down-circle-outline',
  },
  {
    key: 'canWithdraw',
    title: 'Client Withdrawal',
    desc: 'Process rule-based instant payouts for clients',
    icon: 'arrow-up-circle-outline',
  },
  {
    key: 'canSetBonus',
    title: 'Daily Bonus & Rates',
    desc: 'Manage running daily deposit bonus percentage and client bonus %',
    icon: 'gift-outline',
  },
  {
    key: 'canManageClients',
    title: 'Manage Client Data',
    desc: 'Create, edit, update UPI/bank & block/unblock clients',
    icon: 'people-outline',
  },
];

const DEFAULT_PERMS: EmployeePermissions = {
  canOcrUpload: true,
  canDeposit: false,
  canWithdraw: false,
  canSetBonus: false,
  canManageClients: true,
};

type RouteParams = {
  Users?: {
    initialTab?: 'CLIENT' | 'EMPLOYEE';
  };
};

export const UserManagementScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<RouteParams, 'Users'>>();
  const { isSuperAdmin, permissions } = useAuth();
  const { refreshData } = useWallet();

  const canCreateClient = true; // All staff and superadmin can create clients
  const canSetBonus = isSuperAdmin || permissions.canSetBonus;

  const [activeSegment, setActiveSegment] = useState<'CLIENT' | 'EMPLOYEE'>(
    route.params?.initialTab === 'EMPLOYEE' && isSuperAdmin ? 'EMPLOYEE' : 'CLIENT'
  );

  const [accounts, setAccounts] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');

  // Create Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [createType, setCreateType] = useState<'CLIENT' | 'EMPLOYEE'>('CLIENT');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [upiId, setUpiId] = useState('');
  const [password, setPassword] = useState('');
  const [bonusPercentage, setBonusPercentage] = useState('');
  const [empPermissions, setEmpPermissions] =
    useState<EmployeePermissions>({ ...DEFAULT_PERMS });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const loadAccounts = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setIsLoading(true);

      try {
        const res = await adminApi.getUsers({
          role: activeSegment,
        });

        if (res.success && Array.isArray(res.users)) {
          const mapped: User[] = res.users.map((u: any) => ({
            id: u.id,
            name: u.name,
            phone: u.phone,
            email: u.email || '',
            role: 'user',
            accountType: u.accountType || activeSegment,
            permissions: u.permissions,
            status: u.isBlocked ? 'blocked' : 'active',
            createdAt: u.createdAt,
            upiId: u.upiId || undefined,
            bankAccount: u.bankAccount || undefined,
            bonusPercentage: u.bonusPercentage ?? undefined,
            totalBalancePaise: u.totalBalancePaise || 0,
            activeBonusPaise: u.activeBonusPaise || 0,
            lastDepositAmountPaise: u.lastDepositAmountPaise || 0,
            cycleWithdrawnPaise: u.cycleWithdrawnPaise || 0,
            isBonusDeductedInCycle: Boolean(u.isBonusDeductedInCycle),
            totalDepositPrincipalPaise: u.totalDepositPrincipalPaise || 0,
            totalCashDepositedPaise:
              u.totalCashDepositedPaise ?? u.totalDepositPrincipalPaise ?? 0,
            totalPointsDepositedPaise: u.totalPointsDepositedPaise ?? 0,
            totalPointsWithdrawnPaise: u.totalPointsWithdrawnPaise ?? 0,
            totalCashWithdrawnPaise: u.totalCashWithdrawnPaise ?? 0,
            totalBonusDeductedPaise: u.totalBonusDeductedPaise ?? 0,
            withdrawablePaise: u.withdrawablePaise ?? u.totalBalancePaise ?? 0,
            lastLatitude: u.lastLatitude,
            lastLongitude: u.lastLongitude,
            lastLocationAccuracy: u.lastLocationAccuracy,
            lastLocationAddress: u.lastLocationAddress,
            lastLocationUpdatedAt: u.lastLocationUpdatedAt,
            createdById: u.createdById,
            createdByName: u.createdByName,
            createdByRole: u.createdByRole,
          }));
          setAccounts(mapped);
        } else {
          setAccounts([]);
        }
      } catch (error) {
        console.error('Error loading accounts:', error);
      } finally {
        setIsLoading(false);
        setRefreshing(false);
      }
    },
    [activeSegment]
  );

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const openCreateModal = (typeOverride?: 'CLIENT' | 'EMPLOYEE') => {
    const chosenType = typeOverride ?? (isSuperAdmin ? activeSegment : 'CLIENT');
    setCreateType(chosenType);
    setName('');
    setPhone('');
    setEmail('');
    setUpiId('');
    setPassword('');
    setBonusPercentage('');
    setEmpPermissions({ ...DEFAULT_PERMS });
    setFormError('');
    setModalVisible(true);
  };

  const togglePermission = (key: keyof EmployeePermissions) => {
    setEmpPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleCreateAccount = async () => {
    setFormError('');

    if (!name.trim()) {
      setFormError('Please enter full name.');
      return;
    }

    if (!phone.trim() || phone.trim().length < 10) {
      setFormError('Please enter a valid 10-digit phone number.');
      return;
    }

    if (createType === 'EMPLOYEE') {
      if (!password || password.trim().length < 4) {
        setFormError('Employee login password must be at least 4 characters.');
        return;
      }
    }

    let parsedBonus: number | undefined = undefined;
    if (createType === 'CLIENT' && canSetBonus && bonusPercentage.trim()) {
      const b = parseFloat(bonusPercentage);
      if (isNaN(b) || b < 0 || b > 100) {
        setFormError('Bonus % must be between 0 and 100.');
        return;
      }
      parsedBonus = b;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        name: name.trim(),
        phone: phone.trim(),
        userType: createType,
        role: createType,
      };

      if (createType === 'EMPLOYEE') {
        payload.email = email.trim() || undefined;
        payload.password = password.trim();
        payload.permissions = empPermissions;
      } else {
        // Clients strictly require NO password and NO login credentials
        payload.upiId = upiId.trim() || undefined;
        if (canSetBonus && parsedBonus !== undefined) {
          payload.bonusPercentage = parsedBonus;
        }
      }

      const res = await adminApi.createUser(payload);

      if (res.success) {
        Alert.alert(
          createType === 'EMPLOYEE'
            ? 'Employee Created! 🛡️'
            : 'Client Created! ✅',
          createType === 'EMPLOYEE'
            ? `Employee "${name.trim()}" can now log in with phone ${phone.trim()} and their assigned permissions.`
            : `Client "${name.trim()}" (${phone.trim()}) added${
                parsedBonus !== undefined
                  ? ` with custom ${parsedBonus}% bonus.`
                  : ' (will use running daily bonus rate).'
              }`
        );
        setModalVisible(false);
        if (activeSegment !== createType) {
          setActiveSegment(createType);
        } else {
          await loadAccounts(true);
        }
        await refreshData();
      } else {
        setFormError(res.error || 'Failed to create account.');
      }
    } catch (err: any) {
      setFormError(err?.message || 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredAccounts = accounts.filter((u) => {
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.phone.includes(q) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.createdByName && u.createdByName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const renderEmployeeCard = (emp: User) => {
    const perms = emp.permissions;
    const activeLabels = PERMISSION_DEFINITIONS.filter(
      (def) => perms && perms[def.key]
    ).map((def) => def.title.split(' ')[0] + (def.key === 'canOcrUpload' ? ' OCR' : ''));

    return (
      <TouchableOpacity
        key={emp.id}
        style={styles.employeeCard}
        onPress={() => navigation.navigate('UserDetails', { userId: emp.id })}
        activeOpacity={0.75}
      >
        <View style={styles.empTopRow}>
          <View style={styles.empAvatar}>
            <Ionicons name="person" size={20} color="#7C3AED" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.empNameRow}>
              <Text style={styles.empName}>{emp.name}</Text>
              <View
                style={[
                  styles.empStatusBadge,
                  emp.status === 'blocked' && styles.empStatusBlocked,
                ]}
              >
                <Text
                  style={[
                    styles.empStatusText,
                    emp.status === 'blocked' && styles.empStatusBlockedText,
                  ]}
                >
                  {emp.status === 'blocked' ? 'Blocked' : 'Active'}
                </Text>
              </View>
            </View>
            <Text style={styles.empPhone}>
              +91 {emp.phone} {emp.email ? `• ${emp.email}` : ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
        </View>

        <View style={styles.permChipsRow}>
          {activeLabels.length > 0 ? (
            PERMISSION_DEFINITIONS.filter((d) => perms && perms[d.key]).map((d) => (
              <View key={d.key} style={styles.permChip}>
                <Ionicons name={d.icon} size={11} color="#6D28D9" />
                <Text style={styles.permChipText}>{d.title}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.noPermChipText}>No permissions assigned yet</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer
      scrollable
      refreshing={refreshing}
      onRefresh={() => loadAccounts(true)}
      backgroundColor={colors.background}
    >
      <Header
        title={isSuperAdmin ? 'Clients & Employees' : 'Client Accounts'}
        subtitle={
          activeSegment === 'EMPLOYEE'
            ? `${accounts.length} staff employees`
            : `${accounts.length} managed clients (no login)`
        }
      />

      <View style={styles.content}>
        {/* Super Admin Segment Switcher: Clients | Employees */}
        {isSuperAdmin && (
          <View style={styles.segmentContainer}>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                activeSegment === 'CLIENT' && styles.segmentBtnActive,
              ]}
              onPress={() => setActiveSegment('CLIENT')}
            >
              <Ionicons
                name="people-outline"
                size={16}
                color={activeSegment === 'CLIENT' ? colors.white : colors.textSecondary}
              />
              <Text
                style={[
                  styles.segmentText,
                  activeSegment === 'CLIENT' && styles.segmentTextActive,
                ]}
              >
                Clients
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentBtn,
                activeSegment === 'EMPLOYEE' && styles.segmentBtnActiveEmp,
              ]}
              onPress={() => setActiveSegment('EMPLOYEE')}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={16}
                color={activeSegment === 'EMPLOYEE' ? colors.white : colors.textSecondary}
              />
              <Text
                style={[
                  styles.segmentText,
                  activeSegment === 'EMPLOYEE' && styles.segmentTextActive,
                ]}
              >
                Employees
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Create Button */}
        {(isSuperAdmin || (activeSegment === 'CLIENT' && canCreateClient)) && (
          <TouchableOpacity
            style={styles.addUserButton}
            onPress={() => openCreateModal(activeSegment)}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.addUserIconCircle,
                activeSegment === 'EMPLOYEE' && { backgroundColor: '#7C3AED' },
              ]}
            >
              <Ionicons
                name={activeSegment === 'EMPLOYEE' ? 'shield-checkmark' : 'person-add'}
                size={18}
                color={colors.white}
              />
            </View>
            <View style={styles.addUserTextCol}>
              <Text style={styles.addUserTitle}>
                {activeSegment === 'EMPLOYEE'
                  ? 'Create New Employee'
                  : 'Create New Client'}
              </Text>
              <Text style={styles.addUserSubtitle}>
                {activeSegment === 'EMPLOYEE'
                  ? 'Set login credentials & granular role permissions'
                  : 'Name & Phone only — No password required'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </TouchableOpacity>
        )}

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={`Search ${activeSegment === 'EMPLOYEE' ? 'employees' : 'clients'} by name or phone...`}
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

        {/* Status Filter Chips */}
        <View style={styles.filterRow}>
          {(['all', 'active', 'blocked'] as const).map((filter) => {
            const isSelected = statusFilter === filter;
            const count =
              filter === 'all'
                ? accounts.length
                : accounts.filter((u) => u.status === filter).length;
            const label =
              filter === 'all'
                ? `All (${count})`
                : filter === 'active'
                ? `Active (${count})`
                : `Blocked (${count})`;
            return (
              <TouchableOpacity
                key={filter}
                style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                onPress={() => setStatusFilter(filter)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected && styles.filterChipTextSelected,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* List */}
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading accounts...</Text>
          </View>
        ) : filteredAccounts.length > 0 ? (
          activeSegment === 'EMPLOYEE' ? (
            filteredAccounts.map((emp) => renderEmployeeCard(emp))
          ) : (
            filteredAccounts.map((client) => {
              const wallet: UserWalletSummary = {
                userId: client.id,
                totalDepositPaise: client.totalDepositPrincipalPaise || 0,
                totalBonusPaise: 0,
                totalCreditPaise: 0,
                totalWithdrawalPaise: 0,
                availableBalancePaise: client.totalBalancePaise || 0,
                pendingDepositCount: 0,
                pendingWithdrawalCount: 0,
              };
              return (
                <UserCard
                  key={client.id}
                  user={client}
                  walletSummary={wallet}
                  onPress={() =>
                    navigation.navigate('UserDetails', { userId: client.id })
                  }
                />
              );
            })
          )
        ) : (
          <EmptyState
            icon={activeSegment === 'EMPLOYEE' ? 'shield-account-outline' : 'account-group-outline'}
            title={`No ${activeSegment === 'EMPLOYEE' ? 'Employees' : 'Clients'} Found`}
            description={
              activeSegment === 'EMPLOYEE'
                ? 'Tap "Create New Employee" above to set up staff credentials and assign permissions.'
                : 'Tap "Create New Client" above to add a client account.'
            }
          />
        )}
      </View>

      {/* Create Client / Employee Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {createType === 'EMPLOYEE' ? 'Create Employee Account' : 'Create Client Account'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {/* Account Type Selector (Super Admin only) */}
              {isSuperAdmin && (
                <View style={styles.typeSelectorContainer}>
                  <Text style={styles.fieldLabel}>Select Account Type</Text>
                  <View style={styles.typeRow}>
                    <TouchableOpacity
                      style={[
                        styles.typeCard,
                        createType === 'CLIENT' && styles.typeCardActive,
                      ]}
                      onPress={() => setCreateType('CLIENT')}
                    >
                      <Ionicons
                        name="person-outline"
                        size={20}
                        color={createType === 'CLIENT' ? colors.primary : colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.typeCardTitle,
                          createType === 'CLIENT' && styles.typeCardTitleActive,
                        ]}
                      >
                        Client
                      </Text>
                      <Text style={styles.typeCardSub}>No login needed</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.typeCard,
                        createType === 'EMPLOYEE' && styles.typeCardActiveEmp,
                      ]}
                      onPress={() => setCreateType('EMPLOYEE')}
                    >
                      <Ionicons
                        name="shield-checkmark-outline"
                        size={20}
                        color={createType === 'EMPLOYEE' ? '#7C3AED' : colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.typeCardTitle,
                          createType === 'EMPLOYEE' && { color: '#6D28D9' },
                        ]}
                      >
                        Employee
                      </Text>
                      <Text style={styles.typeCardSub}>Login + Permissions</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {!!formError && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color={colors.danger} />
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              )}

              {/* Common Identity Fields */}
              <Text style={styles.fieldLabel}>Full Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder={createType === 'EMPLOYEE' ? 'e.g. Suresh Verma' : 'e.g. Rohit Deshmukh'}
                placeholderTextColor={colors.textLight}
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.fieldLabel}>Phone Number *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="10-digit mobile number"
                placeholderTextColor={colors.textLight}
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
              />

              {createType === 'CLIENT' ? (
                <>
                  <View style={styles.noLoginBadge}>
                    <Ionicons name="shield-checkmark" size={18} color="#15803D" />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={[styles.noLoginBadgeText, { fontWeight: '700', color: '#166534' }]}>
                        No Password Required
                      </Text>
                      <Text style={[styles.noLoginBadgeText, { marginTop: 2 }]}>
                        Clients do not log in. Only Full Name & 10-digit Phone number are required.
                      </Text>
                    </View>
                  </View>

                  {canSetBonus && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={styles.fieldLabel}>Custom Bonus % (Optional)</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="Leave empty for running daily bonus"
                        placeholderTextColor={colors.textLight}
                        keyboardType="decimal-pad"
                        value={bonusPercentage}
                        onChangeText={setBonusPercentage}
                      />
                      <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
                        Client-specific bonus will NOT auto-assign. Leave empty so daily running bonus applies automatically.
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.fieldLabel}>Email (Optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="name@example.com"
                    placeholderTextColor={colors.textLight}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                  />

                  {/* Employee Credentials */}
                  <Text style={styles.fieldLabel}>Employee Login Password *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Min 4 characters"
                    placeholderTextColor={colors.textLight}
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                  />

                  {/* Granular Employee Permissions */}
                  <View style={styles.permsHeaderRow}>
                    <Text style={styles.permsSectionTitle}>Assign Permissions</Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity
                        onPress={() =>
                          setEmpPermissions({
                            canOcrUpload: true,
                            canDeposit: true,
                            canWithdraw: true,
                            canSetBonus: true,
                            canManageClients: true,
                          })
                        }
                      >
                        <Text style={styles.selectAllText}>Grant All</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() =>
                          setEmpPermissions({
                            canOcrUpload: false,
                            canDeposit: false,
                            canWithdraw: false,
                            canSetBonus: false,
                            canManageClients: false,
                          })
                        }
                      >
                        <Text style={[styles.selectAllText, { color: colors.textMuted }]}>
                          Clear
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.permsList}>
                    {PERMISSION_DEFINITIONS.map((perm) => (
                      <View key={perm.key} style={styles.permSwitchRow}>
                        <View style={styles.permIconCircle}>
                          <Ionicons name={perm.icon} size={16} color="#6D28D9" />
                        </View>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.permTitle}>{perm.title}</Text>
                          <Text style={styles.permDesc}>{perm.desc}</Text>
                        </View>
                        <Switch
                          value={empPermissions[perm.key]}
                          onValueChange={() => togglePermission(perm.key)}
                          trackColor={{ false: '#E2E8F0', true: '#C4B5FD' }}
                          thumbColor={empPermissions[perm.key] ? '#7C3AED' : '#94A3B8'}
                        />
                      </View>
                    ))}
                  </View>
                </>
              )}

              <View style={styles.modalActions}>
                <SecondaryButton
                  title="Cancel"
                  onPress={() => setModalVisible(false)}
                  style={{ flex: 1 }}
                  disabled={isSubmitting}
                />
                <PrimaryButton
                  title={
                    isSubmitting
                      ? 'Creating...'
                      : createType === 'EMPLOYEE'
                      ? 'Create Employee'
                      : 'Create Client'
                  }
                  onPress={handleCreateAccount}
                  loading={isSubmitting}
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 6,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  segmentBtnActive: {
    backgroundColor: colors.primary,
  },
  segmentBtnActiveEmp: {
    backgroundColor: '#7C3AED',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.white,
  },
  addUserButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: colors.primary + '35',
  },
  addUserIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  addUserTextCol: {
    flex: 1,
  },
  addUserTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  addUserSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 18,
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
  loadingBox: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: colors.textMuted,
  },
  employeeCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  empTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  empAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  empNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  empName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  empPhone: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  empStatusBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  empStatusBlocked: {
    backgroundColor: colors.dangerLight,
  },
  empStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  empStatusBlockedText: {
    color: colors.danger,
  },
  permChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  permChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  permChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6D28D9',
  },
  noPermChipText: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    height: '90%',
    maxHeight: '94%',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  typeSelectorContainer: {
    marginBottom: 12,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surfaceAlt,
  },
  typeCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.lightBlue,
  },
  typeCardActiveEmp: {
    borderColor: '#7C3AED',
    backgroundColor: '#F5F3FF',
  },
  typeCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4,
  },
  typeCardTitleActive: {
    color: colors.primaryDark,
  },
  typeCardSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 8,
  },
  textInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  noLoginBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightBlue,
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
    gap: 8,
  },
  noLoginBadgeText: {
    fontSize: 12,
    color: colors.primaryDark,
    fontWeight: '600',
    flex: 1,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  permsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  permsSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  selectAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
  },
  permsList: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  permSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  permIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  permTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  permDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerLight,
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.danger,
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
    marginBottom: 14,
  },
});

export default UserManagementScreen;
