import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { CustomInput } from '../inputs/CustomInput';
import { PrimaryButton } from '../buttons/PrimaryButton';
import { SecondaryButton } from '../buttons/SecondaryButton';

interface RejectionModalProps {
  visible: boolean;
  title?: string;
  transactionType: 'deposit' | 'withdrawal';
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

export const RejectionModal: React.FC<RejectionModalProps> = ({
  visible,
  title = 'Reject Request',
  transactionType,
  onConfirm,
  onCancel,
  loading = false,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const depositReasons = [
    'UTR / Reference number not found in bank statement',
    'Payment screenshot is blurry or unreadable',
    'Amount deposited differs from requested amount',
    'Duplicate payment screenshot submitted',
    'Payment received from unverified third-party account',
  ];

  const withdrawalReasons = [
    'Withdrawal amount exceeds available balance',
    'Bank account details or IFSC code invalid',
    'UPI ID not accepting incoming merchant transfers',
    'Account KYC verification is pending',
    'Suspicious withdrawal activity detected',
  ];

  const quickReasons =
    transactionType === 'deposit' ? depositReasons : withdrawalReasons;

  const handleConfirm = () => {
    if (!reason.trim()) {
      setError('Please provide a reason for rejection.');
      return;
    }
    setError('');
    onConfirm(reason.trim());
    setReason('');
  };

  const handleClose = () => {
    setReason('');
    setError('');
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.content}>
              <View style={styles.iconCircle}>
                <Ionicons name="close-circle" size={32} color={colors.danger} />
              </View>

              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>
                Specify why this {transactionType} request is being rejected. This
                will be visible to the user.
              </Text>

              {/* Quick Reason Chips */}
              <Text style={styles.quickLabel}>Select reason template:</Text>
              <ScrollView
                style={styles.chipScrollView}
                contentContainerStyle={styles.chipContainer}
              >
                {quickReasons.map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.chip,
                      reason === item && styles.chipSelected,
                    ]}
                    onPress={() => {
                      setReason(item);
                      setError('');
                    }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        reason === item && styles.chipTextSelected,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <CustomInput
                label="Custom Rejection Reason"
                placeholder="Type reason here..."
                value={reason}
                onChangeText={(text) => {
                  setReason(text);
                  if (error) setError('');
                }}
                multiline
                numberOfLines={3}
                error={error}
              />

              <View style={styles.buttonRow}>
                <View style={styles.buttonCol}>
                  <SecondaryButton
                    title="Cancel"
                    onPress={handleClose}
                    disabled={loading}
                    fullWidth
                  />
                </View>
                <View style={styles.buttonCol}>
                  <PrimaryButton
                    title="Reject Request"
                    variant="danger"
                    onPress={handleConfirm}
                    loading={loading}
                    fullWidth
                  />
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 30, 66, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  content: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  chipScrollView: {
    maxHeight: 130,
    marginBottom: 12,
  },
  chipContainer: {
    gap: 6,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  chipSelected: {
    backgroundColor: colors.dangerLight,
    borderColor: colors.danger,
  },
  chipText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.dangerDark,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginTop: 8,
  },
  buttonCol: {
    flex: 1,
  },
});

export default RejectionModal;

