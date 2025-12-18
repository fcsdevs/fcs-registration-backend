import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import {
  getEntityAuditTrailHandler,
  getUserAuditTrailHandler,
  getAuditLogsHandler,
  getComplianceReportHandler,
  getDataChangeHistoryHandler,
  exportAuditLogsHandler,
  cleanupOldLogsHandler,
} from './controller.js';

const router = Router();

// GET /api/audit/entity/:entityType/:entityId - Get entity audit trail
router.get('/entity/:entityType/:entityId', authenticate, getEntityAuditTrailHandler);

// GET /api/audit/user/:userId - Get user audit trail
router.get('/user/:userId', authenticate, getUserAuditTrailHandler);

// GET /api/audit/logs - List audit logs
router.get('/logs', authenticate, getAuditLogsHandler);

// GET /api/audit/compliance/report - Get compliance report
router.get('/compliance/report', authenticate, getComplianceReportHandler);

// GET /api/audit/history/:entityType/:entityId - Get data change history
router.get('/history/:entityType/:entityId', authenticate, getDataChangeHistoryHandler);

// GET /api/audit/export - Export audit logs
router.get('/export', authenticate, exportAuditLogsHandler);

// POST /api/audit/retention/cleanup - Cleanup old logs
router.post('/retention/cleanup', authenticate, cleanupOldLogsHandler);

export default router;
