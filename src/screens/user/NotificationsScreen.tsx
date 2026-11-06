import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { EmptyState } from '../../components/common/EmptyState';
import { useAuth } from '../../hooks/useAuth';
import { useWallet } from '../../hooks/useWallet';

export const NotificationsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { user } = useAuth();
  const { notifications, markNotificationAsRead } = useWallet();

  const userNotifications = notifications.filter(
    (n) => n.userId === user?.id || n.userId === 'all'
  );

  const getIconConfig = (type: string) => {
    switch (type) {
      case 'deposit':
        return { icon: 'arrow-down-circle' as const, color: colors.success, bg: colors.successLight };
      case 'withdrawal':
        return { icon: 'arrow-up-circle' as const, color: colors.danger, bg: colors.dangerLight };
      case 'bonus':
        return { icon: 'gift' as const, color: colors.warningDark, bg: colors.warningLight };
      default:
        return { icon: 'notifications' as const, color: colors.primary, bg: colors.lightBlue };
    }
  };

  const handleNotificationPress = async (notif: any) => {
    if (!notif.read) {
      await markNotificationAsRead(notif.id);
    }
    if (notif.relatedTransactionId) {
      navigation.navigate('TransactionDetails', {
        transactionId: notif.relatedTransactionId,
      });
    }
  };

  return (
    <ScreenContainer scrollable backgroundColor={colors.background}>
      <Header
        title="Notifications"
        subtitle="Recent wallet events & updates"
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.content}>
        {userNotifications.length > 0 ? (
          userNotifications.map((item) => {
            const iconConfig = getIconConfig(item.type);
            const dateStr = new Date(item.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.notifCard, !item.read && styles.unreadCard]}
                onPress={() => handleNotificationPress(item)}
                activeOpacity={0.7}
              >
                <View
                  style={[styles.iconCircle, { backgroundColor: iconConfig.bg }]}
                >
                  <Ionicons
                    name={iconConfig.icon}
                    size={22}
                    color={iconConfig.color}
                  />
                </View>

                <View style={styles.textContainer}>
                  <View style={styles.titleRow}>
                    <Text style={styles.titleText}>{item.title}</Text>
                    {!item.read && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.messageText}>{item.message}</Text>
                  <Text style={styles.timeText}>{dateStr}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <EmptyState
            icon="bell-outline"
            title="All caught up!"
            description="You have no notifications or transaction alerts at this time."
          />
        )}
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  notifCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  unreadCard: {
    backgroundColor: '#F7FAFF',
    borderColor: '#CCE0FF',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  messageText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 3,
  },
  timeText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 6,
  },
});

export default NotificationsScreen;

