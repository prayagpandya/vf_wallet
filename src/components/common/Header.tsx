import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { Logo } from './Logo';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  greeting?: string;
  userName?: string;
  showBack?: boolean;
  onBackPress?: () => void;
  showLogo?: boolean;
  showNotifications?: boolean;
  unreadCount?: number;
  onNotificationPress?: () => void;
  showProfile?: boolean;
  onProfilePress?: () => void;
  rightAction?: React.ReactNode;
  light?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  greeting,
  userName,
  showBack = false,
  onBackPress,
  showLogo = false,
  showNotifications = false,
  unreadCount = 0,
  onNotificationPress,
  showProfile = false,
  onProfilePress,
  rightAction,
  light = false,
}) => {
  const textColor = light ? colors.white : colors.text;
  const subtitleColor = light ? 'rgba(255,255,255,0.8)' : colors.textSecondary;
  const iconColor = light ? colors.white : colors.text;

  return (
    <View style={styles.container}>
      <View style={styles.leftContainer}>
        {showBack && (
          <TouchableOpacity
            style={[
              styles.iconBtn,
              {
                backgroundColor: light
                  ? 'rgba(255,255,255,0.2)'
                  : colors.lightBlue,
              },
            ]}
            onPress={onBackPress}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={iconColor} />
          </TouchableOpacity>
        )}

        {showLogo ? (
          <Logo size="sm" light={light} />
        ) : greeting ? (
          <View>
            <Text style={[styles.greetingText, { color: subtitleColor }]}>
              {greeting}
            </Text>
            {userName && (
              <Text style={[styles.userNameText, { color: textColor }]}>
                {userName} 👋
              </Text>
            )}
          </View>
        ) : (
          <View>
            {title && (
              <Text style={[styles.titleText, { color: textColor }]}>
                {title}
              </Text>
            )}
            {subtitle && (
              <Text style={[styles.subtitleText, { color: subtitleColor }]}>
                {subtitle}
              </Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.rightContainer}>
        {rightAction}

        {showNotifications && (
          <TouchableOpacity
            style={[
              styles.iconBtn,
              {
                backgroundColor: light
                  ? 'rgba(255,255,255,0.2)'
                  : colors.lightBlue,
              },
            ]}
            onPress={onNotificationPress}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={20} color={iconColor} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {showProfile && (
          <TouchableOpacity
            style={[
              styles.iconBtn,
              {
                backgroundColor: light
                  ? 'rgba(255,255,255,0.2)'
                  : colors.lightBlue,
                marginLeft: 8,
              },
            ]}
            onPress={onProfilePress}
            activeOpacity={0.7}
          >
            <Ionicons name="person-outline" size={20} color={iconColor} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginRight: 8,
  },
  greetingText: {
    fontSize: 13,
    fontWeight: '500',
  },
  userNameText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitleText: {
    fontSize: 12,
    marginTop: 2,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: colors.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.white,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
});

export default Header;

