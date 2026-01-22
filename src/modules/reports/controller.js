import {
  getEventAnalytics,
  getCenterAnalytics,
  getMemberAttendanceReport,
  getStateAnalytics,
  exportEventReport,
  getDashboardSummary,
} from './service.js';
import { paginationSchema } from '../../lib/validation.js';
import { getAdminScope } from '../../middleware/scope-validator.js';

/**
 * GET /api/reports/dashboard
 */
export const getDashboardHandler = async (req, res, next) => {
  try {
    const scope = await getAdminScope(req.userId);
    let effectiveUnitId = req.query.unitId;

    if (!scope.isGlobal) {
      effectiveUnitId = scope.unitId;
    }

    const summary = await getDashboardSummary({
      ...req.query,
      unitId: effectiveUnitId,
      adminScope: scope,
    });
    res.status(200).json({
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reports/events/:eventId/analytics
 */
export const getEventAnalyticsHandler = async (req, res, next) => {
  try {
    const analytics = await getEventAnalytics(req.params.eventId, req.query);
    res.status(200).json({
      data: analytics,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reports/events/:eventId/export
 */
export const exportEventReportHandler = async (req, res, next) => {
  try {
    const format = req.query.format || 'json';
    const report = await exportEventReport(req.params.eventId, format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="event-${req.params.eventId}-report.csv"`
      );
      res.send(report);
    } else {
      res.status(200).json({
        data: report,
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reports/centers/:centerId/analytics
 */
export const getCenterAnalyticsHandler = async (req, res, next) => {
  try {
    const analytics = await getCenterAnalytics(req.params.centerId, req.query);
    res.status(200).json({
      data: analytics,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reports/members/:memberId/attendance
 */
export const getMemberAttendanceReportHandler = async (req, res, next) => {
  try {
    const report = await getMemberAttendanceReport(req.params.memberId, req.query);
    res.status(200).json({
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reports/states/analytics
 */
export const getStateAnalyticsHandler = async (req, res, next) => {
  try {
    const analytics = await getStateAnalytics(req.query);
    res.status(200).json({
      data: analytics,
    });
  } catch (error) {
    next(error);
  }
};
