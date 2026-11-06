import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  User,
  Transaction,
  BonusConfig,
  AppNotification,
  AuthUser,
} from '../types';
import { STORAGE_KEYS, DEFAULT_BONUS_PERCENTAGE } from '../utils/constants';
import { INITIAL_MOCK_USERS } from '../data/mockUsers';
import { INITIAL_MOCK_TRANSACTIONS } from '../data/mockTransactions';

export const storageService = {
  /**
   * Initializes local demo storage with seed data if not present.
   */
  async initializeDefaults(): Promise<void> {
    try {
      const initialized = await AsyncStorage.getItem(
        STORAGE_KEYS.INITIALIZED + '_v2_zero_state'
      );
      if (!initialized) {
        await AsyncStorage.multiSet([
          [STORAGE_KEYS.USERS, JSON.stringify(INITIAL_MOCK_USERS)],
          [STORAGE_KEYS.TRANSACTIONS, JSON.stringify(INITIAL_MOCK_TRANSACTIONS)],
          [
            STORAGE_KEYS.BONUS_CONFIG,
            JSON.stringify({
              isEnabled: true,
              bonusPercentage: DEFAULT_BONUS_PERCENTAGE,
              updatedAt: new Date().toISOString(),
            } as BonusConfig),
          ],
          [
            STORAGE_KEYS.NOTIFICATIONS,
            JSON.stringify([
              {
                id: 'NOTIF-1',
                userId: 'all',
                title: 'Welcome to VF Wallet!',
                message:
                  'Share or select a payment screenshot to start earning 5% bonus on approved deposits.',
                type: 'bonus',
                read: false,
                createdAt: new Date().toISOString(),
              },
            ] as AppNotification[]),
          ],
          [STORAGE_KEYS.INITIALIZED, 'true'],
          [STORAGE_KEYS.INITIALIZED + '_v2_zero_state', 'true'],
        ]);
      }
    } catch (e) {
      console.error('Error initializing default storage:', e);
    }
  },

  async getAuthUser(): Promise<AuthUser | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_USER);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Error getting auth user:', e);
      return null;
    }
  },

  async setAuthUser(user: AuthUser | null): Promise<void> {
    try {
      if (user) {
        await AsyncStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(user));
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_USER);
      }
    } catch (e) {
      console.error('Error setting auth user:', e);
    }
  },

  async getUsers(): Promise<User[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.USERS);
      if (!data) {
        await this.setUsers(INITIAL_MOCK_USERS);
        return INITIAL_MOCK_USERS;
      }
      return JSON.parse(data);
    } catch (e) {
      console.error('Error getting users:', e);
      return INITIAL_MOCK_USERS;
    }
  },

  async setUsers(users: User[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    } catch (e) {
      console.error('Error saving users:', e);
    }
  },

  async getTransactions(): Promise<Transaction[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (!data) {
        await this.setTransactions(INITIAL_MOCK_TRANSACTIONS);
        return INITIAL_MOCK_TRANSACTIONS;
      }
      return JSON.parse(data);
    } catch (e) {
      console.error('Error getting transactions:', e);
      return INITIAL_MOCK_TRANSACTIONS;
    }
  },

  async setTransactions(transactions: Transaction[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.TRANSACTIONS,
        JSON.stringify(transactions)
      );
    } catch (e) {
      console.error('Error saving transactions:', e);
    }
  },

  async getBonusConfig(): Promise<BonusConfig> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.BONUS_CONFIG);
      if (!data) {
        const defaultConfig: BonusConfig = {
          isEnabled: true,
          bonusPercentage: DEFAULT_BONUS_PERCENTAGE,
          updatedAt: new Date().toISOString(),
        };
        await this.setBonusConfig(defaultConfig);
        return defaultConfig;
      }
      return JSON.parse(data);
    } catch (e) {
      console.error('Error getting bonus config:', e);
      return {
        isEnabled: true,
        bonusPercentage: DEFAULT_BONUS_PERCENTAGE,
        updatedAt: new Date().toISOString(),
      };
    }
  },

  async setBonusConfig(config: BonusConfig): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.BONUS_CONFIG, JSON.stringify(config));
    } catch (e) {
      console.error('Error saving bonus config:', e);
    }
  },

  async getNotifications(): Promise<AppNotification[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error getting notifications:', e);
      return [];
    }
  },

  async setNotifications(notifications: AppNotification[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.NOTIFICATIONS,
        JSON.stringify(notifications)
      );
    } catch (e) {
      console.error('Error saving notifications:', e);
    }
  },

  /**
   * DANGEROUS: Clears all stored data and re-seeds pristine defaults.
   */
  async resetAllApplicationData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.AUTH_USER,
        STORAGE_KEYS.USERS,
        STORAGE_KEYS.TRANSACTIONS,
        STORAGE_KEYS.BONUS_CONFIG,
        STORAGE_KEYS.NOTIFICATIONS,
        STORAGE_KEYS.INITIALIZED,
      ]);
      // Re-seed defaults
      await this.initializeDefaults();
    } catch (e) {
      console.error('Error resetting application data:', e);
      throw e;
    }
  },
};

