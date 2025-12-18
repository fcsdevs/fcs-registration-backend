import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import {
  getDashboardHandler,
  getEventAnalyticsHandler,
  exportEventReportHandler,
  getCenterAnalyticsHandler,
  getMemberAttendanceReportHandler,
  getStateAnalyticsHandler,
} from './controller.js';

const router = Router();

// GET /api/reports/dashboard - Dashboard summary (key metrics)
router.get('/dashboard', authenticate, getDashboardHandler);

// GET /api/reports/events/:eventId/analytics - Event analytics
router.get('/events/:eventId/analytics', authenticate, getEventAnalyticsHandler);

// GET /api/reports/events/:eventId/export - Export event report
router.get('/events/:eventId/export', authenticate, exportEventReportHandler);

// GET /api/reports/centers/:centerId/analytics - Center analytics
router.get('/centers/:centerId/analytics', authenticate, getCenterAnalyticsHandler);

// GET /api/reports/members/:memberId/attendance - Member attendance report
router.get('/members/:memberId/attendance', authenticate, getMemberAttendanceReportHandler);

// GET /api/reports/states/analytics - State-wise analytics
router.get('/states/analytics', authenticate, getStateAnalyticsHandler);

export default router;
