import { getPrismaClient } from '../lib/prisma.js';
import { ForbiddenError } from './error-handler.js';
import { getAllDescendantIds, getAllAncestorIds } from '../modules/units/service.js';

const prisma = getPrismaClient();

/**
 * Get admin's effective scope (what they can access)
 * Returns: { unitId, isGlobal, level, hierarchy }
 */
export const getAdminScope = async (userId) => {
  if (!userId) return { unitId: null, isGlobal: false, level: 'None' };

  const member = await prisma.member.findFirst({
    where: { authUserId: userId },
    include: {
      roleAssignments: {
        include: {
          role: true,
          unit: { include: { unitType: true } }
        }
      }
    }
  });

  if (!member || member.roleAssignments.length === 0) {
    return { unitId: null, isGlobal: false, level: 'None' };
  }

  // Check if National/Super Admin (Global scope)
  const isGlobal = member.roleAssignments.some(ra =>
    ra.role.name.toLowerCase().includes('national') ||
    ra.role.name.toLowerCase().includes('super')
  );

  if (isGlobal) {
    return {
      unitId: null,
      isGlobal: true,
      level: 'National',
      hierarchy: { national: true }
    };
  }

  // Find highest-level unit assignment
  // Hierarchy: National → Area → State → Zone → Branch
  const hierarchyLevels = ['Area', 'State', 'Zone', 'Branch'];
  for (const level of hierarchyLevels) {
    const assignment = member.roleAssignments.find(ra =>
      ra.unit?.unitType?.name === level
    );
    if (assignment) {
      return {
        unitId: assignment.unitId,
        isGlobal: false,
        level: level,
        unitName: assignment.unit.name,
        hierarchy: { [level.toLowerCase()]: true }
      };
    }
  }

  // Fallback to first assignment
  const firstAssignment = member.roleAssignments[0];
  return {
    unitId: firstAssignment.unitId,
    isGlobal: false,
    level: firstAssignment.unit?.unitType?.name || 'Unknown',
    unitName: firstAssignment.unit?.name,
    hierarchy: {}
  };
};

/**
 * Check if target unit is within user's scope (downward only)
 * Returns: boolean
 */
export const isWithinScope = async (userId, targetUnitId) => {
  if (!targetUnitId) return true; // Global resource

  const scope = await getAdminScope(userId);

  // Global admins can access anything
  if (scope.isGlobal) return true;

  // No scope assignment = no access
  if (!scope.unitId) return false;

  // Same unit = access
  if (scope.unitId === targetUnitId) return true;

  // Check if target is descendant (downward only)
  const descendants = await getAllDescendantIds(scope.unitId);
  return descendants.includes(targetUnitId);
};

/**
 * Verify admin is NOT trying to access parent/sibling
 * Returns: boolean (true if trying to access upward/sideways)
 */
export const isAccessViolation = async (userId, targetUnitId) => {
  if (!targetUnitId) return false; // Global OK

  const scope = await getAdminScope(userId);
  if (scope.isGlobal) return false; // Global OK

  // Check if target is ancestor (upward = violation)
  const ancestors = await getAllAncestorIds(scope.unitId);
  if (ancestors.includes(targetUnitId)) {
    return true; // Trying to access parent
  }

  // Check if target is sibling (sideways = violation)
  if (scope.unitId) {
    const targetUnit = await prisma.unit.findUnique({
      where: { id: targetUnitId },
      select: { parentId: true }
    });

    const ourUnit = await prisma.unit.findUnique({
      where: { id: scope.unitId },
      select: { parentId: true }
    });

    // Same parent = siblings
    if (targetUnit?.parentId && ourUnit?.parentId === targetUnit.parentId) {
      return true; // Trying to access sibling
    }
  }

  return false;
};

/**
 * Middleware: Enforce scope on resource
 * Usage: app.get('/api/events/:id', requireScope('unitId'), handler)
 */
export const requireScope = (paramName = 'unitId') => {
  return async (req, res, next) => {
    try {
      if (!req.userId) {
        return next(new ForbiddenError('User not authenticated'));
      }

      // Get target unit from request (param, query, or body)
      const targetUnitId = req.params[paramName] || 
                          req.query[paramName] || 
                          req.body?.[paramName];

      if (!targetUnitId) {
        // No scope parameter = global resource, allow it
        return next();
      }

      // Check if access violation
      const violation = await isAccessViolation(req.userId, targetUnitId);
      if (violation) {
        return next(new ForbiddenError('Cannot access unit outside your scope'));
      }

      // Check if within scope
      const allowed = await isWithinScope(req.userId, targetUnitId);
      if (!allowed) {
        return next(new ForbiddenError('Access denied: unit outside your scope'));
      }

      // Attach scope to request for use in controller
      req.adminScope = await getAdminScope(req.userId);
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Automatically filter query results by scope
 * Returns: where clause for Prisma
 */
export const getScopeFilter = async (userId, field = 'unitId') => {
  const scope = await getAdminScope(userId);

  if (scope.isGlobal) {
    return {}; // No filter for global
  }

  if (!scope.unitId) {
    return { [field]: null }; // Only null/unscoped
  }

  // Get all descendants
  const descendants = await getAllDescendantIds(scope.unitId);

  return {
    [field]: {
      in: [scope.unitId, ...descendants]
    }
  };
};

/**
 * Verify user can manage another user (downward only)
 * Cannot manage self, cannot manage upward/sideways
 */
export const canManageUser = async (adminId, targetUserId) => {
  if (adminId === targetUserId) {
    return false; // Cannot manage self
  }

  const adminScope = await getAdminScope(adminId);
  
  // Global admins (National) can manage anyone
  if (adminScope.isGlobal) {
    return true;
  }

  // For non-global admins, get target user's scope and check if within our scope
  const targetMember = await prisma.member.findFirst({
    where: { authUserId: targetUserId },
    include: {
      roleAssignments: {
        include: {
          unit: true
        }
      }
    }
  });

  if (!targetMember || targetMember.roleAssignments.length === 0) {
    return false; // Target user has no roles assigned
  }

  const targetAssignment = targetMember.roleAssignments[0];
  if (!targetAssignment?.unitId) {
    return false; // Target has no unit scope
  }

  // Can only manage if target is within admin's scope (downward only)
  return isWithinScope(adminId, targetAssignment.unitId);
};

/**
 * Verify communication is downward only
 * National can message anyone
 * Others can only message descendants
 */
export const canCommunicate = async (senderId, recipientId) => {
  const senderScope = await getAdminScope(senderId);

  // Global can message anyone
  if (senderScope.isGlobal) return true;

  // Get recipient's unit
  const recipientMember = await prisma.member.findFirst({
    where: { authUserId: recipientId },
    include: {
      roleAssignments: {
        include: { unit: true }
      }
    }
  });

  if (!recipientMember || !recipientMember.roleAssignments[0]?.unitId) {
    return false; // Can't reach unscoped user
  }

  const recipientUnitId = recipientMember.roleAssignments[0].unitId;

  // Check if recipient is within sender's scope
  return isWithinScope(senderId, recipientUnitId);
};
