import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ConfirmationModal } from '../../components/modals/ConfirmationModal';
import { useAuth } from '../../hooks/useAuth';
import { useWallet } from '../../hooks/useWallet';
import { formatPaiseToINR } from '../../utils/currency';
import { User } from '../../types';

export const UserProfileScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { user, logout } = useAuth();
  const { userWallet } = useWallet();

  const currentUser = user && user.role === 'user' ? (user as User) : null;
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  const handleConfirmLogout = async () => {
    setLogoutModalVisible(false);
    await logout();
  };

  return (
    <ScreenContainer scrollable backgroundColor={colors.background}>
      <Header
        title="My Profile"
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.content}>
        {/* User Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarRow}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {user?.name?.slice(0, 2).toUpperCase() || 'VF'}
                </Text>
              </View>
            )}

            <View style={styles.nameContainer}>
              <View style={styles.nameRow}>
                <Text style={styles.nameText}>{user?.name}</Text>
                <StatusBadge status="verified" size="sm" />
              </View>
              <Text style={styles.emailText}>{user?.email}</Text>
              <Text style={styles.phoneText}>+91 {user?.phone}</Text>
            </View>
          </View>

          <View style={styles.idBadge}>
            <Text style={styles.idBadgeText}>User ID: {user?.id}</Text>
          </View>
        </View>

        {/* Wallet Overview Summary */}
        <View style={styles.menuCard}>
          <Text style={styles.menuCardTitle}>Wallet Overview</Text>

          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Available Balance</Text>
            <Text style={[styles.metricVal, styles.primaryVal]}>
              {formatPaiseToINR(userWallet?.availableBalancePaise || 0)}
            </Text>
          </View>

          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Total Lifetime Deposits</Text>
            <Text style={styles.metricVal}>
              {formatPaiseToINR(userWallet?.totalDepositPaise || 0)}
            </Text>
          </View>

          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Total Lifetime Bonuses</Text>
            <Text style={[styles.metricVal, styles.bonusVal]}>
              {formatPaiseToINR(userWallet?.totalBonusPaise || 0)}
            </Text>
          </View>

          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Total Lifetime Withdrawals</Text>
            <Text style={styles.metricVal}>
              {formatPaiseToINR(userWallet?.totalWithdrawalPaise || 0)}
            </Text>
          </View>
        </View>

        {/* Banking & UPI Details */}
        <View style={styles.menuCard}>
          <Text style={styles.menuCardTitle}>Linked Payment Channels</Text>

          <View style={styles.paymentChannelRow}>
            <View style={styles.channelIconCircle}>
              <Ionicons name="card-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.channelInfo}>
              <Text style={styles.channelName}>Default UPI ID</Text>
              <Text style={styles.channelValue}>
                {currentUser?.upiId || 'Not configured'}
              </Text>
            </View>
          </View>

          {currentUser?.bankAccount && (
            <View style={styles.paymentChannelRow}>
              <View style={styles.channelIconCircle}>
                <Ionicons name="business-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.channelInfo}>
                <Text style={styles.channelName}>
                  {currentUser.bankAccount.bankName}
                </Text>
                <Text style={styles.channelValue}>
                  A/C: {currentUser.bankAccount.accountNumber} ({currentUser.bankAccount.ifsc})
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Actions & Settings */}
        <View style={styles.menuCard}>
          <Text style={styles.menuCardTitle}>Quick Actions</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('Support')}
            activeOpacity={0.7}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconCircle, { backgroundColor: colors.lightBlue }]}>
                <Ionicons name="headset-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.menuItemText}>Help & Support Center</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.7}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconCircle, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="notifications-outline" size={18} color="#D97706" />
              </View>
              <Text style={styles.menuItemText}>Notifications & Updates</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setLogoutModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconCircle, { backgroundColor: colors.dangerLight }]}>
                <Ionicons name="log-out-outline" size={18} color={colors.danger} />
              </View>
              <Text style={[styles.menuItemText, { color: colors.danger }]}>
                Sign Out of VF Wallet
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
          </TouchableOpacity>
        </View>

        <Text style={styles.versionText}>VF Wallet Version 1.0.0 (Local Demo)</Text>
      </View>

      {/* Logout Confirmation */}
      <ConfirmationModal
        visible={logoutModalVisible}
        title="Sign Out?"
        message="Are you sure you want to sign out of your demo account?"
        confirmLabel="Sign Out"
        variant="danger"
        icon="log-out-outline"
        onConfirm={handleConfirmLogout}
        onCancel={() => setLogoutModalVisible(false)}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  profileCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
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
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: 14,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
  },
  nameContainer: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  emailText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  phoneText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  idBadge: {
    backgroundColor: colors.surfaceAlt,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 14,
  },
  idBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  menuCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  menuCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  metricLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  metricVal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  primaryVal: {
    color: colors.primary,
  },
  bonusVal: {
    color: colors.warningDark,
  },
  paymentChannelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  channelIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  channelInfo: {
    flex: 1,
  },
  channelName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  channelValue: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  versionText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
});

export default UserProfileScreen;
