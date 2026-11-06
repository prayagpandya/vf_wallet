import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import {
  Transaction,
  User,
  UserWalletSummary,
  BonusConfig,
  AdminStats,
  AppNotification,
  BankAccount,
} from '../types';
import { mockWalletService } from '../services/mockWalletService';
import { storageService } from '../services/storageService';
import { useAuth } from './AuthContext';
import { DEFAULT_BONUS_PERCENTAGE } from '../utils/constants';

interface WalletContextType {
  transactions: Transaction[];
  users: User[];
  bonusConfig: BonusConfig;
  userWallet: UserWalletSummary | null;
  adminStats: AdminStats | null;
  notifications: AppNotification[];
  unreadNotificationCount: number;
  isBalanceHidden: boolean;
  toggleHideBalance: () => void;
  refreshData: () => Promise<void>;
  createDeposit: (params: {
    amountPaise: number;
    paymentMethod: string;
    upiId?: string;
    screenshotUri?: string;
    screenshotHash?: string;
    ocrResult?: import('../types').ExtractedPaymentDetails;
    ocrConfidence?: number;
    utrNumber?: string;
    senderName?: string;
    receiverName?: string;
    paymentAppName?: string;
    rawOcrText?: string;
    submissionSource?: 'gallery' | 'whatsapp_share' | 'manual';
    notes?: string;
  }) => Promise<{ success: boolean; transaction?: Transaction; error?: string }>;
  createWithdrawal: (params: {
    amountPaise: number;
    paymentMethod?: string;
    upiId?: string;
    bankDetails?: BankAccount;
    notes?: string;
  }) => Promise<{ success: boolean; transaction?: Transaction; error?: string }>;
  approveDeposit: (
    transactionId: string
  ) => Promise<{ success: boolean; error?: string }>;
  rejectDeposit: (
    transactionId: string,
    reason: string
  ) => Promise<{ success: boolean; error?: string }>;
  approveWithdrawal: (
    transactionId: string
  ) => Promise<{ success: boolean; error?: string }>;
  rejectWithdrawal: (
    transactionId: string,
    reason: string
  ) => Promise<{ success: boolean; error?: string }>;
  updateBonusConfig: (
    percentage: number,
    enabled: boolean
  ) => Promise<BonusConfig>;
  toggleUserBlock: (userId: string) => Promise<User>;
  updateUserProfile: (userId: string, updates: Partial<User>) => Promise<User>;
  resetAllData: () => Promise<void>;
  markNotificationAsRead: (notificationId: string) => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, logout } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [bonusConfig, setBonusConfig] = useState<BonusConfig>({
    isEnabled: true,
    bonusPercentage: DEFAULT_BONUS_PERCENTAGE,
    updatedAt: new Date().toISOString(),
  });
  const [userWallet, setUserWallet] = useState<UserWalletSummary | null>(null);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isBalanceHidden, setIsBalanceHidden] = useState<boolean>(false);

  const refreshData = useCallback(async () => {
    try {
      const [txns, allUsers, config, notifs] = await Promise.all([
        storageService.getTransactions(),
        storageService.getUsers(),
        storageService.getBonusConfig(),
        storageService.getNotifications(),
      ]);

      setTransactions(txns);
      setUsers(allUsers);
      setBonusConfig(config);
      setNotifications(notifs);

      if (user) {
        if (user.role === 'user') {
          const wallet = await mockWalletService.getUserWalletSummary(user.id);
          setUserWallet(wallet);
        } else if (user.role === 'admin') {
          const stats = await mockWalletService.getAdminStats();
          setAdminStats(stats);
        }
      }
    } catch (e) {
      console.error('Failed to load wallet context data:', e);
    }
  }, [user]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const toggleHideBalance = () => {
    setIsBalanceHidden((prev) => !prev);
  };

  const createDeposit = async (params: {
    amountPaise: number;
    paymentMethod: string;
    upiId?: string;
    screenshotUri?: string;
    screenshotHash?: string;
    ocrResult?: import('../types').ExtractedPaymentDetails;
    ocrConfidence?: number;
    utrNumber?: string;
    senderName?: string;
    receiverName?: string;
    paymentAppName?: string;
    rawOcrText?: string;
    submissionSource?: 'gallery' | 'whatsapp_share' | 'manual';
    notes?: string;
  }) => {
    if (!user) return { success: false, error: 'User not authenticated' };
    const res = await mockWalletService.createDepositRequest({
      userId: user.id,
      userName: user.name,
      userPhone: user.phone,
      ...params,
    });
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const createWithdrawal = async (params: {
    amountPaise: number;
    paymentMethod?: string;
    upiId?: string;
    bankDetails?: BankAccount;
    notes?: string;
  }) => {
    if (!user) return { success: false, error: 'User not authenticated' };
    const res = await mockWalletService.createWithdrawalRequest({
      userId: user.id,
      userName: user.name,
      userPhone: user.phone,
      ...params,
    });
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const approveDeposit = async (transactionId: string) => {
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'Only admins can approve deposits.' };
    }
    const res = await mockWalletService.approveDeposit(
      transactionId,
      user.id,
      user.name
    );
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const rejectDeposit = async (transactionId: string, reason: string) => {
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'Only admins can reject deposits.' };
    }
    const res = await mockWalletService.rejectDeposit(
      transactionId,
      reason,
      user.id,
      user.name
    );
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const approveWithdrawal = async (transactionId: string) => {
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'Only admins can approve withdrawals.' };
    }
    const res = await mockWalletService.approveWithdrawal(
      transactionId,
      user.id,
      user.name
    );
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const rejectWithdrawal = async (transactionId: string, reason: string) => {
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'Only admins can reject withdrawals.' };
    }
    const res = await mockWalletService.rejectWithdrawal(
      transactionId,
      reason,
      user.id,
      user.name
    );
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const updateBonusConfig = async (percentage: number, enabled: boolean) => {
    const updated = await mockWalletService.updateBonusConfig(
      percentage,
      enabled,
      user?.name
    );
    setBonusConfig(updated);
    return updated;
  };

  const toggleUserBlock = async (userId: string) => {
    const updated = await mockWalletService.toggleUserBlockStatus(userId);
    await refreshData();
    return updated;
  };

  const updateUserProfile = async (userId: string, updates: Partial<User>) => {
    const updated = await mockWalletService.updateUserProfile(userId, updates);
    await refreshData();
    return updated;
  };

  const resetAllData = async () => {
    await mockWalletService.resetAllApplicationData();
    await logout();
    await refreshData();
  };

  const markNotificationAsRead = async (notificationId: string) => {
    const current = await storageService.getNotifications();
    const updated = current.map((n) =>
      n.id === notificationId ? { ...n, read: true } : n
    );
    await storageService.setNotifications(updated);
    setNotifications(updated);
  };

  const unreadNotificationCount = notifications.filter(
    (n) => !n.read && (n.userId === user?.id || n.userId === 'all')
  ).length;

  return (
    <WalletContext.Provider
      value={{
        transactions,
        users,
        bonusConfig,
        userWallet,
        adminStats,
        notifications,
        unreadNotificationCount,
        isBalanceHidden,
        toggleHideBalance,
        refreshData,
        createDeposit,
        createWithdrawal,
        approveDeposit,
        rejectDeposit,
        approveWithdrawal,
        rejectWithdrawal,
        updateBonusConfig,
        toggleUserBlock,
        updateUserProfile,
        resetAllData,
        markNotificationAsRead,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

