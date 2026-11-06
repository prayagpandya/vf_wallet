import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { ResetDataModal } from '../../components/modals/ResetDataModal';
import { useWallet } from '../../hooks/useWallet';

export const ResetDataScreen = () => {
  const navigation = useNavigation();
  const { resetAllData } = useWallet();

  const [modalVisible, setModalVisible] = useState(false);

  const handleConfirmReset = async () => {
    try {
      await resetAllData();
      Alert.alert(
        'System Reset Successful',
        'All local wallet transactions, custom users, and bonus configurations have been cleared. Fresh demo seed state has been restored.'
      );
    } catch (e) {
      Alert.alert('Reset Failed', 'Could not clear local demo data.');
    }
  };

  return (
    <ScreenContainer scrollable backgroundColor={colors.background}>
      <Header
        title="Danger Zone: Factory Reset"
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.content}>
        {/* Warning Hero Card */}
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="warning" size={40} color={colors.danger} />
          </View>
          <Text style={styles.title}>Reset All Application Data</Text>
          <Text style={styles.subtitle}>
            This action completely wipes the locally persisted AsyncStorage
            database and restores the pristine default state.
          </Text>

          <View style={styles.impactBox}>
            <Text style={styles.impactTitle}>What will happen:</Text>
            <Text style={styles.impactItem}>
              ❌ All customized user accounts will be reset.
            </Text>
            <Text style={styles.impactItem}>
              ❌ All deposit and withdrawal requests will be erased.
            </Text>
            <Text style={styles.impactItem}>
              ❌ All uploaded payment screenshots will be deleted.
            </Text>
            <Text style={styles.impactItem}>
              ❌ Bonus rate will revert to the default 5%.
            </Text>
            <Text style={styles.impactItem}>
              ❌ Your current administrator session will be terminated.
            </Text>
          </View>

          <View style={styles.protectionNotice}>
            <Ionicons name="shield-outline" size={18} color={colors.primary} />
            <Text style={styles.protectionText}>
              Two-step confirmation with manual keyword verification (typing{' '}
              <Text style={{ fontWeight: '800' }}>RESET ALL</Text>) is required
              to prevent accidental execution.
            </Text>
          </View>

          <PrimaryButton
            title="Reset All Application Data"
            variant="danger"
            onPress={() => setModalVisible(true)}
            size="lg"
            fullWidth
            style={styles.resetBtn}
          />
        </View>
      </View>

      {/* Two-step Verification Modal */}
      <ResetDataModal
        visible={modalVisible}
        onConfirm={handleConfirmReset}
        onCancel={() => setModalVisible(false)}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1.5,
    borderColor: '#FFCDD2',
    alignItems: 'center',
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  impactBox: {
    backgroundColor: '#FFF8F8',
    borderRadius: 14,
    padding: 16,
    width: '100%',
    marginVertical: 18,
    borderWidth: 1,
    borderColor: '#FFD7D7',
  },
  impactTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dangerDark,
    marginBottom: 8,
  },
  impactItem: {
    fontSize: 12,
    color: '#842029',
    lineHeight: 20,
  },
  protectionNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.lightBlue,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  protectionText: {
    fontSize: 12,
    color: colors.primaryDark,
    flex: 1,
    lineHeight: 17,
  },
  resetBtn: {
    marginTop: 4,
  },
});

export default ResetDataScreen;

