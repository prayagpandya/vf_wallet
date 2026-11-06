export const APP_NAME = 'VF Wallet';
export const APP_TAGLINE = 'Secure & Instant Mobile Wallet';
export const APP_VERSION = '1.0.0';

export const DEFAULT_BONUS_PERCENTAGE = 5;

export const DEMO_PAYMENT_INFO = {
  upiId: 'vfwallet@icici',
  merchantName: 'VF Wallet Solutions Pvt Ltd',
  bankName: 'ICICI Bank Ltd',
  accountNumber: '987654321098',
  ifsc: 'ICIC0001048',
  branch: 'BKC, Mumbai',
  accountType: 'Current Account',
};

export const QUICK_DEPOSIT_AMOUNTS = [1000, 5000, 10000, 25000, 50000];

export const QUICK_WITHDRAWAL_PERCENTAGES = [25, 50, 75, 100];

export const STORAGE_KEYS = {
  AUTH_USER: '@vf_wallet_auth_user',
  USERS: '@vf_wallet_users_list',
  TRANSACTIONS: '@vf_wallet_transactions_list',
  BONUS_CONFIG: '@vf_wallet_bonus_config',
  NOTIFICATIONS: '@vf_wallet_notifications_list',
  INITIALIZED: '@vf_wallet_has_initialized',
};

