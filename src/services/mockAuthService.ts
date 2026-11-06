import { AuthUser, User, AdminUser } from '../types';
import { INITIAL_MOCK_ADMINS } from '../data/mockAdmins';
import { storageService } from './storageService';
import { generateUserId } from '../utils/calculations';

/**
 * MOCK AUTHENTICATION SERVICE
 *
 * NOTE: This is for local prototype and UI demo purposes ONLY.
 * In production, this service must be replaced with a secure backend API,
 * token-based authentication (JWT/OAuth), and hashed password verification.
 */
export const mockAuthService = {
  /**
   * Logs in a User using email or mobile number and any non-empty password.
   */
  async loginUser(
    identifier: string,
    password?: string
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    const trimmed = identifier.trim().toLowerCase();

    if (!trimmed) {
      return { success: false, error: 'Please enter your email or mobile number.' };
    }
    if (!password || password.trim() === '') {
      return { success: false, error: 'Password cannot be empty in demo mode.' };
    }

    const users = await storageService.getUsers();
    const cleanDigits = trimmed.replace(/[^0-9]/g, '');

    const foundUser = users.find(
      (u) =>
        u.email.toLowerCase() === trimmed ||
        (cleanDigits.length >= 10 && u.phone.includes(cleanDigits))
    );

    if (!foundUser) {
      return {
        success: false,
        error:
          'No demo user found with these credentials. Try demo user: aditya@example.com / 9820123456 or sign up.',
      };
    }

    if (foundUser.status === 'blocked') {
      return {
        success: false,
        error:
          'Your account has been suspended by an administrator. Please contact support.',
      };
    }

    await storageService.setAuthUser(foundUser);
    return { success: true, user: foundUser };
  },

  /**
   * Logs in an Admin using admin email or mobile and any non-empty password.
   */
  async loginAdmin(
    identifier: string,
    password?: string
  ): Promise<{ success: boolean; admin?: AdminUser; error?: string }> {
    const trimmed = identifier.trim().toLowerCase();

    if (!trimmed) {
      return { success: false, error: 'Please enter admin email or mobile number.' };
    }
    if (!password || password.trim() === '') {
      return { success: false, error: 'Admin password cannot be empty.' };
    }

    const cleanDigits = trimmed.replace(/[^0-9]/g, '');

    const foundAdmin = INITIAL_MOCK_ADMINS.find(
      (a) =>
        a.email.toLowerCase() === trimmed ||
        (cleanDigits.length >= 10 && a.phone.includes(cleanDigits))
    );

    if (!foundAdmin) {
      return {
        success: false,
        error:
          'Invalid admin account. Supported demo admins:\n• admin@vfwallet.com\n• ops@vfwallet.com\n• finance@vfwallet.com\n• compliance@vfwallet.com',
      };
    }

    await storageService.setAuthUser(foundAdmin);
    return { success: true, admin: foundAdmin };
  },

  /**
   * Signs up a new demo user and persists them in local storage.
   */
  async signupUser(data: {
    name: string;
    email: string;
    phone: string;
    password?: string;
    upiId?: string;
  }): Promise<{ success: boolean; user?: User; error?: string }> {
    if (!data.name.trim()) {
      return { success: false, error: 'Please enter your full name.' };
    }
    if (!data.email.trim()) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!data.phone.trim()) {
      return { success: false, error: 'Please enter a valid mobile number.' };
    }

    const users = await storageService.getUsers();
    const emailExists = users.some(
      (u) => u.email.toLowerCase() === data.email.trim().toLowerCase()
    );
    if (emailExists) {
      return {
        success: false,
        error: 'An account with this email already exists.',
      };
    }

    const newUser: User = {
      id: generateUserId(users.length),
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone.trim(),
      role: 'user',
      status: 'active',
      createdAt: new Date().toISOString(),
      upiId: data.upiId?.trim() || `${data.name.toLowerCase().replace(/\s+/g, '')}@okaxis`,
      kycStatus: 'pending',
    };

    const updatedUsers = [newUser, ...users];
    await storageService.setUsers(updatedUsers);
    await storageService.setAuthUser(newUser);

    return { success: true, user: newUser };
  },

  /**
   * Retrieves currently logged in session user.
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    return await storageService.getAuthUser();
  },

  /**
   * Logs out current user.
   */
  async logout(): Promise<void> {
    await storageService.setAuthUser(null);
  },
};

