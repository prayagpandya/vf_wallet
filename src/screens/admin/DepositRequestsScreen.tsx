import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
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
import { ImageViewerModal } from '../../components/modals/ImageViewerModal';
import { EmptyState } from '../../components/common/EmptyState';
import { useWallet } from '../../hooks/useWallet';
import { formatPaiseToINR } from '../../utils/currency';
import { Transaction } from '../../types';

export const DepositRequestsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { transactions, approveDeposit, rejectDeposit, refreshData } = useWallet();

  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>(
    'pending'
  );
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [activeImageUri, setActiveImageUri] = useState<string | undefined>(undefined);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  const depositTransactions = transactions
    .filter((t) => t.type === 'deposit')
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  const displayedList = depositTransactions.filter(
    (t) => t.status === activeTab
  );

  const pendingCount = depositTransactions.filter(
    (t) => t.status === 'pending'
  ).length;

  const handleOpenApprove = (txn: Transaction) => {
    setSelectedTxn(txn);
    setApproveModalVisible(true);
  };

  const handleOpenReject = (txn: Transaction) => {
    setSelectedTxn(txn);
    setRejectModalVisible(true);
  };

  const handleOpenImage = (uri?: string) => {
    if (!uri) {
      Alert.alert('Notice', 'No screenshot was attached to this deposit.');
      return;
    }
    setActiveImageUri(uri);
    setImageModalVisible(true);
  };

  const handleConfirmApprove = async () => {
    if (!selectedTxn) return;
    setActionLoading(true);
    const res = await approveDeposit(selectedTxn.id);
    setActionLoading(false);
    setApproveModalVisible(false);

    if (res.success) {
      Alert.alert('Approved!', `Deposit ${selectedTxn.id} approved & credited.`);
    } else {
      Alert.alert('Error', res.error || 'Failed to approve deposit.');
    }
  };

  const handleConfirmReject = async (reason: string) => {
    if (!selectedTxn) return;
    setActionLoading(true);
    const res = await rejectDeposit(selectedTxn.id, reason);
    setActionLoading(false);
    setRejectModalVisible(false);

    if (res.success) {
      Alert.alert('Rejected', `Deposit ${selectedTxn.id} marked as rejected.`);
    } else {
      Alert.alert('Error', res.error || 'Failed to reject deposit.');
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
        title="Deposit Requests"
        subtitle="Review proof of payment and credit wallets"
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

        {/* List of Deposit Requests */}
        <View style={styles.listContainer}>
          {displayedList.length > 0 ? (
            displayedList.map((item) => {
              const reqDate = new Date(item.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              });

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

                  {/* Financial Breakdown */}
                  <View style={styles.financialBox}>
                    <View style={styles.financialRow}>
                      <Text style={styles.finLabel}>Deposit Amount</Text>
                      <Text style={styles.finValue}>
                        {formatPaiseToINR(item.amountPaise)}
                      </Text>
                    </View>

                    <View style={styles.financialRow}>
                      <Text style={styles.finLabel}>
                        Locked Bonus ({item.bonusPercentage || 5}%)
                      </Text>
                      <Text style={[styles.finValue, styles.bonusVal]}>
                        +{formatPaiseToINR(item.bonusPaise || 0)}
                      </Text>
                    </View>

                    <View style={styles.finDivider} />

                    <View style={styles.financialRow}>
                      <Text style={styles.finTotalLabel}>Total Wallet Credit</Text>
                      <Text style={styles.finTotalValue}>
                        {formatPaiseToINR(item.totalCreditPaise || item.amountPaise)}
                      </Text>
                    </View>
                  </View>

                  {/* Transaction metadata */}
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

                  {/* Payment Screenshot Thumbnail & Action Buttons */}
                  <View style={styles.bottomActionsRow}>
                    {item.screenshotUri ? (
                      <TouchableOpacity
                        style={styles.screenshotThumbBtn}
                        onPress={() => handleOpenImage(item.screenshotUri)}
                        activeOpacity={0.8}
                      >
                        <Image
                          source={{ uri: item.screenshotUri }}
                          style={styles.screenshotThumb}
                        />
                        <View style={styles.thumbOverlay}>
                          <Ionicons name="eye" size={14} color={colors.white} />
                          <Text style={styles.thumbText}>Receipt</Text>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.noScreenshotBadge}>
                        <Ionicons name="document-text-outline" size={14} color={colors.textMuted} />
                        <Text style={styles.noScreenshotText}>No receipt</Text>
                      </View>
                    )}

                    {item.status === 'pending' && (
                      <View style={styles.actionButtonsCol}>
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
                            title="Approve"
                            variant="success"
                            size="sm"
                            onPress={() => handleOpenApprove(item)}
                          />
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          ) : (
            <EmptyState
              icon="receipt-text-outline"
              title={
                depositTransactions.length === 0
                  ? 'No Deposit Requests Yet'
                  : `No ${activeTab} deposit requests`
              }
              description={
                depositTransactions.length === 0
                  ? 'Deposit requests submitted via payment screenshot OCR will appear here for verification.'
                  : `There are currently no deposit requests in ${activeTab} status.`
              }
            />
          )}
        </View>
      </View>

      {/* Approve Confirmation Modal */}
      <ConfirmationModal
        visible={approveModalVisible}
        title="Approve Deposit Request?"
        message={
          selectedTxn
            ? `Are you sure you want to approve deposit ${selectedTxn.id} for ${
                selectedTxn.userName
              }?\n\nDeposit: ${formatPaiseToINR(
                selectedTxn.amountPaise
              )}\nBonus (${selectedTxn.bonusPercentage || 5}%): ${formatPaiseToINR(
                selectedTxn.bonusPaise || 0
              )}\nTotal Credit: ${formatPaiseToINR(
                selectedTxn.totalCreditPaise || selectedTxn.amountPaise
              )}\n\nThis will credit the user's available balance exactly once.`
            : ''
        }
        confirmLabel="Confirm & Credit"
        variant="success"
        icon="checkmark-circle"
        loading={actionLoading}
        onConfirm={handleConfirmApprove}
        onCancel={() => setApproveModalVisible(false)}
      />

      {/* Reject Modal */}
      <RejectionModal
        visible={rejectModalVisible}
        transactionType="deposit"
        loading={actionLoading}
        onConfirm={handleConfirmReject}
        onCancel={() => setRejectModalVisible(false)}
      />

      {/* Screenshot Viewer Modal */}
      <ImageViewerModal
        visible={imageModalVisible}
        imageUri={activeImageUri}
        title="Deposit Proof Receipt"
        onClose={() => setImageModalVisible(false)}
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
    marginVertical: 2,
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
  bonusVal: {
    color: colors.warningDark,
  },
  finDivider: {
    height: 1,
    backgroundColor: '#DFE8F5',
    marginVertical: 6,
  },
  finTotalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  finTotalValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
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
  bottomActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  screenshotThumbBtn: {
    width: 90,
    height: 54,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  screenshotThumb: {
    width: '100%',
    height: '100%',
  },
  thumbOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(9, 30, 66, 0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    gap: 4,
  },
  thumbText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  noScreenshotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 4,
  },
  noScreenshotText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  actionButtonsCol: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
});

export default DepositRequestsScreen;

