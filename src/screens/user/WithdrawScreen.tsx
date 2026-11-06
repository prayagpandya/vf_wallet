import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { AmountInput } from '../../components/inputs/AmountInput';
import { CustomInput } from '../../components/inputs/CustomInput';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { ConfirmationModal } from '../../components/modals/ConfirmationModal';
import { useAuth } from '../../hooks/useAuth';
import { useWallet } from '../../hooks/useWallet';
import {
  rupeesToPaise,
  paiseToRupees,
  formatPaiseToINR,
} from '../../utils/currency';
import { validateWithdrawal } from '../../utils/calculations';
import { User } from '../../types';

export const WithdrawScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { user } = useAuth();
  const { userWallet, createWithdrawal } = useWallet();

  const currentUser = user && user.role === 'user' ? (user as User) : null;

  const [payoutMethod, setPayoutMethod] = useState<'upi' | 'bank'>('upi');
  const [amountStr, setAmountStr] = useState('2000');
  const [upiId, setUpiId] = useState(currentUser?.upiId || '');
  const [accountNumber, setAccountNumber] = useState(
    currentUser?.bankAccount?.accountNumber || ''
  );
  const [ifsc, setIfsc] = useState(currentUser?.bankAccount?.ifsc || '');
  const [bankName, setBankName] = useState(currentUser?.bankAccount?.bankName || '');
  const [accountHolderName, setAccountHolderName] = useState(
    currentUser?.bankAccount?.accountHolderName || user?.name || ''
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [createdTxnId, setCreatedTxnId] = useState('');

  const availablePaise = userWallet ? userWallet.availableBalancePaise : 0;
  const availableRupees = paiseToRupees(availablePaise);
  const totalDepositPaise = userWallet ? userWallet.totalDepositPaise : 0;
  const totalBonusPaise = userWallet ? userWallet.totalBonusPaise : 0;
  const alreadyWithdrawnPaise = userWallet
    ? userWallet.totalWithdrawalPaise
    : 0;

  const quickPercentages = [
    { label: '25%', percentage: 25 },
    { label: '50%', percentage: 50 },
    { label: '75%', percentage: 75 },
    { label: '100% (Max)', percentage: 100 },
  ];

  const handleSubmit = async () => {
    setError('');
    const requestedPaise = rupeesToPaise(amountStr || '0');

    // Central validation
    const validation = validateWithdrawal(availablePaise, requestedPaise);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid withdrawal amount.');
      return;
    }

    if (payoutMethod === 'upi') {
      if (!upiId.trim()) {
        setError('Please enter a valid UPI ID for withdrawal.');
        return;
      }
    } else {
      if (!accountNumber.trim()) {
        setError('Please enter your Bank Account Number.');
        return;
      }
      if (!ifsc.trim()) {
        setError('Please enter your Bank IFSC Code.');
        return;
      }
      if (!accountHolderName.trim()) {
        setError('Please enter the Account Holder Name.');
        return;
      }
    }

    setLoading(true);
    const res = await createWithdrawal({
      amountPaise: requestedPaise,
      paymentMethod:
        payoutMethod === 'upi' ? `UPI (${upiId})` : `Bank (${bankName || 'IMPS'})`,
      upiId: payoutMethod === 'upi' ? upiId.trim() : undefined,
      bankDetails:
        payoutMethod === 'bank'
          ? {
              accountNumber: accountNumber.trim(),
              ifsc: ifsc.trim().toUpperCase(),
              bankName: bankName.trim() || 'Bank Transfer',
              accountHolderName: accountHolderName.trim(),
            }
          : undefined,
      notes: `Requested payout via ${payoutMethod.toUpperCase()}`,
    });
    setLoading(false);

    if (res.success && res.transaction) {
      setCreatedTxnId(res.transaction.id);
      setSuccessModalVisible(true);
    } else {
      setError(res.error || 'Failed to submit withdrawal request.');
    }
  };

  const handleSuccessDone = () => {
    setSuccessModalVisible(false);
    navigation.navigate('UserDashboard');
  };

  return (
    <ScreenContainer scrollable backgroundColor={colors.background}>
      <Header
        title="Withdraw Funds"
        subtitle="Transfer funds to your verified account"
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.content}
      >
        {/* Wallet Balance Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.availableBox}>
            <Text style={styles.availableLabel}>Current Available Balance</Text>
            <Text style={styles.availableValue}>
              {formatPaiseToINR(availablePaise)}
            </Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryGrid}>
            <View style={styles.gridCol}>
              <Text style={styles.gridLabel}>Total Deposit</Text>
              <Text style={styles.gridValue}>
                {formatPaiseToINR(totalDepositPaise)}
              </Text>
            </View>
            <View style={styles.gridCol}>
              <Text style={styles.gridLabel}>Total Bonus</Text>
              <Text style={[styles.gridValue, styles.bonusColor]}>
                {formatPaiseToINR(totalBonusPaise)}
              </Text>
            </View>
            <View style={styles.gridCol}>
              <Text style={styles.gridLabel}>Already Withdrawn</Text>
              <Text style={styles.gridValue}>
                {formatPaiseToINR(alreadyWithdrawnPaise)}
              </Text>
            </View>
          </View>
        </View>

        {/* Withdrawal Amount Input */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Withdrawal Amount</Text>
          <AmountInput
            value={amountStr}
            onChangeValue={(val) => {
              setAmountStr(val);
              if (error) setError('');
            }}
            quickPercentages={quickPercentages}
            maxAvailableRupees={availableRupees}
            placeholder="0"
            error={error}
          />
        </View>

        {/* Payout Destination */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Payout Method</Text>

          {/* Toggle Tab */}
          <View style={styles.tabToggleRow}>
            <TouchableOpacity
              style={[styles.tabBtn, payoutMethod === 'upi' && styles.tabBtnActive]}
              onPress={() => setPayoutMethod('upi')}
            >
              <Ionicons
                name="phone-portrait-outline"
                size={16}
                color={payoutMethod === 'upi' ? colors.white : colors.textSecondary}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  payoutMethod === 'upi' && styles.tabBtnTextActive,
                ]}
              >
                Instant UPI
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                payoutMethod === 'bank' && styles.tabBtnActive,
              ]}
              onPress={() => setPayoutMethod('bank')}
            >
              <Ionicons
                name="business-outline"
                size={16}
                color={
                  payoutMethod === 'bank' ? colors.white : colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.tabBtnText,
                  payoutMethod === 'bank' && styles.tabBtnTextActive,
                ]}
              >
                Bank Transfer (IMPS)
              </Text>
            </TouchableOpacity>
          </View>

          {payoutMethod === 'upi' ? (
            <View style={styles.payoutInputsContainer}>
              <CustomInput
                label="UPI ID / VPA"
                placeholder="e.g. aditya@okaxis"
                value={upiId}
                onChangeText={(text) => setUpiId(text)}
                leftIcon="card-outline"
                autoCapitalize="none"
              />
              <CustomInput
                label="Beneficiary Full Name"
                placeholder="Name as registered with UPI"
                value={accountHolderName}
                onChangeText={(text) => setAccountHolderName(text)}
                leftIcon="person-outline"
              />
            </View>
          ) : (
            <View style={styles.payoutInputsContainer}>
              <CustomInput
                label="Account Holder Name"
                placeholder="e.g. Aditya Sharma"
                value={accountHolderName}
                onChangeText={(text) => setAccountHolderName(text)}
                leftIcon="person-outline"
              />
              <CustomInput
                label="Bank Account Number"
                placeholder="e.g. 50100482910234"
                value={accountNumber}
                onChangeText={(text) => setAccountNumber(text)}
                leftIcon="wallet-outline"
                keyboardType="numeric"
              />
              <CustomInput
                label="IFSC Code"
                placeholder="e.g. HDFC0000060"
                value={ifsc}
                onChangeText={(text) => setIfsc(text.toUpperCase())}
                leftIcon="barcode-outline"
                autoCapitalize="characters"
              />
              <CustomInput
                label="Bank Name (Optional)"
                placeholder="e.g. HDFC Bank"
                value={bankName}
                onChangeText={(text) => setBankName(text)}
                leftIcon="business-outline"
              />
            </View>
          )}

          <View style={styles.securityNote}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.success} />
            <Text style={styles.securityNoteText}>
              Funds are transferred strictly after Admin approval. No balance is
              deducted until approval is confirmed.
            </Text>
          </View>
        </View>

        {/* Submit Button */}
        <PrimaryButton
          title="Submit Withdrawal Request"
          onPress={handleSubmit}
          loading={loading}
          fullWidth
          size="lg"
          style={styles.submitBtn}
        />
      </KeyboardAvoidingView>

      {/* Confirmation Modal */}
      <ConfirmationModal
        visible={successModalVisible}
        title="Withdrawal Request Placed!"
        message={`Your request to withdraw ${formatPaiseToINR(
          rupeesToPaise(amountStr)
        )} has been submitted.\n\nTransaction ID: ${createdTxnId}\nStatus: PENDING ADMIN APPROVAL\n\nYour balance will be deducted once verified and processed by finance.`}
        confirmLabel="Go to Dashboard"
        variant="success"
        icon="checkmark-circle"
        onConfirm={handleSuccessDone}
        onCancel={handleSuccessDone}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  summaryCard: {
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
  availableBox: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  availableLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  availableValue: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.primary,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 14,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gridCol: {
    flex: 1,
    alignItems: 'center',
  },
  gridLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 3,
  },
  gridValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  bonusColor: {
    color: colors.warningDark,
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
  cardHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  tabToggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabBtnTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
  payoutInputsContainer: {
    marginTop: 4,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.successLight,
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  securityNoteText: {
    fontSize: 11,
    color: colors.successDark,
    marginLeft: 6,
    flex: 1,
    lineHeight: 16,
  },
  submitBtn: {
    marginTop: 8,
    marginBottom: 20,
  },
});

export default WithdrawScreen;
