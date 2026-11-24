import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuth } from '../hooks/useAuth';
import { useEmployeeLocationTracker } from '../hooks/useEmployeeLocationTracker';
import { getAdaptiveTabBarStyle } from '../utils/navigationBar';

import { AdminDashboard } from '../screens/admin/AdminDashboard';
import { UserManagementScreen } from '../screens/admin/UserManagementScreen';
import { UserDetailsScreen } from '../screens/admin/UserDetailsScreen';
import { ClientOcrDepositScreen } from '../screens/admin/ClientOcrDepositScreen';
import { ClientWithdrawScreen } from '../screens/admin/ClientWithdrawScreen';
import { BonusSettingsScreen } from '../screens/admin/BonusSettingsScreen';
import { AdminTransactionHistory } from '../screens/admin/AdminTransactionHistory';
import { AdminProfileScreen } from '../screens/admin/AdminProfileScreen';
import { ResetDataScreen } from '../screens/admin/ResetDataScreen';
import { BackupRestoreScreen } from '../screens/admin/BackupRestoreScreen';
import { TransactionDetailsScreen } from '../screens/user/TransactionDetailsScreen';

export type AdminStackParamList = {
  AdminTabs: undefined;
  AdminDashboard: undefined;
  UserDetails: { userId: string };
  Users: { initialTab?: 'CLIENT' | 'EMPLOYEE' } | undefined;
  ClientOcrDeposit:
    | {
        clientId?: string;
        initialMode?: 'ocr' | 'manual';
        imageUri?: string;
        source?: 'gallery' | 'whatsapp_share';
        sharedAt?: number;
      }
    | undefined;
  ClientWithdraw: { clientId?: string } | undefined;
  BonusSettings: undefined;
  AdminTransactions: undefined;
  TransactionDetails: { transactionId: string };
  ResetData: undefined;
  BackupRestore: undefined;
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<AdminStackParamList>();

const AdminTabNavigator = () => {
  const { isSuperAdmin, permissions } = useAuth();
  const insets = useSafeAreaInsets();
  const { tabBarStyle } = getAdaptiveTabBarStyle(insets);
  useEmployeeLocationTracker();

  const canViewClients =
    isSuperAdmin ||
    permissions.canManageClients ||
    permissions.canSetBonus;
  const canDeposit =
    isSuperAdmin || permissions.canOcrUpload || permissions.canDeposit;
  const canWithdraw = isSuperAdmin || permissions.canWithdraw;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle,
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

      {canViewClients && (
        <Tab.Screen
          name="ClientsTab"
          component={UserManagementScreen}
          options={{
            tabBarLabel: isSuperAdmin ? 'Accounts' : 'Clients',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'people' : 'people-outline'}
                size={22}
                color={color}
              />
            ),
          }}
        />
      )}

      {canDeposit && (
        <Tab.Screen
          name="OcrDepositTab"
          component={ClientOcrDepositScreen}
          options={{
            tabBarLabel: 'OCR Deposit',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'scan-circle' : 'scan-circle-outline'}
                size={24}
                color={color}
              />
            ),
          }}
        />
      )}

      {canWithdraw && (
        <Tab.Screen
          name="WithdrawTab"
          component={ClientWithdrawScreen}
          options={{
            tabBarLabel: 'Withdraw',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'arrow-up-circle' : 'arrow-up-circle-outline'}
                size={22}
                color={color}
              />
            ),
          }}
        />
      )}

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
      <Stack.Screen name="AdminDashboard" component={AdminTabNavigator} />
      <Stack.Screen name="Users" component={UserManagementScreen} />
      <Stack.Screen name="UserDetails" component={UserDetailsScreen} />
      <Stack.Screen name="ClientOcrDeposit" component={ClientOcrDepositScreen} />
      <Stack.Screen name="ClientWithdraw" component={ClientWithdrawScreen} />
      <Stack.Screen name="BonusSettings" component={BonusSettingsScreen} />
      <Stack.Screen name="AdminTransactions" component={AdminTransactionHistory} />
      <Stack.Screen name="TransactionDetails" component={TransactionDetailsScreen} />
      <Stack.Screen name="ResetData" component={ResetDataScreen} />
      <Stack.Screen name="BackupRestore" component={BackupRestoreScreen} />
    </Stack.Navigator>
  );
};

export default AdminNavigator;
