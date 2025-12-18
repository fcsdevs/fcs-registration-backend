import {
  checkIn,
  checkOut,
  verifyAttendance,
  bulkSyncAttendance,
  getEventAttendance,
  getCenterAttendance,
  correctAttendance,
  getMemberAttendance,
  generateAttendanceCode,
  validateAttendanceCode,
} from './service.js';
import { checkInSchema, checkOutSchema, bulkSyncSchema, paginationSchema } from '../../lib/validation.js';

/**
 * POST /api/attendance/check-in
 */
export const checkInHandler = async (req, res, next) => {
  try {
    const { error, value } = checkInSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const attendance = await checkIn(value, req.userId);
    res.status(201).json({
      data: attendance,
      message: 'Check-in recorded successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/attendance/check-out
 */
export const checkOutHandler = async (req, res, next) => {
  try {
    const { error, value } = checkOutSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const attendance = await checkOut(value.attendanceId, value.notes);
    res.status(200).json({
      data: attendance,
      message: 'Check-out recorded successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/attendance/verify
 */
export const verifyAttendanceHandler = async (req, res, next) => {
  try {
    const { attendanceId } = req.body;

    if (!attendanceId) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'attendanceId is required',
        },
      });
    }

    const attendance = await verifyAttendance(attendanceId, req.userId);
    res.status(200).json({
      data: attendance,
      message: 'Attendance verified',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/attendance/bulk-sync
 */
export const bulkSyncHandler = async (req, res, next) => {
  try {
    const { error, value } = bulkSyncSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const result = await bulkSyncAttendance(value, req.userId);
    res.status(207).json({
      data: result,
      message: `Synced ${result.synced} records`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/attendance/event/:eventId
 */
export const getEventAttendanceHandler = async (req, res, next) => {
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

    const attendance = await getEventAttendance(req.params.eventId, {
      ...value,
      centerId: req.query.centerId,
      verified: req.query.verified,
    });

    res.status(200).json({
      data: attendance,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/attendance/event/:eventId/center/:centerId
 */
export const getCenterAttendanceHandler = async (req, res, next) => {
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

    const attendance = await getCenterAttendance(
      req.params.eventId,
      req.params.centerId,
      {
        ...value,
        participationMode: req.query.participationMode,
      }
    );

    res.status(200).json({
      data: attendance,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/attendance/:recordId/correct
 */
export const correctAttendanceHandler = async (req, res, next) => {
  try {
    const { correctionType, newValue, reason } = req.body;

    if (!correctionType || !newValue || !reason) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'correctionType, newValue, and reason are required',
        },
      });
    }

    const result = await correctAttendance(
      req.params.recordId,
      { correctionType, newValue, reason },
      req.userId
    );

    res.status(200).json({
      data: result,
      message: 'Attendance corrected successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/attendance/member/:memberId
 */
export const getMemberAttendanceHandler = async (req, res, next) => {
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

    const attendance = await getMemberAttendance(req.params.memberId, {
      ...value,
      eventId: req.query.eventId,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
    });

    res.status(200).json({
      data: attendance,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/attendance/code/generate
 */
export const generateCodeHandler = async (req, res, next) => {
  try {
    const { eventId, codeType } = req.body;

    if (!eventId) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'eventId is required',
        },
      });
    }

    const code = await generateAttendanceCode(eventId, codeType);
    res.status(201).json({
      data: code,
      message: 'Attendance code generated',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/attendance/code/validate
 */
export const validateCodeHandler = async (req, res, next) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'code is required',
        },
      });
    }

    const validatedCode = await validateAttendanceCode(code);
    res.status(200).json({
      data: validatedCode,
      message: 'Code validated successfully',
    });
  } catch (error) {
    next(error);
  }
};
