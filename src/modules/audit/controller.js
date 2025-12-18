import {
  getEntityAuditTrail,
  getUserAuditTrail,
  getAuditLogsByRange,
  getComplianceReport,
  getDataChangeHistory,
  exportAuditLogs,
  clearOldAuditLogs,
} from './service.js';
import { paginationSchema } from '../../lib/validation.js';

/**
 * GET /api/audit/entity/:entityType/:entityId
 */
export const getEntityAuditTrailHandler = async (req, res, next) => {
  try {
    const { error, value } = paginationSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const trail = await getEntityAuditTrail(
      req.params.entityType,
      req.params.entityId,
      { ...value, action: req.query.action }
    );

    res.status(200).json({
      data: trail,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/audit/user/:userId
 */
export const getUserAuditTrailHandler = async (req, res, next) => {
  try {
    const { error, value } = paginationSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const trail = await getUserAuditTrail(req.params.userId, {
      ...value,
      entityType: req.query.entityType,
      action: req.query.action,
    });

    res.status(200).json({
      data: trail,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/audit/logs
 */
export const getAuditLogsHandler = async (req, res, next) => {
  try {
    const { error, value } = paginationSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const logs = await getAuditLogsByRange({
      ...value,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      entityType: req.query.entityType,
      userId: req.query.userId,
      action: req.query.action,
    });

    res.status(200).json({
      data: logs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/audit/compliance/report
 */
export const getComplianceReportHandler = async (req, res, next) => {
  try {
    const report = await getComplianceReport({
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });

    res.status(200).json({
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/audit/history/:entityType/:entityId
 */
export const getDataChangeHistoryHandler = async (req, res, next) => {
  try {
    const history = await getDataChangeHistory(
      req.params.entityType,
      req.params.entityId,
      req.query.field
    );

    res.status(200).json({
      data: history,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/audit/export
 */
export const exportAuditLogsHandler = async (req, res, next) => {
  try {
    const format = req.query.format || 'json';
    const logs = await exportAuditLogs(
      {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        entityType: req.query.entityType,
        userId: req.query.userId,
      },
      format
    );

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="audit-logs-${new Date().toISOString()}.csv"`
      );
      res.send(logs);
    } else {
      res.status(200).json({
        data: logs,
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/audit/retention/cleanup
 * Admin only - Clear old audit logs
 */
export const cleanupOldLogsHandler = async (req, res, next) => {
  try {
    const { daysRetention = 365 } = req.body;

    const result = await clearOldAuditLogs(daysRetention);

    res.status(200).json({
      data: result,
      message: `Deleted ${result.deleted} audit logs older than ${daysRetention} days`,
    });
  } catch (error) {
    next(error);
  }
};
