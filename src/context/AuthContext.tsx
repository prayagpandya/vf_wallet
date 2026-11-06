import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthUser, User, AdminUser, UserRole } from '../types';
import { mockAuthService } from '../services/mockAuthService';
import { storageService } from '../services/storageService';

interface AuthContextType {
  user: AuthUser | null;
  role: UserRole | null;
  isLoading: boolean;
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const initAuth = async () => {
    try {
      await storageService.initializeDefaults();
      const storedUser = await mockAuthService.getCurrentUser();
      setUser(storedUser);
    } catch (e) {
      console.error('Failed to init auth context:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initAuth();
  }, []);

  const loginUser = async (identifier: string, password?: string) => {
    setIsLoading(true);
    const res = await mockAuthService.loginUser(identifier, password);
    setIsLoading(false);
    if (res.success && res.user) {
      setUser(res.user);
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  const loginAdmin = async (identifier: string, password?: string) => {
    setIsLoading(true);
    const res = await mockAuthService.loginAdmin(identifier, password);
    setIsLoading(false);
    if (res.success && res.admin) {
      setUser(res.admin);
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  const signup = async (data: {
    name: string;
    email: string;
    phone: string;
    password?: string;
    upiId?: string;
  }) => {
    setIsLoading(true);
    const res = await mockAuthService.signupUser(data);
    setIsLoading(false);
    if (res.success && res.user) {
      setUser(res.user);
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  const logout = async () => {
    await mockAuthService.logout();
    setUser(null);
  };

  const switchUser = async (targetUser: AuthUser) => {
    await storageService.setAuthUser(targetUser);
    setUser(targetUser);
  };

  const refreshSession = async () => {
    const updated = await mockAuthService.getCurrentUser();
    setUser(updated);
  };

  const role = user ? user.role : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isLoading,
        loginUser,
        loginAdmin,
        signup,
        logout,
        switchUser,
        refreshSession,
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

