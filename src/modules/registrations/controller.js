import {
  createRegistration,
  getRegistrationById,
  listRegistrations,
  updateRegistrationStatus,
  assignCenter,
  assignGroup,
  cancelRegistration,
  getRegistrationsByEvent,
  getMemberRegistrations,
  checkRegistrationStatus,
  getRegistrarStatistics,
  getGlobalRegistrationsStats,
  markAttendance,
  exportRegistrationsToCSV,
} from './service.js';
import { createRegistrationSchema, assignCenterSchema, paginationSchema } from '../../lib/validation.js';
import { getAdminScope } from '../../middleware/scope-validator.js';

/**
 * POST /api/registrations
 */
export const createRegistrationHandler = async (req, res, next) => {
  try {
    const { error, value } = createRegistrationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const registration = await createRegistration(value, req.userId);
    res.status(201).json({
      data: registration,
      message: 'Registration created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/registrations
 */
export const listRegistrationsHandler = async (req, res, next) => {
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

    // Enforce Scope with new scope-validator
    const scope = await getAdminScope(req.userId);
    let effectiveUnitId = req.query.unitId;
    if (!scope.isGlobal) {
      // If eventId is provided, we assume the user has access to the event (or is performing a check-in)
      // and we do NOT restrict by unit scope. This allows Center Admins to check in members for National events.
      // Otherwise, restrict to user's unit and descendants.
      if (!req.query.eventId) {
        effectiveUnitId = scope.unitId;
      }
    }

    const registrations = await listRegistrations({
      ...value,
      eventId: req.query.eventId,
      memberId: req.query.memberId,
      status: req.query.status,
      centerId: req.query.centerId,
      registeredBy: req.query.registeredBy,
      ids: req.query.ids,
      unitId: effectiveUnitId,
      search: req.query.search,
      userId: req.userId,
      adminScope: scope,
    });

    res.status(200).json(registrations);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/registrations/:id
 */
export const getRegistrationHandler = async (req, res, next) => {
  try {
    const registration = await getRegistrationById(req.params.id, req.userId);
    res.status(200).json({
      data: registration,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/registrations/:id/status
 */
export const updateRegistrationStatusHandler = async (req, res, next) => {
  try {
    const { status, reason } = req.body;

    if (!status) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'status is required',
        },
      });
    }

    const registration = await updateRegistrationStatus(req.params.id, status, reason, req.userId);
    res.status(200).json({
      data: registration,
      message: 'Registration status updated',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/registrations/:id/assign-center
 */
export const assignCenterHandler = async (req, res, next) => {
  try {
    const { error, value } = assignCenterSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const participation = await assignCenter(
      req.params.id,
      value.centerId,
      value.participationMode,
      req.userId
    );

    res.status(200).json({
      data: participation,
      message: 'Center assigned successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/registrations/:id/assign-group
 */
export const assignGroupHandler = async (req, res, next) => {
  try {
    const { groupId } = req.body;

    if (!groupId) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'groupId is required',
        },
      });
    }

    const assignment = await assignGroup(req.params.id, groupId, req.userId);
    res.status(200).json({
      data: assignment,
      message: 'Group assigned successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/registrations/:id
 */
export const cancelRegistrationHandler = async (req, res, next) => {
  try {
    const { reason } = req.body;

    const registration = await cancelRegistration(req.params.id, reason, req.userId);
    res.status(200).json({
      data: registration,
      message: 'Registration cancelled successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/registrations/event/:eventId
 */
export const getEventRegistrationsHandler = async (req, res, next) => {
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

    const registrations = await getRegistrationsByEvent(req.params.eventId, {
      ...value,
      centerId: req.query.centerId,
      status: req.query.status,
    });

    res.status(200).json(registrations);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/registrations/member/:memberId
 */
export const getMemberRegistrationsHandler = async (req, res, next) => {
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

    const registrations = await getMemberRegistrations(req.params.memberId, {
      ...value,
      eventId: req.query.eventId,
      status: req.query.status,
    });

    res.status(200).json(registrations);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/registrations/check/:eventId/:memberId
 * Check if a member is already registered for an event
 */
export const checkRegistrationStatusHandler = async (req, res, next) => {
  try {
    const { eventId, memberId } = req.params;

    if (!eventId || !memberId) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'eventId and memberId are required',
        },
      });
    }

    const status = await checkRegistrationStatus(eventId, memberId);
    res.status(200).json({
      data: status,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/registrations/stats
 */
export const getRegistrarStatisticsHandler = async (req, res, next) => {
  try {
    const { eventId, centerId } = req.query;

    if (!eventId) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'eventId is required'
        }
      });
    }

    const stats = await getRegistrarStatistics(eventId, req.userId, centerId);
    res.status(200).json({
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/registrations/stats/summary
 */
export const getGlobalRegistrationsStatsHandler = async (req, res, next) => {
  try {
    const { eventId } = req.query;

    // Enforce Scope
    const scope = await getAdminScope(req.userId);
    let effectiveUnitId = req.query.unitId;
    if (!scope.isGlobal) {
      if (!eventId) {
        effectiveUnitId = scope.unitId;
      }
    }

    const stats = await getGlobalRegistrationsStats({
      eventId,
      unitId: effectiveUnitId
    });

    res.status(200).json({
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/registrations/:id/attendance
 */
export const markAttendanceHandler = async (req, res, next) => {
  try {
    const { method } = req.body; // KIOSK, CODE, SCAN

    const registration = await markAttendance(req.params.id, method, req.userId);
    res.status(200).json({
      data: registration,
      message: 'Attendance marked successfully'
    });
  } catch (error) {
    next(error);
  }
};

import { generateTagPdf } from './pdf-service.js';

/**
 * GET /api/registrations/:id/tag-pdf
 */
export const downloadTagHandler = async (req, res, next) => {
  try {
    const registrationId = req.params.id;
    const userId = req.user?.id;

    console.log('Fetching registration for tag PDF:', registrationId, 'User:', userId);

    const registration = await getRegistrationById(registrationId, userId);

    if (!registration) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Registration not found' } });
    }

    console.log('Registration fetched successfully, generating PDF...');
    const pdfBuffer = await generateTagPdf(registration);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=tag-${registration.member.fcsCode}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error in downloadTagHandler:', error);
    next(error);
  }
};

/**
 * GET /api/registrations/export/csv
 */
export const exportRegistrationsHandler = async (req, res, next) => {
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

    // Enforce Scope (same as listRegistrations)
    const scope = await getAdminScope(req.userId);
    let effectiveUnitId = req.query.unitId;
    if (!scope.isGlobal) {
      if (!req.query.eventId) {
        effectiveUnitId = scope.unitId;
      }
    }

    const csv = await exportRegistrationsToCSV({
      ...value,
      eventId: req.query.eventId,
      memberId: req.query.memberId,
      status: req.query.status,
      centerId: req.query.centerId,
      registeredBy: req.query.registeredBy,
      ids: req.query.ids,
      unitId: effectiveUnitId,
      search: req.query.search,
      adminScope: scope,
    });

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const eventId = req.query.eventId || 'all';
    const filename = `registrations-${eventId}-${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};
