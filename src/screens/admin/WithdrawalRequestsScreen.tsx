import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { SecondaryButton } from '../../components/buttons/SecondaryButton';
import { ConfirmationModal } from '../../components/modals/ConfirmationModal';
import { RejectionModal } from '../../components/modals/RejectionModal';
import { EmptyState } from '../../components/common/EmptyState';
import { useWallet } from '../../hooks/useWallet';
import { formatPaiseToINR } from '../../utils/currency';
import { calculateUserWallet } from '../../utils/calculations';
import { Transaction } from '../../types';

export const WithdrawalRequestsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const {
    transactions,
    approveWithdrawal,
    rejectWithdrawal,
    refreshData,
  } = useWallet();

  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>(
    'pending'
  );
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  const withdrawalTransactions = transactions
    .filter((t) => t.type === 'withdrawal')
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  const displayedList = withdrawalTransactions.filter(
    (t) => t.status === activeTab
  );

  const pendingCount = withdrawalTransactions.filter(
    (t) => t.status === 'pending'
  ).length;

  const handleOpenApprove = (txn: Transaction) => {
    // Check available balance right now
    const wallet = calculateUserWallet(txn.userId, transactions);
    if (txn.amountPaise > wallet.availableBalancePaise) {
      Alert.alert(
        'Insufficient Balance',
        `Cannot approve withdrawal. User's available balance is only ${formatPaiseToINR(
          wallet.availableBalancePaise
        )}, but requested amount is ${formatPaiseToINR(txn.amountPaise)}.`
      );
      return;
    }
    setSelectedTxn(txn);
    setApproveModalVisible(true);
  };

  const handleOpenReject = (txn: Transaction) => {
    setSelectedTxn(txn);
    setRejectModalVisible(true);
  };

  const handleConfirmApprove = async () => {
    if (!selectedTxn) return;
    setActionLoading(true);
    const res = await approveWithdrawal(selectedTxn.id);
    setActionLoading(false);
    setApproveModalVisible(false);

    if (res.success) {
      Alert.alert(
        'Disbursed & Approved!',
        `Withdrawal ${selectedTxn.id} of ${formatPaiseToINR(
          selectedTxn.amountPaise
        )} has been approved and deducted from user's balance.`
      );
    } else {
      Alert.alert('Approval Failed', res.error || 'Failed to approve withdrawal.');
    }
  };

  const handleConfirmReject = async (reason: string) => {
    if (!selectedTxn) return;
    setActionLoading(true);
    const res = await rejectWithdrawal(selectedTxn.id, reason);
    setActionLoading(false);
    setRejectModalVisible(false);

    if (res.success) {
      Alert.alert('Rejected', `Withdrawal ${selectedTxn.id} marked as rejected.`);
    } else {
      Alert.alert('Error', res.error || 'Failed to reject withdrawal.');
    }
  };

  return (
    <ScreenContainer
      scrollable
      refreshing={refreshing}
      onRefresh={onRefresh}
      backgroundColor={colors.background}
    >
      <Header
        title="Withdrawal Requests"
        subtitle="Verify balances & authorize payouts"
      />

      <View style={styles.content}>
        {/* Status Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'pending' && styles.tabBtnActive]}
            onPress={() => setActiveTab('pending')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'pending' && styles.tabTextActive,
              ]}
            >
              Pending ({pendingCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'approved' && styles.tabBtnActive]}
            onPress={() => setActiveTab('approved')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'approved' && styles.tabTextActive,
              ]}
            >
              Approved
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'rejected' && styles.tabBtnActive]}
            onPress={() => setActiveTab('rejected')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'rejected' && styles.tabTextActive,
              ]}
            >
              Rejected
            </Text>
          </TouchableOpacity>
        </View>

        {/* Withdrawal Requests List */}
        <View style={styles.listContainer}>
          {displayedList.length > 0 ? (
            displayedList.map((item) => {
              const reqDate = new Date(item.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              });

              // Compute real-time user wallet balance
              const userWallet = calculateUserWallet(item.userId, transactions);
              const hasSufficientBalance =
                userWallet.availableBalancePaise >= item.amountPaise;

              return (
                <View key={item.id} style={styles.requestCard}>
                  {/* Card Header */}
                  <View style={styles.requestHeader}>
                    <View style={styles.userInfo}>
                      <Text style={styles.userNameText}>{item.userName}</Text>
                      <Text style={styles.userIdText}>
                        {item.userId} • {item.userPhone}
                      </Text>
                    </View>
                    <StatusBadge status={item.status} size="sm" />
                  </View>

                  {/* Financial Breakdown & Real-Time Balance */}
                  <View style={styles.financialBox}>
                    <View style={styles.financialRow}>
                      <Text style={styles.finLabel}>Requested Payout</Text>
                      <Text style={[styles.finValue, styles.amountHighlight]}>
                        {formatPaiseToINR(item.amountPaise)}
                      </Text>
                    </View>

                    <View style={styles.financialRow}>
                      <Text style={styles.finLabel}>User's Available Balance</Text>
                      <Text
                        style={[
                          styles.finValue,
                          hasSufficientBalance
                            ? styles.balanceOk
                            : styles.balanceWarning,
                        ]}
                      >
                        {formatPaiseToINR(userWallet.availableBalancePaise)}
                      </Text>
                    </View>

                    {!hasSufficientBalance && item.status === 'pending' && (
                      <View style={styles.balanceWarningBox}>
                        <Ionicons
                          name="alert-circle"
                          size={14}
                          color={colors.danger}
                        />
                        <Text style={styles.balanceWarningText}>
                          Insufficient balance! Cannot approve.
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Destination Information */}
                  <View style={styles.destinationBox}>
                    <Text style={styles.destHeading}>Payout Destination:</Text>
                    {item.upiId ? (
                      <Text style={styles.destValue}>UPI: {item.upiId}</Text>
                    ) : item.bankDetails ? (
                      <View>
                        <Text style={styles.destValue}>
                          A/C: {item.bankDetails.accountNumber} (
                          {item.bankDetails.ifsc})
                        </Text>
                        <Text style={styles.destSub}>
                          {item.bankDetails.bankName} •{' '}
                          {item.bankDetails.accountHolderName}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.destValue}>
                        {item.paymentMethod || 'Direct Bank/UPI'}
                      </Text>
                    )}
                  </View>

                  {/* Metadata */}
                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>
                      Ref: <Text style={styles.boldText}>{item.id}</Text>
                    </Text>
                    <Text style={styles.metaText}>{reqDate}</Text>
                  </View>

                  {item.rejectionReason && (
                    <View style={styles.rejectionNotice}>
                      <Text style={styles.rejectionNoticeText}>
                        Reason: {item.rejectionReason}
                      </Text>
                    </View>
                  )}

                  {/* Actions for Pending */}
                  {item.status === 'pending' && (
                    <View style={styles.actionButtonsRow}>
                      <View style={{ flex: 1 }}>
                        <SecondaryButton
                          title="Reject"
                          variant="dangerOutline"
                          size="sm"
                          onPress={() => handleOpenReject(item)}
                        />
                      </View>
                      <View style={{ flex: 1.2 }}>
                        <PrimaryButton
                          title="Authorize & Pay"
                          variant="danger"
                          size="sm"
                          disabled={!hasSufficientBalance}
                          onPress={() => handleOpenApprove(item)}
                        />
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          ) : withdrawalTransactions.length === 0 ? (
            <EmptyState
              icon="cash-refund"
              title="No Withdrawal Requests Yet"
              description="No user has requested a withdrawal payout yet. Payout requests will appear here in real-time."
            />
          ) : (
            <EmptyState
              icon="cash-refund"
              title={`No ${activeTab} withdrawals`}
              description={`There are currently no withdrawal requests in ${activeTab} status.`}
            />
          )}
        </View>
      </View>

      {/* Approve Confirmation Modal */}
      <ConfirmationModal
        visible={approveModalVisible}
        title="Authorize Withdrawal Payout?"
        message={
          selectedTxn
            ? `Are you sure you want to approve withdrawal ${selectedTxn.id} for ${
                selectedTxn.userName
              }?\n\nPayout Amount: ${formatPaiseToINR(
                selectedTxn.amountPaise
              )}\n\nThis will permanently deduct ${formatPaiseToINR(
                selectedTxn.amountPaise
              )} from their wallet balance.`
            : ''
        }
        confirmLabel="Authorize & Deduct"
        variant="danger"
        icon="cash-outline"
        loading={actionLoading}
        onConfirm={handleConfirmApprove}
        onCancel={() => setApproveModalVisible(false)}
      />

      {/* Reject Modal */}
      <RejectionModal
        visible={rejectModalVisible}
        transactionType="withdrawal"
        loading={actionLoading}
        onConfirm={handleConfirmReject}
        onCancel={() => setRejectModalVisible(false)}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: colors.white,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  listContainer: {
    marginTop: 2,
  },
  requestCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  userInfo: {
    flex: 1,
  },
  userNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  userIdText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  financialBox: {
    backgroundColor: '#F8FAFD',
    borderRadius: 12,
    padding: 12,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#E2ECF8',
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  finLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  finValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  amountHighlight: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.danger,
  },
  balanceOk: {
    color: colors.success,
  },
  balanceWarning: {
    color: colors.danger,
  },
  balanceWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0ED',
    padding: 6,
    borderRadius: 6,
    marginTop: 6,
    gap: 4,
  },
  balanceWarningText: {
    fontSize: 11,
    color: colors.danger,
    fontWeight: '600',
  },
  destinationBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  destHeading: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: 2,
  },
  destValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  destSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  metaText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  boldText: {
    fontWeight: '700',
    color: colors.textSecondary,
  },
  rejectionNotice: {
    backgroundColor: '#FFF5F5',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  rejectionNoticeText: {
    fontSize: 12,
    color: colors.dangerDark,
    fontWeight: '500',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
});

export default WithdrawalRequestsScreen;

