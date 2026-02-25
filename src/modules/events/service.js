import { getPrismaClient } from '../../lib/prisma.js';
import {
  getPaginationParams,
  formatPaginatedResponse,
  isDateInPast,
  calculateAttendanceRate,
} from '../../lib/helpers.js';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from '../../middleware/error-handler.js';
import { isWithinScope } from '../../middleware/scope-validator.js';
import { getAllDescendantIds, getAllAncestorIds } from '../units/service.js';

const prisma = getPrismaClient();

/**
 * Create event
 */
export const createEvent = async (data, userId) => {
  const {
    title,
    description,
    unitId,
    startDate,
    endDate,
    registrationStart,
    registrationEnd,
    participationMode,
    imageUrl,
  } = data;

  // Permission Check (HRBAC: verify scope)
  const hasAccess = await isWithinScope(userId, unitId);
  if (!hasAccess) {
    throw new ForbiddenError('You do not have permission to create events for this unit');
  }

  // Verify unit exists
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    throw new NotFoundError('Unit');
  }

  // Validate dates
  if (new Date(startDate) >= new Date(endDate)) {
    throw new ValidationError('Start date must be before end date');
  }

  // Removed validation: Allow registration to extend into or after event period
  // if (new Date(registrationEnd) >= new Date(startDate)) {
  //   throw new ValidationError('Registration must close before event starts');
  // }

  const event = await prisma.event.create({
    data: {
      title,
      description: description || null,
      unitId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      registrationStart: new Date(registrationStart),
      registrationEnd: new Date(registrationEnd),
      participationMode,
      imageUrl: imageUrl || null,
      createdBy: userId,
      isPublished: true, // Auto-publish events on creation
    },
  });

  return event;
};

/**
 * Get event by ID
 */
export const getEventById = async (eventId) => {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      unit: {
        select: {
          id: true,
          name: true,
          code: true,
          unitType: { select: { name: true, level: true } }
        },
      },
      settings: true,
      centers: {
        where: { isActive: true },
        select: {
          id: true,
          centerName: true,
          state: { select: { name: true } },
        },
      },
    },
  });

  if (!event) {
    throw new NotFoundError('Event');
  }

  return event;
};

/**
 * List events with pagination and filters
 */
export const listEvents = async (query) => {
  const { page, limit, search, unitId, participationMode, isPublished } = query;
  const { skip, take } = getPaginationParams(page, limit);

  const where = {};

  if (search) {
    where.title = { contains: search, mode: 'insensitive' };
  }

  if (unitId) {
    // Hierarchical Event Visibility
    const unit = await prisma.unit.findUnique({ where: { id: unitId }, include: { unitType: true } });
    if (unit && !unit.unitType.name.includes('National')) {
      const ancestors = await getAllAncestorIds(unitId);
      const descendants = await getAllDescendantIds(unitId);

      // Visibility Logic: Show events in the unit hierarchy (own + ancestors + descendants)
      where.unitId = { in: [unitId, ...ancestors, ...descendants] };
    }
    // If National or unit not found, we show all events (no unitId filter)
  }

  if (participationMode) {
    where.participationMode = participationMode;
  }

  if (isPublished !== undefined) {
    // Handle both boolean and string values
    // This filter is applied in addition to any unitId filtering above
    where.isPublished = isPublished === true || isPublished === 'true';
  }

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      skip,
      take,
      include: {
        unit: {
          select: {
            id: true,
            name: true,
            unitType: { select: { name: true, level: true } }
          }
        },
        _count: {
          select: {
            registrations: true,
            attendances: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
    }),
    prisma.event.count({ where }),
  ]);

  return formatPaginatedResponse(events, total, parseInt(page || 1), parseInt(limit || 20));
};

/**
 * Update event
 */
export const updateEvent = async (eventId, data, userId) => {
  const {
    title,
    description,
    startDate,
    endDate,
    registrationStart,
    registrationEnd,
    participationMode,
    imageUrl,
  } = data;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    throw new NotFoundError('Event');
  }

  // Permission Check
  if (userId) {
    const hasAccess = await checkScopeAccess(userId, event.unitId);
    if (!hasAccess) {
      throw new ForbiddenError('You do not have permission to update this event');
    }
  }

  // Check if registration window has closed
  // Commented out to allow admins to update past events
  // if (isDateInPast(event.registrationEnd)) {
  //   throw new ValidationError('Cannot update event after registration closes');
  // }

  const updateData = {};

  if (title) updateData.title = title;
  if (description !== undefined) updateData.description = description || null;
  if (startDate) {
    updateData.startDate = new Date(startDate);
    // Removed validation: Allow registration to extend into or after event period
    // if (registrationEnd && new Date(registrationEnd) >= new Date(startDate)) {
    //   throw new ValidationError('Registration must close before event starts');
    // }
  }
  if (endDate) updateData.endDate = new Date(endDate);
  if (registrationStart) updateData.registrationStart = new Date(registrationStart);
  if (registrationEnd) updateData.registrationEnd = new Date(registrationEnd);
  if (participationMode) updateData.participationMode = participationMode;
  if (imageUrl !== undefined) updateData.imageUrl = imageUrl || null;

  return prisma.event.update({
    where: { id: eventId },
    data: updateData,
  });
};

/**
 * Publish event
 */
/**
 * Publish event
 */
export const publishEvent = async (eventId, userId) => {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    throw new NotFoundError('Event');
  }

  // Permission Check
  if (userId) {
    const hasAccess = await checkScopeAccess(userId, event.unitId);
    if (!hasAccess) {
      throw new ForbiddenError('You do not have permission to publish this event');
    }
  }

  if (event.isPublished) {
    throw new ValidationError('Event is already published');
  }

  return prisma.event.update({
    where: { id: eventId },
    data: { isPublished: true },
  });
};

/**
 * Get event statistics
 */
export const getEventStatistics = async (eventId) => {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    throw new NotFoundError('Event');
  }

  const [totalRegistrations, totalAttendance, registrationsByMode, attendanceByMode] = await Promise.all([
    prisma.registration.count({
      where: { eventId },
    }),
    prisma.attendanceRecord.count({
      where: { eventId },
    }),
    prisma.registrationParticipation.groupBy({
      by: ['participationMode'],
      where: { registration: { eventId } },
      _count: true,
    }),
    prisma.attendanceRecord.groupBy({
      by: ['participationMode'],
      where: { eventId },
      _count: true,
    }),
  ]);

  const centerStats =
    ['ONSITE', 'HYBRID'].includes(event.participationMode)
      ? await prisma.eventCenter.findMany({
        where: { eventId, isActive: true },
        select: {
          id: true,
          centerName: true,
          _count: {
            select: {
              registrations: true,
              attendances: true,
            },
          },
        },
      })
      : [];

  return {
    eventId,
    title: event.title,
    participationMode: event.participationMode,
    totalRegistrations,
    totalAttendance,
    attendanceRate: calculateAttendanceRate(totalAttendance, totalRegistrations),
    registrationsByMode: registrationsByMode.map((item) => ({
      mode: item.participationMode,
      count: item._count,
    })),
    attendanceByMode: attendanceByMode.map((item) => ({
      mode: item.participationMode,
      count: item._count,
    })),
    centerStatistics: centerStats.map((center) => ({
      centerId: center.id,
      centerName: center.centerName,
      registrations: center._count.registrations,
      attendance: center._count.attendances,
    })),
  };
};

/**
 * Create or update event settings
 */
export const updateEventSettings = async (eventId, data, userId) => {
  const {
    requireGroupAssignment,
    allowSelfRegistration,
    allowThirdPartyRegistration,
    requireParentalConsent,
    groupAssignmentMethod,
  } = data;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    throw new NotFoundError('Event');
  }

  // Permission Check
  if (userId) {
    const hasAccess = await checkScopeAccess(userId, event.unitId);
    if (!hasAccess) {
      throw new ForbiddenError('You do not have permission to update settings for this event');
    }
  }

  const existingSettings = await prisma.eventSetting.findUnique({
    where: { eventId },
  });

  if (existingSettings) {
    return prisma.eventSetting.update({
      where: { eventId },
      data: {
        requireGroupAssignment: requireGroupAssignment !== undefined ? requireGroupAssignment : undefined,
        allowSelfRegistration: allowSelfRegistration !== undefined ? allowSelfRegistration : undefined,
        allowThirdPartyRegistration:
          allowThirdPartyRegistration !== undefined ? allowThirdPartyRegistration : undefined,
        requireParentalConsent: requireParentalConsent !== undefined ? requireParentalConsent : undefined,
        groupAssignmentMethod: groupAssignmentMethod || undefined,
      },
    });
  }

  return prisma.eventSetting.create({
    data: {
      eventId,
      requireGroupAssignment: requireGroupAssignment || false,
      allowSelfRegistration: allowSelfRegistration !== false,
      allowThirdPartyRegistration: allowThirdPartyRegistration !== false,
      requireParentalConsent: requireParentalConsent || false,
      groupAssignmentMethod: groupAssignmentMethod || null,
    },
  });
};

/**
 * Check if registration is open
 */
export const isRegistrationOpen = (event) => {
  const now = new Date();
  return now >= event.registrationStart && now <= event.registrationEnd;
};

/**
 * Check if event is happening
 */
export const isEventHappening = (event) => {
  const now = new Date();
  return now >= event.startDate && now <= event.endDate;
};

/**
 * Delete event
 */
export const deleteEvent = async (eventId, userId) => {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    throw new NotFoundError('Event');
  }

  // Permission Check
  if (userId) {
    const hasAccess = await checkScopeAccess(userId, event.unitId);
    if (!hasAccess) {
      throw new ForbiddenError('You do not have permission to delete this event');
    }
  }

  // Optional: Prevent deletion if there are registrations? 
  // For now, we allow it (Prisma will cascade delete as per schema)
  // But maybe we should warn if it's already published?

  return prisma.event.delete({
    where: { id: eventId },
  });
};
