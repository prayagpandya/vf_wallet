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
import { colors } from '../../theme/colors';
import { Logo } from '../../components/common/Logo';
import { CustomInput } from '../../components/inputs/CustomInput';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { useAuth } from '../../hooks/useAuth';

export const LoginScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { loginUser } = useAuth();

  const [identifier, setIdentifier] = useState('aditya@example.com');
  const [password, setPassword] = useState('demo123');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    setErrorMessage('');
    if (!identifier.trim()) {
      setErrorMessage('Please enter your email or mobile number.');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setLoading(true);
    const res = await loginUser(identifier, password);
    setLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Login failed. Please check credentials.');
    }
  };

  const handleQuickDemoFill = () => {
    setIdentifier('aditya@example.com');
    setPassword('demo123');
    setErrorMessage('');
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
        {/* Logo and Greeting Header */}
        <View style={styles.header}>
          <Logo size="lg" showTagline />
          <Text style={styles.welcomeTitle}>Welcome Back</Text>
          <Text style={styles.welcomeSubtitle}>
            Log in to manage your VF Wallet balance & rewards
          </Text>
        </View>

        {/* Demo Quick Banner */}
        <TouchableOpacity
          style={styles.demoBanner}
          onPress={handleQuickDemoFill}
          activeOpacity={0.8}
        >
          <View style={styles.demoBadge}>
            <Text style={styles.demoBadgeText}>DEMO</Text>
          </View>
          <Text style={styles.demoBannerText}>
            Tap here to auto-fill Aditya Sharma's demo account
          </Text>
        </TouchableOpacity>

        {/* Form Inputs */}
        <View style={styles.formCard}>
          <CustomInput
            label="Email or Mobile Number"
            placeholder="e.g. aditya@example.com or 9820123456"
            value={identifier}
            onChangeText={(text) => {
              setIdentifier(text);
              if (errorMessage) setErrorMessage('');
            }}
            leftIcon="mail-outline"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <CustomInput
            label="Password"
            placeholder="Enter password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errorMessage) setErrorMessage('');
            }}
            leftIcon="lock-closed-outline"
            isPassword
          />

          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={() => navigation.navigate('ForgotPassword')}
            activeOpacity={0.7}
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <PrimaryButton
            title="Sign In to Wallet"
            onPress={handleLogin}
            loading={loading}
            fullWidth
            size="lg"
            style={styles.loginBtn}
          />

          <View style={styles.signupRow}>
            <Text style={styles.signupPrompt}>Don't have an account? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Signup')}
              activeOpacity={0.7}
            >
              <Text style={styles.signupLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Switch to Admin Portal */}
        <TouchableOpacity
          style={styles.adminSwitchBtn}
          onPress={() => navigation.navigate('AdminLogin')}
          activeOpacity={0.7}
        >
          <Text style={styles.adminSwitchText}>
            Switch to <Text style={styles.adminSwitchBold}>Admin Portal 🛡️</Text>
          </Text>
        </TouchableOpacity>
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
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 36,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginTop: 20,
    letterSpacing: -0.3,
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 16,
  },
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightBlue,
    borderRadius: 12,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#CCE0FF',
  },
  demoBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 8,
  },
  demoBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
  demoBannerText: {
    fontSize: 12,
    color: colors.primaryDark,
    fontWeight: '600',
    flex: 1,
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
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    marginTop: -4,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
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
  loginBtn: {
    marginTop: 4,
  },
  signupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  signupPrompt: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  signupLink: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  adminSwitchBtn: {
    alignSelf: 'center',
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  adminSwitchText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  adminSwitchBold: {
    fontWeight: '700',
    color: colors.secondary,
  },
});

export default LoginScreen;

