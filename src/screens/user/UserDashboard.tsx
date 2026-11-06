import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { BalanceCard } from '../../components/cards/BalanceCard';
import { TransactionRow } from '../../components/cards/TransactionRow';
import { EmptyState } from '../../components/common/EmptyState';
import { useAuth } from '../../hooks/useAuth';
import { useWallet } from '../../hooks/useWallet';
import { useShareIntentListener } from '../../hooks/useShareIntentListener';

export const UserDashboard = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { user } = useAuth();
  const {
    userWallet,
    transactions,
    bonusConfig,
    isBalanceHidden,
    toggleHideBalance,
    unreadNotificationCount,
    refreshData,
  } = useWallet();

  const { sharedImage, clearSharedImage } = useShareIntentListener();

  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<
    'all' | 'deposit' | 'withdrawal' | 'bonus'
  >('all');

  // Automatic WhatsApp Share Intent Listener
  useEffect(() => {
    if (sharedImage && sharedImage.uri) {
      const uri = sharedImage.uri;
      clearSharedImage();
      navigation.navigate('OcrProcessing', {
        imageUri: uri,
        source: 'whatsapp_share',
      });
    }
  }, [sharedImage, clearSharedImage, navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
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
        navigation.navigate('OcrProcessing', {
          imageUri: result.assets[0].uri,
          source: 'gallery',
        });
      }
    } catch (e) {
      Alert.alert('Error', 'Could not open image picker.');
    }
  };

  const userTransactions = transactions
    .filter((t) => t.userId === user?.id)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  const filteredTxns = userTransactions.filter((t) => {
    if (filterType === 'all') return true;
    return t.type === filterType;
  });

  const recentTransactions = filteredTxns.slice(0, 5);

  return (
    <ScreenContainer
      scrollable
      refreshing={refreshing}
      onRefresh={onRefresh}
      backgroundColor={colors.background}
    >
      {/* Top Header */}
      <Header
        greeting="Welcome to VF Wallet,"
        userName={user?.name || 'User'}
        showNotifications
        unreadCount={unreadNotificationCount}
        onNotificationPress={() => navigation.navigate('Notifications')}
        showProfile
        onProfilePress={() => navigation.navigate('UserProfile')}
      />

      {/* Main Balance Card (Starts at ₹0 Zero State) */}
      <BalanceCard
        wallet={userWallet}
        isBalanceHidden={isBalanceHidden}
        onToggleHideBalance={toggleHideBalance}
        onDepositPress={() => navigation.navigate('Deposit')}
        onWithdrawPress={() => navigation.navigate('Withdraw')}
        bonusRate={bonusConfig.isEnabled ? bonusConfig.bonusPercentage : 0}
      />

      {/* Quick Action OCR Banner */}
      <View style={styles.ocrActionCard}>
        <View style={styles.ocrActionLeft}>
          <View style={styles.ocrIconCircle}>
            <Ionicons name="scan" size={20} color={colors.primary} />
          </View>
          <View style={styles.ocrTextCol}>
            <Text style={styles.ocrActionTitle}>Instant Screenshot OCR</Text>
            <Text style={styles.ocrActionSub}>
              Share from WhatsApp or pick from Gallery
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.scanBtn}
          onPress={handlePickFromGallery}
          activeOpacity={0.8}
        >
          <Ionicons name="cloud-upload" size={14} color={colors.white} />
          <Text style={styles.scanBtnText}>Upload</Text>
        </TouchableOpacity>
      </View>

      {/* Quick 5% Promo Notice */}
      <View style={styles.promoBanner}>
        <View style={styles.promoIconCircle}>
          <Ionicons name="sparkles" size={16} color="#B45309" />
        </View>
        <View style={styles.promoTextContainer}>
          <Text style={styles.promoTitle}>
            {bonusConfig.isEnabled
              ? `${bonusConfig.bonusPercentage}% Active Deposit Reward`
              : 'Zero Fee Transactions'}
          </Text>
          <Text style={styles.promoDesc}>
            Submit your Google Pay, PhonePe, or Paytm receipt for instant OCR
            recognition.
          </Text>
        </View>
      </View>

      {/* Transactions Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        {userTransactions.length > 0 && (
          <TouchableOpacity
            onPress={() => navigation.navigate('Transactions')}
            activeOpacity={0.7}
          >
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Transaction Category Filter Chips */}
      {userTransactions.length > 0 && (
        <View style={styles.filterRow}>
          {(['all', 'deposit', 'withdrawal', 'bonus'] as const).map((type) => {
            const isSelected = filterType === type;
            const labels = {
              all: 'All',
              deposit: 'Deposits',
              withdrawal: 'Withdrawals',
              bonus: 'Bonuses',
            };
            return (
              <TouchableOpacity
                key={type}
                style={[
                  styles.filterChip,
                  isSelected && styles.filterChipSelected,
                ]}
                onPress={() => setFilterType(type)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected && styles.filterChipTextSelected,
                  ]}
                >
                  {labels[type]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Transactions List or Zero-Transaction Empty State */}
      <View style={styles.transactionsContainer}>
        {recentTransactions.length > 0 ? (
          recentTransactions.map((item) => (
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
          <EmptyState
            icon="receipt-text-outline"
            title="No Transactions Yet"
            description="Your transactions will appear here once you share or upload a payment screenshot."
            actionLabel="Upload Payment Screenshot"
            onAction={handlePickFromGallery}
          />
        )}
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  ocrActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  ocrActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  ocrIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  ocrTextCol: {
    flex: 1,
  },
  ocrActionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  ocrActionSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 6,
  },
  scanBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  promoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  promoIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    marginTop: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  filterChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterChipTextSelected: {
    color: colors.white,
  },
  transactionsContainer: {
    paddingHorizontal: 16,
    marginTop: 4,
  },
});

export default UserDashboard;
