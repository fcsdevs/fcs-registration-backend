/**
 * Scope-aware query helpers
 * Use these to automatically filter queries by user's scope
 */

import { getAllDescendantIds } from '../modules/units/service.js';
import { getAdminScope } from './scope-validator.js';

/**
 * Build WHERE clause that filters by user's scope
 * Usage: const events = prisma.event.findMany({ where: await scopedWhere(userId, 'unitId') })
 */
export const scopedWhere = async (userId, unitField = 'unitId') => {
  const scope = await getAdminScope(userId);

  // Global admin sees everything
  if (scope.isGlobal) {
    return {};
  }

  // No scope = no access to scoped resources
  if (!scope.unitId) {
    return { [unitField]: null };
  }

  // Get all descendants
  const descendants = await getAllDescendantIds(scope.unitId);

  // User can see their own unit + all descendants
  return {
    [unitField]: {
      in: [scope.unitId, ...descendants]
    }
  };
};

/**
 * Filter a list of records by user's scope
 * Returns: filtered array
 */
export const filterByScope = async (userId, records, getUnitId) => {
  const scope = await getAdminScope(userId);

  if (scope.isGlobal) return records;
  if (!scope.unitId) return [];

  const descendants = await getAllDescendantIds(scope.unitId);
  const allowedUnits = [scope.unitId, ...descendants];

  return records.filter(record => {
    const unitId = getUnitId(record);
    return allowedUnits.includes(unitId);
  });
};

/**
 * Verify user can access a specific record by scope
 * Returns: boolean
 */
export const canAccessRecord = async (userId, record, getUnitId) => {
  const scope = await getAdminScope(userId);

  if (scope.isGlobal) return true;
  if (!scope.unitId) return false;

  const recordUnitId = getUnitId(record);
  if (recordUnitId === scope.unitId) return true;

  const descendants = await getAllDescendantIds(scope.unitId);
  return descendants.includes(recordUnitId);
};

/**
 * Build response with scope-aware pagination
 * Usage: return buildScopedResponse(await scopedFindMany(...), userId)
 */
export const buildScopedResponse = (data, pagination = {}) => {
  return {
    data,
    pagination: {
      page: pagination.page || 1,
      limit: pagination.limit || 50,
      total: pagination.total || data.length,
      pages: Math.ceil((pagination.total || data.length) / (pagination.limit || 50))
    }
  };
};
