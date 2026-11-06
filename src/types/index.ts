export type UserRole = 'user' | 'admin';

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
  status: UserStatus;
  createdAt: string;
  upiId?: string;
  bankAccount?: BankAccount;
  avatarUrl?: string;
  kycStatus?: 'verified' | 'pending' | 'unverified';
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'admin';
  adminRoleTitle: string; // e.g., 'Super Admin', 'Finance Manager'
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
  totalCreditPaise?: number; // amountPaise + bonusPaise for deposit
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
}

export interface BonusConfig {
  isEnabled: boolean;
  bonusPercentage: number; // e.g., 5 for 5%
  updatedAt: string;
  updatedBy?: string;
}

export interface AdminStats {
  totalUsers: number;
  totalApprovedDepositsPaise: number;
  totalApprovedWithdrawalsPaise: number;
  totalBonusGivenPaise: number;
  totalWalletLiabilityPaise: number;
  pendingDepositRequestsCount: number;
  pendingWithdrawalRequestsCount: number;
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
