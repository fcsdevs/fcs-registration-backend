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
} from './service.js';
import { createRegistrationSchema, assignCenterSchema, paginationSchema } from '../../lib/validation.js';

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

    const registrations = await listRegistrations({
      ...value,
      eventId: req.query.eventId,
      memberId: req.query.memberId,
      status: req.query.status,
      centerId: req.query.centerId,
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
    const registration = await getRegistrationById(req.params.id);
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

    const registration = await updateRegistrationStatus(req.params.id, status, reason);
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
