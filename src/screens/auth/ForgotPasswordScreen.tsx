import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { CustomInput } from '../../components/inputs/CustomInput';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';

export const ForgotPasswordScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const [identifier, setIdentifier] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSendOtp = () => {
    if (!identifier.trim()) {
      setError('Please enter your email or mobile number.');
      return;
    }
    setError('');
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep(2);
      setMessage('Demo OTP sent to your registered contact: 123456');
    }, 600);
  };

  const handleResetPassword = () => {
    if (otp !== '123456') {
      setError('Invalid demo OTP. Please use code: 123456');
      return;
    }
    if (!newPassword.trim()) {
      setError('Please enter a new password.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      alert('Password reset successful! You can now log in.');
      navigation.navigate('Login');
    }, 600);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
          <Text style={styles.backBtnText}>Back to Sign In</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="key-outline" size={32} color={colors.primary} />
          </View>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            {step === 1
              ? 'Enter your registered email or phone to receive a reset code'
              : 'Enter the verification code and choose a new password'}
          </Text>
        </View>

        <View style={styles.formCard}>
          {message ? (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>{message}</Text>
            </View>
          ) : null}

          {step === 1 ? (
            <>
              <CustomInput
                label="Email or Mobile"
                placeholder="aditya@example.com or 9820123456"
                value={identifier}
                onChangeText={(text) => {
                  setIdentifier(text);
                  if (error) setError('');
                }}
                leftIcon="mail-outline"
                autoCapitalize="none"
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <PrimaryButton
                title="Send Verification Code"
                onPress={handleSendOtp}
                loading={loading}
                fullWidth
                size="lg"
              />
            </>
          ) : (
            <>
              <CustomInput
                label="Verification Code (OTP)"
                placeholder="Enter 123456"
                value={otp}
                onChangeText={(text) => {
                  setOtp(text);
                  if (error) setError('');
                }}
                leftIcon="shield-checkmark-outline"
                keyboardType="numeric"
              />

              <CustomInput
                label="New Password"
                placeholder="Enter new password"
                value={newPassword}
                onChangeText={(text) => {
                  setNewPassword(text);
                  if (error) setError('');
                }}
                leftIcon="lock-closed-outline"
                isPassword
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <PrimaryButton
                title="Reset Password & Login"
                onPress={handleResetPassword}
                loading={loading}
                fullWidth
                size="lg"
              />
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: 'center',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 6,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 16,
    lineHeight: 18,
  },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  infoBox: {
    backgroundColor: colors.infoLight,
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  infoText: {
    fontSize: 12,
    color: colors.info,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
    marginBottom: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default ForgotPasswordScreen;

