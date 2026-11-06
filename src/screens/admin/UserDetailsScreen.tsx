import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { StatusBadge } from '../../components/common/StatusBadge';
import { TransactionRow } from '../../components/cards/TransactionRow';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { SecondaryButton } from '../../components/buttons/SecondaryButton';
import { ConfirmationModal } from '../../components/modals/ConfirmationModal';
import { CustomInput } from '../../components/inputs/CustomInput';
import { useWallet } from '../../hooks/useWallet';
import { calculateUserWallet } from '../../utils/calculations';
import { formatPaiseToINR } from '../../utils/currency';

export const UserDetailsScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { userId } = route.params;

  const {
    users,
    transactions,
    toggleUserBlock,
    updateUserProfile,
  } = useWallet();

  const user = users.find((u) => u.id === userId);
  const userTransactions = transactions
    .filter((t) => t.userId === userId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  const walletSummary = user ? calculateUserWallet(user.id, transactions) : null;

  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [editUpi, setEditUpi] = useState(user?.upiId || '');

  if (!user || !walletSummary) {
    return (
      <ScreenContainer>
        <Header title="User Details" showBack onBackPress={() => navigation.goBack()} />
        <View style={styles.notFound}>
          <Text>User record not found.</Text>
        </View>
      </ScreenContainer>
    );
  }

  const handleToggleBlock = async () => {
    setBlockModalVisible(false);
    await toggleUserBlock(user.id);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      Alert.alert('Required', 'Name cannot be empty.');
      return;
    }
    await updateUserProfile(user.id, {
      name: editName.trim(),
      phone: editPhone.trim(),
      upiId: editUpi.trim(),
    });
    setEditModalVisible(false);
    Alert.alert('Updated', 'User profile saved.');
  };

  return (
    <ScreenContainer scrollable backgroundColor={colors.background}>
      <Header
        title="User Profile"
        subtitle={user.id}
        showBack
        onBackPress={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => {
              setEditName(user.name);
              setEditPhone(user.phone);
              setEditUpi(user.upiId || '');
              setEditModalVisible(true);
            }}
          >
            <Ionicons name="create-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        }
      />

      <View style={styles.content}>
        {/* Main User Card */}
        <View style={styles.card}>
          <View style={styles.profileRow}>
            {user.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {user.name.slice(0, 2).toUpperCase()}
                </Text>
              </View>
            )}

            <View style={styles.userInfoCol}>
              <View style={styles.nameRow}>
                <Text style={styles.nameText}>{user.name}</Text>
                <StatusBadge status={user.status} size="sm" />
              </View>
              <Text style={styles.emailText}>{user.email}</Text>
              <Text style={styles.phoneText}>+91 {user.phone}</Text>
              <Text style={styles.dateText}>
                Registered:{' '}
                {new Date(user.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
            </View>
          </View>

          {/* Block / Unblock CTA Button */}
          <View style={styles.actionRow}>
            <SecondaryButton
              title={user.status === 'active' ? 'Block User' : 'Unblock User'}
              variant={user.status === 'active' ? 'dangerOutline' : 'outline'}
              icon={user.status === 'active' ? 'ban' : 'checkmark-circle-outline'}
              onPress={() => setBlockModalVisible(true)}
              size="sm"
              fullWidth
            />
          </View>
        </View>

        {/* Financial Metrics Card */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Wallet Financial Summary</Text>

          <View style={styles.balanceHighlight}>
            <Text style={styles.balanceHighlightLabel}>Available Balance</Text>
            <Text style={styles.balanceHighlightValue}>
              {formatPaiseToINR(walletSummary.availableBalancePaise)}
            </Text>
          </View>

          <View style={styles.metricGrid}>
            <View style={styles.metricItem}>
              <Text style={styles.metricItemLabel}>Total Deposits</Text>
              <Text style={styles.metricItemVal}>
                {formatPaiseToINR(walletSummary.totalDepositPaise)}
              </Text>
            </View>

            <View style={styles.metricItem}>
              <Text style={styles.metricItemLabel}>Total Bonuses</Text>
              <Text style={[styles.metricItemVal, styles.bonusVal]}>
                {formatPaiseToINR(walletSummary.totalBonusPaise)}
              </Text>
            </View>

            <View style={styles.metricItem}>
              <Text style={styles.metricItemLabel}>Total Withdrawals</Text>
              <Text style={styles.metricItemVal}>
                {formatPaiseToINR(walletSummary.totalWithdrawalPaise)}
              </Text>
            </View>

            <View style={styles.metricItem}>
              <Text style={styles.metricItemLabel}>Pending Requests</Text>
              <Text style={styles.metricItemVal}>
                {walletSummary.pendingDepositCount} dep /{' '}
                {walletSummary.pendingWithdrawalCount} wdr
              </Text>
            </View>
          </View>
        </View>

        {/* Banking and UPI Channels */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Banking & UPI Details</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>UPI ID / VPA</Text>
            <Text style={styles.infoValue}>{user.upiId || 'Not set'}</Text>
          </View>

          {user.bankAccount ? (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Bank Name</Text>
                <Text style={styles.infoValue}>{user.bankAccount.bankName}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Account Holder</Text>
                <Text style={styles.infoValue}>
                  {user.bankAccount.accountHolderName}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Account Number</Text>
                <Text style={styles.infoValue}>
                  {user.bankAccount.accountNumber}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>IFSC Code</Text>
                <Text style={styles.infoValue}>{user.bankAccount.ifsc}</Text>
              </View>
            </>
          ) : (
            <Text style={styles.noBankText}>No bank account linked yet.</Text>
          )}
        </View>

        {/* User Transaction Activity */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>
            User Activity Ledger ({userTransactions.length})
          </Text>
        </View>

        <View style={styles.transactionsContainer}>
          {userTransactions.length > 0 ? (
            userTransactions.map((item) => (
              <TransactionRow
                key={item.id}
                transaction={item}
                onPress={() =>
                  navigation.navigate('TransactionDetails', {
                    transactionId: item.id,
                  })
                }
              />
            ))
          ) : (
            <Text style={styles.noTxnText}>No activity recorded for this user.</Text>
          )}
        </View>
      </View>

      {/* Block Confirmation Modal */}
      <ConfirmationModal
        visible={blockModalVisible}
        title={user.status === 'active' ? 'Block User Account?' : 'Unblock User Account?'}
        message={
          user.status === 'active'
            ? `Blocking ${user.name} will prevent them from signing in or placing deposit and withdrawal requests.`
            : `Unblocking ${user.name} will restore normal wallet access.`
        }
        confirmLabel={user.status === 'active' ? 'Yes, Block User' : 'Yes, Unblock'}
        variant={user.status === 'active' ? 'danger' : 'success'}
        icon={user.status === 'active' ? 'ban' : 'checkmark-circle'}
        onConfirm={handleToggleBlock}
        onCancel={() => setBlockModalVisible(false)}
      />

      {/* Edit User Modal */}
      <Modal visible={editModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Demo User</Text>

            <CustomInput
              label="Full Name"
              value={editName}
              onChangeText={setEditName}
            />
            <CustomInput
              label="Phone Number"
              value={editPhone}
              onChangeText={setEditPhone}
              keyboardType="phone-pad"
            />
            <CustomInput
              label="UPI ID"
              value={editUpi}
              onChangeText={setEditUpi}
              autoCapitalize="none"
            />

            <View style={styles.modalBtnRow}>
              <View style={{ flex: 1 }}>
                <SecondaryButton
                  title="Cancel"
                  onPress={() => setEditModalVisible(false)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton title="Save Changes" onPress={handleSaveEdit} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  editBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
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
  profileRow: {
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
  userInfoCol: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameText: {
    fontSize: 17,
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
  dateText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  actionRow: {
    marginTop: 14,
  },
  cardHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  balanceHighlight: {
    backgroundColor: colors.lightBlue,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginBottom: 14,
  },
  balanceHighlightLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  balanceHighlightValue: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 4,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  metricItem: {
    width: '47%',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: 10,
  },
  metricItemLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  metricItemVal: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  bonusVal: {
    color: colors.warningDark,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  noBankText: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  sectionTitleRow: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  transactionsContainer: {
    marginTop: 4,
  },
  noTxnText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 20,
  },
  notFound: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 30, 66, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 380,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
});

export default UserDetailsScreen;

