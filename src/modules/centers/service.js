import { getPrismaClient } from '../../lib/prisma.js';
import {
  getPaginationParams,
  formatPaginatedResponse,
} from '../../lib/helpers.js';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from '../../middleware/error-handler.js';

const prisma = getPrismaClient();

import { checkScopeAccess } from '../users/service.js';

// ... existing imports

/**
 * Create event center
 */
export const createCenter = async (data, userId) => {
  const { eventId, centerName, country, stateId, address } = data;

  // Verify event exists
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    throw new NotFoundError('Event');
  }

  // Permission Check
  const hasAccess = await checkScopeAccess(userId, event.unitId);
  if (!hasAccess) {
    throw new ForbiddenError('You do not have permission to create centers for this event');
  }

  // Only ONSITE or HYBRID events can have centers
  if (!['ONSITE', 'HYBRID'].includes(event.participationMode)) {
    throw new ValidationError(
      'Centers can only be created for ONSITE or HYBRID events'
    );
  }

  // Verify state exists if provided
  if (stateId) {
    const state = await prisma.unit.findUnique({
      where: { id: stateId },
    });
    if (!state) {
      throw new NotFoundError('State');
    }
  }

  // Verify area exists if provided
  if (data.areaId) {
    const area = await prisma.unit.findUnique({
      where: { id: data.areaId },
    });
    if (!area) {
      throw new NotFoundError('Area');
    }
  }

  // Verify zone exists if provided
  if (data.zoneId) {
    const zone = await prisma.unit.findUnique({
      where: { id: data.zoneId },
    });
    if (!zone) {
      throw new NotFoundError('Zone');
    }
  }

  const center = await prisma.eventCenter.create({
    data: {
      eventId,
      centerName,
      country: country || 'Nigeria',
      stateId: stateId || null,
      areaId: data.areaId || null,
      zoneId: data.zoneId || null,
      address,
      createdBy: userId,
    },
  });

  return center;
};

/**
 * Get center by ID
 */
export const getCenterById = async (centerId, userId) => {
  const center = await prisma.eventCenter.findUnique({
    where: { id: centerId },
    include: {
      admins: {
        include: {
          user: {
            select: {
              id: true,
              phoneNumber: true,
              email: true,
            },
          },
        },
      },
      event: {
        select: {
          id: true,
          title: true,
          participationMode: true,
          unitId: true,
        },
      },
      state: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      area: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      zone: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });

  if (!center) {
    throw new NotFoundError('Center');
  }

  // Permission Check
  if (userId) {
    const hasAccess = await checkScopeAccess(userId, center.event.unitId);
    if (!hasAccess) {
      throw new ForbiddenError('You do not have permission to view this center');
    }
  }

  return center;
};

/**
 * List centers for an event
 */
export const listCentersByEvent = async (eventId, query) => {
  const { page, limit, isActive } = query;
  const { skip, take } = getPaginationParams(page, limit);

  // Verify event exists
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    throw new NotFoundError('Event');
  }

  const where = {
    eventId,
    isActive: isActive !== undefined ? isActive === 'true' : true,
  };

  const [centers, total] = await Promise.all([
    prisma.eventCenter.findMany({
      where,
      skip,
      take,
      include: {
        admins: { select: { user: { select: { phoneNumber: true } } } },
        state: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        zone: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.eventCenter.count({ where }),
  ]);

  return formatPaginatedResponse(centers, total, parseInt(page || 1), parseInt(limit || 20));
};

/**
 * List all active centers (for registration)
 */
export const listActiveCenters = async (eventId, query = {}) => {
  const { state, page, limit } = query;
  const { skip, take } = getPaginationParams(page, limit);

  const where = {
    eventId,
    isActive: true,
  };

  if (state) {
    where.stateId = state;
  }

  const [centers, total] = await Promise.all([
    prisma.eventCenter.findMany({
      where,
      skip,
      take,
      select: {
        id: true,
        centerName: true,
        country: true,
        stateId: true,
        state: { select: { id: true, name: true } },
        address: true,
        isActive: true,
      },
      orderBy: { centerName: 'asc' },
    }),
    prisma.eventCenter.count({ where }),
  ]);

  return formatPaginatedResponse(centers, total, parseInt(page || 1), parseInt(limit || 20));
};

/**
 * Update center
 */
export const updateCenter = async (centerId, data, userId) => {
  const { centerName, address, isActive } = data;

  const center = await prisma.eventCenter.findUnique({
    where: { id: centerId },
    include: { event: true },
  });

  if (!center) {
    throw new NotFoundError('Center');
  }

  // Permission Check
  if (userId) {
    const hasAccess = await checkScopeAccess(userId, center.event.unitId);
    if (!hasAccess) {
      throw new ForbiddenError('You do not have permission to update centers for this event');
    }
  }

  return prisma.eventCenter.update({
    where: { id: centerId },
    data: {
      centerName: centerName || center.centerName,
      address: address || center.address,
      isActive: isActive !== undefined ? isActive : center.isActive,
      stateId: data.stateId !== undefined ? data.stateId : center.stateId,
      areaId: data.areaId !== undefined ? data.areaId : center.areaId,
      zoneId: data.zoneId !== undefined ? data.zoneId : center.zoneId,
    },
  });
};

/**
 * Add center admin
 */
export const addCenterAdmin = async (centerId, userId, requesterUserId) => {
  // Verify center exists
  const center = await prisma.eventCenter.findUnique({
    where: { id: centerId },
    include: { event: true },
  });

  if (!center) {
    throw new NotFoundError('Center');
  }

  // Permission Check
  if (requesterUserId) {
    const hasAccess = await checkScopeAccess(requesterUserId, center.event.unitId);
    if (!hasAccess) {
      throw new ForbiddenError('You do not have permission to manage admins for this center');
    }
  }

  // Verify user exists
  const user = await prisma.authUser.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotFoundError('User');
  }

  // Check if already admin
  const existingAdmin = await prisma.centerAdmin.findFirst({
    where: { centerId, userId },
  });

  if (existingAdmin) {
    throw new ValidationError('User is already an admin for this center');
  }

  return prisma.centerAdmin.create({
    data: {
      centerId,
      userId,
      role: 'CENTER_ADMIN',
    },
  });
};

/**
 * Remove center admin
 */
export const removeCenterAdmin = async (centerId, userId, requesterUserId) => {
  const center = await prisma.eventCenter.findUnique({
    where: { id: centerId },
    include: { event: true },
  });

  if (!center) throw new NotFoundError('Center');

  // Permission Check
  if (requesterUserId) {
    const hasAccess = await checkScopeAccess(requesterUserId, center.event.unitId);
    if (!hasAccess) {
      throw new ForbiddenError('You do not have permission to manage admins for this center');
    }
  }

  const admin = await prisma.centerAdmin.findFirst({
    where: { centerId, userId },
  });

  if (!admin) {
    throw new NotFoundError('Center admin');
  }

  await prisma.centerAdmin.delete({
    where: { id: admin.id },
  });

  return { message: 'Center admin removed successfully' };
};

/**
 * Get center statistics
 */
export const getCenterStatistics = async (centerId, userId) => {
  const center = await prisma.eventCenter.findUnique({
    where: { id: centerId },
    include: { event: true },
  });

  if (!center) {
    throw new NotFoundError('Center');
  }

  // Permission Check
  if (userId) {
    const hasAccess = await checkScopeAccess(userId, center.event.unitId);
    if (!hasAccess) {
      throw new ForbiddenError('You do not have permission to view statistics for this center');
    }
  }

  const [registrations, attendances, groups] = await Promise.all([
    prisma.registration.count({
      where: {
        centerId,
      },
    }),
    prisma.attendanceRecord.count({
      where: {
        centerId,
      },
    }),
    prisma.groupAssignment.count({
      where: {
        registration: { centerId },
      },
    }),
  ]);

  return {
    centerId,
    centerName: center.centerName,
    registrations,
    attendance: attendances,
    groups,
  };
};

/**
 * Deactivate center (soft delete)
 */
export const deactivateCenter = async (centerId, userId) => {
  const center = await prisma.eventCenter.findUnique({
    where: { id: centerId },
    include: { event: true },
  });

  if (!center) {
    throw new NotFoundError('Center');
  }

  // Permission Check
  if (userId) {
    const hasAccess = await checkScopeAccess(userId, center.event.unitId);
    if (!hasAccess) {
      throw new ForbiddenError('You do not have permission to deactivate this center');
    }
  }

  return prisma.eventCenter.update({
    where: { id: centerId },
    data: { isActive: false },
  });
};

/**
 * Check if user is center admin
 */
export const isCenterAdmin = async (centerId, userId) => {
  const admin = await prisma.centerAdmin.findFirst({
    where: { centerId, userId },
  });

  return !!admin;
};

/**
 * Get centers by state (for visibility filtering)
 */
export const getCentersByState = async (eventId, stateId) => {
  return prisma.eventCenter.findMany({
    where: {
      eventId,
      stateId,
      isActive: true,
    },
    select: {
      id: true,
      centerName: true,
      address: true,
    },
  });
};

/**
 * List all centers for admin based on their scope
 * National admins see all centers
 * Area/State/Branch admins see centers within their unit hierarchy
 */
export const listAllCentersForAdmin = async (userId, query = {}) => {
  const { page, limit, eventId, search, isActive } = query;
  const { skip, take } = getPaginationParams(page, limit);

  // Get user's admin scope
  const { getAdminScope } = await import('../../middleware/scope-validator.js');
  const scope = await getAdminScope(userId);

  if (!scope.isGlobal && !scope.unitId) {
    throw new ForbiddenError('You do not have admin privileges');
  }

  const where = {};

  // Apply event filter if provided
  if (eventId) {
    where.eventId = eventId;
  }

  // Apply active filter if provided
  if (isActive !== undefined) {
    where.isActive = isActive === 'true' || isActive === true;
  }

  // Apply search filter
  if (search) {
    where.OR = [
      { centerName: { contains: search, mode: 'insensitive' } },
      { address: { contains: search, mode: 'insensitive' } },
      { state: { name: { contains: search, mode: 'insensitive' } } },
      { area: { name: { contains: search, mode: 'insensitive' } } },
      { zone: { name: { contains: search, mode: 'insensitive' } } }
    ];
  }

  // Apply scope-based filtering
  if (!scope.isGlobal) {
    // Get all descendant units (including the admin's unit)
    const { getAllDescendantIds } = await import('../units/service.js');
    const descendantIds = await getAllDescendantIds(scope.unitId);
    const allUnitIds = [scope.unitId, ...descendantIds];

    // Filter centers by state (unit) within the admin's scope
    const searchFilter = where.OR;
    delete where.OR;

    where.AND = [
      {
        OR: [
          { stateId: { in: allUnitIds } },
          { stateId: null } // Include centers without state assignment
        ]
      }
    ];

    if (searchFilter) {
      where.AND.push({ OR: searchFilter });
    }
  }

  const [centers, total] = await Promise.all([
    prisma.eventCenter.findMany({
      where,
      skip,
      take,
      include: {
        event: {
          select: {
            id: true,
            title: true,
            participationMode: true,
          }
        },
        state: {
          select: {
            id: true,
            name: true,
            code: true,
          }
        },
        area: {
          select: {
            id: true,
            name: true,
            code: true,
          }
        },
        zone: {
          select: {
            id: true,
            name: true,
            code: true,
          }
        },
        admins: {
          include: {
            user: {
              select: {
                id: true,
                phoneNumber: true,
                email: true,
              }
            }
          }
        },
        _count: {
          select: {
            registrations: true,
            attendances: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.eventCenter.count({ where }),
  ]);

  return formatPaginatedResponse(centers, total, parseInt(page || 1), parseInt(limit || 20));
};
