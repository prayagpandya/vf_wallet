import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AuthUser,
  User,
  AdminUser,
  UserRole,
  EmployeePermissions,
  BankAccount,
} from '../types';
import { storageService } from '../services/storageService';
import { authApi, tokenStorage } from '../services/api';

const AUTH_MIGRATION_KEY = '@vf_wallet_staff_auth_v4_required';

const EMPTY_PERMISSIONS: EmployeePermissions = {
  canOcrUpload: false,
  canDeposit: false,
  canWithdraw: false,
  canSetBonus: false,
  canSetThreshold: false,
  canManageClients: true,
};

const FULL_PERMISSIONS: EmployeePermissions = {
  canOcrUpload: true,
  canDeposit: true,
  canWithdraw: true,
  canSetBonus: true,
  canSetThreshold: true,
  canManageClients: true,
};

interface AuthContextType {
  user: AuthUser | null;
  role: UserRole | null;
  isSuperAdmin: boolean;
  permissions: EmployeePermissions;
  isLoading: boolean;
  loginStaff: (
    identifier: string,
    password?: string
  ) => Promise<{ success: boolean; error?: string }>;
  loginUser: (
    identifier: string,
    password?: string
  ) => Promise<{ success: boolean; error?: string }>;
  loginAdmin: (
    identifier: string,
    password?: string
  ) => Promise<{ success: boolean; error?: string }>;
  signup: (data: {
    name: string;
    email: string;
    phone: string;
    password?: string;
    upiId?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  switchUser: (targetUser: AuthUser) => Promise<void>;
  refreshSession: () => Promise<void>;
  updateProfile: (data: {
    name?: string;
    email?: string;
    phone?: string;
    upiId?: string;
    bankAccount?: BankAccount | null;
    avatarUrl?: string;
  }) => Promise<{ success: boolean; user?: AuthUser; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const normalizePermissions = (
  isSuper: boolean,
  raw?: any
): EmployeePermissions => {
  if (isSuper) return { ...FULL_PERMISSIONS };
  if (!raw || typeof raw !== 'object') return { ...EMPTY_PERMISSIONS };
  return {
    canOcrUpload: Boolean(raw.canOcrUpload),
    canDeposit: Boolean(raw.canDeposit),
    canWithdraw: Boolean(raw.canWithdraw),
    canSetBonus: Boolean(raw.canSetBonus),
    canSetThreshold: Boolean(raw.canSetThreshold),
    canManageClients: true, // All staff and superadmin can view and manage clients
  };
};

// Normalizes backend SUPER_ADMIN / ADMIN / EMPLOYEE into frontend Staff AuthUser
const mapBackendUserToAuthUser = (backendUser: any): AuthUser => {
  const isSuper =
    backendUser.role === 'SUPER_ADMIN' ||
    backendUser.role === 'ADMIN' ||
    backendUser.isSuperAdmin === true;

  const isStaff = isSuper || backendUser.role === 'EMPLOYEE';

  if (isStaff) {
    const staff: AdminUser = {
      id: backendUser.id,
      name: backendUser.name,
      email: backendUser.email || `${backendUser.phone}@vfwallet.local`,
      phone: backendUser.phone,
      role: 'admin',
      accountType: isSuper ? 'SUPER_ADMIN' : 'EMPLOYEE',
      isSuperAdmin: isSuper,
      permissions: normalizePermissions(isSuper, backendUser.permissions),
      adminRoleTitle: isSuper ? 'Super Administrator' : 'Employee',
      avatarUrl: backendUser.avatarUrl || undefined,
    };
    return staff;
  }

  const client: User = {
    id: backendUser.id,
    name: backendUser.name,
    email: backendUser.email || `${backendUser.phone}@vfwallet.local`,
    phone: backendUser.phone,
    role: 'user',
    accountType: 'CLIENT',
    isSuperAdmin: false,
    permissions: { ...EMPTY_PERMISSIONS },
    status: backendUser.isBlocked ? 'blocked' : 'active',
    createdAt: backendUser.createdAt || new Date().toISOString(),
    bonusPercentage: backendUser.bonusPercentage,
    totalBalancePaise: backendUser.totalBalancePaise || 0,
    activeBonusPaise: backendUser.activeBonusPaise || 0,
    lastDepositAmountPaise: backendUser.lastDepositAmountPaise || 0,
    cycleWithdrawnPaise: backendUser.cycleWithdrawnPaise || 0,
    isBonusDeductedInCycle: Boolean(backendUser.isBonusDeductedInCycle),
    lastLatitude: backendUser.lastLatitude ?? null,
    lastLongitude: backendUser.lastLongitude ?? null,
    lastLocationUpdatedAt: backendUser.lastLocationUpdatedAt ?? null,
    upiId: backendUser.upiId || undefined,
    bankAccount:
      backendUser.bankAccount ||
      (backendUser.bankAccountNumber
        ? {
            accountNumber: backendUser.bankAccountNumber,
            ifsc: backendUser.bankIfsc || '',
            bankName: backendUser.bankName || '',
            accountHolderName:
              backendUser.bankAccountHolderName || backendUser.name,
          }
        : undefined),
    avatarUrl: backendUser.avatarUrl,
    kycStatus: backendUser.kycStatus || 'verified',
  };
  return client;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const initAuth = async () => {
    try {
      await storageService.initializeDefaults();

      // One-time clean session reset so fresh/migrated installs ALWAYS require manual login first
      const migrated = await AsyncStorage.getItem(AUTH_MIGRATION_KEY);
      if (!migrated) {
        await tokenStorage.clearToken();
        await storageService.setAuthUser(null);
        await AsyncStorage.setItem(AUTH_MIGRATION_KEY, 'true');
        setUser(null);
        return;
      }

      const token = await tokenStorage.getToken();

      // Strict check: NO token means NOT logged in — never auto-login from stale cache
      if (!token) {
        await storageService.setAuthUser(null);
        setUser(null);
        return;
      }

      // Verify existing persistent JWT session with live backend
      const res = await authApi.getMe();
      if (res.success && res.user) {
        const authUser = mapBackendUserToAuthUser(res.user);
        setUser(authUser);
        await storageService.setAuthUser(authUser);
        return;
      }

      if (!res.isNetworkError && (res.status === 401 || res.status === 403)) {
        // Token expired or invalid -> force re-login
        await tokenStorage.clearToken();
        await storageService.setAuthUser(null);
        setUser(null);
        return;
      }

      // Network temporarily offline, but user has a valid persisted JWT -> keep session active
      const storedUser = await storageService.getAuthUser();
      setUser(storedUser);
    } catch (e) {
      console.error('Failed to init auth context:', e);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initAuth();
  }, []);

  /**
   * Unified Staff Login (Super Admin & Employees ONLY).
   * Clients do not have login access.
   */
  const loginStaff = async (identifier: string, password?: string) => {
    setIsLoading(true);
    try {
      const res = await authApi.login(identifier, password);

      if (res.success && res.token && res.user) {
        const isStaff =
          res.user.role === 'SUPER_ADMIN' ||
          res.user.role === 'ADMIN' ||
          res.user.role === 'EMPLOYEE';

        if (!isStaff) {
          return {
            success: false,
            error:
              'Client accounts do not have login access. Only Super Admin and Employees can sign in.',
          };
        }

        await tokenStorage.setToken(res.token);
        const authStaff = mapBackendUserToAuthUser(res.user);
        await storageService.setAuthUser(authStaff);
        setUser(authStaff);
        return { success: true };
      }

      return {
        success: false,
        error: res.error || 'Invalid phone/email or password.',
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Unable to connect to authentication server.',
      };
    } finally {
      setIsLoading(false);
    }
  };

  const loginUser = loginStaff;
  const loginAdmin = loginStaff;

  const signup = async () => {
    return {
      success: false,
      error:
        'Public signup is disabled. Please ask Super Admin to create your Employee account.',
    };
  };

  const logout = async () => {
    await tokenStorage.clearToken();
    await storageService.setAuthUser(null);
    setUser(null);
  };

  const switchUser = async (targetUser: AuthUser) => {
    await storageService.setAuthUser(targetUser);
    setUser(targetUser);
  };

  const refreshSession = async () => {
    try {
      const res = await authApi.getMe();
      if (res.success && res.user) {
        const authUser = mapBackendUserToAuthUser(res.user);
        await storageService.setAuthUser(authUser);
        setUser(authUser);
        return;
      }
    } catch (e) {
      console.warn('Could not refresh session from API:', e);
    }
  };

  const updateProfile = async (data: {
    name?: string;
    email?: string;
    phone?: string;
    upiId?: string;
    bankAccount?: BankAccount | null;
    avatarUrl?: string;
  }) => {
    try {
      const res = await authApi.updateProfile(data);
      if (res.success && res.user) {
        const updatedAuthUser = mapBackendUserToAuthUser(res.user);
        await storageService.setAuthUser(updatedAuthUser);
        setUser(updatedAuthUser);
        return { success: true, user: updatedAuthUser };
      }

      return {
        success: false,
        error: res.error || 'Failed to update profile.',
      };
    } catch (e: any) {
      console.error('Update profile error:', e);
      return {
        success: false,
        error: e?.message || 'Failed to update profile.',
      };
    }
  };

  const role = user ? user.role : null;
  const isSuperAdmin = Boolean(
    user && ((user as AdminUser).isSuperAdmin || (user as AdminUser).accountType === 'SUPER_ADMIN')
  );
  const permissions: EmployeePermissions = isSuperAdmin
    ? { ...FULL_PERMISSIONS }
    : normalizePermissions(false, (user as AdminUser)?.permissions);

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isSuperAdmin,
        permissions,
        isLoading,
        loginStaff,
        loginUser,
        loginAdmin,
        signup,
        logout,
        switchUser,
        refreshSession,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
