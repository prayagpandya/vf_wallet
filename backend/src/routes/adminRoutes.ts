import { Router } from 'express';
import {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  updateEmployeePermissions,
  updateUserBonusConfig,
  toggleBlockUser,
  updateEmployeeLocation,
  getEmployeeLocations,
  resetApplicationData,
  deleteSingleClient,
  deleteSingleTransaction,
  getBackupSnapshotsList,
  restoreBackupSnapshotController,
  undoRestoreBackupSnapshotController,
  deleteBackupPermanentlyController,
} from '../controllers/adminController';
import {
  getAllTransactions,
  createClientDeposit,
  createClientWithdrawal,
  getAdminStats,
  getDailyBonusConfig,
  updateDailyBonusConfig,
} from '../controllers/adminTransactionController';
import { scanReceiptOcr } from '../controllers/ocrController';
import {
  authenticateToken,
  requireStaff,
  requireSuperAdmin,
  requireAnyPermission,
} from '../middleware/auth';

const router = Router();

// All routes require valid JWT and Staff role (Super Admin or Employee)
router.use(authenticateToken);
router.use(requireStaff);

// Clean Operational KPI Metrics (No Liability Wallet, No Pending Approval Queues)
// GET /api/admin/stats
router.get('/stats', getAdminStats);

// Client & Employee Account Management Routes
// POST /api/admin/users/create or /api/admin/users (Super Admin creates Client or Employee; Employee with canManageClients creates Client)
router.post('/users/create', createUser);
router.post('/users', createUser);

// GET /api/admin/users (Clients for all staff; Employees for Super Admin only)
router.get('/users', getAllUsers);

// GET /api/admin/users/:userId
router.get('/users/:userId', getUserById);

// PATCH /api/admin/users/:userId (Edit client/employee details)
router.patch('/users/:userId', updateUser);

// PATCH /api/admin/users/:userId/permissions (Super Admin ONLY)
router.patch('/users/:userId/permissions', requireSuperAdmin, updateEmployeePermissions);

// PATCH /api/admin/users/:userId/bonus-config (Granular canSetBonus / canSetThreshold checks inside controller)
router.patch(
  '/users/:userId/bonus-config',
  requireAnyPermission('canSetBonus', 'canSetThreshold'),
  updateUserBonusConfig
);

// PATCH /api/admin/users/:userId/toggle-block
router.patch('/users/:userId/toggle-block', toggleBlockUser);

// Server-side Reliable OCR Scanner
// POST /api/admin/ocr/scan
router.post(
  '/ocr/scan',
  requireAnyPermission('canOcrUpload', 'canDeposit'),
  scanReceiptOcr
);

// Auto-Accept Client Transactions (Instant Approval — No Pending Queue)
// POST /api/admin/clients/:clientId/deposit (OCR Upload or Manual Deposit)
router.post(
  '/clients/:clientId/deposit',
  requireAnyPermission('canOcrUpload', 'canDeposit'),
  createClientDeposit
);

// POST /api/admin/clients/:clientId/withdraw (Rule-Based Auto-Accept Withdrawal)
router.post(
  '/clients/:clientId/withdraw',
  requireAnyPermission('canWithdraw'),
  createClientWithdrawal
);

// Daily Running Bonus Rate Routes
// GET /api/admin/daily-bonus (Accessible to all staff to see today's active rate)
router.get('/daily-bonus', getDailyBonusConfig);

// POST /api/admin/daily-bonus (Super Admin OR staff granted canSetBonus or canSetThreshold)
router.post(
  '/daily-bonus',
  requireAnyPermission('canSetBonus', 'canSetThreshold'),
  updateDailyBonusConfig
);

// Master Transaction Ledger
// GET /api/admin/transactions
router.get('/transactions', getAllTransactions);

// Employee Location Tracking Routes
// POST /api/admin/employee/location (Active employee sends GPS coordinates)
router.post('/employee/location', updateEmployeeLocation);

// GET /api/admin/employees/locations (Super Admin views all active employees' live coordinates)
router.get('/employees/locations', getEmployeeLocations);

// Backup, App Reset, Soft-Delete & Restore Routes
// POST /api/admin/backup/reset-app (Super Admin one-click zero state reset)
router.post('/backup/reset-app', requireSuperAdmin, resetApplicationData);

// POST /api/admin/backup/delete-client/:id (Soft-delete single client & their transactions to backup)
router.post('/backup/delete-client/:id', deleteSingleClient);

// POST /api/admin/backup/delete-transaction/:id (Soft-delete single transaction to backup)
router.post('/backup/delete-transaction/:id', deleteSingleTransaction);

// GET /api/admin/backup/snapshots (List all archived snapshots and deleted items)
router.get('/backup/snapshots', getBackupSnapshotsList);

// POST /api/admin/backup/restore/:snapshotId (Restore an archived snapshot/transaction)
router.post('/backup/restore/:snapshotId', restoreBackupSnapshotController);

// POST /api/admin/backup/undo-restore/:snapshotId (Undo restore within 5 minutes)
router.post('/backup/undo-restore/:snapshotId', undoRestoreBackupSnapshotController);

// DELETE /api/admin/backup/permanent/:snapshotId (Super Admin permanent hard delete from DB & images)
router.delete('/backup/permanent/:snapshotId', requireSuperAdmin, deleteBackupPermanentlyController);

export default router;
