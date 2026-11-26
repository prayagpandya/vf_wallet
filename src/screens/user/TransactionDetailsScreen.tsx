import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Clipboard,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { colors } from '../../theme/colors';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { StatusBadge } from '../../components/common/StatusBadge';
import { SecondaryButton } from '../../components/buttons/SecondaryButton';
import { ImageViewerModal } from '../../components/modals/ImageViewerModal';
import { useWallet } from '../../hooks/useWallet';
import { useAuth } from '../../hooks/useAuth';
import { adminApi } from '../../services/api';
import { formatPaiseToINR } from '../../utils/currency';

export const TransactionDetailsScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { transactions, refreshData } = useWallet();
  const { isSuperAdmin } = useAuth();

  const transactionId = route.params?.transactionId;
  const transaction = transactions.find((t) => t.id === transactionId);

  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handlePromptDelete = () => {
    if (!transaction) return;
    const formattedAmt =
      transaction.type === 'deposit'
        ? formatPaiseToINR(transaction.amountPaise)
        : formatPaiseToINR(transaction.cashPaidPaise || transaction.amountPaise);

    Alert.alert(
      'Delete Transaction?',
      `Are you sure you want to remove this ${transaction.type.toUpperCase()} of ${formattedAmt} from the live ledger?\n\n• The transaction will be removed from the active ledger.\n• The client's wallet points balance will be adjusted.\n• This entry will be preserved in Backup & Restore and can be restored anytime.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete & Move to Backup',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              const res = await adminApi.deleteTransaction(transaction.id);
              if (res.success) {
                Alert.alert(
                  'Transaction Deleted',
                  'Transaction moved to Backup & Restore and client balance adjusted.'
                );
                await refreshData();
                navigation.goBack();
              } else {
                Alert.alert('Error', res.error || 'Failed to delete transaction.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Error occurred while deleting transaction.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (!transaction) {
    return (
      <ScreenContainer>
        <Header title="Transaction" showBack onBackPress={() => navigation.goBack()} />
        <View style={styles.notFoundContainer}>
          <Text style={styles.notFoundText}>Transaction record not found.</Text>
          <SecondaryButton
            title="Go Back"
            onPress={() => navigation.goBack()}
            style={{ marginTop: 16 }}
          />
        </View>
      </ScreenContainer>
    );
  }

  const isDeposit = transaction.type === 'deposit';
  const isWithdrawal = transaction.type === 'withdrawal';
  const isBonus = transaction.type === 'bonus';

  const dateObj = new Date(transaction.createdAt);
  const formattedDate = dateObj.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const formattedTime = dateObj.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleCopyId = () => {
    Clipboard.setString(transaction.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareReceipt = async () => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert(
          'Share Receipt',
          `VF Wallet Transaction\nID: ${transaction.id}\nAmount: ${formatPaiseToINR(
            transaction.amountPaise
          )}\nStatus: ${transaction.status.toUpperCase()}\nDate: ${formattedDate}`
        );
      } else {
        // Can share text or screenshot
        Alert.alert(
          'Receipt Details Copied',
          `Transaction ID ${transaction.id} details copied for sharing.`
        );
      }
    } catch (e) {
      console.log('Share error:', e);
    }
  };

  return (
    <ScreenContainer scrollable backgroundColor={colors.background}>
      <Header
        title="Transaction Details"
        subtitle={transaction.id}
        showBack
        onBackPress={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity
            style={styles.shareIconBtn}
            onPress={handleShareReceipt}
          >
            <Ionicons name="share-social-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        }
      />

      <View style={styles.content}>
        {/* Main Status & Amount Card */}
        <View style={styles.card}>
          <View style={styles.topStatusRow}>
            <StatusBadge status={transaction.status} size="md" />
            <Text style={styles.dateTimeText}>
              {formattedDate} • {formattedTime}
            </Text>
          </View>

          <View style={styles.amountBox}>
            <Text
              style={[
                styles.amountText,
                {
                  color: isWithdrawal
                    ? colors.danger
                    : transaction.status === 'rejected'
                    ? colors.textMuted
                    : colors.success,
                },
              ]}
            >
              {isWithdrawal ? '-' : '+'}
              {formatPaiseToINR(transaction.amountPaise)}
            </Text>
            <Text style={styles.typeLabel}>
              {isDeposit
                ? 'Wallet Deposit Request'
                : isWithdrawal
                ? 'Wallet Withdrawal Request'
                : 'Promotional Bonus Credit'}
            </Text>
          </View>

          <View style={styles.idBox}>
            <View>
              <Text style={styles.idLabel}>Transaction ID</Text>
              <Text style={styles.idValue}>{transaction.id}</Text>
            </View>
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopyId}>
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={16}
                color={colors.primary}
              />
              <Text style={styles.copyBtnText}>{copied ? 'Copied' : 'Copy'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Financial Breakdown Card */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Points & Cash Breakdown</Text>

          {isDeposit ? (
            <>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Cash Deposited</Text>
                <Text style={styles.breakdownVal}>
                  {formatPaiseToINR(transaction.amountPaise)}
                </Text>
              </View>

              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>
                  Bonus Credit ({transaction.bonusPercentage || 10}%)
                </Text>
                <Text style={[styles.breakdownVal, styles.bonusVal]}>
                  +{((transaction.bonusPaise || 0) / 100).toLocaleString('en-IN')} Points
                </Text>
              </View>

              <View style={styles.breakdownDivider} />

              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownTotalLabel}>Total Points Allocated</Text>
                <Text style={styles.breakdownTotalVal}>
                  {(
                    (transaction.totalCreditPaise ||
                      transaction.amountPaise + (transaction.bonusPaise || 0)) /
                    100
                  ).toLocaleString('en-IN')}{' '}
                  Points
                </Text>
              </View>
            </>
          ) : isWithdrawal ? (
            <>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Points Withdrawn</Text>
                <Text style={styles.breakdownVal}>
                  {(transaction.amountPaise / 100).toLocaleString('en-IN')} Points
                </Text>
              </View>

              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Bonus Points Deducted</Text>
                <Text
                  style={[
                    styles.breakdownVal,
                    {
                      color:
                        (transaction.bonusPaise ||
                          transaction.bonusDeductedPaise ||
                          0) > 0
                          ? colors.danger
                          : colors.textSecondary,
                    },
                  ]}
                >
                  -
                  {(
                    (transaction.bonusPaise ||
                      transaction.bonusDeductedPaise ||
                      0) / 100
                  ).toLocaleString('en-IN')}{' '}
                  Points
                </Text>
              </View>

              <View style={styles.breakdownDivider} />

              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownTotalLabel}>Cash Value of Withdrawal</Text>
                <Text style={[styles.breakdownTotalVal, { color: colors.success }]}>
                  {formatPaiseToINR(
                    transaction.cashPaidPaise !== undefined &&
                      transaction.cashPaidPaise > 0
                      ? transaction.cashPaidPaise
                      : Math.max(
                          0,
                          transaction.amountPaise - (transaction.bonusPaise || 0)
                        )
                  )}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownTotalLabel}>Points Credited</Text>
              <Text style={styles.breakdownTotalVal}>
                {(transaction.amountPaise / 100).toLocaleString('en-IN')} Points
              </Text>
            </View>
          )}

          <View style={styles.balanceImpactRow}>
            <Ionicons name="information-circle-outline" size={16} color={colors.info} />
            <Text style={styles.balanceImpactText}>
              {transaction.status === 'approved'
                ? isWithdrawal
                  ? 'Points debited from wallet and cash payout settled.'
                  : 'Cash received and wallet credited with points & promotional bonus.'
                : transaction.status === 'pending'
                ? 'Pending processing. Wallet balance has NOT been modified.'
                : 'Request was rejected. Wallet balance was not affected.'}
            </Text>
          </View>
        </View>

        {/* Rejection Reason (if rejected) */}
        {transaction.status === 'rejected' && transaction.rejectionReason && (
          <View style={[styles.card, styles.rejectionCard]}>
            <View style={styles.rejectionHeader}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.rejectionTitle}>Rejection Reason</Text>
            </View>
            <Text style={styles.rejectionReasonText}>
              {transaction.rejectionReason}
            </Text>
          </View>
        )}

        {/* Transfer Method Information */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Payment Information</Text>

          {transaction.paymentMethod && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Method</Text>
              <Text style={styles.infoValue}>{transaction.paymentMethod}</Text>
            </View>
          )}

          {transaction.upiId && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>UPI ID</Text>
              <Text style={styles.infoValue}>{transaction.upiId}</Text>
            </View>
          )}

          {transaction.bankDetails && (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Account Holder</Text>
                <Text style={styles.infoValue}>
                  {transaction.bankDetails.accountHolderName}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Account No.</Text>
                <Text style={styles.infoValue}>
                  {transaction.bankDetails.accountNumber}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>IFSC Code</Text>
                <Text style={styles.infoValue}>
                  {transaction.bankDetails.ifsc}
                </Text>
              </View>
            </>
          )}

          {transaction.processedBy && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Verified By</Text>
              <Text style={styles.infoValue}>{transaction.processedBy}</Text>
            </View>
          )}
        </View>

        {/* Payment Screenshot (if available) */}
        {transaction.screenshotUri && (
          <View style={styles.card}>
            <Text style={styles.cardHeading}>Payment Screenshot Receipt</Text>
            <TouchableOpacity
              onPress={() => setImageModalVisible(true)}
              activeOpacity={0.8}
              style={styles.screenshotBox}
            >
              <Image
                source={{ uri: transaction.screenshotUri }}
                style={styles.screenshotImage}
              />
              <View style={styles.zoomOverlay}>
                <Ionicons name="expand-outline" size={18} color={colors.white} />
                <Text style={styles.zoomText}>Tap to View Fullscreen</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Delete from Live Ledger Action (Move to Backup) */}
        <View style={styles.deleteCard}>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={handlePromptDelete}
            disabled={isDeleting}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={18} color={colors.white} />
            <Text style={styles.deleteBtnText}>
              {isDeleting ? 'Archiving...' : 'Delete Transaction (Move to Backup)'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.deleteHintText}>
            Removes this entry from live balances and moves it safely into Backup & Restore.
          </Text>
        </View>
      </View>

      {/* Fullscreen Screenshot Modal */}
      <ImageViewerModal
        visible={imageModalVisible}
        imageUri={transaction.screenshotUri}
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
  shareIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  topStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dateTimeText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  amountBox: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  amountText: {
    fontSize: 32,
    fontWeight: '800',
  },
  typeLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
    marginTop: 4,
  },
  idBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  idLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  idValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 4,
  },
  cardHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 14,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  breakdownLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  breakdownVal: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  bonusVal: {
    color: colors.warningDark,
    fontWeight: '700',
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 10,
  },
  breakdownTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  breakdownTotalVal: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  balanceImpactRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.infoLight,
    padding: 10,
    borderRadius: 8,
    marginTop: 14,
  },
  balanceImpactText: {
    fontSize: 11,
    color: colors.info,
    marginLeft: 6,
    flex: 1,
    lineHeight: 16,
  },
  rejectionCard: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FFD1D1',
  },
  rejectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  rejectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.dangerDark,
    marginLeft: 6,
  },
  rejectionReasonText: {
    fontSize: 13,
    color: '#821414',
    lineHeight: 18,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    maxWidth: '65%',
    textAlign: 'right',
  },
  screenshotBox: {
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    height: 180,
  },
  screenshotImage: {
    width: '100%',
    height: '100%',
  },
  zoomOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(9, 30, 66, 0.75)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  zoomText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  notFoundContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  notFoundText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  deleteCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
    width: '100%',
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  deleteHintText: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
});

export default TransactionDetailsScreen;

