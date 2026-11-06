import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Clipboard,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { DEMO_PAYMENT_INFO } from '../../utils/constants';

export const DepositScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    Clipboard.setString(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handlePickFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission Required',
          'Please allow photo access to select your payment screenshot.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        // Automatically start OCR - NO MANUAL DATA ENTRY!
        navigation.navigate('OcrProcessing', {
          imageUri,
          source: 'gallery',
        });
      }
    } catch (e) {
      Alert.alert('Error', 'Could not open image picker.');
    }
  };

  return (
    <ScreenContainer scrollable backgroundColor={colors.background}>
      <Header
        title="Deposit Funds"
        subtitle="Automatic screenshot OCR & 5% bonus"
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.content}>
        {/* Promotion Banner */}
        <View style={styles.promoBanner}>
          <View style={styles.promoIconCircle}>
            <Ionicons name="sparkles" size={18} color="#B45309" />
          </View>
          <View style={styles.promoTextContainer}>
            <Text style={styles.promoTitle}>Instant 5% Cashback Bonus</Text>
            <Text style={styles.promoDesc}>
              No manual typing required. Just share or select your payment
              receipt!
            </Text>
          </View>
        </View>

        {/* Step 1: Transfer Funds */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>1. Transfer Funds via UPI or Bank</Text>
          <Text style={styles.instructionText}>
            Transfer any deposit amount using Google Pay, PhonePe, Paytm, or your
            bank app to our official account:
          </Text>

          {/* UPI Information */}
          <View style={styles.paymentInfoRow}>
            <View style={styles.paymentIconBox}>
              <Ionicons name="qr-code-outline" size={24} color={colors.primary} />
            </View>
            <View style={styles.paymentDetailsCol}>
              <Text style={styles.paymentSubLabel}>Official Merchant UPI ID</Text>
              <Text style={styles.paymentMainText}>{DEMO_PAYMENT_INFO.upiId}</Text>
            </View>
            <TouchableOpacity
              style={styles.copyBtn}
              onPress={() => handleCopy(DEMO_PAYMENT_INFO.upiId, 'upi')}
            >
              <Ionicons
                name={copiedKey === 'upi' ? 'checkmark' : 'copy-outline'}
                size={16}
                color={colors.primary}
              />
              <Text style={styles.copyBtnText}>
                {copiedKey === 'upi' ? 'Copied' : 'Copy'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Bank Account Information */}
          <View style={styles.paymentInfoRow}>
            <View style={styles.paymentIconBox}>
              <Ionicons name="business-outline" size={24} color={colors.primary} />
            </View>
            <View style={styles.paymentDetailsCol}>
              <Text style={styles.paymentSubLabel}>
                {DEMO_PAYMENT_INFO.bankName}
              </Text>
              <Text style={styles.paymentMainText}>
                A/C: {DEMO_PAYMENT_INFO.accountNumber}
              </Text>
              <Text style={styles.paymentIfscText}>
                IFSC: {DEMO_PAYMENT_INFO.ifsc}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.copyBtn}
              onPress={() =>
                handleCopy(DEMO_PAYMENT_INFO.accountNumber, 'account')
              }
            >
              <Ionicons
                name={copiedKey === 'account' ? 'checkmark' : 'copy-outline'}
                size={16}
                color={colors.primary}
              />
              <Text style={styles.copyBtnText}>
                {copiedKey === 'account' ? 'Copied' : 'Copy'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Step 2: Automated Screenshot Submission */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>2. Submit Payment Screenshot</Text>
          <Text style={styles.instructionText}>
            Our on-device ML Kit OCR will automatically read the amount, UTR
            number, and date without any manual typing.
          </Text>

          {/* Option A: Gallery Selection */}
          <TouchableOpacity
            style={styles.uploadBox}
            onPress={handlePickFromGallery}
            activeOpacity={0.7}
          >
            <View style={styles.uploadIconCircle}>
              <Ionicons name="images-outline" size={32} color={colors.primary} />
            </View>
            <Text style={styles.uploadTitle}>
              Select Screenshot from Gallery
            </Text>
            <Text style={styles.uploadSub}>
              Supports Google Pay, PhonePe, Paytm, BHIM (JPG, PNG)
            </Text>
          </TouchableOpacity>

          {/* Option B: WhatsApp Share Intent */}
          <View style={styles.whatsAppBox}>
            <View style={styles.whatsAppIconCircle}>
              <Ionicons name="logo-whatsapp" size={24} color="#16A36A" />
            </View>
            <View style={styles.whatsAppTextCol}>
              <Text style={styles.whatsAppTitle}>
                Direct WhatsApp Sharing
              </Text>
              <Text style={styles.whatsAppDesc}>
                Open WhatsApp ➔ View payment receipt ➔ Tap Share ➔ Select{' '}
                <Text style={{ fontWeight: '700' }}>VF Wallet</Text>. OCR scan
                will trigger automatically!
              </Text>
            </View>
          </View>
        </View>

        <PrimaryButton
          title="Pick Screenshot to Auto-Scan"
          icon="scan-outline"
          onPress={handlePickFromGallery}
          size="lg"
          fullWidth
          style={{ marginBottom: 20 }}
        />
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  promoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  promoIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  promoTextContainer: {
    flex: 1,
  },
  promoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  promoDesc: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 2,
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
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  paymentInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  paymentIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  paymentDetailsCol: {
    flex: 1,
  },
  paymentSubLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  paymentMainText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  paymentIfscText: {
    fontSize: 12,
    color: colors.textMuted,
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
  uploadBox: {
    borderWidth: 2,
    borderColor: '#BFDBFE',
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFD',
    marginBottom: 14,
  },
  uploadIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  uploadTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  uploadSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  whatsAppBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    gap: 10,
  },
  whatsAppIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsAppTextCol: {
    flex: 1,
  },
  whatsAppTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803D',
  },
  whatsAppDesc: {
    fontSize: 11,
    color: '#166534',
    marginTop: 2,
    lineHeight: 16,
  },
});

export default DepositScreen;
