import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  FlatList,
  TextInput,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { CustomInput } from '../../components/inputs/CustomInput';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { useAuth } from '../../hooks/useAuth';
import { useWallet } from '../../hooks/useWallet';
import { adminApi } from '../../services/api';
import { ocrService } from '../../services/ocrService';
import { formatPaiseToINR, rupeesToPaise } from '../../utils/currency';
import { User, ExtractedPaymentDetails } from '../../types';

type RouteParams = {
  ClientWithdraw?: {
    clientId?: string;
  };
};

export const ClientWithdrawScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<RouteParams, 'ClientWithdraw'>>();
  const { isSuperAdmin, permissions } = useAuth();
  const { users, refreshData } = useWallet();

  const canWithdraw = isSuperAdmin || permissions.canWithdraw;

  const [clients, setClients] = useState<User[]>(users);
  const [selectedClient, setSelectedClient] = useState<User | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  const [amountText, setAmountText] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<'upi' | 'bank' | 'direct'>('upi');
  const [upiId, setUpiId] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [notes, setNotes] = useState('');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [isScanningScreenshot, setIsScanningScreenshot] = useState(false);
  const [scannedPayoutPaise, setScannedPayoutPaise] = useState<number | null>(null);
  const [scannedDetails, setScannedDetails] = useState<ExtractedPaymentDetails | null>(null);
  const [ocrScanError, setOcrScanError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const scanAndVerifyScreenshot = async (uri: string, base64Data: string | null) => {
    setIsScanningScreenshot(true);
    setOcrScanError(null);
    try {
      const res = await ocrService.processScreenshot(uri, base64Data);
      if (res.extracted) {
        setScannedDetails(res.extracted);
        if (res.extracted.amountPaise !== null) {
          setScannedPayoutPaise(res.extracted.amountPaise);
          // If amount text is empty, auto-fill client's total balance for full cashout
          if (!amountText && selectedClient && (selectedClient.totalBalancePaise || 0) > 0) {
            setAmountText(((selectedClient.totalBalancePaise || 0) / 100).toString());
          }
        } else {
          setScannedPayoutPaise(null);
          setOcrScanError('Could not detect transfer amount from screenshot.');
        }
      } else {
        setOcrScanError('Could not read screenshot details.');
      }
    } catch (e: any) {
      console.warn('Screenshot OCR verification error:', e);
      setOcrScanError('OCR failed to scan screenshot.');
    } finally {
      setIsScanningScreenshot(false);
    }
  };

  const handlePickScreenshot = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Permission Required',
          'Allow photo library access to upload withdrawal payout receipts.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.65,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const b64 = asset.base64
          ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`
          : asset.uri;
        setScreenshotUri(asset.uri);
        setScreenshotBase64(b64);
        scanAndVerifyScreenshot(asset.uri, b64);
      }
    } catch {
      Alert.alert('Error', 'Unable to pick screenshot from gallery.');
    }
  };

  const handleCaptureScreenshot = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Permission Required',
          'Allow camera access to capture withdrawal payout receipts.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.65,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const b64 = asset.base64
          ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`
          : asset.uri;
        setScreenshotUri(asset.uri);
        setScreenshotBase64(b64);
        scanAndVerifyScreenshot(asset.uri, b64);
      }
    } catch {
      Alert.alert('Error', 'Unable to open camera.');
    }
  };

  const loadClients = useCallback(async (targetClientId?: string) => {
    try {
      const res = await adminApi.getUsers({ role: 'CLIENT' });
      if (res.success && Array.isArray(res.users)) {
        const mapped: User[] = res.users.map((u: any) => ({
          id: u.id,
          name: u.name,
          phone: u.phone,
          email: u.email || '',
          role: 'user',
          accountType: 'CLIENT',
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
          withdrawablePaise: u.withdrawablePaise ?? u.totalBalancePaise ?? 0,
          createdById: u.createdById,
          createdByName: u.createdByName,
          createdByRole: u.createdByRole,
        }));
        setClients(mapped);

        setSelectedClient((prev) => {
          const idToFind = targetClientId || route.params?.clientId || prev?.id;
          if (idToFind) {
            const found = mapped.find((c) => c.id === idToFind);
            if (found) return found;
          }
          return prev;
        });
      }
    } catch (e) {
      console.warn('Could not load clients for withdrawal:', e);
    }
  }, [route.params?.clientId]);

  // Synchronize fresh client balances every time the screen is focused
  useFocusEffect(
    useCallback(() => {
      loadClients(route.params?.clientId);
    }, [loadClients, route.params?.clientId])
  );

  useEffect(() => {
    if (route.params?.clientId) {
      loadClients(route.params.clientId);
    }
  }, [route.params?.clientId, loadClients]);

  // Pre-fill client's saved UPI / Bank when client changes
  const handleSelectClient = (client: User) => {
    setSelectedClient(client);
    setUpiId(client.upiId || '');
    setBankName(client.bankAccount?.bankName || '');
    setAccountNumber(client.bankAccount?.accountNumber || '');
    setIfsc(client.bankAccount?.ifsc || '');
    setAccountHolderName(client.bankAccount?.accountHolderName || client.name);
    setAmountText('');
    setPickerVisible(false);
    setClientSearch('');
  };

  useEffect(() => {
    if (selectedClient && !upiId && selectedClient.upiId) {
      setUpiId(selectedClient.upiId);
    }
    if (selectedClient && !accountNumber && selectedClient.bankAccount) {
      setBankName(selectedClient.bankAccount.bankName || '');
      setAccountNumber(selectedClient.bankAccount.accountNumber || '');
      setIfsc(selectedClient.bankAccount.ifsc || '');
      setAccountHolderName(
        selectedClient.bankAccount.accountHolderName || selectedClient.name
      );
    }
  }, [selectedClient]);

  const activeClients = clients.filter((c) => c.status === 'active');
  const filteredClients = activeClients.filter((c) => {
    if (!clientSearch.trim()) return true;
    const q = clientSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q);
  });

  // Points & Cycle Metrics
  const totalBalancePaise = selectedClient?.totalBalancePaise || 0;
  const isBonusDeductedInCycle = Boolean(selectedClient?.isBonusDeductedInCycle);
  const rawActiveBonus = selectedClient?.activeBonusPaise || 0;
  const inferredBonus =
    !isBonusDeductedInCycle &&
    Boolean(selectedClient?.lastDepositAmountPaise) &&
    totalBalancePaise > (selectedClient?.lastDepositAmountPaise || 0)
      ? totalBalancePaise - (selectedClient?.lastDepositAmountPaise || 0)
      : 0;
  const activeBonusPaise = rawActiveBonus > 0 ? rawActiveBonus : inferredBonus;
  const hasActiveBonus = activeBonusPaise > 0 && !isBonusDeductedInCycle;

  // Final cash payout if client cashes out in full (e.g. 11,000 Points - 1,000 Bonus = ₹10,000 Cash)
  const fullCashoutNetCashPaise = hasActiveBonus
    ? Math.max(0, totalBalancePaise - activeBonusPaise)
    : totalBalancePaise;

  const numericAmount = parseFloat(amountText.replace(/,/g, '')) || 0;
  const requestedPaise = numericAmount > 0 ? rupeesToPaise(numericAmount) : 0;

  // Did admin enter the exact net cash payable (e.g. 10,000) or total points (11,000)?
  const isEnteredNetCashForFullCashout =
    hasActiveBonus &&
    requestedPaise > 0 &&
    (Math.abs(requestedPaise - fullCashoutNetCashPaise) <= 100 || requestedPaise >= totalBalancePaise);

  const effectiveDebitPointsPaise = isEnteredNetCashForFullCashout
    ? totalBalancePaise
    : requestedPaise;

  // Points & Cycle Deduction Rules:
  // Bonus deduction triggers if withdrawal is full cashout (points >= balance OR entered net cash)
  const isBonusDeductionTriggered =
    hasActiveBonus &&
    (requestedPaise >= totalBalancePaise || isEnteredNetCashForFullCashout);

  const bonusExcludedPaise = isBonusDeductionTriggered ? activeBonusPaise : 0;
  const netPayoutPaise = Math.max(0, effectiveDebitPointsPaise - bonusExcludedPaise);
  // Final cash payout that MUST match the payment screenshot:
  const finalCashPayoutPaise = netPayoutPaise > 0 ? netPayoutPaise : requestedPaise;

  // Verification: Scanned receipt amount MUST match the FINAL CASH PAYOUT amount
  const isAmountMatched =
    scannedPayoutPaise !== null &&
    finalCashPayoutPaise > 0 &&
    (Math.abs(scannedPayoutPaise - finalCashPayoutPaise) <= 100 ||
      Math.abs(scannedPayoutPaise - requestedPaise) <= 100);

  const handleProcessWithdrawal = async () => {
    if (!selectedClient) {
      Alert.alert('Select Client', 'Please choose a client account first.');
      return;
    }

    if (effectiveDebitPointsPaise <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid points withdrawal amount.');
      return;
    }

    if (payoutMethod === 'bank' && (!accountNumber.trim() || !ifsc.trim())) {
      Alert.alert(
        'Bank Details Required',
        'Please provide both Account Number and IFSC code.'
      );
      return;
    }

    if (!screenshotUri) {
      Alert.alert(
        'Screenshot Required',
        'Please upload a payout receipt screenshot before processing withdrawal.'
      );
      return;
    }

    if (isScanningScreenshot) {
      Alert.alert(
        'Scanning Receipt...',
        'Please wait while the uploaded receipt amount is being scanned and verified.'
      );
      return;
    }

    if (!isAmountMatched) {
      Alert.alert(
        'Amount Mismatch ❌',
        scannedPayoutPaise !== null
          ? `Final cash payout requires ₹${(finalCashPayoutPaise / 100).toLocaleString('en-IN')}, but uploaded screenshot shows ₹${(scannedPayoutPaise / 100).toLocaleString('en-IN')}.\n\nThe receipt amount must match the final withdrawal cash payout (₹${(finalCashPayoutPaise / 100).toLocaleString('en-IN')}) before proceeding.`
          : `Could not verify amount from screenshot. Uploaded receipt must clearly show ₹${(finalCashPayoutPaise / 100).toLocaleString('en-IN')}. Please re-upload a clear receipt screenshot.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await adminApi.createClientWithdrawal(selectedClient.id, {
        amountPaise: effectiveDebitPointsPaise,
        isFullCashout: isBonusDeductionTriggered,
        cashPaidPaise: finalCashPayoutPaise,
        paymentMethod:
          payoutMethod === 'upi'
            ? (upiId.trim() ? `UPI: ${upiId.trim()}` : 'UPI Payout')
            : payoutMethod === 'bank'
            ? `Bank: ${bankName.trim() || 'IMPS'}`
            : 'Direct Cash / Settlement',
        upiId: payoutMethod === 'upi' && upiId.trim() ? upiId.trim() : undefined,
        bankDetails:
          payoutMethod === 'bank'
            ? {
                bankName: bankName.trim() || 'Bank Account',
                accountNumber: accountNumber.trim(),
                ifsc: ifsc.trim().toUpperCase(),
                accountHolderName:
                  accountHolderName.trim() || selectedClient.name,
              }
            : undefined,
        notes: notes.trim() || undefined,
        screenshotUri: screenshotBase64 || screenshotUri || undefined,
      });

      if (res.success) {
        await Promise.all([refreshData(), loadClients()]);
        Alert.alert(
          'Payout Processed! ✅',
          res.message ||
            `Debited ${(effectiveDebitPointsPaise / 100).toLocaleString('en-IN')} Points. Paid ₹${(
              finalCashPayoutPaise / 100
            ).toLocaleString('en-IN')} Cash to ${selectedClient.name}.\n\nRemaining Points: ${(
              (res.clientNewBalancePaise ?? Math.max(0, totalBalancePaise - effectiveDebitPointsPaise)) /
              100
            ).toLocaleString('en-IN')}`
        );
        setAmountText('');
        setNotes('');
        setScreenshotUri(null);
        setScreenshotBase64(null);
        setScannedPayoutPaise(null);
        setScannedDetails(null);
        setOcrScanError(null);
      } else {
        Alert.alert(
          'Withdrawal Blocked',
          res.error || 'Could not process withdrawal.'
        );
      }
    } catch (e: any) {
      Alert.alert(
        'Error',
        e?.message || 'Unexpected error processing withdrawal.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canWithdraw) {
    return (
      <ScreenContainer backgroundColor={colors.background}>
        <Header title="Client Withdrawal" showBack onBackPress={() => navigation.goBack()} />
        <View style={styles.noPermContainer}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.textLight} />
          <Text style={styles.noPermTitle}>Permission Restricted</Text>
          <Text style={styles.noPermDesc}>
            You do not have Withdrawal permission. Please contact Super Admin.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable backgroundColor={colors.background}>
      <Header
        title="Client Withdrawal"
        subtitle="Points Cycle Payout (Auto-Accept)"
      />

      <View style={styles.content}>
        {/* Step 1: Select Client */}
        <View style={styles.card}>
          <Text style={styles.stepTitle}>1. Select Client for Payout</Text>
          <TouchableOpacity
            style={styles.clientSelectorBtn}
            onPress={() => setPickerVisible(true)}
            activeOpacity={0.75}
          >
            {selectedClient ? (
              <View style={styles.selectedClientRow}>
                <View style={styles.clientAvatar}>
                  <Text style={styles.clientAvatarText}>
                    {selectedClient.name.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedClientName}>{selectedClient.name}</Text>
                  <Text style={styles.selectedClientMeta}>+91 {selectedClient.phone}</Text>
                  <Text style={styles.selectedClientBal}>
                    Points: {(totalBalancePaise / 100).toLocaleString('en-IN')} • Active Bonus: {(activeBonusPaise / 100).toLocaleString('en-IN')}
                  </Text>
                  <Text style={styles.cycleStatusText}>
                    Cycle Status: {isBonusDeductedInCycle ? '100% Cashout (Bonus Already Deducted)' : hasActiveBonus ? 'Active Bonus Cycle' : 'No Active Bonus'}
                  </Text>
                </View>
                <View style={styles.changePill}>
                  <Text style={styles.changePillText}>Change</Text>
                </View>
              </View>
            ) : (
              <View style={styles.placeholderRow}>
                <Ionicons name="person-outline" size={20} color={colors.primary} />
                <Text style={styles.placeholderText}>Tap to choose a client...</Text>
                <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Step 2: Real-Time Cycle Rule & Payout Calculation */}
        {selectedClient && (
          <View style={styles.card}>
            <Text style={styles.stepTitle}>2. Points & Cycle Calculation</Text>

            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Total Wallet Points</Text>
              <Text style={styles.metricVal}>
                {(totalBalancePaise / 100).toLocaleString('en-IN')} Points
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Active Cycle Bonus</Text>
              <Text style={[styles.metricVal, { color: '#B45309' }]}>
                {(activeBonusPaise / 100).toLocaleString('en-IN')} Points
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Bonus Status in Cycle</Text>
              <Text style={[styles.metricVal, { color: isBonusDeductedInCycle ? '#15803D' : '#D97706' }]}>
                {isBonusDeductedInCycle ? 'Deducted (Full Cash Eligible)' : hasActiveBonus ? 'Active (Deductible on Cashout)' : 'None'}
              </Text>
            </View>

            {requestedPaise > 0 && (
              <View
                style={[
                  styles.ruleStatusBox,
                  isBonusDeductionTriggered ? styles.ruleBoxTriggered : styles.ruleBoxNormal,
                ]}
              >
                <View style={styles.ruleStatusHeader}>
                  <Ionicons
                    name={isBonusDeductionTriggered ? 'alert-circle' : 'checkmark-circle'}
                    size={18}
                    color={isBonusDeductionTriggered ? '#B45309' : '#15803D'}
                  />
                  <Text
                    style={[
                      styles.ruleStatusTitle,
                      isBonusDeductionTriggered
                        ? styles.ruleTitleTriggered
                        : styles.ruleTitleNormal,
                    ]}
                  >
                    {isBonusDeductionTriggered
                      ? 'Equal/Above Balance: Active Bonus Deducted'
                      : isBonusDeductedInCycle
                      ? 'Subsequent Withdrawal: 100% Cash Payout'
                      : 'Partial Cashout: 100% Cash Payout'}
                  </Text>
                </View>

                <Text style={styles.ruleStatusDesc}>
                  {isBonusDeductionTriggered
                    ? `Withdrawal (${(requestedPaise / 100).toLocaleString('en-IN')} Points) is equal to or greater than wallet balance (${(totalBalancePaise / 100).toLocaleString('en-IN')} Points). The ${(
                        bonusExcludedPaise / 100
                      ).toLocaleString('en-IN')} Points bonus from last deposit is deducted.`
                    : isBonusDeductedInCycle
                    ? 'A withdrawal was already processed in this cycle without a new deposit. All demanded points are paid in cash with 0 bonus cut.'
                    : `Withdrawal (${(requestedPaise / 100).toLocaleString('en-IN')} Points) is below current balance (${(totalBalancePaise / 100).toLocaleString('en-IN')} Points). 100% cash is paid, active bonus remains in wallet.`}
                </Text>

                <View style={styles.calcDivider} />

                <View style={styles.calcRow}>
                  <Text style={styles.calcLabel}>Requested Debit Points:</Text>
                  <Text style={styles.calcVal}>
                    {(requestedPaise / 100).toLocaleString('en-IN')} Points
                  </Text>
                </View>
                {isBonusDeductionTriggered && (
                  <View style={styles.calcRow}>
                    <Text style={[styles.calcLabel, { color: '#B45309' }]}>
                      Active Cycle Bonus Deducted:
                    </Text>
                    <Text style={[styles.calcVal, { color: '#B45309', fontWeight: '700' }]}>
                      -{(bonusExcludedPaise / 100).toLocaleString('en-IN')} Points
                    </Text>
                  </View>
                )}
                <View style={[styles.calcRow, styles.calcRowTotal]}>
                  <Text style={styles.calcTotalLabel}>Net Cash Payout to Client:</Text>
                  <Text style={styles.calcTotalVal}>
                    ₹{(netPayoutPaise / 100).toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Step 3: Payout Amount & Channel */}
        <View style={styles.card}>
          <View style={styles.amountHeaderRow}>
            <Text style={styles.stepTitle}>3. Enter Payout Details</Text>
            {selectedClient && totalBalancePaise > 0 && (
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {hasActiveBonus && fullCashoutNetCashPaise > 0 && (
                  <TouchableOpacity
                    style={[styles.maxChip, { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' }]}
                    onPress={() => setAmountText((totalBalancePaise / 100).toString())}
                  >
                    <Text style={[styles.maxChipText, { color: '#1D4ED8', fontWeight: '700' }]}>
                      Full Cashout: ₹{(fullCashoutNetCashPaise / 100).toLocaleString('en-IN')} Cash
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.maxChip}
                  onPress={() => setAmountText((totalBalancePaise / 100).toString())}
                >
                  <Text style={styles.maxChipText}>
                    All Points: {(totalBalancePaise / 100).toLocaleString('en-IN')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <CustomInput
            label="Points to Withdraw"
            placeholder="e.g. 20000"
            keyboardType="decimal-pad"
            leftIcon="wallet-outline"
            value={amountText}
            onChangeText={setAmountText}
          />

          {/* Payout Method Tabs */}
          <Text style={styles.subLabel}>Payout Method</Text>
          <View style={styles.methodRow}>
            {(
              [
                { key: 'upi', label: 'UPI', icon: 'flash-outline' },
                { key: 'bank', label: 'Bank', icon: 'business-outline' },
                { key: 'direct', label: 'Cash/Direct', icon: 'cash-outline' },
              ] as const
            ).map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[styles.methodChip, payoutMethod === m.key && styles.methodChipActive]}
                onPress={() => setPayoutMethod(m.key)}
              >
                <Ionicons
                  name={m.icon}
                  size={15}
                  color={payoutMethod === m.key ? colors.white : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.methodChipText,
                    payoutMethod === m.key && styles.methodChipTextActive,
                  ]}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {payoutMethod === 'upi' && (
            <CustomInput
              label="Client UPI ID (Optional)"
              placeholder="e.g. client@okaxis (Optional)"
              leftIcon="qr-code-outline"
              autoCapitalize="none"
              value={upiId}
              onChangeText={setUpiId}
            />
          )}

          {payoutMethod === 'bank' && (
            <>
              <CustomInput
                label="Bank Name"
                placeholder="e.g. HDFC Bank"
                leftIcon="business-outline"
                value={bankName}
                onChangeText={setBankName}
              />
              <CustomInput
                label="Account Number"
                placeholder="Enter account number"
                keyboardType="number-pad"
                leftIcon="card-outline"
                value={accountNumber}
                onChangeText={setAccountNumber}
              />
              <CustomInput
                label="IFSC Code"
                placeholder="e.g. HDFC0000060"
                autoCapitalize="characters"
                leftIcon="key-outline"
                value={ifsc}
                onChangeText={setIfsc}
              />
              <CustomInput
                label="Account Holder Name"
                placeholder="Account holder name"
                leftIcon="person-outline"
                value={accountHolderName}
                onChangeText={setAccountHolderName}
              />
            </>
          )}

          <CustomInput
            label="Payout Remarks (Optional)"
            placeholder="Optional settlement reference / note"
            leftIcon="document-text-outline"
            value={notes}
            onChangeText={setNotes}
          />

          {/* Payout Screenshot / Receipt Upload */}
          <Text style={styles.subLabel}>Payout Screenshot / Receipt (Proof)</Text>
          {screenshotUri ? (
            <View style={styles.screenshotPreviewContainer}>
              <Image source={{ uri: screenshotUri }} style={styles.screenshotPreviewImage} />

              {/* OCR Amount Verification Box */}
              <View style={styles.ocrMatchStatusBox}>
                {isScanningScreenshot ? (
                  <View style={styles.ocrScanningRow}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.ocrScanningText}>
                      Scanning receipt & matching payout amount...
                    </Text>
                  </View>
                ) : isAmountMatched ? (
                  <View style={styles.ocrMatchSuccessRow}>
                    <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.ocrMatchSuccessTitle}>
                        Amount Matched & Verified! ✅
                      </Text>
                      <Text style={styles.ocrMatchSuccessSub}>
                        Receipt amount {formatPaiseToINR(scannedPayoutPaise!)} matches final withdrawal payout of {formatPaiseToINR(finalCashPayoutPaise)}.
                      </Text>
                      {scannedDetails?.utrNumber && (
                        <Text style={styles.ocrMatchUtrText}>
                          Ref / UTR: {scannedDetails.utrNumber}
                        </Text>
                      )}
                    </View>
                  </View>
                ) : scannedPayoutPaise !== null ? (
                  <View style={styles.ocrMatchMismatchRow}>
                    <Ionicons name="close-circle" size={22} color="#DC2626" />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.ocrMatchMismatchTitle}>
                        Amount Mismatch ❌
                      </Text>
                      <Text style={styles.ocrMatchMismatchSub}>
                        Final cash payout requires {formatPaiseToINR(finalCashPayoutPaise)}, but screenshot shows {formatPaiseToINR(scannedPayoutPaise)}. Amounts must match before proceeding.
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.ocrMatchWarningRow}>
                    <Ionicons name="alert-circle" size={22} color="#D97706" />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.ocrMatchWarningTitle}>
                        Amount Not Detected
                      </Text>
                      <Text style={styles.ocrMatchWarningSub}>
                        {ocrScanError || 'Could not detect payment amount on this receipt.'} Please ensure the uploaded screenshot clearly shows {formatPaiseToINR(finalCashPayoutPaise)}.
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={styles.removeScreenshotBtn}
                onPress={() => {
                  setScreenshotUri(null);
                  setScreenshotBase64(null);
                  setScannedPayoutPaise(null);
                  setScannedDetails(null);
                  setOcrScanError(null);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={16} color={colors.white} />
                <Text style={styles.removeScreenshotBtnText}>Remove Screenshot</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.screenshotActionsRow}>
              <TouchableOpacity
                style={styles.screenshotActionBtn}
                onPress={handlePickScreenshot}
                activeOpacity={0.75}
              >
                <Ionicons name="images-outline" size={18} color={colors.primary} />
                <Text style={styles.screenshotActionText}>Gallery Receipt</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.screenshotActionBtn}
                onPress={handleCaptureScreenshot}
                activeOpacity={0.75}
              >
                <Ionicons name="camera-outline" size={18} color={colors.primary} />
                <Text style={styles.screenshotActionText}>Capture Photo</Text>
              </TouchableOpacity>
            </View>
          )}

          <PrimaryButton
            title={
              isSubmitting
                ? 'Processing Payout...'
                : finalCashPayoutPaise > 0
                ? `Pay Out ₹${(finalCashPayoutPaise / 100).toLocaleString('en-IN')} Cash`
                : 'Process Instant Payout'
            }
            onPress={handleProcessWithdrawal}
            loading={isSubmitting}
            disabled={isSubmitting || !selectedClient}
            fullWidth
            size="lg"
            icon="arrow-up-circle-outline"
            style={{ marginTop: 10 }}
          />
        </View>
      </View>

      {/* Client Picker Modal */}
      <Modal
        visible={pickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setPickerVisible(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Client Account</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchBar}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search client by name or phone..."
                placeholderTextColor={colors.textLight}
                value={clientSearch}
                onChangeText={setClientSearch}
              />
            </View>

            <FlatList
              style={{ flex: 1 }}
              data={filteredClients}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
              ListEmptyComponent={
                <View style={styles.emptyListBox}>
                  <Text style={styles.emptyListText}>No active clients found.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.clientOptionRow,
                    selectedClient?.id === item.id && styles.clientOptionSelected,
                  ]}
                  onPress={() => handleSelectClient(item)}
                >
                  <View style={styles.clientAvatarSmall}>
                    <Text style={styles.clientAvatarSmallText}>
                      {item.name.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionName}>{item.name}</Text>
                    <Text style={styles.optionSub}>+91 {item.phone}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.optionBalance}>
                      {((item.totalBalancePaise || 0) / 100).toLocaleString('en-IN')} Points
                    </Text>
                    <Text style={styles.optionBalLabel}>
                      Bonus: {((item.activeBonusPaise || 0) / 100).toLocaleString('en-IN')} Pts
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
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
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  clientSelectorBtn: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  selectedClientRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  clientAvatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  selectedClientName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  selectedClientMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  selectedClientBal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
    marginTop: 2,
  },
  cycleStatusText: {
    fontSize: 11,
    color: '#B45309',
    fontWeight: '600',
    marginTop: 2,
  },
  changePill: {
    backgroundColor: colors.lightBlue,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  changePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  placeholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  placeholderText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  metricLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  metricVal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  ruleStatusBox: {
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
  },
  ruleBoxTriggered: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  ruleBoxNormal: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  ruleStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  ruleStatusTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  screenshotPreviewContainer: {
    marginVertical: 10,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  screenshotPreviewImage: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  removeScreenshotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingVertical: 8,
    gap: 6,
  },
  removeScreenshotBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  screenshotActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 8,
  },
  screenshotActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  screenshotActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  ruleTitleTriggered: {
    color: '#B45309',
  },
  ruleTitleNormal: {
    color: '#15803D',
  },
  ruleStatusDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
    marginTop: 2,
  },
  calcDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 2,
  },
  calcLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  calcVal: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  calcRowTotal: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  calcTotalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  calcTotalVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#15803D',
  },
  amountHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  maxChip: {
    backgroundColor: colors.lightBlue,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  maxChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 4,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  methodChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 5,
  },
  methodChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  methodChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  methodChipTextActive: {
    color: colors.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '85%',
    maxHeight: '90%',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  modalSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 8,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  clientOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginVertical: 2,
  },
  clientOptionSelected: {
    backgroundColor: colors.lightBlue,
  },
  clientAvatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  clientAvatarSmallText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  optionName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  optionSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  optionBalance: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803D',
  },
  optionBalLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  emptyListBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyListText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  noPermContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  noPermTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginTop: 12,
    marginBottom: 6,
  },
  noPermDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  ocrMatchStatusBox: {
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  ocrScanningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  ocrScanningText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  ocrMatchSuccessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  ocrMatchSuccessTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
  },
  ocrMatchSuccessSub: {
    fontSize: 11,
    color: '#15803D',
    marginTop: 2,
    fontWeight: '600',
  },
  ocrMatchUtrText: {
    fontSize: 10,
    color: '#166534',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  ocrMatchMismatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  ocrMatchMismatchTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#991B1B',
  },
  ocrMatchMismatchSub: {
    fontSize: 11,
    color: '#B91C1C',
    marginTop: 2,
    lineHeight: 16,
  },
  ocrMatchWarningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  ocrMatchWarningTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  ocrMatchWarningSub: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 2,
    lineHeight: 16,
  },
});

export default ClientWithdrawScreen;
