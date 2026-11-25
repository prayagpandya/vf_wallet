import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  FlatList,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
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
import { SecondaryButton } from '../../components/buttons/SecondaryButton';
import { ImageViewerModal } from '../../components/modals/ImageViewerModal';
import { useAuth } from '../../hooks/useAuth';
import { useWallet } from '../../hooks/useWallet';
import { adminApi } from '../../services/api';
import { ocrService } from '../../services/ocrService';
import { formatPaiseToINR, rupeesToPaise } from '../../utils/currency';
import { User, ExtractedPaymentDetails } from '../../types';

type RouteParams = {
  ClientOcrDeposit?: {
    clientId?: string;
    initialMode?: 'ocr' | 'manual';
    imageUri?: string;
    source?: 'gallery' | 'whatsapp_share';
    sharedAt?: number;
  };
};

export const ClientOcrDepositScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<RouteParams, 'ClientOcrDeposit'>>();
  const { isSuperAdmin, permissions } = useAuth();
  const { users, refreshData } = useWallet();

  const canOcr = isSuperAdmin || permissions.canOcrUpload;
  const canManual = isSuperAdmin || permissions.canDeposit;

  const [mode, setMode] = useState<'ocr' | 'manual'>(() => {
    if (route.params?.imageUri) return 'ocr';
    if (route.params?.initialMode === 'manual' && canManual) return 'manual';
    if (canOcr) return 'ocr';
    return 'manual';
  });

  // Client Selection State
  const [clients, setClients] = useState<User[]>(users);
  const [selectedClient, setSelectedClient] = useState<User | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  // Daily Running Bonus State (Day-based bonus set by Superadmin)
  const [dailyBonusRate, setDailyBonusRate] = useState<number>(0);
  const [isDailyBonusActive, setIsDailyBonusActive] = useState<boolean>(false);
  const [todayBonusDate, setTodayBonusDate] = useState<string>('');

  // Inline Quick Client Creation State (Name + Phone)
  const [quickCreateVisible, setQuickCreateVisible] = useState(false);
  const [quickClientName, setQuickClientName] = useState('');
  const [quickClientPhone, setQuickClientPhone] = useState('');
  const [isQuickCreating, setIsQuickCreating] = useState(false);

  // OCR & Receipt State
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [imageHash, setImageHash] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedPaymentDetails | null>(null);
  const [isDuplicateReceipt, setIsDuplicateReceipt] = useState(false);
  const [showRawOcr, setShowRawOcr] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);

  // Verified Editable Deposit Fields
  const [amountText, setAmountText] = useState('');
  const [utrText, setUtrText] = useState('');
  const [paymentAppText, setPaymentAppText] = useState('');
  const [notesText, setNotesText] = useState('');

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync live clients list & today's running bonus
  const loadClients = useCallback(async () => {
    try {
      const [usersRes, dailyRes] = await Promise.all([
        adminApi.getUsers({ role: 'CLIENT' }),
        adminApi.getDailyBonus(),
      ]);

      if (dailyRes.success) {
        setDailyBonusRate(dailyRes.isActive ? dailyRes.percentage : 0);
        setIsDailyBonusActive(Boolean(dailyRes.isActive));
        if (dailyRes.date) setTodayBonusDate(dailyRes.date);
      }

      if (usersRes.success && Array.isArray(usersRes.users)) {
        const mapped: User[] = usersRes.users.map((u: any) => ({
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
          bonusPercentage: u.bonusPercentage ?? undefined,
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

        const targetId = route.params?.clientId || selectedClient?.id;
        if (targetId) {
          const found = mapped.find((c) => c.id === targetId);
          if (found) setSelectedClient(found);
        }
      }
    } catch (e) {
      console.warn('Could not load clients or daily bonus:', e);
    }
  }, [route.params?.clientId, selectedClient?.id]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  // Re-fetch client list & running bonus every time this tab is focused
  useFocusEffect(
    useCallback(() => {
      loadClients();
    }, [loadClients])
  );

  // Sync clients with wallet context if updated
  useEffect(() => {
    if (users && users.length > 0) {
      const clientUsers = users.filter((u) => u.accountType === 'CLIENT');
      if (clientUsers.length > 0) {
        setClients((prev) => {
          const prevMap = new Map(prev.map((c) => [c.id, c]));
          let hasChanges = false;
          clientUsers.forEach((cu) => {
            if (!prevMap.has(cu.id)) {
              prevMap.set(cu.id, cu);
              hasChanges = true;
            }
          });
          return hasChanges ? Array.from(prevMap.values()) : prev;
        });
      }
    }
  }, [users]);

  const activeClients = clients.filter((c) => c.status === 'active');
  const filteredClients = activeClients.filter((c) => {
    if (!clientSearch.trim()) return true;
    const q = clientSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.upiId && c.upiId.toLowerCase().includes(q))
    );
  });

  // Run High-Reliability OCR on selected image (with pre-captured base64)
  const runOcrOnImage = async (
    uri: string,
    base64?: string | null,
    mimeType?: string | null
  ) => {
    setImageUri(uri);
    setImageBase64(base64 || null);
    setImageMimeType(mimeType || null);
    setIsScanning(true);
    setExtracted(null);
    setIsDuplicateReceipt(false);

    try {
      const { hash, extracted: ocrData, isDuplicateHash, scanError } =
        await ocrService.processScreenshot(uri, base64, mimeType);
      setImageHash(hash);
      setExtracted(ocrData);
      setIsDuplicateReceipt(Boolean(isDuplicateHash));

      if (ocrData.amountPaise !== null && ocrData.amountPaise > 0) {
        const rupeesVal = ocrData.amountPaise / 100;
        setAmountText(
          Number.isInteger(rupeesVal) ? String(rupeesVal) : rupeesVal.toFixed(2)
        );
      } else {
        setAmountText('');
      }

      const bestRef =
        ocrData.utrNumber ||
        ocrData.upiRefNumber ||
        (ocrData.transactionId && !ocrData.transactionId.startsWith('TXN-')
          ? ocrData.transactionId
          : '') ||
        '';
      setUtrText(bestRef);
      setPaymentAppText(ocrData.paymentAppName || 'UPI');

      const autoNotesParts = [
        ocrData.senderName ? `From: ${ocrData.senderName}` : null,
        ocrData.receiverName ? `To: ${ocrData.receiverName}` : null,
        ocrData.transactionDate
          ? `${ocrData.transactionDate}${
              ocrData.transactionTime ? `, ${ocrData.transactionTime}` : ''
            }`
          : null,
      ].filter(Boolean);
      if (autoNotesParts.length > 0) {
        setNotesText(autoNotesParts.join(' | '));
      }

      if (isDuplicateHash) {
        Alert.alert(
          'Duplicate Screenshot Detected 🛡️',
          'This exact payment screenshot has already been uploaded and credited earlier.'
        );
      } else if (scanError) {
        Alert.alert('OCR Scan Notice', scanError);
      }
    } catch (err: any) {
      console.warn('OCR scan error:', err);
      Alert.alert(
        'Scan Notice',
        err?.message ||
          'Could not extract all fields automatically. Please review and fill in the verified details from the receipt.'
      );
    } finally {
      setIsScanning(false);
    }
  };

  // Auto-scan screenshot when received from Gallery or WhatsApp share intent
  useEffect(() => {
    if (route.params?.imageUri) {
      setMode('ocr');
      runOcrOnImage(route.params.imageUri);
    }
  }, [route.params?.imageUri, route.params?.sharedAt]);

  const handlePickFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Allow photo library access to scan receipts.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.65,
        base64: true, // Reliable across Android content:// & iOS without FileSystem issues
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        await runOcrOnImage(asset.uri, asset.base64, asset.mimeType);
      }
    } catch {
      Alert.alert('Error', 'Unable to open gallery.');
    }
  };

  const handleCaptureCamera = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Allow camera access to capture payment receipts.');
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
        await runOcrOnImage(asset.uri, asset.base64, asset.mimeType);
      }
    } catch {
      Alert.alert('Error', 'Unable to open camera.');
    }
  };

  const resetForm = () => {
    setImageUri(null);
    setImageBase64(null);
    setImageMimeType(null);
    setImageHash(null);
    setExtracted(null);
    setIsDuplicateReceipt(false);
    setAmountText('');
    setUtrText('');
    setPaymentAppText('');
    setNotesText('');
  };

  // Calculations for real-time auto-credit preview
  // Day-based running bonus set by Superadmin applies automatically to deposits (0% if none set)
  const numericAmount = parseFloat(amountText.replace(/,/g, '')) || 0;
  const amountPaise = numericAmount > 0 ? rupeesToPaise(numericAmount) : 0;
  const hasClientCustomBonus = Boolean(
    selectedClient?.bonusPercentage && selectedClient.bonusPercentage > 0
  );
  const effectiveBonusPct = hasClientCustomBonus
    ? selectedClient!.bonusPercentage!
    : isDailyBonusActive && dailyBonusRate > 0
    ? dailyBonusRate
    : 10.0;
  const bonusPaise = Math.round((amountPaise * effectiveBonusPct) / 100);
  const totalCreditPaise = amountPaise + bonusPaise;

  const handleQuickCreateClient = async () => {
    if (!quickClientName.trim()) {
      Alert.alert('Name Required', 'Please enter client full name.');
      return;
    }
    if (!quickClientPhone.trim() || quickClientPhone.trim().length < 10) {
      Alert.alert('Phone Required', 'Please enter a valid 10-digit phone number.');
      return;
    }

    setIsQuickCreating(true);
    try {
      const res = await adminApi.createUser({
        name: quickClientName.trim(),
        phone: quickClientPhone.trim(),
        userType: 'CLIENT',
        // Client specific bonus will NOT auto assign; daily running bonus applies dynamically
      });

      if (res.success && res.user) {
        const newClient: User = {
          id: res.user.id,
          name: res.user.name,
          phone: res.user.phone,
          email: '',
          role: 'user',
          accountType: 'CLIENT',
          status: 'active',
          createdAt: res.user.createdAt,
          bonusPercentage: undefined,
          totalBalancePaise: 0,
          activeBonusPaise: 0,
          lastDepositAmountPaise: 0,
          cycleWithdrawnPaise: 0,
          isBonusDeductedInCycle: false,
          totalDepositPrincipalPaise: 0,
          withdrawablePaise: 0,
          createdById: res.user.createdById,
          createdByName: res.user.createdByName,
          createdByRole: res.user.createdByRole,
        };

        setClients((prev) => [newClient, ...prev]);
        setSelectedClient(newClient);
        setQuickCreateVisible(false);
        setPickerVisible(false);
        setClientSearch('');
        setQuickClientName('');
        setQuickClientPhone('');
        Alert.alert(
          'Client Created & Selected! ✅',
          `Created "${newClient.name}" (+91 ${newClient.phone}). Today's running bonus (${effectiveBonusPct}%) is now automatically applied.`
        );
      } else {
        Alert.alert('Client Creation Failed', res.error || 'Could not create client.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create client.');
    } finally {
      setIsQuickCreating(false);
    }
  };

  const handleSubmitAutoAcceptDeposit = async () => {
    if (!selectedClient) {
      Alert.alert('Select Client', 'Please select or add a client account first.');
      return;
    }

    if (mode === 'ocr') {
      if (!imageUri) {
        Alert.alert('Upload Receipt', 'Please upload or capture a payment screenshot for OCR deposit.');
        return;
      }

      if (!amountText || amountPaise <= 0) {
        Alert.alert(
          'Amount Not Detected ⚠️',
          'OCR could not extract the deposit amount from this screenshot.\n\nScanned values cannot be typed manually in OCR mode. To enter deposit details manually, please switch to Direct Deposit.',
          canManual
            ? [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Switch to Direct Deposit', onPress: () => setMode('manual') },
              ]
            : [{ text: 'OK' }]
        );
        return;
      }

      if (!utrText.trim()) {
        Alert.alert(
          'UTR Not Detected ⚠️',
          'OCR could not extract a valid UTR / Reference number from this receipt.\n\nScanned values cannot be modified in OCR mode. To enter reference details manually, please switch to Direct Deposit.',
          canManual
            ? [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Switch to Direct Deposit', onPress: () => setMode('manual') },
              ]
            : [{ text: 'OK' }]
        );
        return;
      }

      // Anti-tamper validation
      if (extracted?.amountPaise && extracted.amountPaise > 0 && extracted.amountPaise !== amountPaise) {
        Alert.alert(
          'Anti-Tamper Warning 🛡️',
          'The deposit amount does not match the OCR scanned amount. To modify the amount, please switch to Direct Deposit.'
        );
        return;
      }
    } else {
      if (amountPaise <= 0) {
        Alert.alert('Invalid Amount', 'Please enter a valid deposit amount.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await adminApi.createClientDeposit(selectedClient.id, {
        amountPaise,
        utr: utrText.trim() || undefined,
        imageHash: mode === 'ocr' ? imageHash || undefined : undefined,
        imageUrl: mode === 'ocr' ? imageUri || undefined : undefined,
        paymentApp: paymentAppText.trim() || (mode === 'ocr' ? 'UPI OCR' : 'Direct Deposit'),
        rawOcrData: extracted || undefined,
        submissionSource: mode === 'ocr' ? 'ocr' : 'manual',
        notes: notesText.trim() || undefined,
      });

      if (res.success) {
        await Promise.all([refreshData(), loadClients()]);
        const targetClientId = selectedClient.id;
        const actualBonusPaise = res.transaction?.bonusPaise ?? bonusPaise;
        const actualPrincipalPaise = res.transaction?.amountPaise ?? amountPaise;
        const actualTotalCredited = res.transaction?.totalCreditPaise ?? (actualPrincipalPaise + actualBonusPaise);
        const actualBonusRate = res.transaction?.bonusPercentage ?? effectiveBonusPct;

        const newBalanceRupees = (
          (res.clientNewBalancePaise ?? (selectedClient.totalBalancePaise || 0) + actualTotalCredited) / 100
        ).toLocaleString('en-IN');

        Alert.alert(
          'Deposit Credited Instantly! ✅',
          `${formatPaiseToINR(actualTotalCredited)} Points (${formatPaiseToINR(
            actualPrincipalPaise
          )} Cash + ${actualBonusRate}% Bonus: ${formatPaiseToINR(
            actualBonusPaise
          )} Points) auto-credited to ${selectedClient.name}.\n\nTotal Points Balance: ${newBalanceRupees} Points`,
          [
            { text: 'Done', onPress: resetForm },
            {
              text: 'View in Withdraw Screen 💸',
              onPress: () => {
                resetForm();
                navigation.navigate('ClientWithdraw', { clientId: targetClientId });
              },
            },
          ]
        );
      } else if (res.status === 409) {
        Alert.alert(
          'Duplicate Receipt Blocked 🛡️',
          res.error || 'This UTR or payment screenshot has already been processed.'
        );
      } else {
        Alert.alert('Deposit Failed', res.error || 'Could not process deposit.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Unexpected error processing deposit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canOcr && !canManual) {
    return (
      <ScreenContainer backgroundColor={colors.background}>
        <Header title="Client Deposit" showBack onBackPress={() => navigation.goBack()} />
        <View style={styles.noPermContainer}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.textLight} />
          <Text style={styles.noPermTitle}>Permission Restricted</Text>
          <Text style={styles.noPermDesc}>
            You do not have OCR Upload or Direct Deposit permission. Please contact Super Admin.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable backgroundColor={colors.background}>
      <Header
        title="Client Deposit"
        subtitle="Auto-accept instant credit with high-accuracy OCR"
      />

      <View style={styles.content}>
        {/* Auto-Accept & Running Bonus Banner */}
        <View
          style={[
            styles.autoAcceptBanner,
            !isDailyBonusActive && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
          ]}
        >
          <Ionicons
            name={isDailyBonusActive ? 'gift' : 'information-circle-outline'}
            size={18}
            color={isDailyBonusActive ? '#15803D' : '#64748B'}
          />
          <Text
            style={[
              styles.autoAcceptText,
              !isDailyBonusActive && { color: '#475569' },
            ]}
          >
            {isDailyBonusActive && dailyBonusRate > 0
              ? `Today's Running Bonus: ${dailyBonusRate}% Active (Auto-applied to deposits)`
              : `Today's Running Bonus: 10% Active (Auto-applied to deposits)`}
          </Text>
        </View>

        {/* Step 1: Select Client */}
        <View style={styles.card}>
          <Text style={styles.stepTitle}>1. Select Target Client</Text>
          <TouchableOpacity
            style={styles.clientSelectorBtn}
            onPress={() => {
              loadClients();
              setPickerVisible(true);
            }}
            activeOpacity={0.75}
          >
            {selectedClient ? (
              <View style={styles.selectedClientRow}>
                <View style={styles.clientAvatar}>
                  <Text style={styles.clientAvatarText}>
                    {selectedClient.name.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.clientInfoCol}>
                  <Text style={styles.selectedClientName}>{selectedClient.name}</Text>
                  <Text style={styles.selectedClientMeta}>
                    +91 {selectedClient.phone} • Today's Bonus: {effectiveBonusPct}%
                  </Text>
                  <Text style={styles.selectedClientBal}>
                    Balance: {formatPaiseToINR(selectedClient.totalBalancePaise || 0)}
                  </Text>
                </View>
                <View style={styles.changePill}>
                  <Text style={styles.changePillText}>Change</Text>
                </View>
              </View>
            ) : (
              <View style={styles.placeholderRow}>
                <Ionicons name="person-add-outline" size={20} color={colors.primary} />
                <Text style={styles.placeholderText}>Tap to choose or add client...</Text>
                <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Mode Toggle (when user has both OCR and Manual permissions) */}
        {canOcr && canManual && (
          <View style={styles.modeToggleRow}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'ocr' && styles.modeBtnActive]}
              onPress={() => setMode('ocr')}
            >
              <Ionicons
                name="scan-outline"
                size={16}
                color={mode === 'ocr' ? colors.white : colors.textSecondary}
              />
              <Text style={[styles.modeBtnText, mode === 'ocr' && styles.modeBtnTextActive]}>
                OCR Screenshot
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeBtn, mode === 'manual' && styles.modeBtnActive]}
              onPress={() => setMode('manual')}
            >
              <Ionicons
                name="create-outline"
                size={16}
                color={mode === 'manual' ? colors.white : colors.textSecondary}
              />
              <Text style={[styles.modeBtnText, mode === 'manual' && styles.modeBtnTextActive]}>
                Direct Deposit
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 2: OCR Receipt Upload */}
        {mode === 'ocr' && canOcr && (
          <View style={styles.card}>
            <Text style={styles.stepTitle}>2. Upload & Scan Payment Screenshot</Text>

            {imageUri ? (
              <View style={styles.previewSection}>
                <TouchableOpacity
                  onPress={() => setViewerVisible(true)}
                  activeOpacity={0.85}
                  style={styles.previewWrapper}
                >
                  <Image source={{ uri: imageUri }} style={styles.receiptPreview} resizeMode="cover" />
                  <View style={styles.zoomOverlay}>
                    <Ionicons name="expand-outline" size={14} color={colors.white} />
                    <Text style={styles.zoomOverlayText}>Tap to Inspect</Text>
                  </View>
                </TouchableOpacity>

                {route.params?.source === 'gallery' && (
                  <View style={styles.sourceTag}>
                    <Ionicons name="images-outline" size={14} color="#2563EB" />
                    <Text style={styles.sourceTagText}>Shared from Gallery (Auto-Scanned)</Text>
                  </View>
                )}
                {route.params?.source === 'whatsapp_share' && (
                  <View style={[styles.sourceTag, { backgroundColor: '#E6F8EF' }]}>
                    <Ionicons name="logo-whatsapp" size={14} color="#16A36A" />
                    <Text style={[styles.sourceTagText, { color: '#0E7047' }]}>Shared from WhatsApp</Text>
                  </View>
                )}

                {isScanning ? (
                  <View style={styles.scanningBox}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.scanningText}>
                      Running dual-engine OCR scan for amount & UTR...
                    </Text>
                  </View>
                ) : extracted ? (
                  <View style={styles.ocrSummaryBox}>
                    <View style={styles.ocrConfidenceRow}>
                      <Ionicons
                        name={extracted.isComplete ? 'checkmark-circle' : 'alert-circle'}
                        size={16}
                        color={extracted.isComplete ? colors.success : colors.warningDark}
                      />
                      <Text style={styles.ocrConfidenceText}>
                        OCR Confidence: {extracted.ocrConfidence}%{' '}
                        {extracted.isComplete
                          ? '— Amount & UTR Detected!'
                          : '— Please verify fields below'}
                      </Text>
                    </View>
                    {(extracted.transactionDate || extracted.receiverName) && (
                      <Text style={styles.ocrMetaLine}>
                        {[
                          extracted.paymentAppName,
                          extracted.transactionDate,
                          extracted.transactionTime,
                          extracted.receiverName ? `To: ${extracted.receiverName}` : null,
                        ]
                          .filter(Boolean)
                          .join(' • ')}
                      </Text>
                    )}
                    {!!extracted.rawText && (
                      <TouchableOpacity
                        onPress={() => setShowRawOcr((prev) => !prev)}
                        style={{ marginTop: 6, alignSelf: 'flex-start' }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>
                          {showRawOcr ? 'Hide Scanned Text ▲' : 'View Scanned Text ▼'}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {showRawOcr && !!extracted.rawText && (
                      <Text
                        selectable
                        style={{
                          fontSize: 11,
                          color: colors.textSecondary,
                          backgroundColor: colors.white,
                          padding: 8,
                          borderRadius: 8,
                          marginTop: 6,
                          borderWidth: 1,
                          borderColor: colors.cardBorder,
                        }}
                      >
                        {extracted.rawText}
                      </Text>
                    )}
                  </View>
                ) : null}

                {isDuplicateReceipt && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.dangerLight,
                      padding: 10,
                      borderRadius: 10,
                      gap: 8,
                    }}
                  >
                    <Ionicons name="shield-outline" size={16} color={colors.danger} />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: colors.dangerDark,
                        flex: 1,
                      }}
                    >
                      Duplicate Screenshot: This receipt has already been processed earlier.
                    </Text>
                  </View>
                )}

                <View style={styles.rescanRow}>
                  <SecondaryButton
                    title="Pick Another"
                    onPress={handlePickFromGallery}
                    style={{ flex: 1 }}
                  />
                  <SecondaryButton
                    title="Re-Scan"
                    onPress={() => runOcrOnImage(imageUri, imageBase64, imageMimeType)}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.uploadButtonsRow}>
                <TouchableOpacity
                  style={styles.uploadBox}
                  onPress={handlePickFromGallery}
                  activeOpacity={0.75}
                >
                  <View style={styles.uploadIconCircle}>
                    <Ionicons name="images-outline" size={24} color={colors.primary} />
                  </View>
                  <Text style={styles.uploadBoxTitle}>Gallery Screenshot</Text>
                  <Text style={styles.uploadBoxSub}>PhonePe, GPay, Paytm, Bank</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.uploadBox}
                  onPress={handleCaptureCamera}
                  activeOpacity={0.75}
                >
                  <View style={[styles.uploadIconCircle, { backgroundColor: '#EDE9FE' }]}>
                    <Ionicons name="camera-outline" size={24} color="#7C3AED" />
                  </View>
                  <Text style={styles.uploadBoxTitle}>Capture Photo</Text>
                  <Text style={styles.uploadBoxSub}>Snap receipt directly</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Step 3: Verify / Enter Details */}
        <View style={styles.card}>
          <Text style={styles.stepTitle}>
            {mode === 'ocr' ? '3. Verify Extracted Details' : '2. Enter Deposit Details'}
          </Text>

          {/* Anti-Tamper Notice in OCR mode */}
          {mode === 'ocr' && (
            <View style={styles.ocrLockedNotice}>
              <View style={styles.ocrLockedHeader}>
                <Ionicons name="lock-closed" size={16} color="#D97706" />
                <Text style={styles.ocrLockedTitle}>Anti-Tamper Rule: Scanned Values Locked</Text>
              </View>
              <Text style={styles.ocrLockedDesc}>
                Values extracted from receipt cannot be modified in OCR mode. To enter or adjust deposit details manually, please switch to Direct Deposit.
              </Text>
              {canManual && (
                <TouchableOpacity
                  style={styles.switchModeActionBtn}
                  onPress={() => setMode('manual')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="create-outline" size={15} color={colors.primary} />
                  <Text style={styles.switchModeActionText}>Switch to Direct Deposit to Modify ✏️</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <CustomInput
            label="Deposit Amount (₹)"
            placeholder="e.g. 5000"
            keyboardType="decimal-pad"
            leftIcon="cash-outline"
            rightIcon={mode === 'ocr' ? 'lock-closed' : undefined}
            value={amountText}
            onChangeText={setAmountText}
            editable={mode !== 'ocr'}
            helperText={
              mode === 'ocr'
                ? '🔒 Extracted from OCR scan (Locked). Switch to Direct Deposit to modify.'
                : undefined
            }
          />

          <CustomInput
            label="UTR / 12-Digit Reference Number"
            placeholder="e.g. 432156789012"
            leftIcon="barcode-outline"
            rightIcon={mode === 'ocr' ? 'lock-closed' : undefined}
            value={utrText}
            onChangeText={setUtrText}
            editable={mode !== 'ocr'}
            helperText={
              mode === 'ocr'
                ? '🔒 Extracted from OCR scan (Locked). Switch to Direct Deposit to modify.'
                : 'Protected by duplicate UTR anti-fraud guard'
            }
          />

          <CustomInput
            label="Payment App / Channel"
            placeholder="e.g. Google Pay, PhonePe, Paytm, Bank IMPS"
            leftIcon="phone-portrait-outline"
            rightIcon={mode === 'ocr' ? 'lock-closed' : undefined}
            value={paymentAppText}
            onChangeText={setPaymentAppText}
            editable={mode !== 'ocr'}
            helperText={
              mode === 'ocr'
                ? '🔒 Detected from OCR receipt (Locked)'
                : undefined
            }
          />

          <CustomInput
            label="Remarks / Notes (Optional)"
            placeholder="Optional note for ledger"
            leftIcon="document-text-outline"
            value={notesText}
            onChangeText={setNotesText}
          />

          {/* Live Credit Breakdown */}
          {selectedClient && amountPaise > 0 && (
            <View style={styles.creditSummaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Principal Deposit</Text>
                <Text style={styles.summaryValue}>{formatPaiseToINR(amountPaise)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  Today's Running Bonus ({effectiveBonusPct}%)
                </Text>
                <Text style={[styles.summaryValue, { color: '#15803D' }]}>
                  +{formatPaiseToINR(bonusPaise)}
                </Text>
              </View>
              <View style={[styles.summaryRow, styles.summaryTotalRow]}>
                <Text style={styles.summaryTotalLabel}>Total Instant Credit</Text>
                <Text style={styles.summaryTotalValue}>
                  {formatPaiseToINR(totalCreditPaise)}
                </Text>
              </View>
            </View>
          )}

          <PrimaryButton
            title={
              isSubmitting
                ? 'Crediting Client Wallet...'
                : 'Verify & Auto-Accept Deposit'
            }
            onPress={handleSubmitAutoAcceptDeposit}
            loading={isSubmitting}
            disabled={isScanning || isSubmitting}
            fullWidth
            size="lg"
            icon="checkmark-done-circle-outline"
            style={{ marginTop: 12 }}
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

            {/* Quick Add Client Button (If not in list, write name and create immediately) */}
            {clientSearch.trim().length > 0 && (
              <TouchableOpacity
                style={styles.quickAddClientBtn}
                onPress={() => {
                  setQuickClientName(clientSearch.trim());
                  setQuickClientPhone('');
                  setQuickCreateVisible(true);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.quickAddIcon}>
                  <Ionicons name="person-add" size={16} color={colors.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.quickAddTitle}>
                    + Add New Client: "{clientSearch.trim()}"
                  </Text>
                  <Text style={styles.quickAddSub}>
                    Fast setup with only Name & Phone • Today's Bonus: {effectiveBonusPct}%
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </TouchableOpacity>
            )}

            <FlatList
              style={{ flex: 1 }}
              data={filteredClients}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
              ListEmptyComponent={
                <View style={styles.emptyListBox}>
                  <Text style={styles.emptyListText}>
                    No client found matching "{clientSearch}".
                  </Text>
                  <TouchableOpacity
                    style={[styles.quickAddClientBtn, { marginTop: 12, marginHorizontal: 0 }]}
                    onPress={() => {
                      setQuickClientName(clientSearch.trim());
                      setQuickClientPhone('');
                      setQuickCreateVisible(true);
                    }}
                  >
                    <View style={styles.quickAddIcon}>
                      <Ionicons name="person-add" size={16} color={colors.white} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.quickAddTitle}>
                        Create Client: "{clientSearch.trim() || 'New Client'}"
                      </Text>
                      <Text style={styles.quickAddSub}>
                        Only name & phone required
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.clientOptionRow,
                    selectedClient?.id === item.id && styles.clientOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedClient(item);
                    setPickerVisible(false);
                    setClientSearch('');
                  }}
                >
                  <View style={styles.clientAvatarSmall}>
                    <Text style={styles.clientAvatarSmallText}>
                      {item.name.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionName}>{item.name}</Text>
                    <Text style={styles.optionSub}>
                      +91 {item.phone} • Today's Bonus: {effectiveBonusPct}%
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.optionBalance}>
                      {formatPaiseToINR(item.totalBalancePaise || 0)}
                    </Text>
                    <Text style={styles.optionBalLabel}>Balance</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Quick Create Client Modal (Name + Phone Only) */}
      <Modal
        visible={quickCreateVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setQuickCreateVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlayCenter}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setQuickCreateVisible(false)}
          />
          <View style={styles.quickCreateCard}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.modalTitle}>Add Client Account</Text>
                  <Text style={styles.quickCreateSubText}>
                    Only Name & Phone required • Running Bonus: {effectiveBonusPct}%
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setQuickCreateVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={{ marginTop: 14 }}>
                <Text style={styles.quickFieldLabel}>Client Full Name *</Text>
                <TextInput
                  style={styles.quickInput}
                  placeholder="e.g. Ramesh Patel"
                  placeholderTextColor={colors.textLight}
                  value={quickClientName}
                  onChangeText={setQuickClientName}
                />

                <Text style={[styles.quickFieldLabel, { marginTop: 12 }]}>
                  Phone Number (10 Digits) *
                </Text>
                <TextInput
                  style={styles.quickInput}
                  placeholder="e.g. 9876543210"
                  placeholderTextColor={colors.textLight}
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={quickClientPhone}
                  onChangeText={setQuickClientPhone}
                />

                <View style={styles.dailyBonusNoticePill}>
                  <Ionicons name="gift" size={16} color="#15803D" />
                  <Text style={styles.dailyBonusNoticeText}>
                    Today's running bonus ({effectiveBonusPct}%) will automatically apply to this client's deposits.
                  </Text>
                </View>

                <View style={styles.quickModalActions}>
                  <SecondaryButton
                    title="Cancel"
                    onPress={() => setQuickCreateVisible(false)}
                    style={{ flex: 1 }}
                    disabled={isQuickCreating}
                  />
                  <PrimaryButton
                    title={isQuickCreating ? 'Creating...' : 'Create & Select'}
                    onPress={handleQuickCreateClient}
                    loading={isQuickCreating}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Receipt Image Fullscreen Viewer */}
      {imageUri && (
        <ImageViewerModal
          visible={viewerVisible}
          imageUri={imageUri}
          onClose={() => setViewerVisible(false)}
        />
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  autoAcceptBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  autoAcceptText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
    flex: 1,
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
  clientInfoCol: {
    flex: 1,
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
    color: colors.primary,
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
  modeToggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    padding: 4,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 6,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  modeBtnActive: {
    backgroundColor: colors.primary,
  },
  modeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  modeBtnTextActive: {
    color: colors.white,
  },
  uploadButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  uploadBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary + '55',
    backgroundColor: colors.surfaceAlt,
  },
  uploadIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  uploadBoxTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  uploadBoxSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  previewSection: {
    gap: 10,
  },
  previewWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    height: 200,
    backgroundColor: '#0F172A',
    position: 'relative',
  },
  receiptPreview: {
    width: '100%',
    height: '100%',
  },
  zoomOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  zoomOverlayText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  scanningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightBlue,
    padding: 12,
    borderRadius: 10,
    gap: 10,
  },
  scanningText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryDark,
    flex: 1,
  },
  ocrSummaryBox: {
    backgroundColor: colors.surfaceAlt,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  ocrConfidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ocrConfidenceText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  ocrMetaLine: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
  rescanRow: {
    flexDirection: 'row',
    gap: 10,
  },
  creditSummaryCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: 14,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  summaryTotalRow: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#BBF7D0',
    marginBottom: 0,
  },
  summaryTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#166534',
  },
  summaryTotalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#15803D',
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
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    borderRadius: 10,
  },
  clientOptionSelected: {
    backgroundColor: colors.lightBlue,
  },
  clientAvatarSmall: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  clientAvatarSmallText: {
    fontSize: 13,
    fontWeight: '800',
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
    marginTop: 2,
  },
  optionBalance: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  optionBalLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  emptyListBox: {
    padding: 28,
    alignItems: 'center',
  },
  emptyListText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  noPermContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  noPermTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    marginTop: 12,
  },
  noPermDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  quickAddClientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    gap: 10,
  },
  quickAddIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAddTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  quickAddSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  quickCreateCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  quickCreateSubText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  quickFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  quickInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  dailyBonusNoticePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    padding: 10,
    borderRadius: 10,
    marginTop: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  dailyBonusNoticeText: {
    fontSize: 11,
    color: '#15803D',
    fontWeight: '600',
    flex: 1,
  },
  quickModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  ocrLockedNotice: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1.2,
    borderColor: '#FCD34D',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  ocrLockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  ocrLockedTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  ocrLockedDesc: {
    fontSize: 12,
    color: '#B45309',
    lineHeight: 17,
  },
  switchModeActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  switchModeActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  sourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 8,
    gap: 6,
    alignSelf: 'flex-start',
  },
  sourceTagText: {
    fontSize: 12,
    color: '#1D4ED8',
    fontWeight: '700',
  },
});

export default ClientOcrDepositScreen;
