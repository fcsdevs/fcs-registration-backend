import { getPrismaClient } from '../../lib/prisma.js';
import {
  getPaginationParams,
  formatPaginatedResponse,
} from '../../lib/helpers.js';
import {
  ValidationError,
  NotFoundError,
} from '../../middleware/error-handler.js';

const prisma = getPrismaClient();

// In-memory idempotency cache (use Redis in production)
const idempotencyCache = new Map();

/**
 * Check in member
 */
export const checkIn = async (data, userId) => {
  const { eventId, registrationId, centerId, checkInMethod, notes } = data;

  // Verify registration
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: {
      participation: true,
      member: true,
      event: true,
    },
  });

  if (!registration) {
    throw new NotFoundError('Registration');
  }

  if (registration.eventId !== eventId) {
    throw new ValidationError('Registration does not match event');
  }

  // Check if already checked in
  const existingAttendance = await prisma.attendanceRecord.findFirst({
    where: { registrationId },
  });

  if (existingAttendance && existingAttendance.checkInTime) {
    throw new ValidationError('Member already checked in');
  }

  // Verify center if on-site
  if (registration.participation?.participationMode === 'ONSITE' && centerId) {
    const center = await prisma.eventCenter.findUnique({
      where: { id: centerId },
    });

    if (!center) {
      throw new NotFoundError('Center');
    }

    if (registration.participation?.centerId && registration.participation.centerId !== centerId) {
      throw new ValidationError('Check-in center does not match registration center');
    }
  }

  // Create or update attendance
  let attendance;

  if (existingAttendance) {
    attendance = await prisma.attendanceRecord.update({
      where: { id: existingAttendance.id },
      data: {
        checkInTime: new Date(),
        checkInMethod,
        notes,
      },
    });
  } else {
    attendance = await prisma.attendanceRecord.create({
      data: {
        eventId,
        registrationId,
        memberId: registration.memberId,
        centerId: centerId || registration.centerId || null,
        participationMode: registration.participation?.participationMode || 'ONLINE',
        checkInMethod,
        checkInTime: new Date(),
        notes: notes || null,
      },
    });
  }

  return attendance;
};

/**
 * Check out member
 */
export const checkOut = async (attendanceId, notes) => {
  const attendance = await prisma.attendanceRecord.findUnique({
    where: { id: attendanceId },
  });

  if (!attendance) {
    throw new NotFoundError('Attendance record');
  }

  if (attendance.checkOutTime) {
    throw new ValidationError('Member already checked out');
  }

  return prisma.attendanceRecord.update({
    where: { id: attendanceId },
    data: {
      checkOutTime: new Date(),
      notes: notes || attendance.notes,
    },
  });
};

/**
 * Verify attendance (QR/SAC validation)
 */
export const verifyAttendance = async (attendanceId, userId) => {
  const attendance = await prisma.attendanceRecord.findUnique({
    where: { id: attendanceId },
  });

  if (!attendance) {
    throw new NotFoundError('Attendance record');
  }

  return prisma.attendanceRecord.update({
    where: { id: attendanceId },
    data: {
      isVerified: true,
      verifiedBy: userId,
    },
  });
};

/**
 * Offline sync with idempotency
 * Handles bulk attendance records from kiosk with conflict resolution
 */
export const bulkSyncAttendance = async (data, userId) => {
  const { records } = data;

  if (!Array.isArray(records) || records.length === 0) {
    throw new ValidationError('records array is required and must not be empty');
  }

  const results = [];
  const errors = [];

  for (const record of records) {
    try {
      const { eventId, registrationId, centerId, checkInMethod, checkInTime, idempotencyKey } = record;

      // Check idempotency cache
      if (idempotencyCache.has(idempotencyKey)) {
        results.push({
          idempotencyKey,
          status: 'duplicate',
          message: 'Already processed',
        });
        continue;
      }

      // Verify registration
      const registration = await prisma.registration.findUnique({
        where: { id: registrationId },
        include: { participation: true },
      });

      if (!registration) {
        errors.push({
          idempotencyKey,
          error: 'Registration not found',
        });
        continue;
      }

      // Check if already checked in (conflict resolution)
      const existingAttendance = await prisma.attendanceRecord.findFirst({
        where: { registrationId },
      });

      if (existingAttendance && existingAttendance.checkInTime) {
        results.push({
          idempotencyKey,
          status: 'conflict',
          message: 'Member already checked in',
          attendanceId: existingAttendance.id,
        });

        // Cache this
        idempotencyCache.set(idempotencyKey, existingAttendance.id);
        continue;
      }

      // Create attendance record
      const attendance = await prisma.attendanceRecord.create({
        data: {
          eventId,
          registrationId,
          memberId: registration.memberId,
          centerId: centerId || registration.centerId || null,
          participationMode: registration.participation?.participationMode || 'ONLINE',
          checkInMethod,
          checkInTime: new Date(checkInTime),
        },
      });

      results.push({
        idempotencyKey,
        status: 'success',
        attendanceId: attendance.id,
      });

      // Cache the result
      idempotencyCache.set(idempotencyKey, attendance.id);
    } catch (error) {
      errors.push({
        idempotencyKey: record.idempotencyKey,
        error: error.message,
      });
    }
  }

  return {
    synced: results.filter((r) => r.status === 'success').length,
    duplicates: results.filter((r) => r.status === 'duplicate').length,
    conflicts: results.filter((r) => r.status === 'conflict').length,
    errors: errors.length,
    results,
    errors: errors,
  };
};

/**
 * Get attendance records for event
 */
export const getEventAttendance = async (eventId, query) => {
  const { page, limit, centerId, verified } = query;
  const { skip, take } = getPaginationParams(page, limit);

  const where = { eventId };
  if (centerId) where.centerId = centerId;
  if (verified !== undefined) where.isVerified = verified === 'true';

  const [records, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      skip,
      take,
      include: {
        member: { select: { fcsCode: true, firstName: true, lastName: true } },
        registration: { select: { status: true } },
      },
      orderBy: { checkInTime: 'desc' },
    }),
    prisma.attendanceRecord.count({ where }),
  ]);

  return formatPaginatedResponse(records, total, parseInt(page || 1), parseInt(limit || 20));
};

/**
 * Get center attendance
 */
export const getCenterAttendance = async (eventId, centerId, query) => {
  const { page, limit, participationMode } = query;
  const { skip, take } = getPaginationParams(page, limit);

  const where = { eventId, centerId };
  if (participationMode) where.participationMode = participationMode;

  const [records, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      skip,
      take,
      include: {
        member: { select: { fcsCode: true, firstName: true, lastName: true } },
      },
      orderBy: { checkInTime: 'desc' },
    }),
    prisma.attendanceRecord.count({ where }),
  ]);

  return formatPaginatedResponse(records, total, parseInt(page || 1), parseInt(limit || 20));
};

/**
 * Correct attendance record
 */
export const correctAttendance = async (attendanceId, correction, userId) => {
  const { correctionType, newValue, reason } = correction;

  const attendance = await prisma.attendanceRecord.findUnique({
    where: { id: attendanceId },
  });

  if (!attendance) {
    throw new NotFoundError('Attendance record');
  }

  // Log correction
  const correctionRecord = await prisma.attendanceCorrection.create({
    data: {
      attendanceId,
      correctionType,
      oldValue: String(attendance[Object.keys(correctionType.split('_').map((w) => w.toLowerCase()).join(''))]),
      newValue: String(newValue),
      reason,
      correctedBy: userId,
    },
  });

  // Apply correction
  const updateData = {};
  const fieldMap = {
    CHECK_IN_TIME: 'checkInTime',
    CHECK_OUT_TIME: 'checkOutTime',
    PARTICIPATION_MODE: 'participationMode',
    CENTER_CHANGE: 'centerId',
  };

  const field = fieldMap[correctionType];
  if (field) {
    updateData[field] = correctionType === 'CENTER_CHANGE' ? newValue : new Date(newValue);
  }

  const updated = await prisma.attendanceRecord.update({
    where: { id: attendanceId },
    data: updateData,
  });

  return {
    correction: correctionRecord,
    updated,
  };
};

/**
 * Get member attendance
 */
export const getMemberAttendance = async (memberId, query) => {
  const { page, limit, eventId, fromDate, toDate } = query;
  const { skip, take } = getPaginationParams(page, limit);

  const where = { memberId };
  if (eventId) where.eventId = eventId;
  if (fromDate || toDate) {
    where.checkInTime = {};
    if (fromDate) where.checkInTime.gte = new Date(fromDate);
    if (toDate) where.checkInTime.lte = new Date(toDate);
  }

  const [records, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      skip,
      take,
      include: {
        event: { select: { title: true } },
        center: { select: { centerName: true } },
      },
      orderBy: { checkInTime: 'desc' },
    }),
    prisma.attendanceRecord.count({ where }),
  ]);

  return formatPaginatedResponse(records, total, parseInt(page || 1), parseInt(limit || 20));
};

/**
 * Generate attendance code (QR/SAC)
 */
export const generateAttendanceCode = async (eventId, codeType) => {
  const code = Math.random().toString(36).substring(2, 10).toUpperCase();

  return prisma.attendanceCode.create({
    data: {
      code,
      codeType: codeType || 'QR',
      eventId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  });
};

/**
 * Validate attendance code
 */
export const validateAttendanceCode = async (code) => {
  const attendanceCode = await prisma.attendanceCode.findUnique({
    where: { code },
  });

  if (!attendanceCode) {
    throw new NotFoundError('Code');
  }

  if (attendanceCode.isUsed) {
    throw new ValidationError('Code already used');
  }

  if (new Date() > attendanceCode.expiresAt) {
    throw new ValidationError('Code expired');
  }

  // Mark as used
  await prisma.attendanceCode.update({
    where: { id: attendanceCode.id },
    data: { isUsed: true, usedAt: new Date() },
  });

  return attendanceCode;
};

/**
 * Clear idempotency cache (for testing/maintenance)
 */
export const clearIdempotencyCache = () => {
  idempotencyCache.clear();
};
