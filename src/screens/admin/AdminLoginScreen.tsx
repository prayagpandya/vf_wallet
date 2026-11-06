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
import { useAuth } from '../../hooks/useAuth';
import { INITIAL_MOCK_ADMINS } from '../../data/mockAdmins';

export const AdminLoginScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { loginAdmin } = useAuth();

  const [identifier, setIdentifier] = useState('admin@vfwallet.com');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleAdminLogin = async () => {
    setErrorMessage('');
    if (!identifier.trim()) {
      setErrorMessage('Please enter admin email or mobile number.');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('Please enter admin password.');
      return;
    }

    setLoading(true);
    const res = await loginAdmin(identifier, password);
    setLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Admin verification failed.');
    }
  };

  const handleSelectAdminChip = (email: string) => {
    setIdentifier(email);
    setPassword('admin123');
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
        {/* Top Back to User login */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.navigate('Login')}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
          <Text style={styles.backBtnText}>User Login</Text>
        </TouchableOpacity>

        {/* Admin Header */}
        <View style={styles.header}>
          <View style={styles.shieldIconWrapper}>
            <Ionicons name="shield-checkmark" size={36} color={colors.white} />
          </View>
          <Text style={styles.adminTitle}>Admin Console</Text>
          <Text style={styles.adminSubtitle}>
            Administrative access for approvals, user metrics & wallet controls
          </Text>
        </View>

        {/* Predefined Admin Accounts Quick Selection */}
        <View style={styles.predefinedBox}>
          <Text style={styles.predefinedTitle}>
            Select Demo Admin Account (1-Tap Fill):
          </Text>
          <View style={styles.adminChipsContainer}>
            {INITIAL_MOCK_ADMINS.map((admin) => {
              const isSelected = identifier.toLowerCase() === admin.email.toLowerCase();
              return (
                <TouchableOpacity
                  key={admin.id}
                  style={[
                    styles.adminChip,
                    isSelected && styles.adminChipSelected,
                  ]}
                  onPress={() => handleSelectAdminChip(admin.email)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.adminChipName,
                      isSelected && styles.adminChipTextSelected,
                    ]}
                  >
                    {admin.name}
                  </Text>
                  <Text
                    style={[
                      styles.adminChipRole,
                      isSelected && styles.adminChipTextSelected,
                    ]}
                  >
                    {admin.adminRoleTitle}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Form Inputs */}
        <View style={styles.formCard}>
          <CustomInput
            label="Admin Email or Phone"
            placeholder="admin@vfwallet.com"
            value={identifier}
            onChangeText={(text) => {
              setIdentifier(text);
              if (errorMessage) setErrorMessage('');
            }}
            leftIcon="shield-outline"
            autoCapitalize="none"
          />

          <CustomInput
            label="Security Password"
            placeholder="Enter admin password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errorMessage) setErrorMessage('');
            }}
            leftIcon="key-outline"
            isPassword
          />

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <PrimaryButton
            title="Authenticate as Admin"
            onPress={handleAdminLogin}
            loading={loading}
            fullWidth
            size="lg"
            variant="primary"
          />
        </View>

        <Text style={styles.disclaimerText}>
          Demo Security Notice: Any non-empty password is accepted for prototype
          evaluation. Role permissions are simulated locally.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4FA',
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
    marginBottom: 16,
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 6,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  shieldIconWrapper: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 12,
  },
  adminTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  adminSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  predefinedBox: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  predefinedTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  adminChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  adminChip: {
    width: '48%',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  adminChipSelected: {
    backgroundColor: colors.lightBlue,
    borderColor: colors.primary,
  },
  adminChipName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  adminChipRole: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  adminChipTextSelected: {
    color: colors.primaryDark,
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
  disclaimerText: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 16,
    paddingHorizontal: 16,
  },
});

export default AdminLoginScreen;

