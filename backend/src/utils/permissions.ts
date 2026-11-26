import { Role } from '@prisma/client';

export interface EmployeePermissions {
  canOcrUpload: boolean;
  canDeposit: boolean;
  canWithdraw: boolean;
  canSetBonus: boolean;
  canSetThreshold: boolean;
  canManageClients: boolean;
}

export type PermissionKey = keyof EmployeePermissions;

export const ALL_PERMISSIONS: EmployeePermissions = {
  canOcrUpload: true,
  canDeposit: true,
  canWithdraw: true,
  canSetBonus: true,
  canSetThreshold: true,
  canManageClients: true,
};

export const DEFAULT_EMPLOYEE_PERMISSIONS: EmployeePermissions = {
  canOcrUpload: false,
  canDeposit: false,
  canWithdraw: false,
  canSetBonus: false,
  canSetThreshold: false,
  canManageClients: true,
};

/**
 * Normalizes any raw permissions JSON into a safe, strict EmployeePermissions object.
 * Super Admins and Admins always receive all permissions.
 */
export function resolveUserPermissions(
  role: Role,
  rawPermissions?: unknown
): EmployeePermissions {
  if (role === Role.SUPER_ADMIN || role === Role.ADMIN) {
    return { ...ALL_PERMISSIONS };
  }

  if (role !== Role.EMPLOYEE) {
    return { ...DEFAULT_EMPLOYEE_PERMISSIONS };
  }

  const obj =
    rawPermissions && typeof rawPermissions === 'object'
      ? (rawPermissions as Record<string, unknown>)
      : {};

  return {
    canOcrUpload: Boolean(obj.canOcrUpload),
    canDeposit: Boolean(obj.canDeposit),
    canWithdraw: Boolean(obj.canWithdraw),
    canSetBonus: Boolean(obj.canSetBonus),
    canSetThreshold: Boolean(obj.canSetThreshold),
    canManageClients: true, // All staff and superadmin have full client data access
  };
}

export function isSuperAdminRole(role: Role): boolean {
  return role === Role.SUPER_ADMIN || role === Role.ADMIN;
}

export function isStaffRole(role: Role): boolean {
  return role === Role.SUPER_ADMIN || role === Role.ADMIN || role === Role.EMPLOYEE;
}

export function isClientRole(role: Role): boolean {
  return role === Role.CLIENT || role === Role.USER;
}
