export type UserRole = 'user' | 'admin';

export type AccountType = 'CLIENT' | 'EMPLOYEE' | 'SUPER_ADMIN';

export interface EmployeePermissions {
  canOcrUpload: boolean;
  canDeposit: boolean;
  canWithdraw: boolean;
  canSetBonus: boolean;
  canSetThreshold?: boolean;
  canManageClients: boolean;
}

export type UserStatus = 'active' | 'blocked';

export interface BankAccount {
  accountNumber: string;
  ifsc: string;
  bankName: string;
  accountHolderName: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'user';
  accountType?: AccountType;
  isSuperAdmin?: boolean;
  permissions?: EmployeePermissions;
  status: UserStatus;
  createdAt: string;
  upiId?: string;
  bankAccount?: BankAccount;
  avatarUrl?: string;
  kycStatus?: 'verified' | 'pending' | 'unverified';
  bonusPercentage?: number;
  totalBalancePaise?: number;
  activeBonusPaise?: number;
  lastDepositAmountPaise?: number;
  cycleWithdrawnPaise?: number;
  isBonusDeductedInCycle?: boolean;
  totalDepositPrincipalPaise?: number;
  totalCashDepositedPaise?: number;
  totalPointsDepositedPaise?: number;
  totalPointsWithdrawnPaise?: number;
  totalCashWithdrawnPaise?: number;
  totalBonusDeductedPaise?: number;
  allocatedBonusPaise?: number;
  withdrawablePaise?: number;
  // Employee location tracking
  lastLatitude?: number | null;
  lastLongitude?: number | null;
  lastLocationAccuracy?: number | null;
  lastLocationAddress?: string | null;
  lastLocationUpdatedAt?: string | null;
  // Creator / Onboarding tracking (Which employee added this client)
  createdById?: string | null;
  createdByName?: string | null;
  createdByRole?: string | null;
  // Employee performance activity data
  employeeActivity?: EmployeeActivityData;
  // Legacy optional
  bonusThresholdLimitPaise?: number;
  isThresholdReached?: boolean;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'admin';
  accountType?: AccountType;
  isSuperAdmin?: boolean;
  permissions?: EmployeePermissions;
  adminRoleTitle: string; // e.g., 'Super Administrator', 'Employee'
  avatarUrl?: string;
}

export type AuthUser = (User | AdminUser) & { role: UserRole };

export type TransactionType = 'deposit' | 'withdrawal' | 'bonus';

export type TransactionStatus = 'pending' | 'approved' | 'rejected';

export interface ExtractedPaymentDetails {
  amountPaise: number | null; // Integer paise
  amountFormatted: string | null; // e.g. "₹10,000"
  senderName: string | null;
  receiverName: string | null;
  transactionDate: string | null;
  transactionTime: string | null;
  utrNumber: string | null;
  upiRefNumber: string | null;
  transactionId: string | null;
  paymentStatus: string | null;
  upiId: string | null;
  paymentAppName: string | null;
  bankDetails: string | null;
  ocrConfidence: number; // 0 to 100 percentage
  rawText: string;
  isComplete: boolean;
  missingFields: string[];
}

export interface Transaction {
  id: string; // e.g. TXN-100234
  userId: string;
  userName: string;
  userPhone: string;
  type: TransactionType;
  status: TransactionStatus;
  amountPaise: number; // Stored in integer paise to avoid floating-point issues
  bonusPercentage?: number; // Snapshot of bonus rate at deposit creation
  bonusPaise?: number; // Integer paise
  bonusDeductedPaise?: number; // Deducted bonus points on cycle withdrawal
  cashPaidPaise?: number; // Actual cash INR payout
  totalCreditPaise?: number; // amountPaise + bonusPaise for deposit
  withdrawablePaise?: number; // Withdrawable amount
  eligibleWithdrawablePaise?: number; // Calculated withdrawable real cash
  isThresholdReached?: boolean; // Legacy
  totalDepositPrincipalPaise?: number; // Total approved deposit principal
  userTotalBalancePaise?: number; // User total balance in paise
  userThresholdLimitPaise?: number; // Legacy
  paymentMethod?: string;
  upiId?: string;
  bankDetails?: BankAccount;
  screenshotUri?: string;
  screenshotHash?: string; // SHA-256 hash for duplicate screenshot detection
  ocrResult?: ExtractedPaymentDetails;
  ocrConfidence?: number;
  utrNumber?: string;
  senderName?: string;
  receiverName?: string;
  paymentAppName?: string;
  rawOcrText?: string;
  submissionSource?: 'gallery' | 'whatsapp_share' | 'manual';
  rejectionReason?: string;
  createdAt: string; // ISO string
  processedAt?: string; // ISO string
  processedBy?: string;
  notes?: string;
  isArchived?: boolean;
  archivedAt?: string;
  backupBatchId?: string;
}

export interface UserWalletSummary {
  userId: string;
  totalDepositPaise: number;
  totalBonusPaise: number;
  totalCreditPaise: number;
  totalWithdrawalPaise: number;
  availableBalancePaise: number;
  pendingDepositCount: number;
  pendingWithdrawalCount: number;
  // The 4 Core Metrics
  totalCashDepositedPaise?: number;
  totalCashDepositedRupees?: number;
  totalPointsDepositedPaise?: number;
  totalPointsDepositedPoints?: number;
  totalPointsWithdrawnPaise?: number;
  totalPointsWithdrawnPoints?: number;
  totalCashWithdrawnPaise?: number;
  totalCashWithdrawnRupees?: number;
  totalBonusDeductedPaise?: number;
  totalBonusDeductedRupees?: number;
  // Cycle metrics
  withdrawablePaise?: number;
  withdrawableRupees?: number;
  netCashIfFullCashoutPaise?: number;
  netCashIfFullCashoutRupees?: number;
  activeBonusPaise?: number;
  activeBonusRupees?: number;
  isBonusDeductedInCycle?: boolean;
  cycleWithdrawnPaise?: number;
  lastDepositAmountPaise?: number;
  isThresholdReached?: boolean;
  bonusThresholdLimitPaise?: number;
  bonusThresholdLimitRupees?: number;
}

export interface BonusConfig {
  isEnabled: boolean;
  bonusPercentage: number; // e.g., 5 for 5%
  updatedAt: string;
  updatedBy?: string;
}

export interface AdminStats {
  totalClients?: number;
  totalEmployees?: number;
  totalUsers: number;
  totalTransactionsCount?: number;
  // The 4 Core Metrics
  totalCashDepositedPaise: number;
  totalPointsDepositedPaise: number;
  totalPointsWithdrawnPaise: number;
  totalCashWithdrawnPaise: number;
  totalClientsPointsBalancePaise?: number;
  totalActiveBonusPaise?: number;
  totalBonusDeductedPaise?: number;
  totalApprovedDepositsPaise: number;
  totalApprovedWithdrawalsPaise: number;
  totalBonusGivenPaise: number;
  totalWalletLiabilityPaise?: number;
  pendingDepositRequestsCount?: number;
  pendingWithdrawalRequestsCount?: number;
}

export interface AppNotification {
  id: string;
  userId: string | 'all' | 'admin';
  title: string;
  message: string;
  type: 'deposit' | 'withdrawal' | 'bonus' | 'system' | 'security';
  read: boolean;
  createdAt: string;
  relatedTransactionId?: string;
}

export interface EmployeeActivityItem {
  id: string;
  name?: string;
  phone?: string;
  status?: string;
  createdAt: string;
  amountPaise?: number;
  bonusPaise?: number;
  cashPaidPaise?: number;
  utr?: string;
  paymentApp?: string;
  userId?: string;
  userName?: string;
  userPhone?: string;
  bonusPercentage?: number;
  totalBalancePaise?: number;
}

export interface EmployeeActivityData {
  clients: EmployeeActivityItem[];
  deposits: EmployeeActivityItem[];
  withdrawals: EmployeeActivityItem[];
  totalClientsAdded?: number;
  totalDepositsHandled?: number;
  totalWithdrawalsHandled?: number;
}

export interface BackupSnapshot {
  id: string;
  title: string;
  backupType: 'FULL_RESET' | 'SINGLE_TRANSACTION' | 'SINGLE_CLIENT';
  createdById: string;
  createdByName: string;
  createdAt: string;
  clientCount?: number;
  transactionCount: number;
  totalDepositPaise: number;
  totalWithdrawPaise: number;
  clientIds?: string[];
  transactionIds: string[];
  singleTransactionId?: string;
  singleClientId?: string;
  isRestored: boolean;
  restoredAt?: string | null;
  restoredById?: string | null;
  restoredByName?: string | null;
  canUndoUntil?: string | null;
  canUndo?: boolean;
  undoSecondsRemaining?: number;
  isPermanentlyDeleted: boolean;
  clients?: Array<{
    id: string;
    name: string;
    phone: string;
    email?: string | null;
    role?: string;
    totalBalancePaise?: number;
    activeBonusPaise?: number;
    bonusPercentage?: number;
    upiId?: string | null;
    bankAccountNumber?: string | null;
    bankIfsc?: string | null;
    bankName?: string | null;
    bankAccountHolderName?: string | null;
    createdAt?: string;
  }>;
  transactions?: any[];
}
