# VF Wallet - Premium Mobile Fintech Wallet Application (OCR & Zero Transaction System)

**VF Wallet** is a production-grade mobile fintech wallet application developed with **React Native**, **Expo CLI (SDK 58)**, and **TypeScript**. It features a modern blue & white user interface, a centralized integer-paise wallet calculation engine, dual-role workflows (**User** and **Admin**), offline-first local state persistence via **AsyncStorage**, **On-Device OCR Text Recognition** using `@react-native-ml-kit/text-recognition`, **Android WhatsApp Share Intent** (`expo-share-intent`), and **SHA-256 Duplicate Prevention**.

---

## 🚀 Key Innovations & What's New

### 1. Pristine Zero Transaction Initial State
- **Zero Dummy Data**: When the app opens fresh, all wallet balances and metrics start strictly at **₹0**:
  - Available Balance = ₹0
  - Total Deposit = ₹0
  - Total Withdrawal = ₹0
  - Total Bonus = ₹0
  - Transaction Count = 0
  - Pending Deposits / Withdrawals = 0
- **Beautiful Empty States**: Friendly, encouraging empty states across User Dashboard, History, Admin Dashboard, Deposit Requests, and Withdrawal queues.

### 2. Automatic WhatsApp Image Sharing (Android Share Intent)
- Share payment screenshots directly from WhatsApp, Telegram, or Photos to **VF Wallet**.
- Configured with `ACTION_SEND` and `ACTION_SEND_MULTIPLE` intent filters with MIME type `image/*`.
- Automatically opens VF Wallet, reads the incoming image stream via `useShareIntentListener`, and launches the animated OCR screen.

### 3. Gallery 1-Tap Screenshot Selection (Zero Manual Typing)
- Users tap **Select Screenshot from Gallery** (supporting JPG, JPEG, PNG).
- No manual typing required for Amount, UTR, Date, Sender Name, or UPI ID.
- Missing or low-confidence fields show clean fallback ("Not detected") without inventing data.

### 4. On-Device OCR Text Recognition & Heuristic Extraction
- Powered natively by `@react-native-ml-kit/text-recognition` (Google ML Kit).
- Heuristic parsing for:
  - **Google Pay**
  - **PhonePe**
  - **Paytm**
  - **BHIM UPI & Banking IMPS/NEFT**
- Extracts 12 specific transaction attributes:
  1. Amount (Paise-level precision)
  2. Sender Name
  3. Receiver Name
  4. Date
  5. Time
  6. UTR Number (12-digit standard)
  7. UPI Reference Number
  8. Transaction ID
  9. Payment Status (Success / Completed / Failed)
  10. UPI ID
  11. Payment App Name
  12. Bank Reference Details

### 5. Duplicate Screenshot & Transaction Prevention
- **SHA-256 Image File Hash**: Calculates cryptographic digest (`expo-crypto`) of every uploaded screenshot.
- **UTR Uniqueness Engine**: Checks 12-digit UTR against active ledger transactions.
- Immediately blocks duplicate submissions with clear warnings:
  - *"This payment screenshot has already been submitted."*
  - *"This transaction reference (UTR) already exists."*

### 6. Admin Screenshot Verification & Bank Reconciliation Panel
- Dedicated Admin screen for OCR inspection.
- Zoomable high-resolution screenshot modal.
- Prominent security warnings reminding Admin to reconcile UTR with their merchant bank statement before approving.
- Single-click Approve / Reject with automatic bonus calculation.

---

## 📱 Tech Stack & Highlights

- **Framework**: React Native with Expo SDK 58 (TypeScript)
- **Navigation**: React Navigation v7 (Native Stack + Bottom Tabs)
- **Local Persistence**: AsyncStorage (Offline Demo State)
- **Styling & Theme**: Custom Fintech Design System (Primary `#1769E8`, Secondary `#0D47A1`, Background `#F5F8FF`)
- **Assets & Icons**: `@expo/vector-icons` (Ionicons, MaterialCommunityIcons), `expo-linear-gradient`
- **File & Media Handling**: `expo-image-picker`, `expo-sharing`, `expo-file-system`
- **Package ID**: `com.vfwallet.app`
- **Build System**: EAS Build (`preview` profile configured for `.apk` distribution)

---

## 🏗️ Folder Structure

```
d:/VF_Wallet/
├── App.tsx                        # Root Application Component
├── app.json                       # Expo Configuration & Android Package
├── eas.json                       # EAS Build Profile for Android APK
├── package.json                   # Dependencies & Scripts
├── tsconfig.json                  # TypeScript Compiler Configuration
└── src/
    ├── components/
    │   ├── buttons/
    │   │   ├── PrimaryButton.tsx  # Gradient primary button with loading state
    │   │   ├── SecondaryButton.tsx# Outlined / subtle button
    │   │   └── IconButton.tsx     # Reusable icon button
    │   ├── cards/
    │   │   ├── BalanceCard.tsx    # Premium wallet balance card with eye toggle
    │   │   ├── TransactionRow.tsx # Transaction history row card
    │   │   ├── StatCard.tsx       # Admin KPI statistic card
    │   │   └── UserCard.tsx       # Admin user management card
    │   ├── common/
    │   │   ├── Header.tsx         # Universal application header
    │   │   ├── Logo.tsx           # Brand icon and VF Wallet typography
    │   │   ├── StatusBadge.tsx    # Pending / Approved / Rejected pill badges
    │   │   ├── ScreenContainer.tsx# Safe-area view with pull-to-refresh
    │   │   └── EmptyState.tsx     # Friendly empty state placeholders
    │   ├── inputs/
    │   │   ├── CustomInput.tsx    # Styled input with show/hide password toggle
    │   │   └── AmountInput.tsx    # Large INR currency input with quick chips
    │   └── modals/
    │       ├── ConfirmationModal.tsx  # General action confirmation modal
    │       ├── ImageViewerModal.tsx   # Fullscreen payment screenshot viewer
    │       ├── RejectionModal.tsx     # Reason input modal for request rejections
    │       └── ResetDataModal.tsx     # Two-step danger confirmation modal
    ├── context/
    │   ├── AuthContext.tsx        # Authentication & Role State Management
    │   └── WalletContext.tsx      # Central Wallet State, Approvals & Ledger
    ├── data/
    │   ├── mockAdmins.ts          # 4 Demo Admin accounts
    │   ├── mockUsers.ts           # 10 Realistic Indian Demo user accounts
    │   └── mockTransactions.ts    # Seed deposits, withdrawals, and bonuses
    ├── hooks/
    │   ├── useAuth.ts             # Auth context consumer hook
    │   └── useWallet.ts           # Wallet context consumer hook
    ├── navigation/
    │   ├── AppNavigator.tsx       # Root role-based navigator
    │   ├── AuthNavigator.tsx      # Login, Signup, ForgotPassword, AdminLogin
    │   ├── UserNavigator.tsx      # Dashboard, History, Deposit, Profile
    │   └── AdminNavigator.tsx     # Overview, Users, Deposits, Withdrawals, Settings
    ├── screens/
    │   ├── admin/
    │   │   ├── AdminDashboard.tsx           # KPI metrics, liability & pending queues
    │   │   ├── AdminLoginScreen.tsx         # Dedicated admin sign-in with 1-tap fill
    │   │   ├── AdminProfileScreen.tsx       # Admin settings & session management
    │   │   ├── AdminTransactionHistory.tsx  # Master platform ledger
    │   │   ├── BonusSettingsScreen.tsx      # Cashback percentage & live simulator
    │   │   ├── DepositRequestsScreen.tsx    # Verify screenshots, approve & credit
    │   │   ├── ResetDataScreen.tsx          # Two-step verification demo data wipe
    │   │   ├── UserDetailsScreen.tsx        # Full profile, ledger, block/unblock
    │   │   ├── UsersScreen.tsx              # Search & filter registered users
    │   │   └── WithdrawalRequestsScreen.tsx # Balance verification & payout
    │   ├── auth/
    │   │   ├── ForgotPasswordScreen.tsx     # Demo OTP password reset
    │   │   ├── LoginScreen.tsx              # User login with 1-tap demo credentials
    │   │   └── SignupScreen.tsx             # New user registration
    │   └── user/
    │       ├── DepositScreen.tsx            # Amount input, UPI info, receipt upload
    │       ├── NotificationsScreen.tsx      # Real-time event notifications
    │       ├── SupportScreen.tsx            # FAQs & 24/7 support tickets
    │       ├── TransactionDetailsScreen.tsx # Receipt breakdown & receipt sharing
    │       ├── TransactionHistoryScreen.tsx # Multi-filter transaction search
    │       ├── UserDashboard.tsx            # Main wallet balance & quick actions
    │       ├── UserProfileScreen.tsx        # Profile info & bank channel view
    │       └── WithdrawScreen.tsx           # Balance validation & payout request
    ├── services/
    │   ├── mockAuthService.ts     # Demo authentication logic (pluggable API)
    │   ├── mockWalletService.ts   # Core business logic & storage coordinator
    │   └── storageService.ts      # AsyncStorage data layer & reset handler
    ├── theme/
    │   ├── colors.ts              # Theme palette (Primary, Secondary, Background)
    │   ├── spacing.ts             # Spacing, border radius & shadow tokens
    │   └── typography.ts          # Standard font sizes & weights
    ├── types/
    │   └── index.ts               # Complete TypeScript interfaces
    └── utils/
        ├── calculations.ts        # Central Wallet Calculation Engine
        ├── constants.ts           # App constants & storage keys
        ├── currency.ts            # Indian Rupee (INR) formatting & integer paise
        └── validation.ts          # Validation regexes (Email, Phone, UPI, IFSC)
```

---

## 🧮 Central Wallet Calculation Engine

All monetary amounts are strictly maintained in **integer paise** (1 Rupee = 100 paise) to eliminate floating-point arithmetic errors.

### Core Formula
$$\text{Total Deposit} = \sum \text{Approved Deposits}$$
$$\text{Bonus} = \frac{\text{Approved Deposit} \times \text{Locked Bonus Percentage}}{100}$$
$$\text{Total Credit} = \text{Total Deposit} + \text{Total Bonus}$$
$$\text{Total Withdrawal} = \sum \text{Approved Withdrawals}$$
$$\text{Available Balance} = \max(0, \text{Total Credit} - \text{Total Withdrawal})$$

### Core Rules
1. **Pending deposits** do not increment wallet balance until Admin approval.
2. **Pending withdrawals** do not deduct wallet balance until Admin approval.
3. **Rejected transactions** do not alter balance.
4. **Approved deposits** receive the snapshot bonus rate locked at request creation exactly once.
5. **Approved withdrawals** deduct the requested amount exactly once after re-validating the live balance.
6. **Bonus modifications** by Admin only apply to future deposits; past transactions retain historical bonus amounts.

---

## 🔑 Demo Login Credentials

### User Accounts
- **Aditya Sharma (Default Demo User)**:
  - Email: `aditya@example.com`
  - Phone: `9820123456`
  - Password: Any non-empty password (e.g. `demo123`)
  - Note: Tap the **DEMO** banner on the login screen for 1-tap auto-fill.

### Admin Accounts
Access via the **"Admin Portal 🛡️"** link on the login screen:
- **Super Administrator**: `admin@vfwallet.com` / `admin123`
- **Operations Head**: `ops@vfwallet.com` / `admin123`
- **Finance Manager**: `finance@vfwallet.com` / `admin123`
- **Compliance Officer**: `compliance@vfwallet.com` / `admin123`

---

## 🚀 Execution & APK Build Commands

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Expo Development Server
```bash
npm run start
# or
npx expo start
```

### 3. Run on Android Device / Emulator
```bash
npm run android
# or
npx expo run:android
```

### 4. Configure EAS Build
Install the EAS CLI globally (if not already installed) and log in to your Expo account:
```bash
npm install -g eas-cli
eas login
```

Initialize your project with EAS:
```bash
eas build:configure
```

### 5. Generate Standalone Android APK (.apk file)
Because `eas.json` is already configured with `"buildType": "apk"` in the `preview` profile, run:
```bash
eas build -p android --profile preview
```
*EAS will build the APK in the cloud and provide a direct download link for installing on any Android device.*

---

## ⚡ Resetting Demo Data
Admins can perform a factory reset of local state by navigating to:
**Admin Settings ➔ Reset Application Data (Danger Zone)**
The action requires typing **`RESET ALL`** to prevent accidental clicks. It clears all customized local records, restores original seed users and transactions, resets bonus settings to 5%, and logs out the current session.

