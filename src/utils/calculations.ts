import { Transaction, User, UserWalletSummary, AdminStats } from '../types';
import { formatPaiseToINR } from './currency';

/**
 * Calculates the bonus amount in integer paise for a given deposit.
 * Formula: Approved Deposit Amount × Bonus Percentage / 100
 */
export function calculateDepositBonus(
  depositAmountPaise: number,
  bonusPercentage: number
): number {
  if (depositAmountPaise <= 0 || bonusPercentage <= 0) return 0;
  // Calculate in integer paise using exact round
  return Math.round((depositAmountPaise * bonusPercentage) / 100);
}

/**
 * Computes expected deposit breakdown.
 */
export function calculateDepositPreview(
  depositAmountPaise: number,
  bonusPercentage: number
): {
  depositPaise: number;
  bonusPercentage: number;
  bonusPaise: number;
  totalCreditPaise: number;
} {
  const bonusPaise = calculateDepositBonus(depositAmountPaise, bonusPercentage);
  const totalCreditPaise = depositAmountPaise + bonusPaise;

  return {
    depositPaise: depositAmountPaise,
    bonusPercentage,
    bonusPaise,
    totalCreditPaise,
  };
}

/**
 * CENTRAL WALLET CALCULATION ENGINE
 *
 * Implements strict rules:
 * - Pending deposits do NOT count.
 * - Rejected deposits do NOT count.
 * - Pending withdrawals do NOT reduce balance.
 * - Rejected withdrawals do NOT reduce balance.
 * - Approved withdrawals reduce balance exactly once.
 * - Approved deposits receive their configured bonus exactly once.
 * - Never apply bonus twice to the same deposit.
 * - Balance cannot drop below zero.
 */
export function calculateUserWallet(
  userId: string,
  transactions: Transaction[]
): UserWalletSummary {
  const userTxns = transactions.filter((t) => t.userId === userId);

  let totalDepositPaise = 0;
  let totalBonusPaise = 0;
  let totalWithdrawalPaise = 0;
  let pendingDepositCount = 0;
  let pendingWithdrawalCount = 0;

  for (const txn of userTxns) {
    if (txn.type === 'deposit') {
      if (txn.status === 'approved') {
        totalDepositPaise += txn.amountPaise;

        // Use the snapshot bonusPaise recorded when the deposit was approved or created
        const bonus =
          txn.bonusPaise !== undefined
            ? txn.bonusPaise
            : calculateDepositBonus(txn.amountPaise, txn.bonusPercentage || 0);
        totalBonusPaise += bonus;
      } else if (txn.status === 'pending') {
        pendingDepositCount += 1;
      }
    } else if (txn.type === 'withdrawal') {
      if (txn.status === 'approved') {
        totalWithdrawalPaise += txn.amountPaise;
      } else if (txn.status === 'pending') {
        pendingWithdrawalCount += 1;
      }
    } else if (txn.type === 'bonus' && txn.status === 'approved') {
      // Standalone bonus transaction if any
      totalBonusPaise += txn.amountPaise;
    }
  }

  const totalCreditPaise = totalDepositPaise + totalBonusPaise;
  const availableBalancePaise = Math.max(0, totalCreditPaise - totalWithdrawalPaise);

  return {
    userId,
    totalDepositPaise,
    totalBonusPaise,
    totalCreditPaise,
    totalWithdrawalPaise,
    availableBalancePaise,
    pendingDepositCount,
    pendingWithdrawalCount,
  };
}

/**
 * Validates a withdrawal request against user's current available balance.
 */
export function validateWithdrawal(
  availableBalancePaise: number,
  requestedAmountPaise: number
): { isValid: boolean; error?: string } {
  if (isNaN(requestedAmountPaise) || requestedAmountPaise <= 0) {
    return {
      isValid: false,
      error: 'Please enter a valid withdrawal amount greater than ₹0.',
    };
  }

  if (requestedAmountPaise > availableBalancePaise) {
    return {
      isValid: false,
      error: `Withdrawal amount exceeds your available balance of ${formatPaiseToINR(
        availableBalancePaise
      )}.`,
    };
  }

  return { isValid: true };
}

/**
 * Validates a deposit amount.
 */
export function validateDeposit(
  depositAmountPaise: number,
  minDepositPaise: number = 10000 // default min ₹100
): { isValid: boolean; error?: string } {
  if (isNaN(depositAmountPaise) || depositAmountPaise <= 0) {
    return {
      isValid: false,
      error: 'Please enter a valid deposit amount greater than ₹0.',
    };
  }

  if (depositAmountPaise < minDepositPaise) {
    return {
      isValid: false,
      error: `Minimum deposit amount is ${formatPaiseToINR(minDepositPaise)}.`,
    };
  }

  return { isValid: true };
}

/**
 * Computes global statistics for the Admin Dashboard.
 */
export function calculateAdminStats(
  users: User[],
  transactions: Transaction[]
): AdminStats {
  let totalApprovedDepositsPaise = 0;
  let totalApprovedWithdrawalsPaise = 0;
  let totalBonusGivenPaise = 0;
  let pendingDepositRequestsCount = 0;
  let pendingWithdrawalRequestsCount = 0;

  for (const txn of transactions) {
    if (txn.status === 'approved') {
      if (txn.type === 'deposit') {
        totalApprovedDepositsPaise += txn.amountPaise;
        const bonus =
          txn.bonusPaise !== undefined
            ? txn.bonusPaise
            : calculateDepositBonus(txn.amountPaise, txn.bonusPercentage || 0);
        totalBonusGivenPaise += bonus;
      } else if (txn.type === 'withdrawal') {
        totalApprovedWithdrawalsPaise += txn.amountPaise;
      } else if (txn.type === 'bonus') {
        totalBonusGivenPaise += txn.amountPaise;
      }
    } else if (txn.status === 'pending') {
      if (txn.type === 'deposit') {
        pendingDepositRequestsCount += 1;
      } else if (txn.type === 'withdrawal') {
        pendingWithdrawalRequestsCount += 1;
      }
    }
  }

  // Calculate total wallet liability: sum of available balance of all users
  let totalWalletLiabilityPaise = 0;
  for (const user of users) {
    const summary = calculateUserWallet(user.id, transactions);
    totalWalletLiabilityPaise += summary.availableBalancePaise;
  }

  return {
    totalUsers: users.length,
    totalApprovedDepositsPaise,
    totalApprovedWithdrawalsPaise,
    totalBonusGivenPaise,
    totalWalletLiabilityPaise,
    pendingDepositRequestsCount,
    pendingWithdrawalRequestsCount,
  };
}

/**
 * Generates a unique transaction reference ID.
 * Format: TXN-YYYYMMDD-XXXX
 */
export function generateTransactionId(): string {
  const dateStr = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');
  const randomPart = Math.floor(1000 + Math.random() * 9000).toString();
  return `TXN-${dateStr}-${randomPart}`;
}

/**
 * Generates a unique user ID.
 * Format: USR-XXXX
 */
export function generateUserId(existingCount: number = 0): string {
  const num = 1000 + existingCount + 1;
  return `USR-${num}`;
}

