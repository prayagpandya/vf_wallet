import { Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma, { withDbRetry } from '../utils/prisma';
import { Role, TransactionStatus, TransactionType } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  resolveUserPermissions,
  isSuperAdminRole,
  isClientRole,
} from '../utils/permissions';
import { getRunningDailyBonusRate } from '../utils/dailyBonus';
import {
  createAppResetBackup,
  createSingleClientBackup,
  createSingleTransactionBackup,
  getAllBackupSnapshots,
  restoreBackupSnapshot,
  undoRestoreBackupSnapshot,
  deleteBackupPermanently,
} from '../utils/backupService';

interface UserAggregatedMetrics {
  totalCashDepositedPaise: number;
  totalPointsDepositedPaise: number;
  totalPointsWithdrawnPaise: number;
  totalCashWithdrawnPaise: number;
  totalBonusDeductedPaise: number;
}

const formatManagedUser = (
  user: any,
  totalDepositPrincipalPaise?: number,
  allocatedBonusPaise?: number,
  metrics?: UserAggregatedMetrics
) => {
  const cashDeposited = metrics?.totalCashDepositedPaise ?? (totalDepositPrincipalPaise ?? 0);
  const bonusEarned = allocatedBonusPaise ?? 0;
  const pointsDeposited = metrics?.totalPointsDepositedPaise ?? (cashDeposited + bonusEarned);
  const pointsWithdrawn = metrics?.totalPointsWithdrawnPaise ?? 0;
  const cashWithdrawn = metrics?.totalCashWithdrawnPaise ?? 0;
  const bonusDeducted = metrics?.totalBonusDeductedPaise ?? 0;

  const activeBonusPaise = user.activeBonusPaise || 0;
  const hasActiveBonus = activeBonusPaise > 0 && !user.isBonusDeductedInCycle;

  // Withdrawable points in cash:
  // If client has an active bonus not yet deducted, full cashout excludes active bonus
  const withdrawablePaise = hasActiveBonus
    ? Math.max(0, user.totalBalancePaise - activeBonusPaise)
    : user.totalBalancePaise;

  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    role: user.role,
    accountType: isSuperAdminRole(user.role)
      ? 'SUPER_ADMIN'
      : user.role === Role.EMPLOYEE
      ? 'EMPLOYEE'
      : 'CLIENT',
    isSuperAdmin: isSuperAdminRole(user.role),
    permissions: resolveUserPermissions(user.role, user.permissions),
    isBlocked: user.isBlocked,
    bonusPercentage: user.bonusPercentage,
    totalBalancePaise: user.totalBalancePaise,
    totalDepositPrincipalPaise: cashDeposited,
    // The 4 Core Client Metrics
    totalCashDepositedPaise: cashDeposited,
    totalPointsDepositedPaise: pointsDeposited,
    totalPointsWithdrawnPaise: pointsWithdrawn,
    totalCashWithdrawnPaise: cashWithdrawn,
    totalBonusDeductedPaise: bonusDeducted,
    activeBonusPaise,
    lastDepositAmountPaise: user.lastDepositAmountPaise || 0,
    cycleWithdrawnPaise: user.cycleWithdrawnPaise || 0,
    isBonusDeductedInCycle: Boolean(user.isBonusDeductedInCycle),
    withdrawablePaise,
    lastLatitude: user.lastLatitude || null,
    lastLongitude: user.lastLongitude || null,
    lastLocationAccuracy: user.lastLocationAccuracy || null,
    lastLocationAddress: user.lastLocationAddress || null,
    lastLocationUpdatedAt: user.lastLocationUpdatedAt || null,
    upiId: user.upiId || null,
    bankAccount: user.bankAccountNumber
      ? {
          accountNumber: user.bankAccountNumber,
          ifsc: user.bankIfsc || '',
          bankName: user.bankName || '',
          accountHolderName: user.bankAccountHolderName || user.name,
        }
      : null,
    avatarUrl: user.avatarUrl || null,
    createdById: user.createdById || null,
    createdByName: user.createdByName || null,
    createdByRole: user.createdByRole || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    ...(user._count ? { totalTransactions: user._count.transactions } : {}),
    ...(user.transactions ? { transactions: user.transactions } : {}),
  };
};

/**
 * POST /api/admin/users/create
 * Creates either a CLIENT (no login credentials required) or an EMPLOYEE (credentials + granular permissions).
 */
export const createUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    const {
      name,
      phone,
      email,
      password,
      userType,
      role,
      permissions,
      upiId,
      bankAccount,
      bonusPercentage,
    } = req.body;

    // Determine target role: CLIENT or EMPLOYEE
    const requestedType = String(userType || role || 'CLIENT').toUpperCase();
    const targetRole: Role =
      requestedType === 'EMPLOYEE' ? Role.EMPLOYEE : Role.CLIENT;

    // Authorization check
    if (targetRole === Role.EMPLOYEE) {
      if (!req.user.isSuperAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Only Super Admin can create Employee accounts.',
        });
      }
    } else {
      if (!req.user.isSuperAdmin && !req.user.permissions.canManageClients) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You do not have permission to create clients.',
        });
      }
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Full name is required.',
      });
    }

    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required.',
      });
    }

    // Employees MUST have a password; Clients do NOT need login credentials
    let passwordHash: string | null = null;
    if (targetRole === Role.EMPLOYEE) {
      if (!password || typeof password !== 'string' || password.length < 4) {
        return res.status(400).json({
          success: false,
          error: 'Employee password must be at least 4 characters long.',
        });
      }
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(password, salt);
    }

    const cleanPhone = phone.trim();
    const cleanEmail =
      email && typeof email === 'string' && email.trim()
        ? email.trim().toLowerCase()
        : null;

    // Check if phone already registered (with auto-reconnect retry on serverless drop)
    const existingPhone = await withDbRetry(() =>
      prisma.user.findUnique({
        where: { phone: cleanPhone },
      })
    );

    if (existingPhone) {
      return res.status(409).json({
        success: false,
        error: `An account with phone number ${cleanPhone} already exists.`,
      });
    }

    // Check if email already registered (if provided)
    if (cleanEmail) {
      const existingEmail = await withDbRetry(() =>
        prisma.user.findFirst({
          where: { email: cleanEmail },
        })
      );

      if (existingEmail) {
        return res.status(409).json({
          success: false,
          error: `An account with email ${cleanEmail} already exists.`,
        });
      }
    }

    // Client-specific bonus: will NOT auto-assign. Only set if explicitly configured by admin.
    let finalBonusPercentage: number | null = null;
    const canConfigureBonus =
      req.user.isSuperAdmin || req.user.permissions.canSetBonus;
    if (
      canConfigureBonus &&
      bonusPercentage !== undefined &&
      bonusPercentage !== null &&
      bonusPercentage !== ''
    ) {
      const parsedBonus = Number(bonusPercentage);
      if (!isNaN(parsedBonus) && parsedBonus > 0 && parsedBonus <= 100) {
        finalBonusPercentage = parsedBonus;
      }
    }

    const resolvedPerms =
      targetRole === Role.EMPLOYEE
        ? resolveUserPermissions(Role.EMPLOYEE, permissions)
        : undefined;

    const cleanUpi =
      upiId && typeof upiId === 'string' && upiId.trim() ? upiId.trim() : null;

    const creatorId = req.user.userId;
    const creatorName = req.user.name;
    const creatorRole = req.user.isSuperAdmin ? 'SUPER_ADMIN' : (req.user.role || 'EMPLOYEE');

    const newUser = await withDbRetry(() =>
      prisma.user.create({
        data: {
          name: name.trim(),
          phone: cleanPhone,
          email: cleanEmail || undefined,
          passwordHash: passwordHash || undefined,
          role: targetRole,
          permissions: resolvedPerms ? (resolvedPerms as any) : undefined,
          isBlocked: false,
          bonusPercentage: finalBonusPercentage ?? 0,
          totalBalancePaise: 0,
          activeBonusPaise: 0,
          lastDepositAmountPaise: 0,
          cycleWithdrawnPaise: 0,
          isBonusDeductedInCycle: false,
          upiId: cleanUpi || undefined,
          bankAccountNumber: bankAccount?.accountNumber?.trim() || null,
          bankIfsc: bankAccount?.ifsc?.trim()?.toUpperCase() || null,
          bankName: bankAccount?.bankName?.trim() || null,
          bankAccountHolderName: bankAccount?.accountHolderName?.trim() || null,
          createdById: creatorId,
          createdByName: creatorName,
          createdByRole: creatorRole,
        },
      })
    );

    return res.status(201).json({
      success: true,
      message:
        targetRole === Role.EMPLOYEE
          ? 'Employee account created successfully with assigned permissions.'
          : 'Client account created successfully.',
      user: formatManagedUser(newUser, 0),
    });
  } catch (error: any) {
    console.error('Error in createUser:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to create account.',
    });
  }
};

/**
 * GET /api/admin/users
 * Lists clients or employees with search, filter, and live withdrawable calculation.
 */
export const getAllUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    const { search, isBlocked, role, page, limit } = req.query;

    const whereClause: any = {
      isArchived: { not: true },
    };

    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      whereClause.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (isBlocked !== undefined) {
      whereClause.isBlocked = isBlocked === 'true';
    }

    const requestedRole = typeof role === 'string' ? role.toUpperCase() : '';

    if (requestedRole === 'EMPLOYEE') {
      if (!req.user.isSuperAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Only Super Admin can view Employee accounts.',
        });
      }
      whereClause.role = Role.EMPLOYEE;
    } else if (requestedRole === 'CLIENT' || requestedRole === 'USER') {
      whereClause.role = { in: [Role.CLIENT, Role.USER] };
    } else if (requestedRole === 'SUPER_ADMIN' || requestedRole === 'ADMIN') {
      if (!req.user.isSuperAdmin) {
        return res.status(403).json({ success: false, error: 'Access denied.' });
      }
      whereClause.role = { in: [Role.SUPER_ADMIN, Role.ADMIN] };
    } else if (!req.user.isSuperAdmin) {
      // Employees only ever list Clients
      whereClause.role = { in: [Role.CLIENT, Role.USER] };
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(200, Math.max(1, Number(limit) || 100));
    const skip = (pageNum - 1) * limitNum;

    const [totalUsers, users] = await Promise.all([
      prisma.user.count({ where: whereClause }),
      prisma.user.findMany({
        where: whereClause,
        include: {
          _count: {
            select: {
              transactions: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
    ]);

    // Aggregate approved deposits and withdrawals per user for accurate metrics display
    const userIds = users.map((u) => u.id);
    const [depositSums, withdrawalTxns] =
      userIds.length > 0
        ? await Promise.all([
            prisma.transaction.groupBy({
              by: ['userId'],
              where: {
                userId: { in: userIds },
                type: TransactionType.DEPOSIT,
                status: TransactionStatus.APPROVED,
              },
              _sum: { amountPaise: true, bonusPaise: true },
            }),
            prisma.transaction.findMany({
              where: {
                userId: { in: userIds },
                type: TransactionType.WITHDRAWAL,
                status: TransactionStatus.APPROVED,
              },
              select: {
                userId: true,
                amountPaise: true,
                bonusPaise: true,
                cashPaidPaise: true,
              },
            }),
          ])
        : [[], []];

    const metricsMap = new Map<string, UserAggregatedMetrics>();
    for (const id of userIds) {
      metricsMap.set(id, {
        totalCashDepositedPaise: 0,
        totalPointsDepositedPaise: 0,
        totalPointsWithdrawnPaise: 0,
        totalCashWithdrawnPaise: 0,
        totalBonusDeductedPaise: 0,
      });
    }

    for (const d of depositSums) {
      const m = metricsMap.get(d.userId);
      if (m) {
        const cash = d._sum.amountPaise || 0;
        const bonus = d._sum.bonusPaise || 0;
        m.totalCashDepositedPaise += cash;
        m.totalPointsDepositedPaise += cash + bonus;
      }
    }

    for (const w of withdrawalTxns) {
      const m = metricsMap.get(w.userId);
      if (m) {
        m.totalPointsWithdrawnPaise += w.amountPaise;
        m.totalBonusDeductedPaise += w.bonusPaise;
        m.totalCashWithdrawnPaise +=
          w.cashPaidPaise || Math.max(0, w.amountPaise - w.bonusPaise);
      }
    }

    return res.status(200).json({
      success: true,
      total: totalUsers,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalUsers / limitNum),
      users: users.map((u) =>
        formatManagedUser(
          u,
          metricsMap.get(u.id)?.totalCashDepositedPaise || 0,
          0,
          metricsMap.get(u.id)
        )
      ),
    });
  } catch (error: any) {
    console.error('Error in getAllUsers:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve accounts.',
    });
  }
};

/**
 * PATCH /api/admin/users/:userId
 * Updates a Client's (or Employee's) data: name, phone, email, upiId, bankAccount.
 */
export const updateUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    const { userId } = req.params;
    const { name, phone, email, upiId, bankAccount, password } = req.body;

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      return res.status(404).json({ success: false, error: 'Account not found.' });
    }

    // Permission checks
    if (!isClientRole(target.role)) {
      if (!req.user.isSuperAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Only Super Admin can modify Employee or Admin accounts.',
        });
      }
    } else {
      if (!req.user.isSuperAdmin && !req.user.permissions.canManageClients) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Client Data Management permission required.',
        });
      }
    }

    const updateData: any = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ success: false, error: 'Name cannot be empty.' });
      }
      updateData.name = name.trim();
    }

    if (phone !== undefined) {
      const cleanPhone = String(phone).trim();
      if (!cleanPhone) {
        return res.status(400).json({ success: false, error: 'Phone number cannot be empty.' });
      }
      if (cleanPhone !== target.phone) {
        const dup = await prisma.user.findUnique({ where: { phone: cleanPhone } });
        if (dup) {
          return res.status(409).json({
            success: false,
            error: `Phone number ${cleanPhone} is already in use.`,
          });
        }
      }
      updateData.phone = cleanPhone;
    }

    if (email !== undefined) {
      const cleanEmail =
        email && typeof email === 'string' && email.trim()
          ? email.trim().toLowerCase()
          : null;
      if (cleanEmail && cleanEmail !== target.email) {
        const dup = await prisma.user.findFirst({ where: { email: cleanEmail } });
        if (dup) {
          return res.status(409).json({
            success: false,
            error: `Email ${cleanEmail} is already in use.`,
          });
        }
      }
      updateData.email = cleanEmail;
    }

    if (upiId !== undefined) {
      updateData.upiId =
        upiId && typeof upiId === 'string' && upiId.trim() ? upiId.trim() : null;
    }

    if (bankAccount !== undefined) {
      if (bankAccount === null) {
        updateData.bankAccountNumber = null;
        updateData.bankIfsc = null;
        updateData.bankName = null;
        updateData.bankAccountHolderName = null;
      } else if (typeof bankAccount === 'object') {
        updateData.bankAccountNumber = bankAccount.accountNumber?.trim() || null;
        updateData.bankIfsc = bankAccount.ifsc?.trim()?.toUpperCase() || null;
        updateData.bankName = bankAccount.bankName?.trim() || null;
        updateData.bankAccountHolderName =
          bankAccount.accountHolderName?.trim() || null;
      }
    }

    if (
      password &&
      typeof password === 'string' &&
      password.trim().length >= 4 &&
      target.role === Role.EMPLOYEE &&
      req.user.isSuperAdmin
    ) {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(password.trim(), salt);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    const depositAgg = await prisma.transaction.aggregate({
      where: {
        userId,
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.APPROVED,
      },
      _sum: { amountPaise: true },
    });

    return res.status(200).json({
      success: true,
      message: 'Account details updated successfully.',
      user: formatManagedUser(updated, depositAgg._sum.amountPaise || 0),
    });
  } catch (error: any) {
    console.error('Error in updateUser:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update account details.',
    });
  }
};

/**
 * PATCH /api/admin/users/:userId/permissions
 * Super Admin ONLY: updates an Employee's granular permissions (and optionally password).
 */
export const updateEmployeePermissions = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!req.user || !req.user.isSuperAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only Super Admin can update employee permissions.',
      });
    }

    const { userId } = req.params;
    const { permissions, password } = req.body;

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      return res.status(404).json({ success: false, error: 'Employee not found.' });
    }

    if (target.role !== Role.EMPLOYEE) {
      return res.status(400).json({
        success: false,
        error: 'Permissions can only be customized for Employee accounts.',
      });
    }

    const normalized = resolveUserPermissions(Role.EMPLOYEE, permissions);
    const updateData: any = {
      permissions: normalized as any,
    };

    if (password && typeof password === 'string' && password.trim().length >= 4) {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(password.trim(), salt);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return res.status(200).json({
      success: true,
      message: 'Employee permissions updated successfully.',
      user: formatManagedUser(updated, 0),
    });
  } catch (error: any) {
    console.error('Error in updateEmployeePermissions:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update employee permissions.',
    });
  }
};

/**
 * PATCH /api/admin/users/:userId/bonus-config
 * Updates a client's custom bonusPercentage (requires canSetBonus).
 */
export const updateUserBonusConfig = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    const { userId } = req.params;
    const { bonusPercentage } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: `Client with ID ${userId} not found.`,
      });
    }

    const updates: any = {};

    if (bonusPercentage !== undefined) {
      if (!req.user.isSuperAdmin && !req.user.permissions.canSetBonus) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You do not have permission to set client bonus %.',
        });
      }

      if (
        bonusPercentage === null ||
        bonusPercentage === '' ||
        Number(bonusPercentage) === 0
      ) {
        // Clear custom client bonus so global daily running bonus applies
        updates.bonusPercentage = 0;
      } else {
        const percentage = Number(bonusPercentage);
        if (isNaN(percentage) || percentage < 0 || percentage > 100) {
          return res.status(400).json({
            success: false,
            error: 'bonusPercentage must be a valid number between 0 and 100.',
          });
        }
        updates.bonusPercentage = percentage;
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide bonusPercentage to update.',
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updates,
    });

    const depositAgg = await prisma.transaction.aggregate({
      where: {
        userId,
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.APPROVED,
      },
      _sum: { amountPaise: true },
    });

    return res.status(200).json({
      success: true,
      message: "Client's configuration updated successfully.",
      user: formatManagedUser(updatedUser, depositAgg._sum.amountPaise || 0),
    });
  } catch (error: any) {
    console.error('Error updating bonus config:', error);
    return res.status(500).json({
      success: false,
      error: "Failed to update client's configuration.",
    });
  }
};

/**
 * PATCH /api/admin/users/:userId/toggle-block
 * Toggles an existing client's or employee's isBlocked state.
 */
export const toggleBlockUser = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    const { userId } = req.params;
    const { isBlocked } = req.body;

    if (userId === req.user.userId) {
      return res.status(400).json({
        success: false,
        error: 'You cannot suspend your own account.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: `Account with ID ${userId} not found.`,
      });
    }

    if (!isClientRole(user.role)) {
      if (!req.user.isSuperAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Only Super Admin can block or unblock Employee accounts.',
        });
      }
    } else if (!req.user.isSuperAdmin && !req.user.permissions.canManageClients) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Client Management permission required.',
      });
    }

    const targetBlocked =
      typeof isBlocked === 'boolean' ? isBlocked : !user.isBlocked;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isBlocked: targetBlocked },
    });

    const statusText = targetBlocked ? 'blocked' : 'unblocked';
    return res.status(200).json({
      success: true,
      message: `Account has been successfully ${statusText}.`,
      user: formatManagedUser(updatedUser, 0),
    });
  } catch (error: any) {
    console.error('Error in toggleBlockUser:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to toggle account status.',
    });
  }
};

/**
 * GET /api/admin/users/:userId
 * Returns full client or employee details, withdrawable calculation, and recent transactions.
 */
export const getUserById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: `Account with ID ${userId} not found.`,
      });
    }

    if (!isClientRole(user.role) && !req.user.isSuperAdmin && user.id !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Only Super Admin can inspect Employee accounts.',
      });
    }

    const [depositAgg, withdrawalTxns] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          userId,
          type: TransactionType.DEPOSIT,
          status: TransactionStatus.APPROVED,
          isArchived: { not: true } as any,
        },
        _sum: { amountPaise: true, bonusPaise: true },
      }),
      prisma.transaction.findMany({
        where: {
          userId,
          type: TransactionType.WITHDRAWAL,
          status: TransactionStatus.APPROVED,
          isArchived: { not: true } as any,
        },
        select: {
          amountPaise: true,
          bonusPaise: true,
          cashPaidPaise: true,
        },
      }),
    ]);

    const cashDeposited = depositAgg._sum?.amountPaise || 0;
    const bonusEarned = depositAgg._sum?.bonusPaise || 0;
    const pointsDeposited = cashDeposited + bonusEarned;

    let pointsWithdrawn = 0;
    let cashWithdrawn = 0;
    let bonusDeducted = 0;

    for (const w of withdrawalTxns) {
      pointsWithdrawn += w.amountPaise;
      bonusDeducted += w.bonusPaise;
      cashWithdrawn +=
        w.cashPaidPaise || Math.max(0, w.amountPaise - w.bonusPaise);
    }

    const metrics: UserAggregatedMetrics = {
      totalCashDepositedPaise: cashDeposited,
      totalPointsDepositedPaise: pointsDeposited,
      totalPointsWithdrawnPaise: pointsWithdrawn,
      totalCashWithdrawnPaise: cashWithdrawn,
      totalBonusDeductedPaise: bonusDeducted,
    };

    // If Employee, aggregate detailed action performance tracking
    let employeeActivity: any = undefined;
    if (user.role === Role.EMPLOYEE) {
      const [createdClients, processedTxns] = await Promise.all([
        prisma.user.findMany({
          where: { createdById: userId, isArchived: { not: true } },
          select: {
            id: true,
            name: true,
            phone: true,
            createdAt: true,
            isBlocked: true,
            bonusPercentage: true,
            totalBalancePaise: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.transaction.findMany({
          where: { processedByAdminId: userId, isArchived: { not: true } as any },
          include: {
            user: { select: { id: true, name: true, phone: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      const txnsList = processedTxns as any[];
      const deposits = txnsList.filter((t) => t.type === TransactionType.DEPOSIT);
      const withdrawals = txnsList.filter((t) => t.type === TransactionType.WITHDRAWAL);

      employeeActivity = {
        clients: createdClients.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          status: c.isBlocked ? 'blocked' : 'active',
          bonusPercentage: c.bonusPercentage,
          totalBalancePaise: c.totalBalancePaise,
          createdAt: c.createdAt,
        })),
        deposits: deposits.map((d) => ({
          id: d.id,
          userId: d.userId,
          userName: d.user?.name,
          userPhone: d.user?.phone,
          amountPaise: d.amountPaise,
          bonusPaise: d.bonusPaise,
          status: d.status,
          utr: d.utr,
          paymentApp: d.paymentApp,
          createdAt: d.createdAt,
        })),
        withdrawals: withdrawals.map((w) => ({
          id: w.id,
          userId: w.userId,
          userName: w.user?.name,
          userPhone: w.user?.phone,
          amountPaise: w.amountPaise,
          bonusPaise: w.bonusPaise,
          cashPaidPaise: w.cashPaidPaise || Math.max(0, w.amountPaise - w.bonusPaise),
          status: w.status,
          utr: w.utr,
          paymentApp: w.paymentApp,
          createdAt: w.createdAt,
        })),
        totalClientsAdded: createdClients.length,
        totalDepositsHandled: deposits.length,
        totalWithdrawalsHandled: withdrawals.length,
      };
    }

    const formatted = formatManagedUser(user, cashDeposited, bonusEarned, metrics);

    return res.status(200).json({
      success: true,
      user: {
        ...formatted,
        employeeActivity,
      },
    });
  } catch (error: any) {
    console.error('Error in getUserById:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve account details.',
    });
  }
};

/**
 * POST /api/admin/employee/location
 * Updates live GPS coordinates for an Employee / Admin
 */
export const updateEmployeeLocation = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    const { latitude, longitude, accuracy, address } = req.body;
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required.',
      });
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    const acc = accuracy !== undefined ? Number(accuracy) : null;
    const addr = typeof address === 'string' && address.trim() ? address.trim() : null;

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinates.',
      });
    }

    const now = new Date();

    await Promise.all([
      prisma.user.update({
        where: { id: req.user.userId },
        data: {
          lastLatitude: lat,
          lastLongitude: lng,
          lastLocationAccuracy: acc,
          lastLocationAddress: addr,
          lastLocationUpdatedAt: now,
        },
      }),
      prisma.employeeLocation.create({
        data: {
          employeeId: req.user.userId,
          latitude: lat,
          longitude: lng,
          accuracy: acc,
          address: addr,
        },
      }),
    ]);

    return res.json({
      success: true,
      message: 'Location updated successfully.',
      timestamp: now.toISOString(),
    });
  } catch (error: any) {
    console.error('Error in updateEmployeeLocation:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to record employee location.',
    });
  }
};

/**
 * GET /api/admin/employees/locations
 * Returns current locations of all active Employees for Super Admin tracking
 */
export const getEmployeeLocations = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    if (!req.user.isSuperAdmin && !req.user.permissions?.canManageClients) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Only Super Admin can track employee locations.',
      });
    }

    const employees = await prisma.user.findMany({
      where: {
        role: { in: [Role.EMPLOYEE, Role.ADMIN] },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isBlocked: true,
        lastLatitude: true,
        lastLongitude: true,
        lastLocationAccuracy: true,
        lastLocationAddress: true,
        lastLocationUpdatedAt: true,
      },
      orderBy: { name: 'asc' },
    });

    return res.json({
      success: true,
      employees,
    });
  } catch (error: any) {
    console.error('Error in getEmployeeLocations:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch employee locations.',
    });
  }
};

/**
 * POST /api/admin/backup/reset-app
 * Super Admin one-click action to reset application to zero state without deleting from database.
 * Backs up all transactions & state into an archive file in Backup & Restore.
 */
export const resetApplicationData = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user || !req.user.isSuperAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only Super Admin can reset application data.',
      });
    }

    const snapshot = await createAppResetBackup(req.user.userId, req.user.name);
    return res.status(200).json({
      success: true,
      message: 'Application has been reset to zero state. All data is securely archived in Backup & Restore.',
      snapshot,
    });
  } catch (error: any) {
    console.error('Error in resetApplicationData:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to reset application data.',
    });
  }
};

/**
 * POST /api/admin/backup/delete-transaction/:id
 * Super Admin soft-deletes a single transaction. Restorable in Backup & Restore.
 */
export const deleteSingleTransaction = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user || !req.user.isSuperAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only Super Admin can delete transactions.',
      });
    }

    const { id } = req.params;
    const snapshot = await createSingleTransactionBackup(id, req.user.userId, req.user.name);
    return res.status(200).json({
      success: true,
      message: 'Transaction deleted from live ledger. Restorable from Backup & Restore.',
      snapshot,
    });
  } catch (error: any) {
    console.error('Error in deleteSingleTransaction:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete transaction.',
    });
  }
};

/**
 * POST /api/admin/backup/delete-client/:id
 * Super Admin soft-deletes a single client and their transactions, moving them into Backup & Restore.
 */
export const deleteSingleClient = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user || !req.user.isSuperAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only Super Admin can delete clients.',
      });
    }

    const { id } = req.params;
    const snapshot = await createSingleClientBackup(id, req.user.userId, req.user.name);
    return res.status(200).json({
      success: true,
      message: 'Client and all transactions moved to Backup & Restore. Data can be restored at any time.',
      snapshot,
    });
  } catch (error: any) {
    console.error('Error in deleteSingleClient:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete client.',
    });
  }
};

/**
 * GET /api/admin/backup/snapshots
 * Returns all backup snapshots & soft-deleted items with 5-minute undo state.
 */
export const getBackupSnapshotsList = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    const snapshots = await getAllBackupSnapshots();
    return res.status(200).json({
      success: true,
      snapshots,
    });
  } catch (error: any) {
    console.error('Error in getBackupSnapshotsList:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch backup snapshots.',
    });
  }
};

/**
 * POST /api/admin/backup/restore/:snapshotId
 * Restores an archived snapshot or transaction. Live data stays as it is.
 * Enables 5-minute undo window.
 */
export const restoreBackupSnapshotController = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    const { snapshotId } = req.params;
    const snapshot = await restoreBackupSnapshot(snapshotId, req.user.userId, req.user.name);
    return res.status(200).json({
      success: true,
      message: 'Data successfully restored to live application. Undo is available for 5 minutes.',
      snapshot,
    });
  } catch (error: any) {
    console.error('Error in restoreBackupSnapshotController:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to restore backup snapshot.',
    });
  }
};

/**
 * POST /api/admin/backup/undo-restore/:snapshotId
 * Undoes a restore action within 5 minutes.
 */
export const undoRestoreBackupSnapshotController = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    const { snapshotId } = req.params;
    const snapshot = await undoRestoreBackupSnapshot(snapshotId);
    return res.status(200).json({
      success: true,
      message: 'Restore undone successfully. Data returned to archived backup state.',
      snapshot,
    });
  } catch (error: any) {
    console.error('Error in undoRestoreBackupSnapshotController:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to undo restore.',
    });
  }
};

/**
 * DELETE /api/admin/backup/permanent/:snapshotId
 * Permanently deletes a backup snapshot, its database records, and screenshot image files.
 */
export const deleteBackupPermanentlyController = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user || !req.user.isSuperAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only Super Admin can permanently delete data from the database.',
      });
    }

    const { snapshotId } = req.params;
    const result = await deleteBackupPermanently(snapshotId);
    return res.status(200).json({
      success: true,
      message: `Permanently deleted from database (${result.deletedTransactionsCount} records, ${result.deletedImagesCount} images).`,
      result,
    });
  } catch (error: any) {
    console.error('Error in deleteBackupPermanentlyController:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to permanently delete backup.',
    });
  }
};
