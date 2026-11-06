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
import { Logo } from '../../components/common/Logo';
import { CustomInput } from '../../components/inputs/CustomInput';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { useAuth } from '../../hooks/useAuth';
import { isValidEmail, isValidPhone } from '../../utils/validation';

export const SignupScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { signup } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [upiId, setUpiId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSignup = async () => {
    setErrorMessage('');

    if (!name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!isValidEmail(email)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!isValidPhone(phone)) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('Please enter a password.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    const res = await signup({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      password,
      upiId: upiId.trim() || undefined,
    });
    setLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Signup failed. Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
          <Text style={styles.backBtnText}>Back to Sign In</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Logo size="md" />
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Join VF Wallet to enjoy 5% cashback bonus on your deposits
          </Text>
        </View>

        <View style={styles.formCard}>
          <CustomInput
            label="Full Name"
            placeholder="e.g. Rahul Sharma"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (errorMessage) setErrorMessage('');
            }}
            leftIcon="person-outline"
          />

          <CustomInput
            label="Email Address"
            placeholder="e.g. rahul@example.com"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (errorMessage) setErrorMessage('');
            }}
            leftIcon="mail-outline"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <CustomInput
            label="Mobile Number"
            placeholder="e.g. 9812345678"
            value={phone}
            onChangeText={(text) => {
              setPhone(text);
              if (errorMessage) setErrorMessage('');
            }}
            leftIcon="call-outline"
            keyboardType="phone-pad"
            maxLength={10}
          />

          <CustomInput
            label="UPI ID (Optional)"
            placeholder="e.g. rahul@okaxis"
            value={upiId}
            onChangeText={(text) => setUpiId(text)}
            leftIcon="card-outline"
            autoCapitalize="none"
            helperText="Used for fast withdrawal transfers"
          />

          <CustomInput
            label="Password"
            placeholder="Create password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errorMessage) setErrorMessage('');
            }}
            leftIcon="lock-closed-outline"
            isPassword
          />

          <CustomInput
            label="Confirm Password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (errorMessage) setErrorMessage('');
            }}
            leftIcon="lock-closed-outline"
            isPassword
          />

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <PrimaryButton
            title="Create Demo Account"
            onPress={handleSignup}
            loading={loading}
            fullWidth
            size="lg"
            style={styles.signupBtn}
          />
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
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
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
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginTop: 12,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
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
  errorBox: {
    backgroundColor: colors.dangerLight,
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FFD1D1',
  },
  errorText: {
    fontSize: 12,
    color: colors.dangerDark,
    fontWeight: '500',
    textAlign: 'center',
  },
  signupBtn: {
    marginTop: 8,
  },
});

export default SignupScreen;

