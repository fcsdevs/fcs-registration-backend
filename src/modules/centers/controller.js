import {
  createCenter,
  getCenterById,
  listCentersByEvent,
  listActiveCenters,
  updateCenter,
  addCenterAdmin,
  removeCenterAdmin,
  getCenterStatistics,
  deactivateCenter,
} from './service.js';
import { createCenterSchema, updateCenterSchema, paginationSchema } from '../../lib/validation.js';

/**
 * POST /api/centers - Create center
 */
export const createCenterHandler = async (req, res, next) => {
  try {
    const { error, value } = createCenterSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const center = await createCenter(value, req.userId);
    res.status(201).json({
      data: center,
      message: 'Center created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/centers - List centers for event
 */
export const listCentersHandler = async (req, res, next) => {
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

    const { eventId } = req.query;
    if (!eventId) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'eventId is required',
        },
      });
    }

    const centers = await listCentersByEvent(eventId, {
      ...value,
      isActive: req.query.isActive,
    });

    res.status(200).json({
      data: centers,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/centers/active - List active centers for registration
 */
export const listActiveCentersHandler = async (req, res, next) => {
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

    const { eventId, state } = req.query;
    if (!eventId) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'eventId is required',
        },
      });
    }

    const centers = await listActiveCenters(eventId, {
      ...value,
      state,
    });

    res.status(200).json({
      data: centers,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/centers/:id - Get center details
 */
export const getCenterHandler = async (req, res, next) => {
  try {
    const center = await getCenterById(req.params.id);
    res.status(200).json({
      data: center,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/centers/:id - Update center
 */
export const updateCenterHandler = async (req, res, next) => {
  try {
    const { error, value } = updateCenterSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const center = await updateCenter(req.params.id, value);
    res.status(200).json({
      data: center,
      message: 'Center updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/centers/:id/admins - Add center admin
 */
export const addCenterAdminHandler = async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'userId is required',
        },
      });
    }

    const admin = await addCenterAdmin(req.params.id, userId);
    res.status(201).json({
      data: admin,
      message: 'Center admin added successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/centers/:id/admins/:userId - Remove center admin
 */
export const removeCenterAdminHandler = async (req, res, next) => {
  try {
    const result = await removeCenterAdmin(req.params.id, req.params.userId);
    res.status(200).json({
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/centers/:id/statistics - Get center statistics
 */
export const getCenterStatisticsHandler = async (req, res, next) => {
  try {
    const stats = await getCenterStatistics(req.params.id);
    res.status(200).json({
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/centers/:id - Deactivate center
 */
export const deactivateCenterHandler = async (req, res, next) => {
  try {
    const center = await deactivateCenter(req.params.id);
    res.status(200).json({
      data: center,
      message: 'Center deactivated successfully',
    });
  } catch (error) {
    next(error);
  }
};
