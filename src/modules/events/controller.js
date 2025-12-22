import {
  createEvent,
  getEventById,
  listEvents,
  updateEvent,
  publishEvent,
  getEventStatistics,
  updateEventSettings,
} from './service.js';
import { createEventSchema, updateEventSchema, paginationSchema } from '../../lib/validation.js';

/**
 * POST /api/events - Create event
 */
export const createEventHandler = async (req, res, next) => {
  try {
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

    const events = await listEvents({
      ...value,
      search: req.query.search,
      unitId: req.query.unitId,
      participationMode: req.query.participationMode,
      isPublished: req.query.isPublished,
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
    const { error, value } = updateEventSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const event = await updateEvent(req.params.id, value);
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
    const event = await publishEvent(req.params.id);
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
    const settings = await updateEventSettings(req.params.id, req.body);
    res.status(200).json({
      data: settings,
      message: 'Event settings updated successfully',
    });
  } catch (error) {
    next(error);
  }
};
