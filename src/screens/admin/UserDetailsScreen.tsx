import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
  Linking,
  ScrollView,
  Modal,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { StatusBadge } from '../../components/common/StatusBadge';
import { TransactionRow } from '../../components/cards/TransactionRow';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { SecondaryButton } from '../../components/buttons/SecondaryButton';
import { ConfirmationModal } from '../../components/modals/ConfirmationModal';
import { EditProfileModal } from '../../components/modals/EditProfileModal';
import { adminApi } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useWallet } from '../../hooks/useWallet';
import { formatPaiseToINR } from '../../utils/currency';
import { User, Transaction, EmployeePermissions, BankAccount, EmployeeActivityItem } from '../../types';

const PERMISSION_ITEMS: Array<{
  key: keyof EmployeePermissions;
  title: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  {
    key: 'canOcrUpload',
    title: 'OCR Upload (Selected Client)',
    desc: 'Scan receipt screenshots & auto-credit deposits',
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
    title: 'Daily Bonus Rates',
    desc: 'Manage running daily deposit bonus percentage',
    icon: 'gift-outline',
  },
  {
    key: 'canManageClients',
    title: 'Manage Client Data',
    desc: 'Create, edit, update UPI/bank & block clients',
    icon: 'people-outline',
  },
];

// Helpers for date range filtering
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

type ParamList = {
  UserDetails: { userId: string };
};

export const UserDetailsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<ParamList, 'UserDetails'>>();
  const { userId } = route.params;

  const { isSuperAdmin, permissions } = useAuth();
  const { refreshData, transactions: allWalletTxns } = useWallet();

  const [account, setAccount] = useState<User | null>(null);
  const [accountTxns, setAccountTxns] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Client Bonus & Threshold Config State
  const [bonusInput, setBonusInput] = useState('10');
  const [thresholdInput, setThresholdInput] = useState('10000');
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Employee Permissions State
  const [empPerms, setEmpPerms] = useState<EmployeePermissions>({
    canOcrUpload: false,
    canDeposit: false,
    canWithdraw: false,
    canSetBonus: false,
    canSetThreshold: false,
    canManageClients: false,
  });
  const [newEmpPassword, setNewEmpPassword] = useState('');
  const [isSavingPerms, setIsSavingPerms] = useState(false);

  // Modals
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [deleteClientModalVisible, setDeleteClientModalVisible] = useState(false);
  const [isDeletingClient, setIsDeletingClient] = useState(false);

  // Employee Action Tracking State
  const [employeeDateFilter, setEmployeeDateFilter] = useState<
    'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'
  >('all');
  const [employeeActionTab, setEmployeeActionTab] = useState<'clients' | 'deposits' | 'withdrawals'>('clients');
  const [empCustomModalVisible, setEmpCustomModalVisible] = useState(false);
  const [empCustomStartDate, setEmpCustomStartDate] = useState('');
  const [empCustomEndDate, setEmpCustomEndDate] = useState('');
  const [empInputStartDate, setEmpInputStartDate] = useState('');
  const [empInputEndDate, setEmpInputEndDate] = useState('');

  const loadDetails = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setIsLoading(true);

      try {
        const res = await adminApi.getUserById(userId);
        if (res.success && res.user) {
          const u = res.user;
          const mapped: User = {
            id: u.id,
            name: u.name,
            phone: u.phone,
            email: u.email || '',
            role: 'user',
            accountType: u.accountType || (u.role === 'EMPLOYEE' ? 'EMPLOYEE' : 'CLIENT'),
            permissions: u.permissions,
            status: u.isBlocked ? 'blocked' : 'active',
            createdAt: u.createdAt,
            upiId: u.upiId || undefined,
            bankAccount: u.bankAccount || undefined,
            bonusPercentage: u.bonusPercentage && u.bonusPercentage > 0 ? u.bonusPercentage : 0,
            totalBalancePaise: u.totalBalancePaise || 0,
            activeBonusPaise: u.activeBonusPaise || 0,
            lastDepositAmountPaise: u.lastDepositAmountPaise || 0,
            cycleWithdrawnPaise: u.cycleWithdrawnPaise || 0,
            isBonusDeductedInCycle: Boolean(u.isBonusDeductedInCycle),
            totalDepositPrincipalPaise: u.totalDepositPrincipalPaise || 0,
            totalCashDepositedPaise:
              u.totalCashDepositedPaise ?? u.totalDepositPrincipalPaise ?? 0,
            totalPointsDepositedPaise:
              u.totalPointsDepositedPaise ??
              ((u.totalCashDepositedPaise || u.totalDepositPrincipalPaise || 0) +
                (u.allocatedBonusPaise || 0)),
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
            employeeActivity: u.employeeActivity,
          };
          setAccount(mapped);
          setBonusInput(mapped.bonusPercentage ? String(mapped.bonusPercentage) : '');

          if (u.permissions) {
            setEmpPerms({
              canOcrUpload: Boolean(u.permissions.canOcrUpload),
              canDeposit: Boolean(u.permissions.canDeposit),
              canWithdraw: Boolean(u.permissions.canWithdraw),
              canSetBonus: Boolean(u.permissions.canSetBonus),
              canSetThreshold: Boolean(u.permissions.canSetThreshold),
              canManageClients: Boolean(u.permissions.canManageClients),
            });
          }

          if (Array.isArray(u.transactions)) {
            const mappedTxns: Transaction[] = u.transactions.map((t: any) => ({
              id: t.id,
              userId: u.id,
              userName: u.name,
              userPhone: u.phone,
              type: t.type.toLowerCase(),
              status: t.status.toLowerCase(),
              amountPaise: t.amountPaise,
              bonusPaise: t.bonusPaise || 0,
              bonusDeductedPaise: t.bonusDeductedPaise || 0,
              cashPaidPaise: t.cashPaidPaise || 0,
              totalCreditPaise:
                t.type === 'DEPOSIT' ? t.amountPaise + (t.bonusPaise || 0) : undefined,
              utrNumber: t.utr,
              paymentMethod: t.paymentApp,
              paymentAppName: t.paymentApp,
              screenshotUri: t.imageUrl,
              createdAt: t.createdAt,
              processedBy: t.processedByName || t.processedByAdminId,
            }));
            setAccountTxns(mappedTxns);
          }
        }
      } catch (e) {
        console.error('Error loading user details:', e);
      } finally {
        setIsLoading(false);
        setRefreshing(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const isEmployee = account?.accountType === 'EMPLOYEE';
  const canEditData = isSuperAdmin || !isEmployee; // All staff and superadmin can edit client data
  const canEditBonus = isSuperAdmin || (!isEmployee && permissions.canSetBonus);
  const canDepositForClient =
    !isEmployee && (isSuperAdmin || permissions.canOcrUpload || permissions.canDeposit);
  const canWithdrawForClient = !isEmployee && (isSuperAdmin || permissions.canWithdraw);

  // Auto-refresh GPS coordinates every 1 minute for Employees
  useEffect(() => {
    if (!isEmployee) return;
    const interval = setInterval(() => {
      loadDetails(true);
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [isEmployee, loadDetails]);

  const effectiveTxns = useMemo(() => {
    if (accountTxns.length > 0) return accountTxns;
    if (!account?.id) return [];
    return allWalletTxns.filter((t) => t.userId === account.id);
  }, [accountTxns, allWalletTxns, account?.id]);

  const lastDepositTxn = useMemo(
    () => effectiveTxns.find((t) => t.type === 'deposit'),
    [effectiveTxns]
  );
  const lastWithdrawalTxn = useMemo(
    () => effectiveTxns.find((t) => t.type === 'withdrawal'),
    [effectiveTxns]
  );

  // Memoized Filtered Employee Actions
  const filteredEmployeeActivity = useMemo(() => {
    const activity = account?.employeeActivity;
    if (!activity) {
      return {
        clients: [] as EmployeeActivityItem[],
        deposits: [] as EmployeeActivityItem[],
        withdrawals: [] as EmployeeActivityItem[],
        clientsCount: 0,
        depositsCount: 0,
        depositsTotalPaise: 0,
        withdrawalsCount: 0,
        withdrawalsTotalPaise: 0,
      };
    }

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

    const filterByDate = (dateIso: string) => {
      const t = new Date(dateIso).getTime();
      if (employeeDateFilter === 'today') {
        return t >= todayStart && t <= todayEnd;
      }
      if (employeeDateFilter === 'yesterday') {
        return t >= yesterdayStart && t <= yesterdayEnd;
      }
      if (employeeDateFilter === 'week') {
        return t >= sevenDaysStart;
      }
      if (employeeDateFilter === 'month') {
        return t >= startOfMonth;
      }
      if (employeeDateFilter === 'custom') {
        if (empCustomStartDate) {
          const s = getStartOfDay(new Date(empCustomStartDate));
          if (t < s) return false;
        }
        if (empCustomEndDate) {
          const e = getEndOfDay(new Date(empCustomEndDate));
          if (t > e) return false;
        }
        return true;
      }
      return true; // 'all'
    };

    const clients: EmployeeActivityItem[] = (activity.clients || []).filter(
      (c: EmployeeActivityItem) => filterByDate(c.createdAt)
    );
    const deposits: EmployeeActivityItem[] = (activity.deposits || []).filter(
      (d: EmployeeActivityItem) => filterByDate(d.createdAt)
    );
    const withdrawals: EmployeeActivityItem[] = (activity.withdrawals || []).filter(
      (w: EmployeeActivityItem) => filterByDate(w.createdAt)
    );

    const depositsTotalPaise = deposits.reduce(
      (sum: number, d: EmployeeActivityItem) => sum + (d.amountPaise || 0),
      0
    );
    const withdrawalsTotalPaise = withdrawals.reduce(
      (sum: number, w: EmployeeActivityItem) =>
        sum + (w.cashPaidPaise || w.amountPaise || 0),
      0
    );

    return {
      clients,
      deposits,
      withdrawals,
      clientsCount: clients.length,
      depositsCount: deposits.length,
      depositsTotalPaise,
      withdrawalsCount: withdrawals.length,
      withdrawalsTotalPaise,
    };
  }, [
    account?.employeeActivity,
    employeeDateFilter,
    empCustomStartDate,
    empCustomEndDate,
  ]);

  const handleApplyEmpCustomDates = () => {
    const s = empInputStartDate.trim();
    const e = empInputEndDate.trim();

    if (s && isNaN(new Date(s).getTime())) {
      Alert.alert('Invalid Date', 'Please enter a valid Start Date (YYYY-MM-DD).');
      return;
    }
    if (e && isNaN(new Date(e).getTime())) {
      Alert.alert('Invalid Date', 'Please enter a valid End Date (YYYY-MM-DD).');
      return;
    }

    setEmpCustomStartDate(s);
    setEmpCustomEndDate(e);
    setEmployeeDateFilter('custom');
    setEmpCustomModalVisible(false);
  };

  const handleClearEmpCustomDates = () => {
    setEmpInputStartDate('');
    setEmpInputEndDate('');
    setEmpCustomStartDate('');
    setEmpCustomEndDate('');
    setEmployeeDateFilter('all');
  };

  const handleSaveClientConfig = async () => {
    if (!account || !canEditBonus) return;
    const cleanStr = bonusInput.trim();
    const b = cleanStr ? parseFloat(cleanStr) : 0;
    if (isNaN(b) || b < 0 || b > 100) {
      Alert.alert('Invalid Bonus %', 'Bonus percentage must be between 0 and 100.');
      return;
    }

    setIsSavingConfig(true);
    try {
      const res = await adminApi.updateUserBonusConfig(account.id, { bonusPercentage: b });
      if (res.success) {
        Alert.alert(
          'Saved ✅',
          b > 0
            ? `Client custom bonus set to ${b}%.`
            : 'Custom bonus cleared. Client will use global daily running bonus.'
        );
        await Promise.all([loadDetails(true), refreshData()]);
      } else {
        Alert.alert('Error', res.error || 'Could not update configuration.');
      }
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleClearClientBonus = async () => {
    if (!account || !canEditBonus) return;
    setIsSavingConfig(true);
    try {
      const res = await adminApi.updateUserBonusConfig(account.id, { bonusPercentage: 0 });
      if (res.success) {
        Alert.alert(
          'Cleared ✅',
          'Custom bonus removed. Client will now use the global daily running bonus automatically.'
        );
        setBonusInput('');
        await Promise.all([loadDetails(true), refreshData()]);
      } else {
        Alert.alert('Error', res.error || 'Could not clear configuration.');
      }
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSaveEmployeePermissions = async () => {
    if (!account) return;
    setIsSavingPerms(true);
    try {
      const res = await adminApi.updateEmployeePermissions(
        account.id,
        empPerms,
        newEmpPassword.trim() || undefined
      );
      if (res.success) {
        Alert.alert(
          'Permissions Updated 🛡️',
          `Permissions for ${account.name} have been saved${
            newEmpPassword.trim() ? ' and password has been reset' : ''
          }.`
        );
        setNewEmpPassword('');
        await loadDetails(true);
      } else {
        Alert.alert('Error', res.error || 'Could not update permissions.');
      }
    } finally {
      setIsSavingPerms(false);
    }
  };

  const handleSaveAccountDetails = async (data: {
    name?: string;
    email?: string;
    phone?: string;
    upiId?: string;
    bankAccount?: BankAccount | null;
  }) => {
    if (!account) return { success: false, error: 'Account not loaded' };
    const res = await adminApi.updateUser(account.id, data);
    if (res.success) {
      await Promise.all([loadDetails(true), refreshData()]);
    }
    return res;
  };

  const handleConfirmToggleBlock = async () => {
    if (!account) return;
    setBlockModalVisible(false);
    const res = await adminApi.toggleBlockUser(account.id, account.status !== 'blocked');
    if (res.success) {
      await Promise.all([loadDetails(true), refreshData()]);
      Alert.alert(
        'Status Updated',
        `${account.name} has been ${account.status === 'blocked' ? 'unblocked' : 'blocked'}.`
      );
    } else {
      Alert.alert('Error', res.error || 'Failed to update status.');
    }
  };

  const handleConfirmDeleteClient = async () => {
    if (!account) return;
    setDeleteClientModalVisible(false);
    setIsDeletingClient(true);
    try {
      const res = await adminApi.deleteClient(account.id);
      if (res.success) {
        Alert.alert(
          'Client Moved to Backup 📦',
          `"${account.name}" and all their transaction records have been deleted from the live application and securely archived in Backup & Restore.\n\nYou can restore this client at any time from Backup & Restore, or permanently delete them from the database.`,
          [
            {
              text: 'OK',
              onPress: () => {
                refreshData();
                navigation.goBack();
              },
            },
          ]
        );
      } else {
        Alert.alert('Delete Failed', res.error || 'Could not delete client.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to delete client.');
    } finally {
      setIsDeletingClient(false);
    }
  };

  if (isLoading && !account) {
    return (
      <ScreenContainer backgroundColor={colors.background}>
        <Header title="Account Details" showBack onBackPress={() => navigation.goBack()} />
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading account profile...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!account) {
    return (
      <ScreenContainer backgroundColor={colors.background}>
        <Header title="Account Not Found" showBack onBackPress={() => navigation.goBack()} />
        <View style={styles.loadingBox}>
          <Ionicons name="alert-circle-outline" size={44} color={colors.textLight} />
          <Text style={styles.loadingText}>This account could not be found.</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      scrollable
      refreshing={refreshing}
      onRefresh={() => loadDetails(true)}
      backgroundColor={colors.background}
    >
      <Header
        title={isEmployee ? 'Employee Details' : 'Client Profile'}
        subtitle={account.name}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.content}>
        {/* Identity Card */}
        <View style={styles.card}>
          <View style={styles.identityRow}>
            <View
              style={[
                styles.avatarCircle,
                isEmployee && { backgroundColor: '#EDE9FE' },
              ]}
            >
              <Text
                style={[
                  styles.avatarText,
                  isEmployee && { color: '#7C3AED' },
                ]}
              >
                {account.name.slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.nameText}>{account.name}</Text>
                <StatusBadge status={account.status} size="sm" />
              </View>
              <Text style={styles.roleTag}>
                {isEmployee ? '🛡️ Staff Employee (Login Enabled)' : '👤 Client Account (No Login)'}
              </Text>
              <Text style={styles.metaText}>+91 {account.phone}</Text>
              {!!account.email && <Text style={styles.metaText}>{account.email}</Text>}
            </View>
            {canEditData && (
              <TouchableOpacity
                style={styles.editIconBtn}
                onPress={() => setEditModalVisible(true)}
              >
                <Ionicons name="pencil" size={14} color={colors.primary} />
                <Text style={styles.editIconText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          {!isEmployee && (
            <>
              <View style={styles.paymentInfoStrip}>
                <Text style={styles.stripItem}>
                  UPI: <Text style={styles.stripVal}>{account.upiId || 'Not set'}</Text>
                </Text>
                {account.bankAccount && (
                  <Text style={styles.stripItem}>
                    Bank:{' '}
                    <Text style={styles.stripVal}>
                      {account.bankAccount.bankName} ({account.bankAccount.accountNumber})
                    </Text>
                  </Text>
                )}
              </View>

              {/* Show line of set custom bonus */}
              <View style={styles.bonusNoticeLine}>
                <View style={styles.bonusNoticeLeft}>
                  <Ionicons
                    name={account.bonusPercentage ? 'gift' : 'sparkles-outline'}
                    size={15}
                    color={account.bonusPercentage ? '#15803D' : colors.primary}
                  />
                  <Text style={styles.bonusNoticeText}>
                    {account.bonusPercentage && account.bonusPercentage > 0
                      ? `Client Custom Bonus: ${account.bonusPercentage}% (Specific Override)`
                      : 'Custom Bonus: 0% (Daily running bonus applies automatically)'}
                  </Text>
                </View>
              </View>

              {/* Employee who added this client */}
              <View style={styles.addedByNoticeLine}>
                <View style={styles.addedByNoticeLeft}>
                  <Ionicons name="person-add-outline" size={15} color={colors.primary} />
                  <Text style={styles.addedByNoticeText}>
                    Added By:{' '}
                    <Text style={styles.addedByNoticeBold}>
                      {account.createdByName
                        ? `${account.createdByName}${
                            account.createdByRole === 'SUPER_ADMIN'
                              ? ' (Super Admin)'
                              : ' (Employee)'
                          }`
                        : 'Admin / Direct'}
                    </Text>
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Client Quick Actions (OCR Deposit / Withdraw) */}
        {!isEmployee && (canDepositForClient || canWithdrawForClient) && (
          <View style={styles.quickActionRow}>
            {canDepositForClient && (
              <PrimaryButton
                title="Deposit / OCR"
                icon="scan-outline"
                onPress={() =>
                  navigation.navigate('ClientOcrDeposit', { clientId: account.id })
                }
                style={{ flex: 1 }}
              />
            )}
            {canWithdrawForClient && (
              <SecondaryButton
                title="Withdraw Payout"
                onPress={() =>
                  navigation.navigate('ClientWithdraw', { clientId: account.id })
                }
                style={{ flex: 1 }}
              />
            )}
          </View>
        )}

        {/* Client Wallet Breakdown */}
        {!isEmployee && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Client Points & Cash Ledger</Text>

            {/* Last Activity: Last Deposit & Last Withdrawal */}
            <View style={styles.lastActivityContainer}>
              {/* Last Deposit */}
              <View style={styles.activityCard}>
                <View style={styles.activityHeaderRow}>
                  <View style={[styles.activityIconCircle, { backgroundColor: '#DCFCE7' }]}>
                    <Ionicons name="arrow-down" size={16} color="#16A34A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityHeaderTitle}>Last Deposit</Text>
                    {lastDepositTxn ? (
                      <Text style={styles.activityDateText}>
                        {new Date(lastDepositTxn.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    ) : null}
                  </View>
                  {lastDepositTxn && (
                    <View style={styles.activityBadgeGreen}>
                      <Text style={styles.activityBadgeGreenText}>Credited</Text>
                    </View>
                  )}
                </View>

                {lastDepositTxn ? (
                  <View style={styles.activityBody}>
                    <Text style={[styles.activityMainVal, { color: '#16A34A' }]}>
                      +{((lastDepositTxn.totalCreditPaise ?? (lastDepositTxn.amountPaise + (lastDepositTxn.bonusPaise || 0))) / 100).toLocaleString('en-IN')} Points
                    </Text>
                    <View style={styles.activitySubRow}>
                      <Text style={styles.activitySubLabel}>
                        Cash Received: <Text style={styles.activitySubBold}>₹{(lastDepositTxn.amountPaise / 100).toLocaleString('en-IN')}</Text>
                      </Text>
                      {Boolean(lastDepositTxn.bonusPaise && lastDepositTxn.bonusPaise > 0) && (
                        <Text style={styles.activityBonusBadge}>
                          +{((lastDepositTxn.bonusPaise || 0) / 100).toLocaleString('en-IN')} Bonus Pts
                        </Text>
                      )}
                    </View>
                  </View>
                ) : account.lastDepositAmountPaise && account.lastDepositAmountPaise > 0 ? (
                  <View style={styles.activityBody}>
                    <Text style={[styles.activityMainVal, { color: '#16A34A' }]}>
                      ₹{(account.lastDepositAmountPaise / 100).toLocaleString('en-IN')} Cash
                    </Text>
                    <Text style={styles.activitySubLabel}>From recent deposit cycle</Text>
                  </View>
                ) : (
                  <View style={styles.activityEmptyBox}>
                    <Text style={styles.activityEmptyText}>No deposits recorded yet</Text>
                  </View>
                )}
              </View>

              {/* Last Withdrawal */}
              <View style={styles.activityCard}>
                <View style={styles.activityHeaderRow}>
                  <View style={[styles.activityIconCircle, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="arrow-up" size={16} color="#D97706" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityHeaderTitle}>Last Withdrawal</Text>
                    {lastWithdrawalTxn ? (
                      <Text style={styles.activityDateText}>
                        {new Date(lastWithdrawalTxn.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    ) : null}
                  </View>
                  {lastWithdrawalTxn && (
                    <View style={styles.activityBadgeOrange}>
                      <Text style={styles.activityBadgeOrangeText}>Paid Out</Text>
                    </View>
                  )}
                </View>

                {lastWithdrawalTxn ? (
                  <View style={styles.activityBody}>
                    <Text style={[styles.activityMainVal, { color: '#D97706' }]}>
                      -{(lastWithdrawalTxn.amountPaise / 100).toLocaleString('en-IN')} Points
                    </Text>
                    <View style={styles.activitySubRow}>
                      <Text style={styles.activitySubLabel}>
                        Cash Paid: <Text style={styles.activitySubBold}>₹{(((lastWithdrawalTxn.cashPaidPaise ?? Math.max(0, lastWithdrawalTxn.amountPaise - (lastWithdrawalTxn.bonusPaise || 0)))) / 100).toLocaleString('en-IN')}</Text>
                      </Text>
                      {Boolean((lastWithdrawalTxn.bonusDeductedPaise || lastWithdrawalTxn.bonusPaise || 0) > 0) ? (
                        <Text style={styles.activityDeductBadge}>
                          -{(((lastWithdrawalTxn.bonusDeductedPaise || lastWithdrawalTxn.bonusPaise || 0)) / 100).toLocaleString('en-IN')} Bonus Deducted
                        </Text>
                      ) : (
                        <Text style={styles.activityBonusBadge}>100% Cash (No deduction)</Text>
                      )}
                    </View>
                  </View>
                ) : (
                  <View style={styles.activityEmptyBox}>
                    <Text style={styles.activityEmptyText}>No withdrawals recorded yet</Text>
                  </View>
                )}
              </View>
            </View>

            {/* The 4 Core Metrics Grid */}
            <View style={styles.fourMetricsContainer}>
              <View style={styles.fourMetricBox}>
                <Text style={styles.fourMetricLabel}>Total Cash Deposited</Text>
                <Text style={[styles.fourMetricVal, { color: colors.success }]}>
                  ₹
                  {(
                    (account.totalCashDepositedPaise ??
                      account.totalDepositPrincipalPaise ??
                      0) / 100
                  ).toLocaleString('en-IN')}
                </Text>
                <Text style={styles.fourMetricSub}>Actual cash received</Text>
              </View>

              <View style={styles.fourMetricBox}>
                <Text style={styles.fourMetricLabel}>Total Points Deposited</Text>
                <Text style={[styles.fourMetricVal, { color: colors.primary }]}>
                  {(
                    (account.totalPointsDepositedPaise ??
                      (account.totalCashDepositedPaise ||
                        account.totalDepositPrincipalPaise ||
                        0) + (account.allocatedBonusPaise || 0)) /
                    100
                  ).toLocaleString('en-IN')}{' '}
                  Pts
                </Text>
                <Text style={styles.fourMetricSub}>Cash + bonus allocated</Text>
              </View>

              <View style={styles.fourMetricBox}>
                <Text style={styles.fourMetricLabel}>Total Points Withdrawn</Text>
                <Text style={[styles.fourMetricVal, { color: colors.danger }]}>
                  {((account.totalPointsWithdrawnPaise || 0) / 100).toLocaleString(
                    'en-IN'
                  )}{' '}
                  Pts
                </Text>
                <Text style={styles.fourMetricSub}>Gross points debited</Text>
              </View>

              <View style={styles.fourMetricBox}>
                <Text style={styles.fourMetricLabel}>Total Cash Withdrawn</Text>
                <Text style={[styles.fourMetricVal, { color: '#B45309' }]}>
                  ₹
                  {((account.totalCashWithdrawnPaise || 0) / 100).toLocaleString(
                    'en-IN'
                  )}
                </Text>
                <Text style={styles.fourMetricSub}>Net cash payouts sent</Text>
              </View>
            </View>

            {/* Deposit & Withdrawal Cycle Status Subcard */}
            <View style={styles.cycleSubCard}>
              <Text style={styles.cycleSubTitle}>Active Deposit & Withdrawal Cycle</Text>

              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Active Cycle Bonus</Text>
                <Text style={[styles.metricValue, { color: '#B45309' }]}>
                  {((account.activeBonusPaise || 0) / 100).toLocaleString('en-IN')} Points
                </Text>
              </View>

              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Last Cash Deposited</Text>
                <Text style={styles.metricValue}>
                  ₹{((account.lastDepositAmountPaise || 0) / 100).toLocaleString('en-IN')}
                </Text>
              </View>

              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Cycle Points Withdrawn</Text>
                <Text style={styles.metricValue}>
                  {((account.cycleWithdrawnPaise || 0) / 100).toLocaleString('en-IN')} Points
                </Text>
              </View>

              <View style={[styles.metricRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.metricLabel}>Cycle Cashout Mode</Text>
                <Text
                  style={[
                    styles.metricValue,
                    { color: account.isBonusDeductedInCycle ? '#15803D' : '#D97706' },
                  ]}
                >
                  {account.isBonusDeductedInCycle
                    ? '100% Cashout Mode (Bonus Deducted)'
                    : (account.activeBonusPaise || 0) > 0
                    ? 'Active Bonus (Deductible on Cashout)'
                    : 'Standard (No Active Bonus)'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Client Bonus % Config (Permission-Gated) */}
        {!isEmployee && canEditBonus && (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={styles.sectionTitle}>Set Custom Bonus Rate</Text>
              {account.bonusPercentage ? (
                <View style={styles.customBonusActiveBadge}>
                  <Text style={styles.customBonusActiveBadgeText}>Custom: {account.bonusPercentage}%</Text>
                </View>
              ) : (
                <View style={styles.customBonusInactiveBadge}>
                  <Text style={styles.customBonusInactiveBadgeText}>Using Daily Bonus</Text>
                </View>
              )}
            </View>
            <Text style={styles.sectionSub}>
              Client-specific bonus will NOT auto-assign. Set a custom bonus rate here to override the running daily bonus for this client, or leave blank/0 so global daily bonus applies automatically.
            </Text>
            <View style={{ marginTop: 8 }}>
              <Text style={styles.inputLabel}>Custom Bonus (%)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 10 (Leave blank or 0 to clear)"
                placeholderTextColor={colors.textLight}
                keyboardType="decimal-pad"
                value={bonusInput}
                onChangeText={setBonusInput}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <PrimaryButton
                title={isSavingConfig ? 'Saving...' : 'Set Custom Bonus'}
                onPress={handleSaveClientConfig}
                loading={isSavingConfig}
                style={{ flex: 1 }}
              />
              {Boolean(account.bonusPercentage) && (
                <SecondaryButton
                  title="Clear (Use Daily Rate)"
                  onPress={handleClearClientBonus}
                  disabled={isSavingConfig}
                  style={{ flex: 1 }}
                />
              )}
            </View>
          </View>
        )}

        {/* Employee Live Location Card (Super Admin ONLY) */}
        {isEmployee && isSuperAdmin && (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="navigate-circle" size={22} color="#0284C7" />
                <Text style={styles.sectionTitle}>Employee Live GPS Location</Text>
              </View>
              <View style={styles.liveSyncBadge}>
                <View style={styles.livePulseDot} />
                <Text style={styles.liveSyncText}>Updates every 1m</Text>
              </View>
            </View>

            {account.lastLatitude && account.lastLongitude ? (
              <View>
                {/* Visual Google Maps Box */}
                <TouchableOpacity
                  style={styles.mapVisualCard}
                  activeOpacity={0.85}
                  onPress={() => {
                    const url = `https://www.google.com/maps/search/?api=1&query=${account.lastLatitude},${account.lastLongitude}`;
                    Linking.openURL(url).catch(() =>
                      Alert.alert('Error', 'Could not open Google Maps.')
                    );
                  }}
                >
                  <View style={styles.mapGridPattern}>
                    <View style={styles.mapPinContainer}>
                      <Ionicons name="location" size={32} color="#EF4444" />
                      <View style={styles.mapPinPulse} />
                    </View>
                    <Text style={styles.mapCoordsOverlay}>
                      {account.lastLatitude.toFixed(5)}°, {account.lastLongitude.toFixed(5)}°
                    </Text>
                    <Text style={styles.mapTapHint}>Tap to view on Google Maps ↗</Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.locationInfoBox}>
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Last Coordinates</Text>
                    <Text style={[styles.metricValue, { color: '#0369A1' }]}>
                      {account.lastLatitude.toFixed(6)}° N, {account.lastLongitude.toFixed(6)}° E
                    </Text>
                  </View>
                  {account.lastLocationAccuracy ? (
                    <View style={styles.metricRow}>
                      <Text style={styles.metricLabel}>GPS Accuracy</Text>
                      <Text style={styles.metricValue}>
                        ±{Math.round(account.lastLocationAccuracy)} meters
                      </Text>
                    </View>
                  ) : null}
                  {account.lastLocationAddress ? (
                    <View style={styles.metricRow}>
                      <Text style={styles.metricLabel}>Detected Location</Text>
                      <Text style={[styles.metricValue, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>
                        {account.lastLocationAddress}
                      </Text>
                    </View>
                  ) : null}
                  <View style={[styles.metricRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.metricLabel}>Last Coordinate Update</Text>
                    <Text style={styles.metricValue}>
                      {account.lastLocationUpdatedAt
                        ? new Date(account.lastLocationUpdatedAt).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })
                        : 'Recently'}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <PrimaryButton
                    title="Open Google Maps 🗺️"
                    onPress={() => {
                      const url = `https://www.google.com/maps/search/?api=1&query=${account.lastLatitude},${account.lastLongitude}`;
                      Linking.openURL(url).catch(() =>
                        Alert.alert('Error', 'Could not open Google Maps.')
                      );
                    }}
                    icon="map-outline"
                    style={{ flex: 1, backgroundColor: '#0284C7' }}
                  />
                  <SecondaryButton
                    title="Refresh Now 🔄"
                    onPress={() => loadDetails(true)}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.noLocationBox}>
                <Ionicons name="location-outline" size={32} color={colors.textLight} />
                <Text style={styles.noLocationText}>
                  Location pending sync from employee's device.
                </Text>
                <Text style={styles.noLocationSub}>
                  GPS coordinates will update automatically every 1 minute when the employee logs in and operates the app.
                </Text>
                <SecondaryButton
                  title="Check Coordinates Now 🔄"
                  onPress={() => loadDetails(true)}
                  style={{ marginTop: 12 }}
                />
              </View>
            )}
          </View>
        )}

        {/* Employee Performance & Action Tracking Card */}
        {isEmployee && (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <View style={[styles.permIconCircle, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="bar-chart-outline" size={18} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Employee Actions & Performance</Text>
                <Text style={styles.sectionSub}>
                  Track clients onboarded, deposits, and payouts handled by {account.name}
                </Text>
              </View>
            </View>

            {/* Date Filter Bar */}
            <View style={styles.filterSection}>
              <View style={styles.filterHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="calendar-outline" size={14} color={colors.text} />
                  <Text style={styles.filterSectionLabel}>Filter Actions by Date</Text>
                </View>
                {employeeDateFilter === 'custom' && (empCustomStartDate || empCustomEndDate) && (
                  <TouchableOpacity onPress={handleClearEmpCustomDates} style={styles.clearDateBadge}>
                    <Text style={styles.clearDateBadgeText}>
                      {empCustomStartDate || 'Any'} → {empCustomEndDate || 'Today'} ✕
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
                {[
                  { key: 'all', label: 'All Dates' },
                  { key: 'today', label: 'Today' },
                  { key: 'yesterday', label: 'Yesterday' },
                  { key: 'week', label: 'Last 7 Days' },
                  { key: 'month', label: 'This Month' },
                  {
                    key: 'custom',
                    label:
                      employeeDateFilter === 'custom' && (empCustomStartDate || empCustomEndDate)
                        ? `Range: ${empCustomStartDate || '…'} - ${empCustomEndDate || '…'}`
                        : 'Custom Range 📅',
                  },
                ].map((item) => {
                  const isSelected = employeeDateFilter === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.dateChip, isSelected && styles.dateChipSelected]}
                      onPress={() => {
                        if (item.key === 'custom') {
                          setEmpInputStartDate(empCustomStartDate);
                          setEmpInputEndDate(empCustomEndDate);
                          setEmpCustomModalVisible(true);
                        } else {
                          setEmployeeDateFilter(item.key as any);
                        }
                      }}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.dateChipText, isSelected && styles.dateChipTextSelected]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* 3 Metric Cards */}
            <View style={styles.empMetricsRow}>
              <TouchableOpacity
                style={[
                  styles.empMetricCard,
                  employeeActionTab === 'clients' && styles.empMetricCardActive,
                ]}
                onPress={() => setEmployeeActionTab('clients')}
                activeOpacity={0.8}
              >
                <View style={[styles.empMetricIconWrap, { backgroundColor: '#EDE9FE' }]}>
                  <Ionicons name="people" size={15} color="#7C3AED" />
                </View>
                <Text style={styles.empMetricValue}>{filteredEmployeeActivity.clientsCount}</Text>
                <Text style={styles.empMetricLabel}>Clients Added</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.empMetricCard,
                  employeeActionTab === 'deposits' && styles.empMetricCardActive,
                ]}
                onPress={() => setEmployeeActionTab('deposits')}
                activeOpacity={0.8}
              >
                <View style={[styles.empMetricIconWrap, { backgroundColor: colors.successLight }]}>
                  <Ionicons name="arrow-down" size={15} color={colors.success} />
                </View>
                <Text style={styles.empMetricValue}>{filteredEmployeeActivity.depositsCount}</Text>
                <Text style={styles.empMetricSubValue}>
                  {formatPaiseToINR(filteredEmployeeActivity.depositsTotalPaise)}
                </Text>
                <Text style={styles.empMetricLabel}>Deposits</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.empMetricCard,
                  employeeActionTab === 'withdrawals' && styles.empMetricCardActive,
                ]}
                onPress={() => setEmployeeActionTab('withdrawals')}
                activeOpacity={0.8}
              >
                <View style={[styles.empMetricIconWrap, { backgroundColor: colors.dangerLight }]}>
                  <Ionicons name="arrow-up" size={15} color={colors.danger} />
                </View>
                <Text style={styles.empMetricValue}>{filteredEmployeeActivity.withdrawalsCount}</Text>
                <Text style={styles.empMetricSubValue}>
                  {formatPaiseToINR(filteredEmployeeActivity.withdrawalsTotalPaise)}
                </Text>
                <Text style={styles.empMetricLabel}>Withdrawals</Text>
              </TouchableOpacity>
            </View>

            {/* Segmented Tab Row */}
            <View style={styles.empTabRow}>
              <TouchableOpacity
                style={[styles.empTabBtn, employeeActionTab === 'clients' && styles.empTabBtnActive]}
                onPress={() => setEmployeeActionTab('clients')}
              >
                <Text
                  style={[
                    styles.empTabBtnText,
                    employeeActionTab === 'clients' && styles.empTabBtnTextActive,
                  ]}
                >
                  Clients ({filteredEmployeeActivity.clientsCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.empTabBtn, employeeActionTab === 'deposits' && styles.empTabBtnActive]}
                onPress={() => setEmployeeActionTab('deposits')}
              >
                <Text
                  style={[
                    styles.empTabBtnText,
                    employeeActionTab === 'deposits' && styles.empTabBtnTextActive,
                  ]}
                >
                  Deposits ({filteredEmployeeActivity.depositsCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.empTabBtn, employeeActionTab === 'withdrawals' && styles.empTabBtnActive]}
                onPress={() => setEmployeeActionTab('withdrawals')}
              >
                <Text
                  style={[
                    styles.empTabBtnText,
                    employeeActionTab === 'withdrawals' && styles.empTabBtnTextActive,
                  ]}
                >
                  Payouts ({filteredEmployeeActivity.withdrawalsCount})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tab 1: Clients Added */}
            {employeeActionTab === 'clients' && (
              <View style={{ marginTop: 8 }}>
                {filteredEmployeeActivity.clients.length > 0 ? (
                  filteredEmployeeActivity.clients.map((c: EmployeeActivityItem) => (
                    <TouchableOpacity
                      key={c.id}
                      style={styles.empActionItemCard}
                      onPress={() => navigation.push('UserDetails', { userId: c.id })}
                      activeOpacity={0.7}
                    >
                      <View style={styles.empActionItemLeft}>
                        <View style={[styles.empAvatarCircle, { backgroundColor: '#EDE9FE' }]}>
                          <Text style={styles.empAvatarInitials}>
                            {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.empActionItemTitle}>{c.name || 'Client'}</Text>
                          <Text style={styles.empActionItemSub}>{c.phone || 'No phone'}</Text>
                          <Text style={styles.empActionItemDate}>
                            Onboarded: {new Date(c.createdAt).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <StatusBadge status={c.status === 'blocked' ? 'blocked' : 'active'} />
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                          <Text style={styles.viewLinkText}>View</Text>
                          <Ionicons name="chevron-forward" size={13} color={colors.primary} />
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.empEmptyBox}>
                    <Ionicons name="people-outline" size={26} color={colors.textLight} />
                    <Text style={styles.empEmptyText}>No clients added in this date period.</Text>
                  </View>
                )}
              </View>
            )}

            {/* Tab 2: Deposits Handled */}
            {employeeActionTab === 'deposits' && (
              <View style={{ marginTop: 8 }}>
                {filteredEmployeeActivity.deposits.length > 0 ? (
                  filteredEmployeeActivity.deposits.map((d: EmployeeActivityItem) => (
                    <TouchableOpacity
                      key={d.id}
                      style={styles.empActionItemCard}
                      onPress={() => navigation.navigate('TransactionDetails', { transactionId: d.id })}
                      activeOpacity={0.7}
                    >
                      <View style={styles.empActionItemLeft}>
                        <View style={[styles.empAvatarCircle, { backgroundColor: colors.successLight }]}>
                          <Ionicons name="arrow-down" size={16} color={colors.success} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.empActionItemTitle}>{d.userName || d.name || 'Client'}</Text>
                          <Text style={styles.empActionItemSub}>{d.userPhone || d.phone || ''}</Text>
                          {d.utr ? (
                            <Text style={styles.empActionItemUtr}>UTR: {d.utr}</Text>
                          ) : null}
                          <Text style={styles.empActionItemDate}>
                            {new Date(d.createdAt).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.empActionAmount, { color: colors.success }]}>
                          +{formatPaiseToINR(d.amountPaise || 0)}
                        </Text>
                        {d.bonusPaise ? (
                          <Text style={styles.empActionBonus}>
                            +{(d.bonusPaise / 100).toLocaleString('en-IN')} pts bonus
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.empEmptyBox}>
                    <Ionicons name="arrow-down-circle-outline" size={26} color={colors.textLight} />
                    <Text style={styles.empEmptyText}>No deposits handled in this date period.</Text>
                  </View>
                )}
              </View>
            )}

            {/* Tab 3: Withdrawals Handled */}
            {employeeActionTab === 'withdrawals' && (
              <View style={{ marginTop: 8 }}>
                {filteredEmployeeActivity.withdrawals.length > 0 ? (
                  filteredEmployeeActivity.withdrawals.map((w: EmployeeActivityItem) => (
                    <TouchableOpacity
                      key={w.id}
                      style={styles.empActionItemCard}
                      onPress={() => navigation.navigate('TransactionDetails', { transactionId: w.id })}
                      activeOpacity={0.7}
                    >
                      <View style={styles.empActionItemLeft}>
                        <View style={[styles.empAvatarCircle, { backgroundColor: colors.dangerLight }]}>
                          <Ionicons name="arrow-up" size={16} color={colors.danger} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.empActionItemTitle}>{w.userName || w.name || 'Client'}</Text>
                          <Text style={styles.empActionItemSub}>{w.userPhone || w.phone || ''}</Text>
                          {w.utr ? (
                            <Text style={styles.empActionItemUtr}>UTR: {w.utr}</Text>
                          ) : null}
                          <Text style={styles.empActionItemDate}>
                            {new Date(w.createdAt).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.empActionAmount, { color: colors.danger }]}>
                          -{formatPaiseToINR(w.cashPaidPaise || w.amountPaise || 0)}
                        </Text>
                        {w.bonusPaise ? (
                          <Text style={styles.empActionBonus}>
                            -{(w.bonusPaise / 100).toLocaleString('en-IN')} pts deducted
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.empEmptyBox}>
                    <Ionicons name="arrow-up-circle-outline" size={26} color={colors.textLight} />
                    <Text style={styles.empEmptyText}>No withdrawals processed in this date period.</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Employee Permissions Editor (Super Admin ONLY) */}
        {isEmployee && isSuperAdmin && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Employee Permissions</Text>
            <Text style={styles.sectionSub}>
              Toggle exactly which operations {account.name} can perform after logging in.
            </Text>

            {PERMISSION_ITEMS.map((perm) => (
              <View key={perm.key} style={styles.permSwitchRow}>
                <View style={styles.permIconCircle}>
                  <Ionicons name={perm.icon} size={16} color="#6D28D9" />
                </View>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.permTitle}>{perm.title}</Text>
                  <Text style={styles.permDesc}>{perm.desc}</Text>
                </View>
                <Switch
                  value={empPerms[perm.key]}
                  onValueChange={() =>
                    setEmpPerms((prev) => ({ ...prev, [perm.key]: !prev[perm.key] }))
                  }
                  trackColor={{ false: '#E2E8F0', true: '#C4B5FD' }}
                  thumbColor={empPerms[perm.key] ? '#7C3AED' : '#94A3B8'}
                />
              </View>
            ))}

            <Text style={[styles.inputLabel, { marginTop: 14 }]}>
              Reset Login Password (Optional)
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Leave blank to keep current password"
              placeholderTextColor={colors.textLight}
              secureTextEntry
              value={newEmpPassword}
              onChangeText={setNewEmpPassword}
            />

            <PrimaryButton
              title={isSavingPerms ? 'Saving Permissions...' : 'Save Permissions'}
              onPress={handleSaveEmployeePermissions}
              loading={isSavingPerms}
              fullWidth
              icon="shield-checkmark-outline"
              style={{ marginTop: 14 }}
            />
          </View>
        )}

        {/* Account Status Toggle */}
        {canEditData && (
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.blockBtn}
              onPress={() => setBlockModalVisible(true)}
            >
              <Ionicons
                name={account.status === 'blocked' ? 'checkmark-circle-outline' : 'ban-outline'}
                size={18}
                color={account.status === 'blocked' ? colors.success : colors.danger}
              />
              <Text
                style={[
                  styles.blockBtnText,
                  { color: account.status === 'blocked' ? colors.success : colors.danger },
                ]}
              >
                {account.status === 'blocked'
                  ? `Unblock ${isEmployee ? 'Employee' : 'Client'} Account`
                  : `Suspend / Block ${isEmployee ? 'Employee' : 'Client'} Account`}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Delete Client to Backup */}
        {!isEmployee && (
          <View style={[styles.card, styles.dangerCard]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Ionicons name="warning-outline" size={16} color={colors.danger} />
              <Text style={styles.dangerZoneTitle}>Delete Client from Application</Text>
            </View>
            <Text style={styles.dangerZoneSubtitle}>
              Removes this client and their entire transaction history from the live app. All data is safely stored in Backup & Restore, where it can be restored anytime or permanently deleted from the database.
            </Text>
            <TouchableOpacity
              style={styles.deleteClientBtn}
              onPress={() => setDeleteClientModalVisible(true)}
              disabled={isDeletingClient}
            >
              {isDeletingClient ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  <Text style={styles.deleteClientBtnText}>
                    Delete Client (Move to Backup)
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Client Transactions History */}
        {!isEmployee && (
          <View style={{ marginTop: 4 }}>
            <Text style={styles.historyTitle}>
              Transaction History ({effectiveTxns.length})
            </Text>
            {effectiveTxns.length > 0 ? (
              effectiveTxns.map((txn) => (
                <TransactionRow
                  key={txn.id}
                  transaction={txn}
                  onPress={() =>
                    navigation.navigate('TransactionDetails', { transactionId: txn.id })
                  }
                />
              ))
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyBoxText}>No transactions recorded for this client yet.</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Edit Client / Employee Profile Modal */}
      <EditProfileModal
        visible={editModalVisible}
        user={account}
        initialTab="personal"
        onClose={() => setEditModalVisible(false)}
        onSave={handleSaveAccountDetails}
      />

      {/* Block / Unblock Confirmation */}
      <ConfirmationModal
        visible={blockModalVisible}
        title={account.status === 'blocked' ? 'Unblock Account?' : 'Block Account?'}
        message={
          account.status === 'blocked'
            ? `Restore active status for ${account.name}?`
            : `Suspend ${account.name}? They will be prevented from transactions${
                isEmployee ? ' and login' : ''
              }.`
        }
        confirmLabel={account.status === 'blocked' ? 'Unblock' : 'Block Account'}
        variant={account.status === 'blocked' ? 'primary' : 'danger'}
        onConfirm={handleConfirmToggleBlock}
        onCancel={() => setBlockModalVisible(false)}
      />

      {/* Delete Client to Backup Confirmation Modal */}
      <ConfirmationModal
        visible={deleteClientModalVisible}
        title="Delete Client from App?"
        message={`Are you sure you want to delete "${account.name}" (${account.phone}) from the application?\n\nThis will remove the client and their ${effectiveTxns.length} transaction(s) from all live screens. The data will be safely stored in Backup & Restore and can be restored anytime.`}
        confirmLabel="Delete & Move to Backup"
        variant="danger"
        onConfirm={handleConfirmDeleteClient}
        onCancel={() => setDeleteClientModalVisible(false)}
      />

      {/* Employee Custom Date Range Modal */}
      <Modal
        visible={empCustomModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEmpCustomModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                <Text style={styles.modalTitle}>Filter Actions by Date</Text>
              </View>
              <TouchableOpacity
                onPress={() => setEmpCustomModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              Filter clients, deposits, and payouts handled within specific dates.
            </Text>

            <View style={styles.dateInputsRow}>
              <View style={styles.dateInputCol}>
                <Text style={styles.inputLabel}>From Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="2026-11-01"
                  placeholderTextColor={colors.textLight}
                  value={empInputStartDate}
                  onChangeText={setEmpInputStartDate}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.dateInputCol}>
                <Text style={styles.inputLabel}>To Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="2026-11-24"
                  placeholderTextColor={colors.textLight}
                  value={empInputEndDate}
                  onChangeText={setEmpInputEndDate}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.modalActionsRow}>
              <SecondaryButton
                title="Clear"
                onPress={handleClearEmpCustomDates}
                style={{ flex: 1 }}
              />
              <PrimaryButton
                title="Apply Filter"
                onPress={handleApplyEmpCustomDates}
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
    paddingBottom: 32,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: colors.textMuted,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameText: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  roleTag: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 2,
  },
  metaText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  editIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightBlue,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
  },
  editIconText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  paymentInfoStrip: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: 4,
  },
  stripItem: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  stripVal: {
    fontWeight: '700',
    color: colors.text,
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 10,
  },
  sectionSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  lastActivityContainer: {
    gap: 10,
    marginBottom: 14,
  },
  activityCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  activityIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  activityDateText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  activityBadgeGreen: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activityBadgeGreenText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  activityBadgeOrange: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activityBadgeOrangeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  activityBody: {
    marginTop: 2,
  },
  activityMainVal: {
    fontSize: 20,
    fontWeight: '800',
  },
  activitySubRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 6,
  },
  activitySubLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  activitySubBold: {
    fontWeight: '700',
    color: colors.text,
  },
  activityBonusBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  activityDeductBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991B1B',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  activityEmptyBox: {
    paddingVertical: 8,
  },
  activityEmptyText: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  fourMetricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  fourMetricBox: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fourMetricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  fourMetricVal: {
    fontSize: 16,
    fontWeight: '700',
  },
  fourMetricSub: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  cycleSubCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  cycleSubTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  permSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  permIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
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
  blockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  blockBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 10,
  },
  locationInfoBox: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  noLocationBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  noLocationText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginTop: 6,
  },
  noLocationSub: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
    paddingHorizontal: 16,
  },
  emptyBox: {
    backgroundColor: colors.white,
    padding: 20,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  emptyBoxText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  bonusNoticeLine: {
    marginTop: 10,
    backgroundColor: '#F0FDF4',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  bonusNoticeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bonusNoticeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
    flex: 1,
  },
  addedByNoticeLine: {
    marginTop: 6,
    backgroundColor: '#F8FAFC',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  addedByNoticeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addedByNoticeText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  addedByNoticeBold: {
    fontWeight: '700',
    color: colors.text,
  },
  customBonusActiveBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  customBonusActiveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  customBonusInactiveBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  customBonusInactiveBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  liveSyncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0284C7',
  },
  liveSyncText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1',
  },
  mapVisualCard: {
    height: 110,
    backgroundColor: '#E0F2FE',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  mapGridPattern: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F9FF',
  },
  mapPinContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  mapPinPulse: {
    width: 14,
    height: 6,
    borderRadius: 7,
    backgroundColor: '#EF4444',
    opacity: 0.35,
    marginTop: -4,
  },
  mapCoordsOverlay: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0369A1',
    marginTop: 2,
  },
  mapTapHint: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0284C7',
    marginTop: 2,
  },
  filterSection: {
    marginBottom: 14,
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
  },
  clearDateBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  clearDateBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.danger,
  },
  chipRow: {
    marginHorizontal: -4,
  },
  chipContainer: {
    paddingHorizontal: 4,
    gap: 6,
    flexDirection: 'row',
  },
  dateChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  dateChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
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
  empMetricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  empMetricCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
  },
  empMetricCardActive: {
    backgroundColor: colors.white,
    borderColor: colors.primary,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  empMetricIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  empMetricValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  empMetricSubValue: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: 1,
  },
  empMetricLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  empTabRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: 3,
    marginBottom: 8,
  },
  empTabBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
  },
  empTabBtnActive: {
    backgroundColor: colors.white,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  empTabBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  empTabBtnTextActive: {
    fontWeight: '800',
    color: colors.primary,
  },
  empActionItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  empActionItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  empAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empAvatarInitials: {
    fontSize: 14,
    fontWeight: '800',
    color: '#6D28D9',
  },
  empActionItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  empActionItemSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  empActionItemUtr: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0284C7',
    marginTop: 1,
  },
  empActionItemDate: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  empActionAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  empActionBonus: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.warningDark,
    marginTop: 2,
  },
  viewLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  empEmptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  empEmptyText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  modalSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  dateInputsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  dateInputCol: {
    flex: 1,
  },
  modalInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dangerCard: {
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.02)',
  },
  dangerZoneTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.danger,
  },
  dangerZoneSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    marginBottom: 12,
  },
  deleteClientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  deleteClientBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.danger,
  },
});

export default UserDetailsScreen;
