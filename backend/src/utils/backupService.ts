import fs from 'fs';
import path from 'path';
import prisma from './prisma';
import { TransactionType, TransactionStatus, Role } from '@prisma/client';

export interface BackupSnapshotItem {
  id: string;
  title: string;
  backupType: 'FULL_RESET' | 'SINGLE_TRANSACTION' | 'SINGLE_CLIENT';
  createdById: string;
  createdByName: string;
  createdAt: string;
  clientCount: number;
  transactionCount: number;
  totalDepositPaise: number;
  totalWithdrawPaise: number;
  clientIds: string[];
  transactionIds: string[];
  singleTransactionId?: string;
  singleClientId?: string;
  isRestored: boolean;
  restoredAt?: string | null;
  restoredById?: string | null;
  restoredByName?: string | null;
  canUndoUntil?: string | null; // ISO string: restoredAt + 5 minutes
  isPermanentlyDeleted: boolean;
  clients?: Array<{
    id: string;
    name: string;
    phone: string;
    email?: string | null;
    role: string;
    totalBalancePaise: number;
    activeBonusPaise: number;
    bonusPercentage: number;
    upiId?: string | null;
    bankAccountNumber?: string | null;
    bankIfsc?: string | null;
    bankName?: string | null;
    bankAccountHolderName?: string | null;
    createdById?: string | null;
    createdByName?: string | null;
    createdByRole?: string | null;
    createdAt: string;
  }>;
  transactions?: any[];
  clientBalances?: Array<{
    userId: string;
    totalBalancePaise: number;
    activeBonusPaise: number;
  }>;
}

const SETTING_PREFIX = 'backup_snapshot_';

/**
 * Creates a full application reset backup.
 * Soft-deletes (archives) all active clients and transactions, and resets application state to zero.
 * The live app will show 0 clients, 0 transactions, and 0 points.
 * All data is safely preserved in MongoDB and restorable via Backup & Restore.
 */
export const createAppResetBackup = async (adminId: string, adminName: string) => {
  // 1. Fetch all active (non-archived) clients
  const activeClients = await prisma.user.findMany({
    where: {
      role: Role.CLIENT,
      isArchived: false,
    },
    orderBy: { createdAt: 'desc' },
  });

  // 2. Fetch all active (non-archived) transactions
  const activeTransactions = (await prisma.transaction.findMany({
    where: {
      isArchived: false,
    },
    include: {
      user: {
        select: { id: true, name: true, phone: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })) as any[];

  const clientIds = activeClients.map((c) => c.id);
  const transactionIds = activeTransactions.map((t) => t.id);
  const now = new Date();
  const snapshotId = `backup_${now.getTime()}_${Math.random().toString(36).substring(2, 7)}`;
  const dateStr = now.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  let totalDepositPaise = 0;
  let totalWithdrawPaise = 0;

  for (const t of activeTransactions) {
    if (t.type === TransactionType.DEPOSIT && t.status === TransactionStatus.APPROVED) {
      totalDepositPaise += t.amountPaise;
    } else if (t.type === TransactionType.WITHDRAWAL && t.status === TransactionStatus.APPROVED) {
      totalWithdrawPaise += t.amountPaise;
    }
  }

  const snapshot: BackupSnapshotItem = {
    id: snapshotId,
    title: `App Reset Backup - ${dateStr}`,
    backupType: 'FULL_RESET',
    createdById: adminId,
    createdByName: adminName,
    createdAt: now.toISOString(),
    clientCount: activeClients.length,
    transactionCount: activeTransactions.length,
    totalDepositPaise,
    totalWithdrawPaise,
    clientIds,
    transactionIds,
    isRestored: false,
    isPermanentlyDeleted: false,
    clients: activeClients.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      role: c.role,
      totalBalancePaise: c.totalBalancePaise,
      activeBonusPaise: c.activeBonusPaise,
      bonusPercentage: c.bonusPercentage,
      upiId: c.upiId,
      bankAccountNumber: c.bankAccountNumber,
      bankIfsc: c.bankIfsc,
      bankName: c.bankName,
      bankAccountHolderName: c.bankAccountHolderName,
      createdById: c.createdById,
      createdByName: c.createdByName,
      createdByRole: c.createdByRole,
      createdAt: c.createdAt.toISOString(),
    })),
    transactions: activeTransactions.map((t) => ({
      id: t.id,
      userId: t.userId,
      userName: t.user?.name,
      userPhone: t.user?.phone,
      type: t.type,
      status: t.status,
      amountPaise: t.amountPaise,
      bonusPaise: t.bonusPaise,
      cashPaidPaise: t.cashPaidPaise,
      utr: t.utr,
      imageUrl: t.imageUrl,
      createdAt: t.createdAt,
    })),
    clientBalances: activeClients.map((c) => ({
      userId: c.id,
      totalBalancePaise: c.totalBalancePaise,
      activeBonusPaise: c.activeBonusPaise,
    })),
  };

  // 3. Save snapshot document in SystemSetting
  await prisma.systemSetting.upsert({
    where: { key: `${SETTING_PREFIX}${snapshotId}` },
    create: {
      key: `${SETTING_PREFIX}${snapshotId}`,
      value: JSON.stringify(snapshot),
    },
    update: {
      value: JSON.stringify(snapshot),
    },
  });

  // 4. Soft-delete transactions from active live view
  if (transactionIds.length > 0) {
    await prisma.transaction.updateMany({
      where: { id: { in: transactionIds } },
      data: {
        isArchived: true,
        archivedAt: now,
        archivedById: adminId,
        backupBatchId: snapshotId,
      },
    });
  }

  // 5. Soft-delete clients from active live view and zero their live balances
  if (clientIds.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: clientIds } },
      data: {
        isArchived: true,
        archivedAt: now,
        archivedById: adminId,
        backupBatchId: snapshotId,
        totalBalancePaise: 0,
        activeBonusPaise: 0,
        lastDepositAmountPaise: 0,
        cycleWithdrawnPaise: 0,
        isBonusDeductedInCycle: false,
      },
    });
  }

  return snapshot;
};

/**
 * Soft-deletes a single client and all their transactions, moving them into Backup & Restore.
 */
export const createSingleClientBackup = async (
  clientId: string,
  adminId: string,
  adminName: string
) => {
  const client = await prisma.user.findUnique({
    where: { id: clientId },
    include: {
      transactions: {
        where: { isArchived: false },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!client) {
    throw new Error(`Client with ID "${clientId}" not found.`);
  }

  if (client.role !== Role.CLIENT && client.role !== Role.USER) {
    throw new Error('Only client accounts can be moved to backup.');
  }

  if (client.isArchived) {
    throw new Error('Client is already archived / deleted from live application.');
  }

  const now = new Date();
  const snapshotId = `client_${now.getTime()}_${Math.random().toString(36).substring(2, 7)}`;
  const dateStr = now.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const transactionIds = client.transactions.map((t) => t.id);
  let totalDepositPaise = 0;
  let totalWithdrawPaise = 0;

  for (const t of client.transactions) {
    if (t.type === TransactionType.DEPOSIT && t.status === TransactionStatus.APPROVED) {
      totalDepositPaise += t.amountPaise;
    } else if (t.type === TransactionType.WITHDRAWAL && t.status === TransactionStatus.APPROVED) {
      totalWithdrawPaise += t.amountPaise;
    }
  }

  const snapshot: BackupSnapshotItem = {
    id: snapshotId,
    title: `Deleted Client: ${client.name} (${client.phone}) - ${dateStr}`,
    backupType: 'SINGLE_CLIENT',
    createdById: adminId,
    createdByName: adminName,
    createdAt: now.toISOString(),
    clientCount: 1,
    transactionCount: client.transactions.length,
    totalDepositPaise,
    totalWithdrawPaise,
    clientIds: [client.id],
    transactionIds,
    singleClientId: client.id,
    isRestored: false,
    isPermanentlyDeleted: false,
    clients: [
      {
        id: client.id,
        name: client.name,
        phone: client.phone,
        email: client.email,
        role: client.role,
        totalBalancePaise: client.totalBalancePaise,
        activeBonusPaise: client.activeBonusPaise,
        bonusPercentage: client.bonusPercentage,
        upiId: client.upiId,
        bankAccountNumber: client.bankAccountNumber,
        bankIfsc: client.bankIfsc,
        bankName: client.bankName,
        bankAccountHolderName: client.bankAccountHolderName,
        createdById: client.createdById,
        createdByName: client.createdByName,
        createdByRole: client.createdByRole,
        createdAt: client.createdAt.toISOString(),
      },
    ],
    transactions: client.transactions.map((t) => ({
      id: t.id,
      userId: t.userId,
      userName: client.name,
      userPhone: client.phone,
      type: t.type,
      status: t.status,
      amountPaise: t.amountPaise,
      bonusPaise: t.bonusPaise,
      cashPaidPaise: t.cashPaidPaise,
      utr: t.utr,
      imageUrl: t.imageUrl,
      createdAt: t.createdAt,
    })),
    clientBalances: [
      {
        userId: client.id,
        totalBalancePaise: client.totalBalancePaise,
        activeBonusPaise: client.activeBonusPaise,
      },
    ],
  };

  // 1. Save in SystemSetting
  await prisma.systemSetting.upsert({
    where: { key: `${SETTING_PREFIX}${snapshotId}` },
    create: {
      key: `${SETTING_PREFIX}${snapshotId}`,
      value: JSON.stringify(snapshot),
    },
    update: {
      value: JSON.stringify(snapshot),
    },
  });

  // 2. Soft-delete the client from active app
  await prisma.user.update({
    where: { id: clientId },
    data: {
      isArchived: true,
      archivedAt: now,
      archivedById: adminId,
      backupBatchId: snapshotId,
    },
  });

  // 3. Soft-delete their active transactions
  if (transactionIds.length > 0) {
    await prisma.transaction.updateMany({
      where: { id: { in: transactionIds } },
      data: {
        isArchived: true,
        archivedAt: now,
        archivedById: adminId,
        backupBatchId: snapshotId,
      },
    });
  }

  return snapshot;
};

/**
 * Soft-deletes a single transaction and marks it restorable in Backup & Restore.
 */
export const createSingleTransactionBackup = async (
  transactionId: string,
  adminId: string,
  adminName: string
) => {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      user: {
        select: { id: true, name: true, phone: true },
      },
    },
  });

  if (!transaction) {
    throw new Error(`Transaction with ID "${transactionId}" not found.`);
  }

  const now = new Date();
  const snapshotId = `single_${now.getTime()}_${Math.random().toString(36).substring(2, 7)}`;
  const dateStr = now.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const snapshot: BackupSnapshotItem = {
    id: snapshotId,
    title: `Deleted ${transaction.type} #${transaction.utr || transaction.id.slice(-6)} - ${dateStr}`,
    backupType: 'SINGLE_TRANSACTION',
    createdById: adminId,
    createdByName: adminName,
    createdAt: now.toISOString(),
    clientCount: 0,
    transactionCount: 1,
    totalDepositPaise: transaction.type === TransactionType.DEPOSIT ? transaction.amountPaise : 0,
    totalWithdrawPaise: transaction.type === TransactionType.WITHDRAWAL ? transaction.amountPaise : 0,
    clientIds: [],
    transactionIds: [transaction.id],
    singleTransactionId: transaction.id,
    isRestored: false,
    isPermanentlyDeleted: false,
    transactions: [
      {
        id: transaction.id,
        userId: transaction.userId,
        userName: transaction.user?.name,
        userPhone: transaction.user?.phone,
        type: transaction.type,
        status: transaction.status,
        amountPaise: transaction.amountPaise,
        bonusPaise: transaction.bonusPaise,
        cashPaidPaise: transaction.cashPaidPaise,
        utr: transaction.utr,
        imageUrl: transaction.imageUrl,
        createdAt: transaction.createdAt,
      },
    ],
  };

  // 1. Save in SystemSetting
  await prisma.systemSetting.upsert({
    where: { key: `${SETTING_PREFIX}${snapshotId}` },
    create: {
      key: `${SETTING_PREFIX}${snapshotId}`,
      value: JSON.stringify(snapshot),
    },
    update: {
      value: JSON.stringify(snapshot),
    },
  });

  // 2. Mark transaction as archived (soft-deleted)
  await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      isArchived: true,
      archivedAt: now,
      archivedById: adminId,
      backupBatchId: snapshotId,
    },
  });

  // 3. Deduct/Adjust the transaction amount from client's points balance if approved
  if (transaction.status === TransactionStatus.APPROVED) {
    if (transaction.type === TransactionType.DEPOSIT) {
      const netPoints = transaction.amountPaise + transaction.bonusPaise;
      await prisma.user.update({
        where: { id: transaction.userId },
        data: {
          totalBalancePaise: { decrement: netPoints },
        },
      });
    } else if (transaction.type === TransactionType.WITHDRAWAL) {
      await prisma.user.update({
        where: { id: transaction.userId },
        data: {
          totalBalancePaise: { increment: transaction.amountPaise },
        },
      });
    }
  }

  return snapshot;
};

/**
 * Retrieves all backup snapshots & soft-deleted items with live 5-minute undo state.
 */
export const getAllBackupSnapshots = async (): Promise<
  (BackupSnapshotItem & { canUndo: boolean; undoSecondsRemaining: number })[]
> => {
  const records = await prisma.systemSetting.findMany({
    where: {
      key: { startsWith: SETTING_PREFIX },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const now = Date.now();
  const results: (BackupSnapshotItem & { canUndo: boolean; undoSecondsRemaining: number })[] = [];

  for (const r of records) {
    try {
      const parsed: BackupSnapshotItem = JSON.parse(r.value);
      if (parsed.isPermanentlyDeleted) continue;

      let canUndo = false;
      let undoSecondsRemaining = 0;

      if (parsed.isRestored && parsed.canUndoUntil) {
        const untilMs = new Date(parsed.canUndoUntil).getTime();
        if (untilMs > now) {
          canUndo = true;
          undoSecondsRemaining = Math.max(0, Math.round((untilMs - now) / 1000));
        }
      }

      results.push({
        ...parsed,
        clientCount: parsed.clientCount ?? (parsed.clientIds ? parsed.clientIds.length : 0),
        clientIds: parsed.clientIds ?? [],
        canUndo,
        undoSecondsRemaining,
      });
    } catch (e) {
      console.warn('Failed to parse backup snapshot:', r.key, e);
    }
  }

  // Sort by createdAt descending
  results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return results;
};

/**
 * Restores an archived snapshot, client, or deleted transaction.
 * Current live data stays as it is (restored items are safely merged in).
 * Sets a 5-minute undo window.
 */
export const restoreBackupSnapshot = async (
  snapshotId: string,
  adminId: string,
  adminName: string
) => {
  const record = await prisma.systemSetting.findUnique({
    where: { key: `${SETTING_PREFIX}${snapshotId}` },
  });

  if (!record) {
    throw new Error(`Backup snapshot "${snapshotId}" not found.`);
  }

  const snapshot: BackupSnapshotItem = JSON.parse(record.value);
  if (snapshot.isPermanentlyDeleted) {
    throw new Error(`This backup snapshot has been permanently deleted.`);
  }

  const now = new Date();
  const canUndoUntil = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes window

  // 1. Un-archive clients if this snapshot contained clients
  if (snapshot.clientIds && snapshot.clientIds.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: snapshot.clientIds } },
      data: {
        isArchived: false,
        backupBatchId: null,
      },
    });
  }

  // 2. Un-archive transactions
  if (snapshot.transactionIds && snapshot.transactionIds.length > 0) {
    await prisma.transaction.updateMany({
      where: { id: { in: snapshot.transactionIds } },
      data: {
        isArchived: false,
        backupBatchId: null,
      },
    });
  }

  // 3. Restore points to clients without affecting other current data
  if ((snapshot.backupType === 'FULL_RESET' || snapshot.backupType === 'SINGLE_CLIENT') && snapshot.clientBalances) {
    for (const cb of snapshot.clientBalances) {
      if (cb.totalBalancePaise > 0) {
        await prisma.user.update({
          where: { id: cb.userId },
          data: {
            totalBalancePaise: { increment: cb.totalBalancePaise },
            activeBonusPaise: cb.activeBonusPaise,
          },
        });
      }
    }
  } else if (snapshot.backupType === 'SINGLE_TRANSACTION' && snapshot.transactions) {
    for (const t of snapshot.transactions) {
      if (t.status === TransactionStatus.APPROVED) {
        if (t.type === TransactionType.DEPOSIT) {
          const netPoints = t.amountPaise + (t.bonusPaise || 0);
          await prisma.user.update({
            where: { id: t.userId },
            data: {
              totalBalancePaise: { increment: netPoints },
            },
          });
        } else if (t.type === TransactionType.WITHDRAWAL) {
          await prisma.user.update({
            where: { id: t.userId },
            data: {
              totalBalancePaise: { decrement: t.amountPaise },
            },
          });
        }
      }
    }
  }

  // 4. Update snapshot metadata with 5-minute undo timer
  snapshot.isRestored = true;
  snapshot.restoredAt = now.toISOString();
  snapshot.restoredById = adminId;
  snapshot.restoredByName = adminName;
  snapshot.canUndoUntil = canUndoUntil.toISOString();

  await prisma.systemSetting.update({
    where: { key: `${SETTING_PREFIX}${snapshotId}` },
    data: { value: JSON.stringify(snapshot) },
  });

  return {
    ...snapshot,
    canUndo: true,
    undoSecondsRemaining: 300,
  };
};

/**
 * Undoes a restore within the 5-minute window.
 */
export const undoRestoreBackupSnapshot = async (snapshotId: string) => {
  const record = await prisma.systemSetting.findUnique({
    where: { key: `${SETTING_PREFIX}${snapshotId}` },
  });

  if (!record) {
    throw new Error(`Backup snapshot "${snapshotId}" not found.`);
  }

  const snapshot: BackupSnapshotItem = JSON.parse(record.value);
  if (!snapshot.isRestored) {
    throw new Error(`This backup is not currently in restored state.`);
  }

  if (!snapshot.canUndoUntil || new Date(snapshot.canUndoUntil).getTime() < Date.now()) {
    throw new Error(`The 5-minute undo window has expired. This action can no longer be undone.`);
  }

  // 1. Re-archive clients
  if (snapshot.clientIds && snapshot.clientIds.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: snapshot.clientIds } },
      data: {
        isArchived: true,
        backupBatchId: snapshotId,
      },
    });
  }

  // 2. Re-archive transactions
  if (snapshot.transactionIds && snapshot.transactionIds.length > 0) {
    await prisma.transaction.updateMany({
      where: { id: { in: snapshot.transactionIds } },
      data: {
        isArchived: true,
        backupBatchId: snapshotId,
      },
    });
  }

  // 3. Reverse balance changes that were restored
  if ((snapshot.backupType === 'FULL_RESET' || snapshot.backupType === 'SINGLE_CLIENT') && snapshot.clientBalances) {
    for (const cb of snapshot.clientBalances) {
      if (cb.totalBalancePaise > 0) {
        await prisma.user.update({
          where: { id: cb.userId },
          data: {
            totalBalancePaise: { decrement: cb.totalBalancePaise },
          },
        });
      }
    }
  } else if (snapshot.backupType === 'SINGLE_TRANSACTION' && snapshot.transactions) {
    for (const t of snapshot.transactions) {
      if (t.status === TransactionStatus.APPROVED) {
        if (t.type === TransactionType.DEPOSIT) {
          const netPoints = t.amountPaise + (t.bonusPaise || 0);
          await prisma.user.update({
            where: { id: t.userId },
            data: {
              totalBalancePaise: { decrement: netPoints },
            },
          });
        } else if (t.type === TransactionType.WITHDRAWAL) {
          await prisma.user.update({
            where: { id: t.userId },
            data: {
              totalBalancePaise: { increment: t.amountPaise },
            },
          });
        }
      }
    }
  }

  // 4. Mark undo completed
  snapshot.isRestored = false;
  snapshot.canUndoUntil = null;

  await prisma.systemSetting.update({
    where: { key: `${SETTING_PREFIX}${snapshotId}` },
    data: { value: JSON.stringify(snapshot) },
  });

  return {
    ...snapshot,
    canUndo: false,
    undoSecondsRemaining: 0,
  };
};

/**
 * Permanently deletes a backup snapshot from the database (MongoDB) and deletes associated screenshot images.
 * This completely deletes client records, transactions, and files.
 */
export const deleteBackupPermanently = async (snapshotId: string) => {
  const record = await prisma.systemSetting.findUnique({
    where: { key: `${SETTING_PREFIX}${snapshotId}` },
  });

  if (!record) {
    throw new Error(`Backup snapshot "${snapshotId}" not found.`);
  }

  const snapshot: BackupSnapshotItem = JSON.parse(record.value);
  let deletedImagesCount = 0;
  let deletedClientsCount = 0;
  let deletedTransactionsCount = 0;

  // 1. Find and delete physical screenshot files
  if (snapshot.transactionIds && snapshot.transactionIds.length > 0) {
    const txnsWithImages = await prisma.transaction.findMany({
      where: { id: { in: snapshot.transactionIds } },
      select: { imageUrl: true },
    });

    for (const t of txnsWithImages) {
      if (t.imageUrl) {
        try {
          const cleanPath = t.imageUrl.replace(/^file:\/\//, '');
          if (fs.existsSync(cleanPath)) {
            fs.unlinkSync(cleanPath);
            deletedImagesCount++;
          }
        } catch (err) {
          console.warn('Could not delete image file:', t.imageUrl, err);
        }
      }
    }

    // 2. Permanently delete transaction records from MongoDB
    const txnDelRes = await prisma.transaction.deleteMany({
      where: { id: { in: snapshot.transactionIds } },
    });
    deletedTransactionsCount = txnDelRes.count;
  }

  // 3. Permanently delete client records from MongoDB
  if (snapshot.clientIds && snapshot.clientIds.length > 0) {
    const clientDelRes = await prisma.user.deleteMany({
      where: { id: { in: snapshot.clientIds } },
    });
    deletedClientsCount = clientDelRes.count;
  }

  // 4. Permanently remove snapshot setting
  await prisma.systemSetting.delete({
    where: { key: `${SETTING_PREFIX}${snapshotId}` },
  });

  return {
    success: true,
    deletedClientsCount,
    deletedTransactionsCount,
    deletedImagesCount,
  };
};
