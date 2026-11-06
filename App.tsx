import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ShareIntentProvider } from 'expo-share-intent';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { AuthProvider } from './src/context/AuthContext';
import { WalletProvider } from './src/context/WalletContext';
import { AppNavigator } from './src/navigation/AppNavigator';

const isExpoGo =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ShareIntentProvider options={{ disabled: isExpoGo }}>
        <AuthProvider>
          <WalletProvider>
            <AppNavigator />
          </WalletProvider>
        </AuthProvider>
      </ShareIntentProvider>
    </SafeAreaProvider>
  );
}
