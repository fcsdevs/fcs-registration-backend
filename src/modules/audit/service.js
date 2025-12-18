import { getPrismaClient } from '../../lib/prisma.js';
import { NotFoundError } from '../../middleware/error-handler.js';

const prisma = getPrismaClient();

/**
 * Create audit log entry
 */
export const createAuditLog = async (data) => {
  const {
    entityType,
    entityId,
    action,
    changes,
    userId,
    userRole,
    ipAddress,
    userAgent,
  } = data;

  const auditLog = await prisma.auditLog.create({
    data: {
      entityType,
      entityId,
      action,
      changes,
      userId,
      userRole,
      ipAddress,
      userAgent,
      timestamp: new Date(),
    },
  });

  return auditLog;
};

/**
 * Log entity change (for audit trail)
 */
export const logEntityChange = async (data) => {
  const {
    entityType,
    entityId,
    action,
    oldValues,
    newValues,
    userId,
    userRole,
    ipAddress,
    userAgent,
  } = data;

  const changes = {};
  if (oldValues && newValues) {
    Object.keys(newValues).forEach((key) => {
      if (oldValues[key] !== newValues[key]) {
        changes[key] = {
          oldValue: oldValues[key],
          newValue: newValues[key],
        };
      }
    });
  }

  return createAuditLog({
    entityType,
    entityId,
    action,
    changes,
    userId,
    userRole,
    ipAddress,
    userAgent,
  });
};

/**
 * Get audit trail for entity
 */
export const getEntityAuditTrail = async (entityType, entityId, query = {}) => {
  const { page = 1, limit = 50, action } = query;
  const skip = (page - 1) * limit;

  const where = {
    entityType,
    entityId,
    ...(action && { action }),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get user audit trail (all actions by user)
 */
export const getUserAuditTrail = async (userId, query = {}) => {
  const { page = 1, limit = 50, entityType, action } = query;
  const skip = (page - 1) * limit;

  const where = {
    userId,
    ...(entityType && { entityType }),
    ...(action && { action }),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get audit logs by time range
 */
export const getAuditLogsByRange = async (query = {}) => {
  const {
    page = 1,
    limit = 50,
    startDate,
    endDate,
    entityType,
    userId,
    action,
  } = query;
  const skip = (page - 1) * limit;

  const where = {
    timestamp: {},
    ...(startDate && { timestamp: { gte: new Date(startDate) } }),
    ...(endDate && {
      timestamp: {
        ...where.timestamp,
        lte: new Date(endDate),
      },
    }),
    ...(entityType && { entityType }),
    ...(userId && { userId }),
    ...(action && { action }),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get compliance audit report (access control, sensitive operations)
 */
export const getComplianceReport = async (query = {}) => {
  const { startDate, endDate } = query;
  const dateFilter = {};

  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);

  // Get sensitive operations (LOGIN, CREATE_ADMIN, ROLE_CHANGE, etc.)
  const sensitiveActions = [
    'LOGIN',
    'LOGOUT',
    'CREATE_ADMIN',
    'REMOVE_ADMIN',
    'ROLE_CHANGE',
    'PERMISSION_CHANGE',
    'DATA_EXPORT',
    'DATA_DELETE',
  ];

  const sensitiveOps = await prisma.auditLog.findMany({
    where: {
      action: { in: sensitiveActions },
      ...(Object.keys(dateFilter).length > 0 && {
        timestamp: dateFilter,
      }),
    },
    orderBy: { timestamp: 'desc' },
    take: 100,
  });

  // Get failed operations (errors logged)
  const failedOps = await prisma.auditLog.findMany({
    where: {
      entityType: 'ERROR',
      ...(Object.keys(dateFilter).length > 0 && {
        timestamp: dateFilter,
      }),
    },
    orderBy: { timestamp: 'desc' },
    take: 100,
  });

  // Summarize by action
  const actionSummary = {};
  sensitiveOps.forEach((op) => {
    actionSummary[op.action] = (actionSummary[op.action] || 0) + 1;
  });

  // Summarize by user
  const userSummary = {};
  sensitiveOps.forEach((op) => {
    if (op.userId) {
      userSummary[op.userId] = (userSummary[op.userId] || 0) + 1;
    }
  });

  return {
    period: { startDate, endDate },
    sensitiveOperations: sensitiveOps.length,
    failedOperations: failedOps.length,
    actionSummary,
    userSummary,
    recentSensitiveOps: sensitiveOps.slice(0, 20),
    recentFailures: failedOps.slice(0, 20),
  };
};

/**
 * Get data change history (what changed on an entity)
 */
export const getDataChangeHistory = async (
  entityType,
  entityId,
  field = null
) => {
  const logs = await prisma.auditLog.findMany({
    where: {
      entityType,
      entityId,
      action: { in: ['CREATE', 'UPDATE'] },
    },
    orderBy: { timestamp: 'asc' },
  });

  if (!logs || logs.length === 0) {
    throw new NotFoundError(`No change history found for ${entityType} ${entityId}`);
  }

  // Extract field-specific history if requested
  if (field) {
    const fieldHistory = logs
      .filter((log) => log.changes && log.changes[field])
      .map((log) => ({
        timestamp: log.timestamp,
        action: log.action,
        oldValue: log.changes[field].oldValue,
        newValue: log.changes[field].newValue,
        changedBy: log.userId,
      }));

    return {
      entity: { type: entityType, id: entityId },
      field,
      history: fieldHistory,
    };
  }

  // Return all changes
  return {
    entity: { type: entityType, id: entityId },
    history: logs.map((log) => ({
      timestamp: log.timestamp,
      action: log.action,
      changes: log.changes,
      changedBy: log.userId,
    })),
  };
};

/**
 * Export audit logs for compliance/archive
 */
export const exportAuditLogs = async (query = {}, format = 'json') => {
  const {
    startDate,
    endDate,
    entityType,
    userId,
  } = query;

  const where = {};

  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) where.timestamp.gte = new Date(startDate);
    if (endDate) where.timestamp.lte = new Date(endDate);
  }

  if (entityType) where.entityType = entityType;
  if (userId) where.userId = userId;

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { timestamp: 'desc' },
  });

  if (format === 'csv') {
    return convertAuditLogsToCSV(logs);
  }

  return {
    exportDate: new Date().toISOString(),
    filters: query,
    count: logs.length,
    logs,
  };
};

/**
 * Convert audit logs to CSV
 */
const convertAuditLogsToCSV = (logs) => {
  const headers = [
    'Timestamp',
    'Entity Type',
    'Entity ID',
    'Action',
    'User ID',
    'User Role',
    'IP Address',
    'Changes',
  ];

  const rows = logs.map((log) => [
    log.timestamp.toISOString(),
    log.entityType,
    log.entityId,
    log.action,
    log.userId || 'SYSTEM',
    log.userRole || 'N/A',
    log.ipAddress || 'N/A',
    JSON.stringify(log.changes || {}),
  ]);

  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      row
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(',')
    ),
  ].join('\n');

  return csv;
};

/**
 * Clear old audit logs (retention policy)
 */
export const clearOldAuditLogs = async (daysRetention = 365) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysRetention);

  const result = await prisma.auditLog.deleteMany({
    where: {
      timestamp: { lt: cutoffDate },
    },
  });

  return {
    deleted: result.count,
    retentionDays: daysRetention,
    cutoffDate,
  };
};
