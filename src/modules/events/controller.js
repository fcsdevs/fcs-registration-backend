import {
  createEvent,
  getEventById,
  listEvents,
  updateEvent,
  publishEvent,
  getEventStatistics,
  updateEventSettings,
  deleteEvent,
} from './service.js';
import { createEventSchema, updateEventSchema, paginationSchema } from '../../lib/validation.js';

import { cloudinaryUploadImage } from '../../lib/cloudinary.js';
import fs from 'fs';
import { getAdminScope } from '../../middleware/scope-validator.js';

/**
 * POST /api/events - Create event
 */
export const createEventHandler = async (req, res, next) => {
  try {
    // If image file is uploaded, upload to cloudinary first
    if (req.file) {
      try {
        const uploadResult = await cloudinaryUploadImage(req.file.path);
        req.body.imageUrl = uploadResult.url;

        // Clean up resized file from local storage
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (uploadError) {
        console.error('Image upload failed:', uploadError);
        // We continue even if image fails, or we could return error
      }
    }

    const { error, value } = createEventSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const event = await createEvent(value, req.userId);
    res.status(201).json({
      data: event,
      message: 'Event created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/events - List events
 */
export const listEventsHandler = async (req, res, next) => {
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

    // Enforce Scope (HRBAC)
    const scope = await getAdminScope(req.userId);
    let effectiveUnitId = req.query.unitId;

    if (!scope.isGlobal && scope.unitId) {
      // Non-global admins default to their own unit
      // They can only see events in their hierarchy (own + descendants)
      effectiveUnitId = scope.unitId;
    }

    const events = await listEvents({
      ...value,
      search: req.query.search,
      unitId: effectiveUnitId,
      participationMode: req.query.participationMode,
      isPublished: req.query.isPublished,
      adminScope: scope, // Pass scope to service for filtering
    });

    res.status(200).json(events);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/events/:id - Get event details
 */
export const getEventHandler = async (req, res, next) => {
  try {
    const event = await getEventById(req.params.id);
    res.status(200).json({
      data: event,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/events/:id - Update event
 */
export const updateEventHandler = async (req, res, next) => {
  try {
    // If image file is uploaded, upload to cloudinary first
    if (req.file) {
      try {
        const uploadResult = await cloudinaryUploadImage(req.file.path);
        req.body.imageUrl = uploadResult.url;

        // Clean up resized file from local storage
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (uploadError) {
        console.error('Image upload failed during update:', uploadError);
      }
    }

    const { error, value } = updateEventSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const event = await updateEvent(req.params.id, value, req.userId);
    res.status(200).json({
      data: event,
      message: 'Event updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/events/:id/publish - Publish event
 */
export const publishEventHandler = async (req, res, next) => {
  try {
    const event = await publishEvent(req.params.id, req.userId);
    res.status(200).json({
      data: event,
      message: 'Event published successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/events/:id/statistics - Get event stats
 */
export const getEventStatisticsHandler = async (req, res, next) => {
  try {
    const stats = await getEventStatistics(req.params.id);
    res.status(200).json({
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/events/:id/settings - Update event settings
 */
export const updateEventSettingsHandler = async (req, res, next) => {
  try {
    const settings = await updateEventSettings(req.params.id, req.body, req.userId);
    res.status(200).json({
      data: settings,
      message: 'Event settings updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/events/:id - Delete event
 */
export const deleteEventHandler = async (req, res, next) => {
  try {
    await deleteEvent(req.params.id, req.userId);
    res.status(200).json({
      message: 'Event deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
