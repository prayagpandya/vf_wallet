import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { SecondaryButton } from '../../components/buttons/SecondaryButton';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ConfirmationModal } from '../../components/modals/ConfirmationModal';
import { ImageViewerModal } from '../../components/modals/ImageViewerModal';
import { ocrService } from '../../services/ocrService';
import { useWallet } from '../../hooks/useWallet';
import { ExtractedPaymentDetails } from '../../types';
import { formatPaiseToINR } from '../../utils/currency';
import { calculateDepositPreview } from '../../utils/calculations';

export const OcrProcessingScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { imageUri, source = 'gallery' } = route.params || {};

  const { transactions, bonusConfig, createDeposit } = useWallet();

  const [processingState, setProcessingState] = useState<
    'hashing' | 'reading' | 'detecting_amount' | 'detecting_utr' | 'complete' | 'error'
  >('hashing');

  const [screenshotHash, setScreenshotHash] = useState<string>('');
  const [extractedDetails, setExtractedDetails] =
    useState<ExtractedPaymentDetails | null>(null);
  const [duplicateCheck, setDuplicateCheck] = useState<{
    isDuplicate: boolean;
    duplicateReason?: string;
  }>({ isDuplicate: false });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [createdTxnId, setCreatedTxnId] = useState('');
  const [imageModalVisible, setImageModalVisible] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function runOcrPipeline() {
      if (!imageUri) {
        setProcessingState('error');
        return;
      }

      try {
        // Step 1: Hashing
        setProcessingState('hashing');
        const hash = await ocrService.computeImageHash(imageUri);
        if (!isMounted) return;
        setScreenshotHash(hash);

        // Step 2: Reading text
        setProcessingState('reading');
        await new Promise((r) => setTimeout(r, 400));
        const rawText = await ocrService.recognizeText(imageUri);
        if (!isMounted) return;

        // Step 3: Detecting Amount & UTR
        setProcessingState('detecting_amount');
        await new Promise((r) => setTimeout(r, 400));
        const details = ocrService.parsePaymentText(rawText);
        if (!isMounted) return;

        setProcessingState('detecting_utr');
        await new Promise((r) => setTimeout(r, 300));

        // Step 4: Duplicate Check
        const dup = ocrService.checkDuplicate(
          hash,
          details.utrNumber,
          transactions
        );
        setDuplicateCheck(dup);
        setExtractedDetails(details);
        setProcessingState('complete');
      } catch (e) {
        console.error('OCR pipeline error:', e);
        if (isMounted) setProcessingState('error');
      }
    }

    runOcrPipeline();

    return () => {
      isMounted = false;
    };
  }, [imageUri, transactions]);

  const bonusRate = bonusConfig.isEnabled ? bonusConfig.bonusPercentage : 0;
  const depositPaise = extractedDetails?.amountPaise || 0;
  const preview = calculateDepositPreview(depositPaise, bonusRate);

  const handleSubmitToAdmin = async () => {
    if (!extractedDetails || depositPaise <= 0) {
      Alert.alert(
        'Missing Amount',
        'Unable to detect a valid deposit amount from this screenshot. Please ensure the screenshot clearly displays the payment amount.'
      );
      return;
    }

    if (duplicateCheck.isDuplicate) {
      Alert.alert(
        'Duplicate Submission Prevented',
        duplicateCheck.duplicateReason ||
          'This payment receipt has already been submitted.'
      );
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    const res = await createDeposit({
      amountPaise: depositPaise,
      paymentMethod:
        extractedDetails.paymentAppName || 'UPI Payment Screenshot',
      upiId: extractedDetails.upiId || undefined,
      screenshotUri: imageUri,
      screenshotHash,
      ocrResult: extractedDetails,
      ocrConfidence: extractedDetails.ocrConfidence,
      utrNumber: extractedDetails.utrNumber || undefined,
      senderName: extractedDetails.senderName || undefined,
      receiverName: extractedDetails.receiverName || undefined,
      paymentAppName: extractedDetails.paymentAppName || undefined,
      rawOcrText: extractedDetails.rawText,
      submissionSource: source === 'whatsapp_share' ? 'whatsapp_share' : 'gallery',
      notes: `Automated OCR submission via ${source}. OCR Confidence: ${extractedDetails.ocrConfidence}%`,
    });

    setSubmitting(false);

    if (res.success && res.transaction) {
      setCreatedTxnId(res.transaction.id);
      setSuccessModalVisible(true);
    } else {
      setSubmitError(res.error || 'Failed to submit deposit request.');
    }
  };

  const handleSuccessDone = () => {
    setSuccessModalVisible(false);
    navigation.navigate('UserDashboard');
  };

  return (
    <ScreenContainer scrollable backgroundColor={colors.background}>
      <Header
        title="Payment Recognition"
        subtitle="Automatic on-device OCR scan"
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.content}>
        {/* Screenshot Card & Preview */}
        <View style={styles.imageCard}>
          <TouchableOpacity
            style={styles.imageWrapper}
            onPress={() => setImageModalVisible(true)}
            activeOpacity={0.85}
          >
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.image} />
            ) : (
              <View style={styles.noImageView}>
                <Ionicons name="image-outline" size={40} color={colors.textLight} />
                <Text style={styles.noImageText}>No image provided</Text>
              </View>
            )}
            <View style={styles.zoomBadge}>
              <Ionicons name="expand-outline" size={14} color={colors.white} />
              <Text style={styles.zoomText}>View Fullscreen</Text>
            </View>
          </TouchableOpacity>

          {source === 'whatsapp_share' && (
            <View style={styles.sourceTag}>
              <Ionicons name="logo-whatsapp" size={14} color="#16A36A" />
              <Text style={styles.sourceTagText}>Shared from WhatsApp</Text>
            </View>
          )}
        </View>

        {/* Processing State Indicator */}
        {processingState !== 'complete' && processingState !== 'error' && (
          <View style={styles.processingCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.processingTitle}>
              {processingState === 'hashing'
                ? 'Hashing Screenshot File...'
                : processingState === 'reading'
                ? 'Reading Payment Details...'
                : processingState === 'detecting_amount'
                ? 'Detecting Transaction Amount...'
                : 'Verifying UTR & Duplicate Records...'}
            </Text>
            <Text style={styles.processingSub}>
              Analyzing payment receipt on-device using Google ML Kit
            </Text>
          </View>
        )}

        {/* Duplicate Alert Notice */}
        {duplicateCheck.isDuplicate && (
          <View style={styles.duplicateAlertBox}>
            <View style={styles.duplicateHeader}>
              <Ionicons name="alert-circle" size={20} color={colors.danger} />
              <Text style={styles.duplicateTitle}>Duplicate Transaction Warning</Text>
            </View>
            <Text style={styles.duplicateDesc}>
              {duplicateCheck.duplicateReason}
            </Text>
            <Text style={styles.duplicateSub}>
              This screenshot cannot be credited again to protect ledger integrity.
            </Text>
          </View>
        )}

        {/* Extracted Details Results */}
        {processingState === 'complete' && extractedDetails && (
          <>
            <View style={styles.resultsCard}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardHeading}>Detected Payment Details</Text>
                  <Text style={styles.cardSub}>
                    Extracted automatically without manual typing
                  </Text>
                </View>

                <View style={styles.confidencePill}>
                  <Text style={styles.confidenceLabel}>OCR Confidence</Text>
                  <Text style={styles.confidenceScore}>
                    {extractedDetails.ocrConfidence}%
                  </Text>
                </View>
              </View>

              {/* Amount Highlight */}
              <View style={styles.amountBox}>
                <Text style={styles.amountLabel}>Detected Amount</Text>
                <Text
                  style={[
                    styles.amountValue,
                    !extractedDetails.amountPaise && styles.notDetectedText,
                  ]}
                >
                  {extractedDetails.amountFormatted || 'Not detected'}
                </Text>
              </View>

              {/* Key Fields Grid */}
              <View style={styles.fieldsGrid}>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Payment Application</Text>
                  <Text
                    style={[
                      styles.fieldValue,
                      !extractedDetails.paymentAppName && styles.notDetectedText,
                    ]}
                  >
                    {extractedDetails.paymentAppName || 'Not detected'}
                  </Text>
                </View>

                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>UTR / Reference No.</Text>
                  <Text
                    style={[
                      styles.fieldValue,
                      styles.boldValue,
                      !extractedDetails.utrNumber && styles.notDetectedText,
                    ]}
                  >
                    {extractedDetails.utrNumber || 'Not detected'}
                  </Text>
                </View>

                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Receiver / Paid To</Text>
                  <Text
                    style={[
                      styles.fieldValue,
                      !extractedDetails.receiverName && styles.notDetectedText,
                    ]}
                  >
                    {extractedDetails.receiverName || 'Not detected'}
                  </Text>
                </View>

                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Sender / From</Text>
                  <Text
                    style={[
                      styles.fieldValue,
                      !extractedDetails.senderName && styles.notDetectedText,
                    ]}
                  >
                    {extractedDetails.senderName || 'Not detected'}
                  </Text>
                </View>

                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Date & Time</Text>
                  <Text
                    style={[
                      styles.fieldValue,
                      !extractedDetails.transactionDate &&
                        !extractedDetails.transactionTime &&
                        styles.notDetectedText,
                    ]}
                  >
                    {extractedDetails.transactionDate || ''}
                    {extractedDetails.transactionTime
                      ? ` ${extractedDetails.transactionTime}`
                      : ''}
                    {!extractedDetails.transactionDate &&
                    !extractedDetails.transactionTime
                      ? 'Not detected'
                      : ''}
                  </Text>
                </View>

                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Payment Status</Text>
                  <Text
                    style={[
                      styles.fieldValue,
                      styles.statusHighlight,
                      !extractedDetails.paymentStatus && styles.notDetectedText,
                    ]}
                  >
                    {extractedDetails.paymentStatus || 'Not detected'}
                  </Text>
                </View>

                {extractedDetails.upiId && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>UPI ID (VPA)</Text>
                    <Text style={styles.fieldValue}>
                      {extractedDetails.upiId}
                    </Text>
                  </View>
                )}
              </View>

              {/* Bonus Breakdown Preview */}
              {depositPaise > 0 && (
                <View style={styles.bonusBox}>
                  <View style={styles.bonusRow}>
                    <Text style={styles.bonusLabel}>
                      5% Bonus Credited upon Admin Approval:
                    </Text>
                    <Text style={styles.bonusVal}>
                      +{formatPaiseToINR(preview.bonusPaise)}
                    </Text>
                  </View>
                  <View style={styles.bonusDivider} />
                  <View style={styles.bonusRow}>
                    <Text style={styles.bonusTotalLabel}>
                      Expected Total Wallet Credit:
                    </Text>
                    <Text style={styles.bonusTotalVal}>
                      {formatPaiseToINR(preview.totalCreditPaise)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Notice regarding Admin verification */}
              <View style={styles.adminNote}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={16}
                  color={colors.info}
                />
                <Text style={styles.adminNoteText}>
                  Zero Auto-Credit Policy: To prevent fraud, wallet balances are
                  only credited after an Administrator verifies the payment
                  against bank records.
                </Text>
              </View>
            </View>

            {submitError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{submitError}</Text>
              </View>
            ) : null}

            {/* Actions */}
            <View style={styles.actionsContainer}>
              <PrimaryButton
                title={
                  depositPaise > 0
                    ? `Submit to Admin (${formatPaiseToINR(depositPaise)})`
                    : 'Submit to Admin for Manual Review'
                }
                onPress={handleSubmitToAdmin}
                loading={submitting}
                disabled={duplicateCheck.isDuplicate}
                fullWidth
                size="lg"
              />

              <SecondaryButton
                title="Cancel / Select Another Screenshot"
                onPress={() => navigation.goBack()}
                fullWidth
                size="md"
                style={{ marginTop: 10 }}
              />
            </View>
          </>
        )}
      </View>

      {/* Confirmation Modal */}
      <ConfirmationModal
        visible={successModalVisible}
        title="Screenshot Submitted to Admin!"
        message={`Your deposit request of ${formatPaiseToINR(
          depositPaise
        )} has been queued.\n\nTransaction ID: ${createdTxnId}\nUTR: ${
          extractedDetails?.utrNumber || 'Detected'
        }\nStatus: PENDING ADMIN APPROVAL\n\nYour wallet will be credited once verified by our administrative team.`}
        confirmLabel="Go to Dashboard"
        variant="success"
        icon="checkmark-circle"
        onConfirm={handleSuccessDone}
        onCancel={handleSuccessDone}
      />

      {/* Fullscreen Image Preview */}
      <ImageViewerModal
        visible={imageModalVisible}
        imageUri={imageUri}
        title="Payment Screenshot"
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
  imageCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    alignItems: 'center',
  },
  imageWrapper: {
    width: '100%',
    height: 180,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F3F4F6',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  noImageView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noImageText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
  },
  zoomBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(9, 30, 66, 0.75)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  zoomText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  sourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F8EF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
    gap: 6,
  },
  sourceTagText: {
    fontSize: 12,
    color: '#0E7047',
    fontWeight: '700',
  },
  processingCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  processingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginTop: 14,
  },
  processingSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  duplicateAlertBox: {
    backgroundColor: '#FFF0ED',
    borderWidth: 1.5,
    borderColor: '#FFBDAD',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  duplicateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  duplicateTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.dangerDark,
  },
  duplicateDesc: {
    fontSize: 13,
    color: colors.danger,
    fontWeight: '600',
    lineHeight: 18,
  },
  duplicateSub: {
    fontSize: 11,
    color: '#821414',
    marginTop: 4,
  },
  resultsCard: {
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
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  cardSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  confidencePill: {
    backgroundColor: colors.lightBlue,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  confidenceLabel: {
    fontSize: 9,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  confidenceScore: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  amountBox: {
    backgroundColor: '#F8FAFD',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  amountLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  amountValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 4,
  },
  fieldsGrid: {
    marginBottom: 14,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  fieldLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  fieldValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    maxWidth: '65%',
    textAlign: 'right',
  },
  boldValue: {
    fontWeight: '700',
    color: colors.primaryDark,
  },
  statusHighlight: {
    color: colors.successDark,
    fontWeight: '700',
  },
  notDetectedText: {
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  bonusBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 12,
  },
  bonusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  bonusLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  bonusVal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.warningDark,
  },
  bonusDivider: {
    height: 1,
    backgroundColor: '#FDE68A',
    marginVertical: 6,
  },
  bonusTotalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  bonusTotalVal: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  adminNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.infoLight,
    padding: 10,
    borderRadius: 8,
    gap: 6,
  },
  adminNoteText: {
    fontSize: 11,
    color: colors.info,
    flex: 1,
    lineHeight: 16,
  },
  errorBox: {
    backgroundColor: colors.dangerLight,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    color: colors.dangerDark,
    textAlign: 'center',
    fontWeight: '600',
  },
  actionsContainer: {
    marginBottom: 20,
  },
});

export default OcrProcessingScreen;
