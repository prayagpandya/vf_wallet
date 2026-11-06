import React from 'react';
import { StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

import { AdminDashboard } from '../screens/admin/AdminDashboard';
import { UsersScreen } from '../screens/admin/UsersScreen';
import { UserDetailsScreen } from '../screens/admin/UserDetailsScreen';
import { DepositRequestsScreen } from '../screens/admin/DepositRequestsScreen';
import { WithdrawalRequestsScreen } from '../screens/admin/WithdrawalRequestsScreen';
import { BonusSettingsScreen } from '../screens/admin/BonusSettingsScreen';
import { AdminTransactionHistory } from '../screens/admin/AdminTransactionHistory';
import { AdminProfileScreen } from '../screens/admin/AdminProfileScreen';
import { ResetDataScreen } from '../screens/admin/ResetDataScreen';
import { ScreenshotVerificationScreen } from '../screens/admin/ScreenshotVerificationScreen';
import { TransactionDetailsScreen } from '../screens/user/TransactionDetailsScreen';

export type AdminStackParamList = {
  AdminTabs: undefined;
  UserDetails: { userId: string };
  BonusSettings: undefined;
  AdminTransactions: undefined;
  TransactionDetails: { transactionId: string };
  ResetData: undefined;
  ScreenshotVerification: undefined;
  DepositRequests: undefined;
  WithdrawalRequests: undefined;
  Users: undefined;
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<AdminStackParamList>();

const AdminTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.cardBorder,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 86 : 64,
          paddingBottom: Platform.OS === 'ios' ? 24 : 10,
          paddingTop: 8,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={AdminDashboard}
        options={{
          tabBarLabel: 'Overview',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'grid' : 'grid-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="ScreenshotVerificationTab"
        component={ScreenshotVerificationScreen}
        options={{
          tabBarLabel: 'OCR Verify',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'scan-circle' : 'scan-circle-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="DepositRequests"
        component={DepositRequestsScreen}
        options={{
          tabBarLabel: 'Deposits',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'arrow-down-circle' : 'arrow-down-circle-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="WithdrawalRequests"
        component={WithdrawalRequestsScreen}
        options={{
          tabBarLabel: 'Payouts',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'arrow-up-circle' : 'arrow-up-circle-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="AdminProfile"
        component={AdminProfileScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'settings' : 'settings-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export const AdminNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="AdminTabs" component={AdminTabNavigator} />
      <Stack.Screen name="ScreenshotVerification" component={ScreenshotVerificationScreen} />
      <Stack.Screen name="UserDetails" component={UserDetailsScreen} />
      <Stack.Screen name="BonusSettings" component={BonusSettingsScreen} />
      <Stack.Screen name="AdminTransactions" component={AdminTransactionHistory} />
      <Stack.Screen name="TransactionDetails" component={TransactionDetailsScreen} />
      <Stack.Screen name="ResetData" component={ResetDataScreen} />
      <Stack.Screen name="Users" component={UsersScreen} />
    </Stack.Navigator>
  );
};

export default AdminNavigator;
