import {
  Transaction,
  UserWalletSummary,
  BonusConfig,
  AdminStats,
  User,
  BankAccount,
  AppNotification,
} from '../types';
import { storageService } from './storageService';
import {
  calculateUserWallet,
  calculateDepositBonus,
  calculateAdminStats,
  generateTransactionId,
  validateWithdrawal,
} from '../utils/calculations';
import { formatPaiseToINR } from '../utils/currency';

export const mockWalletService = {
  /**
   * Calculates the real-time wallet summary for a given user using the central engine.
   */
  async getUserWalletSummary(userId: string): Promise<UserWalletSummary> {
    const transactions = await storageService.getTransactions();
    return calculateUserWallet(userId, transactions);
  },

  /**
   * Retrieves all transactions in the system.
   */
  async getAllTransactions(): Promise<Transaction[]> {
    return await storageService.getTransactions();
  },

  /**
   * Retrieves transactions for a specific user, sorted newest first.
   */
  async getUserTransactions(userId: string): Promise<Transaction[]> {
    const all = await storageService.getTransactions();
    return all
      .filter((t) => t.userId === userId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  },

  /**
   * Gets a transaction by ID.
   */
  async getTransactionById(
    transactionId: string
  ): Promise<Transaction | undefined> {
    const all = await storageService.getTransactions();
    return all.find((t) => t.id === transactionId);
  },

  /**
   * Creates a new pending deposit request.
   * Locks the current bonus percentage at the time of request.
   * Validates duplicate screenshot hashes and UTR numbers.
   * Does NOT credit the wallet until approved.
   */
  async createDepositRequest(params: {
    userId: string;
    userName: string;
    userPhone: string;
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
  }): Promise<{ success: boolean; transaction?: Transaction; error?: string }> {
    if (params.amountPaise <= 0) {
      return { success: false, error: 'Deposit amount must be greater than ₹0.' };
    }

    const currentTxns = await storageService.getTransactions();

    // Check for duplicate screenshot or UTR
    if (params.screenshotHash || params.utrNumber) {
      if (params.screenshotHash) {
        const hashMatch = currentTxns.find(
          (t) => t.screenshotHash === params.screenshotHash
        );
        if (hashMatch) {
          return {
            success: false,
            error: 'This payment screenshot has already been submitted.',
          };
        }
      }

      if (params.utrNumber && params.utrNumber.trim()) {
        const utrMatch = currentTxns.find(
          (t) =>
            t.utrNumber === params.utrNumber?.trim() &&
            t.status !== 'rejected'
        );
        if (utrMatch) {
          return {
            success: false,
            error: 'This transaction reference already exists.',
          };
        }
      }
    }

    const bonusConfig = await storageService.getBonusConfig();
    const bonusRate = bonusConfig.isEnabled ? bonusConfig.bonusPercentage : 0;
    const bonusPaise = calculateDepositBonus(params.amountPaise, bonusRate);
    const totalCreditPaise = params.amountPaise + bonusPaise;

    const newTxn: Transaction = {
      id: generateTransactionId(),
      userId: params.userId,
      userName: params.userName,
      userPhone: params.userPhone,
      type: 'deposit',
      status: 'pending',
      amountPaise: params.amountPaise,
      bonusPercentage: bonusRate,
      bonusPaise,
      totalCreditPaise,
      paymentMethod: params.paymentMethod,
      upiId: params.upiId,
      screenshotUri: params.screenshotUri,
      screenshotHash: params.screenshotHash,
      ocrResult: params.ocrResult,
      ocrConfidence: params.ocrConfidence,
      utrNumber: params.utrNumber,
      senderName: params.senderName,
      receiverName: params.receiverName,
      paymentAppName: params.paymentAppName,
      rawOcrText: params.rawOcrText,
      submissionSource: params.submissionSource || 'gallery',
      createdAt: new Date().toISOString(),
      notes: params.notes,
    };

    const updatedTxns = [newTxn, ...currentTxns];
    await storageService.setTransactions(updatedTxns);

    // Add user notification
    const notifications = await storageService.getNotifications();
    const newNotif: AppNotification = {
      id: `NOTIF-${Date.now()}`,
      userId: params.userId,
      title: 'Deposit Request Submitted',
      message: `Your deposit of ${formatPaiseToINR(
        params.amountPaise
      )} (UTR: ${params.utrNumber || 'Pending'}) is submitted and awaiting admin verification.`,
      type: 'deposit',
      read: false,
      createdAt: new Date().toISOString(),
      relatedTransactionId: newTxn.id,
    };
    await storageService.setNotifications([newNotif, ...notifications]);

    return { success: true, transaction: newTxn };
  },

  /**
   * Creates a pending withdrawal request.
   * Validates available balance at request time.
   * Does NOT deduct balance until approved.
   */
  async createWithdrawalRequest(params: {
    userId: string;
    userName: string;
    userPhone: string;
    amountPaise: number;
    paymentMethod?: string;
    upiId?: string;
    bankDetails?: BankAccount;
    notes?: string;
  }): Promise<{ success: boolean; transaction?: Transaction; error?: string }> {
    const transactions = await storageService.getTransactions();
    const wallet = calculateUserWallet(params.userId, transactions);

    const validation = validateWithdrawal(
      wallet.availableBalancePaise,
      params.amountPaise
    );
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    const newTxn: Transaction = {
      id: generateTransactionId(),
      userId: params.userId,
      userName: params.userName,
      userPhone: params.userPhone,
      type: 'withdrawal',
      status: 'pending',
      amountPaise: params.amountPaise,
      paymentMethod: params.paymentMethod || 'Bank / UPI Payout',
      upiId: params.upiId,
      bankDetails: params.bankDetails,
      createdAt: new Date().toISOString(),
      notes: params.notes,
    };

    const updatedTxns = [newTxn, ...transactions];
    await storageService.setTransactions(updatedTxns);

    // Add user notification
    const notifications = await storageService.getNotifications();
    const newNotif: AppNotification = {
      id: `NOTIF-${Date.now()}`,
      userId: params.userId,
      title: 'Withdrawal Request Submitted',
      message: `Your withdrawal request of ${formatPaiseToINR(
        params.amountPaise
      )} is submitted and pending admin approval.`,
      type: 'withdrawal',
      read: false,
      createdAt: new Date().toISOString(),
      relatedTransactionId: newTxn.id,
    };
    await storageService.setNotifications([newNotif, ...notifications]);

    return { success: true, transaction: newTxn };
  },

  /**
   * Admin approves a deposit request.
   * Validates state, locks bonus exactly once, updates wallet.
   */
  async approveDeposit(
    transactionId: string,
    adminId: string,
    adminName: string
  ): Promise<{ success: boolean; error?: string }> {
    const transactions = await storageService.getTransactions();
    const txnIndex = transactions.findIndex((t) => t.id === transactionId);

    if (txnIndex === -1) {
      return { success: false, error: 'Transaction not found.' };
    }

    const txn = transactions[txnIndex];
    if (txn.status !== 'pending') {
      return {
        success: false,
        error: `Deposit has already been ${txn.status}. Duplicate actions are prohibited.`,
      };
    }

    // Retain snapshot bonus calculation recorded at request time
    const bonusPaise =
      txn.bonusPaise !== undefined
        ? txn.bonusPaise
        : calculateDepositBonus(txn.amountPaise, txn.bonusPercentage || 0);

    const updatedTxn: Transaction = {
      ...txn,
      status: 'approved',
      bonusPaise,
      totalCreditPaise: txn.amountPaise + bonusPaise,
      processedAt: new Date().toISOString(),
      processedBy: `${adminName} (${adminId})`,
    };

    transactions[txnIndex] = updatedTxn;
    await storageService.setTransactions([...transactions]);

    // Send user notification
    const notifications = await storageService.getNotifications();
    const notif: AppNotification = {
      id: `NOTIF-${Date.now()}`,
      userId: txn.userId,
      title: 'Deposit Approved! 🎉',
      message: `Deposit of ${formatPaiseToINR(
        txn.amountPaise
      )} and bonus of ${formatPaiseToINR(
        bonusPaise
      )} have been credited to your wallet.`,
      type: 'deposit',
      read: false,
      createdAt: new Date().toISOString(),
      relatedTransactionId: txn.id,
    };
    await storageService.setNotifications([notif, ...notifications]);

    return { success: true };
  },

  /**
   * Admin rejects a deposit request.
   */
  async rejectDeposit(
    transactionId: string,
    reason: string,
    adminId: string,
    adminName: string
  ): Promise<{ success: boolean; error?: string }> {
    const transactions = await storageService.getTransactions();
    const txnIndex = transactions.findIndex((t) => t.id === transactionId);

    if (txnIndex === -1) {
      return { success: false, error: 'Transaction not found.' };
    }

    const txn = transactions[txnIndex];
    if (txn.status !== 'pending') {
      return { success: false, error: `Transaction is already ${txn.status}.` };
    }

    const updatedTxn: Transaction = {
      ...txn,
      status: 'rejected',
      rejectionReason: reason || 'Deposit verification failed.',
      processedAt: new Date().toISOString(),
      processedBy: `${adminName} (${adminId})`,
    };

    transactions[txnIndex] = updatedTxn;
    await storageService.setTransactions([...transactions]);

    // Send notification
    const notifications = await storageService.getNotifications();
    const notif: AppNotification = {
      id: `NOTIF-${Date.now()}`,
      userId: txn.userId,
      title: 'Deposit Request Rejected',
      message: `Your deposit of ${formatPaiseToINR(
        txn.amountPaise
      )} was rejected. Reason: ${reason}`,
      type: 'deposit',
      read: false,
      createdAt: new Date().toISOString(),
      relatedTransactionId: txn.id,
    };
    await storageService.setNotifications([notif, ...notifications]);

    return { success: true };
  },

  /**
   * Admin approves a withdrawal request.
   * RE-VALIDATES available balance at time of approval.
   * Prevents balance from going negative.
   */
  async approveWithdrawal(
    transactionId: string,
    adminId: string,
    adminName: string
  ): Promise<{ success: boolean; error?: string }> {
    const transactions = await storageService.getTransactions();
    const txnIndex = transactions.findIndex((t) => t.id === transactionId);

    if (txnIndex === -1) {
      return { success: false, error: 'Transaction not found.' };
    }

    const txn = transactions[txnIndex];
    if (txn.status !== 'pending') {
      return {
        success: false,
        error: `Withdrawal has already been ${txn.status}. Duplicate approval is prevented.`,
      };
    }

    // Re-verify that user has enough balance RIGHT NOW
    const currentWallet = calculateUserWallet(txn.userId, transactions);
    if (txn.amountPaise > currentWallet.availableBalancePaise) {
      return {
        success: false,
        error: `Cannot approve withdrawal. User currently only has ${formatPaiseToINR(
          currentWallet.availableBalancePaise
        )} available balance.`,
      };
    }

    const updatedTxn: Transaction = {
      ...txn,
      status: 'approved',
      processedAt: new Date().toISOString(),
      processedBy: `${adminName} (${adminId})`,
    };

    transactions[txnIndex] = updatedTxn;
    await storageService.setTransactions([...transactions]);

    // Send notification
    const notifications = await storageService.getNotifications();
    const notif: AppNotification = {
      id: `NOTIF-${Date.now()}`,
      userId: txn.userId,
      title: 'Withdrawal Disbursed Successfully ✅',
      message: `Your withdrawal of ${formatPaiseToINR(
        txn.amountPaise
      )} has been approved and processed to your account.`,
      type: 'withdrawal',
      read: false,
      createdAt: new Date().toISOString(),
      relatedTransactionId: txn.id,
    };
    await storageService.setNotifications([notif, ...notifications]);

    return { success: true };
  },

  /**
   * Admin rejects a withdrawal request.
   */
  async rejectWithdrawal(
    transactionId: string,
    reason: string,
    adminId: string,
    adminName: string
  ): Promise<{ success: boolean; error?: string }> {
    const transactions = await storageService.getTransactions();
    const txnIndex = transactions.findIndex((t) => t.id === transactionId);

    if (txnIndex === -1) {
      return { success: false, error: 'Transaction not found.' };
    }

    const txn = transactions[txnIndex];
    if (txn.status !== 'pending') {
      return { success: false, error: `Transaction is already ${txn.status}.` };
    }

    const updatedTxn: Transaction = {
      ...txn,
      status: 'rejected',
      rejectionReason: reason || 'Withdrawal verification could not be completed.',
      processedAt: new Date().toISOString(),
      processedBy: `${adminName} (${adminId})`,
    };

    transactions[txnIndex] = updatedTxn;
    await storageService.setTransactions([...transactions]);

    // Send notification
    const notifications = await storageService.getNotifications();
    const notif: AppNotification = {
      id: `NOTIF-${Date.now()}`,
      userId: txn.userId,
      title: 'Withdrawal Request Rejected',
      message: `Your withdrawal request of ${formatPaiseToINR(
        txn.amountPaise
      )} was rejected. Reason: ${reason}`,
      type: 'withdrawal',
      read: false,
      createdAt: new Date().toISOString(),
      relatedTransactionId: txn.id,
    };
    await storageService.setNotifications([notif, ...notifications]);

    return { success: true };
  },

  /**
   * Retrieves active Bonus Configuration.
   */
  async getBonusConfig(): Promise<BonusConfig> {
    return await storageService.getBonusConfig();
  },

  /**
   * Updates Bonus percentage / status.
   * Only affects future deposit requests; does not alter historical approved bonuses.
   */
  async updateBonusConfig(
    newPercentage: number,
    isEnabled: boolean,
    adminName?: string
  ): Promise<BonusConfig> {
    const newConfig: BonusConfig = {
      isEnabled,
      bonusPercentage: Math.max(0, Math.min(100, newPercentage)),
      updatedAt: new Date().toISOString(),
      updatedBy: adminName || 'Admin',
    };
    await storageService.setBonusConfig(newConfig);
    return newConfig;
  },

  /**
   * Retrieves Admin Dashboard Metrics.
   */
  async getAdminStats(): Promise<AdminStats> {
    const users = await storageService.getUsers();
    const transactions = await storageService.getTransactions();
    return calculateAdminStats(users, transactions);
  },

  /**
   * Toggles user status between active and blocked.
   */
  async toggleUserBlockStatus(userId: string): Promise<User> {
    const users = await storageService.getUsers();
    const userIndex = users.findIndex((u) => u.id === userId);
    if (userIndex === -1) throw new Error('User not found');

    const currentUser = users[userIndex];
    const newStatus = currentUser.status === 'active' ? 'blocked' : 'active';
    const updatedUser: User = { ...currentUser, status: newStatus };

    users[userIndex] = updatedUser;
    await storageService.setUsers([...users]);
    return updatedUser;
  },

  /**
   * Updates demo user information.
   */
  async updateUserProfile(
    userId: string,
    updates: Partial<User>
  ): Promise<User> {
    const users = await storageService.getUsers();
    const userIndex = users.findIndex((u) => u.id === userId);
    if (userIndex === -1) throw new Error('User not found');

    const updatedUser: User = { ...users[userIndex], ...updates };
    users[userIndex] = updatedUser;
    await storageService.setUsers([...users]);

    // If current logged in user is this user, update session as well
    const authUser = await storageService.getAuthUser();
    if (authUser && authUser.id === userId) {
      await storageService.setAuthUser(updatedUser);
    }

    return updatedUser;
  },

  /**
   * Dangerous demo action: Resets all application data to seed state.
   */
  async resetAllApplicationData(): Promise<void> {
    await storageService.resetAllApplicationData();
  },
};

