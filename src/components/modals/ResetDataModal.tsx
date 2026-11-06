import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableWithoutFeedback,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { PrimaryButton } from '../buttons/PrimaryButton';
import { SecondaryButton } from '../buttons/SecondaryButton';

interface ResetDataModalProps {
  visible: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export const ResetDataModal: React.FC<ResetDataModalProps> = ({
  visible,
  onConfirm,
  onCancel,
}) => {
  // Step 1: Warning explanation -> Step 2: Type "RESET ALL" confirmation
  const [step, setStep] = useState<1 | 2>(1);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    setStep(1);
    setInputText('');
    setError('');
    onCancel();
  };

  const handleNextStep = () => {
    setStep(2);
  };

  const handleFinalConfirm = async () => {
    if (inputText.trim() !== 'RESET ALL') {
      setError('Please type exactly "RESET ALL" in capital letters to confirm.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await onConfirm();
      handleClose();
    } catch (e) {
      setError('Failed to reset application data.');
    } finally {
      setLoading(false);
    }
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
                <Ionicons name="warning" size={36} color={colors.danger} />
              </View>

              {step === 1 ? (
                <>
                  <Text style={styles.title}>Reset All Application Data?</Text>
                  <Text style={styles.stepTag}>Step 1 of 2: Danger Warning</Text>

                  <View style={styles.warningBox}>
                    <Text style={styles.warningItem}>
                      • All demo user accounts will be restored to seed state.
                    </Text>
                    <Text style={styles.warningItem}>
                      • All custom deposit and withdrawal requests will be cleared.
                    </Text>
                    <Text style={styles.warningItem}>
                      • Bonus configurations and settings will be reset to default (5%).
                    </Text>
                    <Text style={styles.warningItem}>
                      • All local transactions and demo screenshots will be erased.
                    </Text>
                    <Text style={styles.warningItem}>
                      • You will be automatically logged out.
                    </Text>
                  </View>

                  <View style={styles.buttonRow}>
                    <View style={styles.buttonCol}>
                      <SecondaryButton
                        title="Cancel"
                        onPress={handleClose}
                        fullWidth
                      />
                    </View>
                    <View style={styles.buttonCol}>
                      <PrimaryButton
                        title="Proceed"
                        variant="danger"
                        onPress={handleNextStep}
                        fullWidth
                      />
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.title}>Confirm Factory Reset</Text>
                  <Text style={styles.stepTag}>
                    Step 2 of 2: Type verification phrase
                  </Text>
                  <Text style={styles.instruction}>
                    To prevent accidental data loss, please type{' '}
                    <Text style={styles.boldPhrase}>RESET ALL</Text> below:
                  </Text>

                  <TextInput
                    style={[styles.input, !!error && styles.inputError]}
                    placeholder="Type RESET ALL"
                    placeholderTextColor={colors.textLight}
                    value={inputText}
                    onChangeText={(text) => {
                      setInputText(text);
                      if (error) setError('');
                    }}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />

                  {error ? <Text style={styles.errorText}>{error}</Text> : null}

                  <View style={styles.buttonRow}>
                    <View style={styles.buttonCol}>
                      <SecondaryButton
                        title="Back"
                        onPress={() => setStep(1)}
                        disabled={loading}
                        fullWidth
                      />
                    </View>
                    <View style={styles.buttonCol}>
                      <PrimaryButton
                        title="Reset Everything"
                        variant="danger"
                        onPress={handleFinalConfirm}
                        loading={loading}
                        disabled={inputText.trim() !== 'RESET ALL'}
                        fullWidth
                      />
                    </View>
                  </View>
                </>
              )}
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
    backgroundColor: 'rgba(9, 30, 66, 0.75)',
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
    alignItems: 'center',
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  stepTag: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.dangerDark,
    marginTop: 4,
    marginBottom: 14,
    textTransform: 'uppercase',
  },
  warningBox: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FFD1D1',
    borderRadius: 12,
    padding: 14,
    width: '100%',
    marginBottom: 20,
  },
  warningItem: {
    fontSize: 12,
    color: '#821414',
    lineHeight: 18,
    marginBottom: 4,
  },
  instruction: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
  },
  boldPhrase: {
    fontWeight: '800',
    color: colors.danger,
    letterSpacing: 0.5,
  },
  input: {
    width: '100%',
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 6,
    backgroundColor: '#FAFBFC',
  },
  inputError: {
    borderColor: colors.danger,
    backgroundColor: '#FFF9F8',
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginTop: 10,
  },
  buttonCol: {
    flex: 1,
  },
});

export default ResetDataModal;

