import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { Role, TransactionType, TransactionStatus } from '@prisma/client';
import { isClientRole } from '../utils/permissions';
import {
  getRunningDailyBonusRate,
  setRunningDailyBonusRate,
  setRunningDailySettings,
  getTodayDateString,
} from '../utils/dailyBonus';

/**
 * POST /api/admin/clients/:clientId/deposit
 * Auto-Accept Deposit for a selected Client (via OCR screenshot upload or manual entry).
 * - Enforces granular employee permissions:
 *     - OCR upload requires `canOcrUpload` (or Super Admin)
 *     - Manual deposit requires `canDeposit` (or Super Admin)
 * - Enforces Anti-Fraud Duplicate UTR & SHA-256 Image Hash checks (HTTP 409).
 * - Atomically creates an APPROVED transaction and credits Principal + Custom Bonus to client.
 */
export const createClientDeposit = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    const { clientId } = req.params;
    const {
      amountPaise,
      amount,
      utr,
      imageHash,
      imageUrl,
      screenshotUri,
      paymentApp,
      rawOcrData,
      submissionSource,
      notes,
    } = req.body;

    const isOcrSubmission =
      submissionSource === 'manual'
        ? false
        : submissionSource === 'ocr' ||
          submissionSource === 'gallery' ||
          submissionSource === 'whatsapp_share' ||
          Boolean(imageHash || imageUrl || screenshotUri);

    // Granular Permission Check
    if (!req.user.isSuperAdmin) {
      if (isOcrSubmission && !req.user.permissions.canOcrUpload) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You do not have OCR Upload permission.',
        });
      }
      if (!isOcrSubmission && !req.user.permissions.canDeposit) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You do not have Direct Deposit permission.',
        });
      }
    }

    // Parse positive integer amount in paise
    let parsedAmountPaise = Number(amountPaise);
    if (isNaN(parsedAmountPaise) || parsedAmountPaise <= 0) {
      if (amount !== undefined && !isNaN(Number(amount))) {
        parsedAmountPaise = Math.round(Number(amount) * 100);
      }
    }

    if (isNaN(parsedAmountPaise) || parsedAmountPaise <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Deposit amount must be a positive value.',
      });
    }

    // Validate or auto-create Client account on-the-fly
    let client: any = null;
    if (clientId && clientId !== 'new') {
      client = await prisma.user.findUnique({
        where: { id: clientId },
      });
      if (client?.isArchived) {
        return res.status(400).json({
          success: false,
          error: 'This client is archived in Backup & Restore. Please restore the client before depositing.',
        });
      }
    }

    // On-the-fly client creation by name & phone if client not found or clientId === 'new'
    const { clientName, clientPhone } = req.body;
    if (!client && clientName && typeof clientName === 'string' && clientName.trim()) {
      const cleanName = clientName.trim();
      const cleanClientPhone =
        clientPhone && typeof clientPhone === 'string' && clientPhone.trim()
          ? clientPhone.trim()
          : null;

      if (!cleanClientPhone) {
        return res.status(400).json({
          success: false,
          error: 'Client phone number is required to register a new client.',
        });
      }

      // Check if phone already registered
      const existingClient = await prisma.user.findUnique({
        where: { phone: cleanClientPhone },
      });

      if (existingClient) {
        if (existingClient.isArchived) {
          // Reactivate client from archived state
          client = await prisma.user.update({
            where: { id: existingClient.id },
            data: { isArchived: false, backupBatchId: null },
          });
        } else {
          client = existingClient;
        }
      } else {
        // Fetch running daily rates for new client default setup
        const dailySettings = await getRunningDailyBonusRate();
        // Create new client account on-the-fly
        client = await prisma.user.create({
          data: {
            name: cleanName,
            phone: cleanClientPhone,
            role: Role.CLIENT,
            bonusPercentage: dailySettings.isActive ? dailySettings.percentage : 0.0,
            totalBalancePaise: 0,
            activeBonusPaise: 0,
            lastDepositAmountPaise: 0,
            cycleWithdrawnPaise: 0,
            isBonusDeductedInCycle: false,
          },
        });
      }
    }

    if (!client || !isClientRole(client.role)) {
      return res.status(404).json({
        success: false,
        error: 'Target client account not found. Please provide a valid client ID or name & phone number.',
      });
    }

    if (client.isBlocked) {
      return res.status(403).json({
        success: false,
        error: `Client "${client.name}" is currently blocked and cannot receive deposits.`,
      });
    }

    const cleanUtr =
      utr && typeof utr === 'string' && utr.trim() ? utr.trim() : null;
    const cleanImageHash =
      imageHash && typeof imageHash === 'string' && imageHash.trim()
        ? imageHash.trim()
        : null;

    // Strict Anti-Tamper Rule: Scanned values (amount & UTR) cannot be modified in OCR mode.
    // If manual adjustments or direct entry are needed, staff must submit as Direct Deposit ('manual').
    if (isOcrSubmission) {
      if (!cleanImageHash && !imageUrl && !screenshotUri) {
        return res.status(400).json({
          success: false,
          error: 'A receipt screenshot is required for OCR deposit submissions.',
        });
      }

      if (rawOcrData && typeof rawOcrData === 'object') {
        const ocrAmountPaise =
          typeof rawOcrData.amountPaise === 'number' ? rawOcrData.amountPaise : null;

        if (ocrAmountPaise && ocrAmountPaise > 0) {
          if (ocrAmountPaise !== parsedAmountPaise) {
            return res.status(400).json({
              success: false,
              error: `Anti-tamper violation: Scanned deposit amount (₹${(ocrAmountPaise / 100).toLocaleString('en-IN')}) cannot be modified in OCR mode. To enter or modify deposit values manually, please submit via Direct Deposit.`,
            });
          }
        } else {
          return res.status(400).json({
            success: false,
            error:
              'OCR could not detect the deposit amount from this screenshot. To enter values manually, please submit via Direct Deposit.',
          });
        }

        const detectedUtr =
          rawOcrData.utrNumber ||
          rawOcrData.upiRefNumber ||
          (rawOcrData.transactionId && !rawOcrData.transactionId.startsWith('TXN-')
            ? rawOcrData.transactionId
            : null);

        if (detectedUtr) {
          const cleanDetected = detectedUtr.toString().trim().replace(/[\s-]/g, '').toLowerCase();
          const cleanProvided = cleanUtr ? cleanUtr.trim().replace(/[\s-]/g, '').toLowerCase() : '';

          if (cleanDetected && cleanProvided && cleanDetected !== cleanProvided) {
            return res.status(400).json({
              success: false,
              error: `Anti-tamper violation: Scanned UTR (${detectedUtr}) cannot be modified in OCR mode. To enter or modify reference details manually, please submit via Direct Deposit.`,
            });
          }
        }
      }
    }

    // 1. Anti-fraud: Check duplicate screenshot hash
    if (cleanImageHash) {
      const existingHash = await prisma.transaction.findFirst({
        where: {
          imageHash: cleanImageHash,
          status: { in: [TransactionStatus.PENDING, TransactionStatus.APPROVED] },
        },
      });

      if (existingHash) {
        return res.status(409).json({
          success: false,
          error: 'This payment screenshot has already been uploaded and processed.',
          duplicateType: 'imageHash',
          existingTransactionId: existingHash.id,
        });
      }
    }

    // 2. Anti-fraud: Check duplicate UTR reference
    if (cleanUtr) {
      const existingUtr = await prisma.transaction.findFirst({
        where: {
          utr: cleanUtr,
          status: { in: [TransactionStatus.PENDING, TransactionStatus.APPROVED] },
        },
      });

      if (existingUtr) {
        return res.status(409).json({
          success: false,
          error: `Duplicate UTR detected: Transaction reference "${cleanUtr}" already exists.`,
          duplicateType: 'utr',
          existingTransactionId: existingUtr.id,
        });
      }
    }

    // 3. Determine effective bonus percentage & calculate bonus points
    const dailyBonusInfo = await getRunningDailyBonusRate();
    const effectiveBonusRate =
      client.bonusPercentage && client.bonusPercentage > 0
        ? client.bonusPercentage
        : dailyBonusInfo.isActive
        ? dailyBonusInfo.percentage
        : 0.0;

    const newDepositBonusPaise = Math.round((parsedAmountPaise * effectiveBonusRate) / 100);

    // Points Cycle Rule:
    // If client had an active bonus in the current cycle that has not yet been deducted,
    // that previous bonus is superseded/reverted so only the latest deposit's bonus remains active!
    let previousBonusToRevertPaise = 0;
    if (client.activeBonusPaise && client.activeBonusPaise > 0 && !client.isBonusDeductedInCycle) {
      previousBonusToRevertPaise = client.activeBonusPaise;
    }

    const netPointsAddedPaise = parsedAmountPaise + newDepositBonusPaise - previousBonusToRevertPaise;

    // 4. AUTO-ACCEPT Atomic Transaction: Create APPROVED deposit & credit client points
    const [transaction, updatedClient] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          userId: client.id,
          type: TransactionType.DEPOSIT,
          status: TransactionStatus.APPROVED,
          amountPaise: parsedAmountPaise, // Principal cash deposited
          bonusPaise: newDepositBonusPaise, // Bonus points credited
          cashPaidPaise: 0,
          withdrawablePaise: 0,
          utr: cleanUtr,
          imageHash: cleanImageHash,
          imageUrl: imageUrl || screenshotUri || null,
          paymentApp: paymentApp || (isOcrSubmission ? 'UPI OCR' : 'Direct Deposit'),
          rawOcrData: {
            ...(typeof rawOcrData === 'object' ? rawOcrData : {}),
            notes: notes || undefined,
            bonusPercentageApplied: effectiveBonusRate,
            dailyBonusDate: dailyBonusInfo.date,
            previousBonusReplacedPaise: previousBonusToRevertPaise,
            netPointsAddedPaise,
            newActiveBonusPaise: newDepositBonusPaise,
            submissionSource: isOcrSubmission ? 'ocr' : 'manual',
          },
          processedByAdminId: req.user.userId,
          processedByName: req.user.name,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              bonusPercentage: true,
              totalBalancePaise: true,
              activeBonusPaise: true,
            },
          },
        },
      }),
      prisma.user.update({
        where: { id: client.id },
        data: {
          totalBalancePaise: {
            increment: netPointsAddedPaise,
          },
          activeBonusPaise: newDepositBonusPaise,
          lastDepositAmountPaise: parsedAmountPaise,
          cycleWithdrawnPaise: 0,
          isBonusDeductedInCycle: false,
        },
        select: {
          id: true,
          name: true,
          totalBalancePaise: true,
          activeBonusPaise: true,
        },
      }),
    ]);

    return res.status(201).json({
      success: true,
      message: previousBonusToRevertPaise > 0
        ? `Deposit credited! Added ${(parsedAmountPaise / 100).toLocaleString('en-IN')} Cash Points. Previous active bonus (${(previousBonusToRevertPaise / 100).toLocaleString('en-IN')} Points) was replaced with ${(newDepositBonusPaise / 100).toLocaleString('en-IN')} Points (${effectiveBonusRate}%). Total balance: ${(updatedClient.totalBalancePaise / 100).toLocaleString('en-IN')} Points.`
        : `Deposit credited! Added ${(parsedAmountPaise / 100).toLocaleString('en-IN')} Points (Cash: ₹${(parsedAmountPaise / 100).toLocaleString('en-IN')} + ${effectiveBonusRate}% Bonus: ${(newDepositBonusPaise / 100).toLocaleString('en-IN')} Points) to ${updatedClient.name}. Total balance: ${(updatedClient.totalBalancePaise / 100).toLocaleString('en-IN')} Points.`,
      transaction: {
        ...transaction,
        bonusPercentage: effectiveBonusRate,
        totalCreditPaise: parsedAmountPaise + newDepositBonusPaise,
      },
      creditedTotalPaise: netPointsAddedPaise,
      clientNewBalancePaise: updatedClient.totalBalancePaise,
      activeBonusPaise: updatedClient.activeBonusPaise,
    });
  } catch (error: any) {
    console.error('Error in createClientDeposit:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process client deposit.',
    });
  }
};

/**
 * POST /api/admin/clients/:clientId/withdraw
 * Auto-Accept Points Cycle Withdrawal for a selected Client.
 * - Requires `canWithdraw` permission (or Super Admin).
 * - Enforces Points Cycle Rule:
 *     If full cashout / qualifying withdrawal:
 *       active cycle bonus is deducted once from cash payout.
 *     Subsequent withdrawals in the cycle:
 *       100% full cash paid, no bonus deduction.
 * - Atomically creates an APPROVED withdrawal and debits client's balance immediately.
 */
export const createClientWithdrawal = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    if (!req.user.isSuperAdmin && !req.user.permissions.canWithdraw) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You do not have Withdrawal permission.',
      });
    }

    const { clientId } = req.params;
    const {
      amountPaise,
      amount,
      paymentApp,
      paymentMethod,
      upiId,
      bankDetails,
      notes,
      imageUrl,
      screenshotUri,
      imageHash,
    } = req.body;

    let parsedAmountPaise = Number(amountPaise);
    if (isNaN(parsedAmountPaise) || parsedAmountPaise <= 0) {
      if (amount !== undefined && !isNaN(Number(amount))) {
        parsedAmountPaise = Math.round(Number(amount) * 100);
      }
    }

    if (isNaN(parsedAmountPaise) || parsedAmountPaise <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Withdrawal amount must be a positive value.',
      });
    }

    const client = await prisma.user.findUnique({
      where: { id: clientId },
    });

    if (!client || !isClientRole(client.role) || client.isArchived) {
      return res.status(404).json({
        success: false,
        error: 'Target client account not found or is currently archived in Backup & Restore.',
      });
    }

    if (client.isBlocked) {
      return res.status(403).json({
        success: false,
        error: `Client "${client.name}" is currently blocked and cannot withdraw funds.`,
      });
    }

    // Points & Cycle Deduction Rules:
    // Withdrawal is NOT restricted by current wallet points balance.
    // 1. Check if any withdrawal was already done without deposit again in this cycle:
    const wasWithdrawalAlreadyDoneInCycle = Boolean(client.isBonusDeductedInCycle);
    const activeBonusPaise = client.activeBonusPaise || 0;
    const previousCycleWithdrawn = client.cycleWithdrawnPaise || 0;
    const newCycleWithdrawn = previousCycleWithdrawn + parsedAmountPaise;

    let bonusExcludedPaise = 0;
    let isBonusDeductionTriggered = false;

    if (wasWithdrawalAlreadyDoneInCycle) {
      // If any withdrawal was already done without deposit again, give all demanded points
      bonusExcludedPaise = 0;
      isBonusDeductionTriggered = false;
    } else {
      // If no withdrawal done yet in this cycle:
      // If withdrawal is equal to balance or greater than balance: deduct bonus points from last deposit
      if (parsedAmountPaise >= client.totalBalancePaise && activeBonusPaise > 0) {
        bonusExcludedPaise = activeBonusPaise;
        isBonusDeductionTriggered = true;
      } else {
        // Partial withdrawal below balance: give all demanded points, active bonus remains in wallet
        bonusExcludedPaise = 0;
        isBonusDeductionTriggered = false;
      }
    }

    const actualPayoutPaise = Math.max(0, parsedAmountPaise - bonusExcludedPaise);
    const newTotalBalancePaise = Math.max(0, client.totalBalancePaise - parsedAmountPaise);

    const paymentAppStr = upiId
      ? `UPI: ${upiId}`
      : bankDetails?.accountNumber
      ? `Bank: ${bankDetails.bankName || 'A/C'} (${bankDetails.accountNumber})`
      : paymentApp || paymentMethod || 'Direct Payout';

    const rawData = {
      ...(bankDetails || {}),
      upiId: upiId || null,
      notes: notes || null,
      requestedPointsPaise: parsedAmountPaise,
      bonusExcludedPaise,
      actualPayoutPaise,
      activeBonusAtStartPaise: activeBonusPaise,
      isBonusDeductionTriggered,
      cumulativeCycleWithdrawnPaise: newCycleWithdrawn,
      balanceBeforePaise: client.totalBalancePaise,
      balanceAfterPaise: newTotalBalancePaise,
    };

    // AUTO-ACCEPT Atomic Transaction: Create APPROVED withdrawal & update client balance
    const [transaction, updatedClient] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          userId: client.id,
          type: TransactionType.WITHDRAWAL,
          status: TransactionStatus.APPROVED,
          amountPaise: parsedAmountPaise, // Requested debited points
          bonusPaise: bonusExcludedPaise, // Bonus points cut
          cashPaidPaise: actualPayoutPaise, // Actual cash (INR) payout sent
          withdrawablePaise: actualPayoutPaise,
          imageUrl: imageUrl || screenshotUri || null,
          imageHash: imageHash || null,
          paymentApp: paymentAppStr,
          rejectionReason: notes || null,
          rawOcrData: rawData,
          processedByAdminId: req.user.userId,
          processedByName: req.user.name,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              bonusPercentage: true,
              totalBalancePaise: true,
              activeBonusPaise: true,
              isBonusDeductedInCycle: true,
            },
          },
        },
      }),
      prisma.user.update({
        where: { id: client.id },
        data: {
          totalBalancePaise: newTotalBalancePaise,
          ...(isBonusDeductionTriggered
            ? {
                activeBonusPaise: 0,
                isBonusDeductedInCycle: true,
                cycleWithdrawnPaise: newCycleWithdrawn,
              }
            : {
                cycleWithdrawnPaise: newCycleWithdrawn,
              }),
        },
        select: {
          id: true,
          name: true,
          totalBalancePaise: true,
          activeBonusPaise: true,
          isBonusDeductedInCycle: true,
        },
      }),
    ]);

    return res.status(201).json({
      success: true,
      message: isBonusDeductionTriggered
        ? `Withdrawal Approved! Debited ${(parsedAmountPaise / 100).toLocaleString(
            'en-IN'
          )} Points. Deducted ${(bonusExcludedPaise / 100).toLocaleString(
            'en-IN'
          )} Bonus Points. Pay ₹${(actualPayoutPaise / 100).toLocaleString(
            'en-IN'
          )} Cash to ${updatedClient.name}.`
        : `Withdrawal Approved! Debited ${(parsedAmountPaise / 100).toLocaleString(
            'en-IN'
          )} Points. Pay ₹${(actualPayoutPaise / 100).toLocaleString('en-IN')} Cash to ${
            updatedClient.name
          } (Full 100% Cashout).`,
      transaction: {
        ...transaction,
        bonusDeductedPaise: bonusExcludedPaise,
        cashPaidPaise: actualPayoutPaise,
      },
      requestedPointsPaise: parsedAmountPaise,
      bonusDeductedPaise: bonusExcludedPaise,
      cashPaidPaise: actualPayoutPaise,
      withdrawablePaise: actualPayoutPaise,
      clientNewBalancePaise: updatedClient.totalBalancePaise,
      activeBonusRemainingPaise: updatedClient.activeBonusPaise,
      isCycleBonusDeducted: updatedClient.isBonusDeductedInCycle,
    });
  } catch (error: any) {
    console.error('Error in createClientWithdrawal:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process client withdrawal.',
    });
  }
};

/**
 * GET /api/admin/transactions
 * Returns master ledger of transactions with filtering (status, type, userId, search, pagination).
 */
export const getAllTransactions = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { status, type, userId, search, page, limit, includeArchived } = req.query;

    const whereClause: any = {};

    if (includeArchived !== 'true') {
      whereClause.isArchived = { not: true };
    }

    if (
      status &&
      (status === 'PENDING' || status === 'APPROVED' || status === 'REJECTED')
    ) {
      whereClause.status = status as TransactionStatus;
    }

    if (type && (type === 'DEPOSIT' || type === 'WITHDRAWAL' || type === 'BONUS')) {
      whereClause.type = type as TransactionType;
    }

    if (userId && typeof userId === 'string') {
      whereClause.userId = userId;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      whereClause.OR = [
        { utr: { contains: q, mode: 'insensitive' } },
        { paymentApp: { contains: q, mode: 'insensitive' } },
        { processedByName: { contains: q, mode: 'insensitive' } },
        { user: { name: { contains: q, mode: 'insensitive' } } },
        { user: { phone: { contains: q } } },
      ];
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [total, transactions] = await Promise.all([
      prisma.transaction.count({ where: whereClause }),
      prisma.transaction.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              bonusPercentage: true,
              isBlocked: true,
              totalBalancePaise: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
    ]);

    return res.status(200).json({
      success: true,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      transactions: transactions.map((t) => ({
        ...t,
        cashPaidPaise:
          t.type === 'WITHDRAWAL'
            ? t.cashPaidPaise || Math.max(0, t.amountPaise - t.bonusPaise)
            : 0,
        bonusDeductedPaise: t.type === 'WITHDRAWAL' ? t.bonusPaise : 0,
        totalCreditPaise:
          t.type === 'DEPOSIT' ? t.amountPaise + t.bonusPaise : undefined,
      })),
    });
  } catch (error: any) {
    console.error('Error in getAllTransactions:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve transactions.',
    });
  }
};

/**
 * GET /api/admin/stats
 * Clean Operational KPI Metrics for Dashboard (Auto-Accept System).
 * Per specification: NO Liability Wallet and NO Pending Approval Request Queues.
 */
export const getAdminStats = async (
  _req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const [totalClients, totalEmployees, transactions, clientsBalanceAgg] = await Promise.all([
      prisma.user.count({
        where: {
          role: { in: [Role.CLIENT, Role.USER] },
          isArchived: { not: true },
        },
      }),
      prisma.user.count({
        where: {
          role: Role.EMPLOYEE,
          isArchived: { not: true },
        },
      }),
      prisma.transaction.findMany({
        where: {
          status: TransactionStatus.APPROVED,
          isArchived: { not: true } as any,
        },
        select: {
          type: true,
          amountPaise: true,
          bonusPaise: true,
          cashPaidPaise: true,
        },
      }),
      prisma.user.aggregate({
        where: {
          role: { in: [Role.CLIENT, Role.USER] },
          isArchived: { not: true },
        },
        _sum: { totalBalancePaise: true, activeBonusPaise: true },
      }),
    ]);

    let totalCashDepositedPaise = 0;
    let totalPointsDepositedPaise = 0;
    let totalPointsWithdrawnPaise = 0;
    let totalCashWithdrawnPaise = 0;
    let totalBonusGivenPaise = 0;
    let totalBonusDeductedPaise = 0;

    for (const txn of transactions) {
      if (txn.type === TransactionType.DEPOSIT) {
        totalCashDepositedPaise += txn.amountPaise;
        totalBonusGivenPaise += txn.bonusPaise;
        totalPointsDepositedPaise += txn.amountPaise + txn.bonusPaise;
      } else if (txn.type === TransactionType.WITHDRAWAL) {
        totalPointsWithdrawnPaise += txn.amountPaise;
        totalBonusDeductedPaise += txn.bonusPaise;
        totalCashWithdrawnPaise +=
          txn.cashPaidPaise || Math.max(0, txn.amountPaise - txn.bonusPaise);
      } else if (txn.type === TransactionType.BONUS) {
        totalBonusGivenPaise += txn.amountPaise;
        totalPointsDepositedPaise += txn.amountPaise;
      }
    }

    return res.status(200).json({
      success: true,
      stats: {
        totalClients,
        totalEmployees,
        totalUsers: totalClients,
        totalTransactionsCount: transactions.length,
        // The 4 Core Ledger Metrics
        totalCashDepositedPaise,
        totalCashDepositedRupees: totalCashDepositedPaise / 100,
        totalPointsDepositedPaise,
        totalPointsDepositedPoints: totalPointsDepositedPaise / 100,
        totalPointsWithdrawnPaise,
        totalPointsWithdrawnPoints: totalPointsWithdrawnPaise / 100,
        totalCashWithdrawnPaise,
        totalCashWithdrawnRupees: totalCashWithdrawnPaise / 100,

        // Points Balance & Cycle Metrics
        totalClientsPointsBalancePaise: clientsBalanceAgg._sum.totalBalancePaise || 0,
        totalClientsPointsBalancePoints:
          (clientsBalanceAgg._sum.totalBalancePaise || 0) / 100,
        totalActiveBonusPaise: clientsBalanceAgg._sum.activeBonusPaise || 0,
        totalBonusGivenPaise,
        totalBonusGivenRupees: totalBonusGivenPaise / 100,
        totalBonusDeductedPaise,
        totalBonusDeductedRupees: totalBonusDeductedPaise / 100,

        // Backward compatibility keys
        totalApprovedDepositsPaise: totalCashDepositedPaise,
        totalApprovedDepositsRupees: totalCashDepositedPaise / 100,
        totalApprovedWithdrawalsPaise: totalPointsWithdrawnPaise,
        totalApprovedWithdrawalsRupees: totalPointsWithdrawnPaise / 100,
      },
    });
  } catch (error: any) {
    console.error('Error fetching admin stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve operational statistics.',
    });
  }
};

/**
 * GET /api/admin/daily-bonus
 * Returns the active daily running bonus configuration.
 */
export const getDailyBonusConfig = async (
  _req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const dailyInfo = await getRunningDailyBonusRate();
    return res.status(200).json({
      success: true,
      ...dailyInfo,
      message: dailyInfo.isActive
        ? `Today's running bonus rate is ${dailyInfo.percentage}%.`
        : 'No bonus is currently active for today (0%).',
    });
  } catch (error: any) {
    console.error('Error fetching daily bonus config:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve daily bonus configuration.',
    });
  }
};

/**
 * POST /api/admin/daily-bonus
 * Manage running daily bonus percentage.
 * Permitted for Super Admin and employees granted `canSetBonus`.
 */
export const updateDailyBonusConfig = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.',
      });
    }

    const isSuperAdmin = Boolean(req.user.isSuperAdmin);
    const canSetBonus = isSuperAdmin || Boolean(req.user.permissions?.canSetBonus);

    if (!canSetBonus) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You do not have permission to manage daily bonus rates.',
      });
    }

    const { percentage, isActive } = req.body;

    let parsedRate: number | undefined = undefined;
    let parsedIsActive: boolean | undefined = undefined;

    if (percentage !== undefined) {
      parsedRate = Number(percentage);
      if (isNaN(parsedRate) || parsedRate < 0 || parsedRate > 100) {
        return res.status(400).json({
          success: false,
          error: 'Bonus percentage must be between 0% and 100%.',
        });
      }
    }

    if (isActive !== undefined) {
      parsedIsActive = Boolean(isActive);
    }

    const record = await setRunningDailySettings({
      percentage: parsedRate,
      isActive: parsedIsActive,
      adminId: req.user.userId,
      adminName: req.user.name,
    });

    return res.status(200).json({
      success: true,
      message: 'Daily running bonus rate updated successfully.',
      dailyBonus: record,
      percentage: record.percentage,
      isActive: record.isActive,
      date: record.date,
    });
  } catch (error: any) {
    console.error('Error updating daily bonus config:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update daily bonus configuration.',
    });
  }
};
