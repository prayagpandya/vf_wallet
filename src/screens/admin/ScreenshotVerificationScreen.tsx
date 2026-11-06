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

export const ScreenshotVerificationScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { transactions, approveDeposit, rejectDeposit, refreshData } = useWallet();

  const [activeTab, setActiveTab] = useState<'pending' | 'verified' | 'all'>('pending');
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

  // Only consider transactions that have screenshots or OCR results
  const screenshotTransactions = transactions
    .filter((t) => t.type === 'deposit' && (t.screenshotUri || t.ocrResult))
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  const displayedList = screenshotTransactions.filter((t) => {
    if (activeTab === 'pending') return t.status === 'pending';
    if (activeTab === 'verified') return t.status === 'approved';
    return true;
  });

  const pendingCount = screenshotTransactions.filter(
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
      Alert.alert('Notice', 'No screenshot image attached.');
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
      Alert.alert(
        'Verified & Approved!',
        `Deposit ${selectedTxn.id} verified. Principal ${formatPaiseToINR(
          selectedTxn.amountPaise
        )} and bonus of ${formatPaiseToINR(
          selectedTxn.bonusPaise || 0
        )} credited to user's wallet.`
      );
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
        title="Screenshot Verification"
        subtitle="On-device OCR review & manual bank reconciliation"
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.content}>
        {/* Verification Safety Banner */}
        <View style={styles.safetyBanner}>
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.warningDark} />
          <View style={styles.safetyTextCol}>
            <Text style={styles.safetyTitle}>Crucial Verification Rule</Text>
            <Text style={styles.safetyDesc}>
              OCR text detection does NOT prove money was received. Verify the
              UTR number against your merchant bank statement before approving.
            </Text>
          </View>
        </View>

        {/* Tab Filters */}
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
              Pending Verification ({pendingCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'verified' && styles.tabBtnActive]}
            onPress={() => setActiveTab('verified')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'verified' && styles.tabTextActive,
              ]}
            >
              Approved
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'all' && styles.tabBtnActive]}
            onPress={() => setActiveTab('all')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'all' && styles.tabTextActive,
              ]}
            >
              All Receipts
            </Text>
          </TouchableOpacity>
        </View>

        {/* List of OCR Submissions */}
        <View style={styles.listContainer}>
          {displayedList.length > 0 ? (
            displayedList.map((item) => {
              const ocr = item.ocrResult;
              const subDate = new Date(item.createdAt).toLocaleDateString(
                'en-IN',
                {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }
              );

              const isIncomplete =
                !item.utrNumber || (item.ocrConfidence || 0) < 60;

              return (
                <View key={item.id} style={styles.verificationCard}>
                  {/* Header Row */}
                  <View style={styles.cardHeader}>
                    <View style={styles.userCol}>
                      <Text style={styles.userNameText}>{item.userName}</Text>
                      <Text style={styles.userIdText}>
                        {item.userId} • {item.userPhone}
                      </Text>
                    </View>
                    <StatusBadge status={item.status} size="sm" />
                  </View>

                  {/* Submission Source & Time */}
                  <View style={styles.metaBadgeRow}>
                    <View style={styles.sourceTag}>
                      <Ionicons
                        name={
                          item.submissionSource === 'whatsapp_share'
                            ? 'logo-whatsapp'
                            : 'images-outline'
                        }
                        size={12}
                        color={
                          item.submissionSource === 'whatsapp_share'
                            ? '#16A36A'
                            : colors.primary
                        }
                      />
                      <Text style={styles.sourceTagText}>
                        {item.submissionSource === 'whatsapp_share'
                          ? 'WhatsApp Share Intent'
                          : 'Gallery Selection'}
                      </Text>
                    </View>

                    <Text style={styles.timeText}>{subDate}</Text>
                  </View>

                  {/* Screenshot Thumbnail with zoom overlay */}
                  <TouchableOpacity
                    style={styles.screenshotPreviewWrapper}
                    onPress={() => handleOpenImage(item.screenshotUri)}
                    activeOpacity={0.8}
                  >
                    {item.screenshotUri ? (
                      <Image
                        source={{ uri: item.screenshotUri }}
                        style={styles.screenshotImage}
                      />
                    ) : (
                      <View style={styles.noImagePlaceholder}>
                        <Ionicons
                          name="document-text-outline"
                          size={32}
                          color={colors.textLight}
                        />
                        <Text style={styles.noImageText}>
                          No screenshot attached
                        </Text>
                      </View>
                    )}
                    <View style={styles.zoomButton}>
                      <Ionicons name="scan-outline" size={14} color={colors.white} />
                      <Text style={styles.zoomButtonText}>Tap to Zoom Original</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Extracted Details Box */}
                  <View style={styles.extractedBox}>
                    <View style={styles.extractedHeader}>
                      <Text style={styles.extractedTitle}>
                        OCR Extracted Fields
                      </Text>
                      <View style={styles.confidenceScoreBox}>
                        <Text style={styles.confidenceText}>
                          Confidence: {item.ocrConfidence || 0}%
                        </Text>
                      </View>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Extracted Amount:</Text>
                      <Text style={[styles.detailVal, styles.amountHighlight]}>
                        {formatPaiseToINR(item.amountPaise)}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>UTR / Reference:</Text>
                      <Text
                        style={[
                          styles.detailVal,
                          styles.utrText,
                          !item.utrNumber && styles.missingText,
                        ]}
                      >
                        {item.utrNumber || 'Not detected'}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Payment App:</Text>
                      <Text style={styles.detailVal}>
                        {item.paymentAppName ||
                          ocr?.paymentAppName ||
                          'Not detected'}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Sender / Receiver:</Text>
                      <Text style={styles.detailVal}>
                        {item.senderName || item.receiverName
                          ? `${item.senderName || ''} ➔ ${
                              item.receiverName || ''
                            }`
                          : 'Not detected'}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Payment Status:</Text>
                      <Text style={[styles.detailVal, styles.statusSuccess]}>
                        {ocr?.paymentStatus || 'SUCCESS'}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Internal TXN Ref:</Text>
                      <Text style={styles.detailVal}>{item.id}</Text>
                    </View>
                  </View>

                  {/* Warning if OCR data is incomplete */}
                  {isIncomplete && item.status === 'pending' && (
                    <View style={styles.incompleteWarning}>
                      <Ionicons
                        name="warning-outline"
                        size={16}
                        color={colors.warningDark}
                      />
                      <Text style={styles.incompleteWarningText}>
                        Incomplete OCR extraction: Verify screenshot carefully
                        before approving.
                      </Text>
                    </View>
                  )}

                  {/* Approval Actions */}
                  {item.status === 'pending' && (
                    <View style={styles.actionsRow}>
                      <View style={{ flex: 1 }}>
                        <SecondaryButton
                          title="Reject"
                          variant="dangerOutline"
                          size="sm"
                          onPress={() => handleOpenReject(item)}
                        />
                      </View>

                      <View style={{ flex: 1.3 }}>
                        <PrimaryButton
                          title="Verify & Credit"
                          variant="success"
                          size="sm"
                          icon="checkmark-circle"
                          onPress={() => handleOpenApprove(item)}
                        />
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <EmptyState
              icon="image-search-outline"
              title="No Screenshots Received Yet"
              description="When users share screenshots from WhatsApp or upload via Gallery, they will appear here for verification."
            />
          )}
        </View>
      </View>

      {/* Confirmation Modal */}
      <ConfirmationModal
        visible={approveModalVisible}
        title="Approve & Credit Wallet?"
        message={
          selectedTxn
            ? `Deposit: ${formatPaiseToINR(
                selectedTxn.amountPaise
              )}\nBonus (${selectedTxn.bonusPercentage || 5}%): ${formatPaiseToINR(
                selectedTxn.bonusPaise || 0
              )}\nTotal Credit: ${formatPaiseToINR(
                selectedTxn.totalCreditPaise || selectedTxn.amountPaise
              )}\nUTR: ${selectedTxn.utrNumber || 'Verified'}\n\nHave you verified the payment in your official bank statement?`
            : ''
        }
        confirmLabel="Yes, Approve & Credit"
        variant="success"
        icon="checkmark-circle"
        loading={actionLoading}
        onConfirm={handleConfirmApprove}
        onCancel={() => setApproveModalVisible(false)}
      />

      {/* Rejection Modal */}
      <RejectionModal
        visible={rejectModalVisible}
        transactionType="deposit"
        loading={actionLoading}
        onConfirm={handleConfirmReject}
        onCancel={() => setRejectModalVisible(false)}
      />

      {/* Fullscreen Screenshot Modal */}
      <ImageViewerModal
        visible={imageModalVisible}
        imageUri={activeImageUri}
        title="Original Payment Screenshot"
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
  safetyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 14,
    gap: 8,
  },
  safetyTextCol: {
    flex: 1,
  },
  safetyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  safetyDesc: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 2,
    lineHeight: 16,
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
    fontSize: 12,
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
  verificationCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  userCol: {
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
    marginTop: 1,
  },
  metaBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  sourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  sourceTagText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  timeText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  screenshotPreviewWrapper: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F3F4F6',
    marginBottom: 12,
  },
  screenshotImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  noImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noImageText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  zoomButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(9, 30, 66, 0.8)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  zoomButtonText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  extractedBox: {
    backgroundColor: '#F8FAFD',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2ECF8',
    marginBottom: 10,
  },
  extractedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  extractedTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    textTransform: 'uppercase',
  },
  confidenceScoreBox: {
    backgroundColor: colors.lightBlue,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  detailLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  detailVal: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    maxWidth: '60%',
    textAlign: 'right',
  },
  amountHighlight: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  utrText: {
    fontWeight: '700',
    color: colors.primaryDark,
  },
  statusSuccess: {
    color: colors.successDark,
    fontWeight: '700',
  },
  missingText: {
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  incompleteWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
    gap: 6,
  },
  incompleteWarningText: {
    fontSize: 11,
    color: colors.warningDark,
    fontWeight: '600',
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
});

export default ScreenshotVerificationScreen;
