import { getPrismaClient } from '../../lib/prisma.js';
import { checkScopeAccess } from '../users/service.js';
import {
  NotFoundError,
  AppError,
  ForbiddenError
} from '../../middleware/error-handler.js';

const prisma = getPrismaClient();

/**
 * Create event group
 */
export const createGroup = async (data, userId) => {
  const { eventId, name, type, description } = data;

  // Verify event exists
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  // Permission Check
  if (userId) {
    const hasAccess = await checkScopeAccess(userId, event.unitId);
    if (!hasAccess) {
      throw new ForbiddenError('You do not have permission to create groups for this event');
    }
  }

  const group = await prisma.eventGroup.create({
    data: {
      eventId,
      name,
      type, // BIBLE_STUDY | WORKSHOP | BREAKOUT
      description,
    },
  });

  return group;
};

/**
 * Get group by ID
 */
export const getGroupById = async (groupId) => {
  const group = await prisma.eventGroup.findUnique({
    where: { id: groupId },
    include: {
      event: true,
      _count: {
        select: { assignments: true }
      }
    }
  });

  if (!group) {
    throw new NotFoundError('Group not found');
  }

  return {
    ...group,
    memberCount: group._count.assignments
  };
};

/**
 * List groups by event
 */
export const listGroupsByEvent = async (eventId, params = {}) => {
  const { page = 1, limit = 10, type, userId, isGlobalAdmin } = params;
  const skip = (page - 1) * limit;

  let where = {
    ...(eventId && { eventId }),
    ...(type && { type }),
  };

  // If listing all groups (no eventId) and user is not global admin, apply scope filtering
  if (!eventId && userId && !isGlobalAdmin) {
    const { getAdminScope } = await import('../../middleware/scope-validator.js');
    const { getAllDescendantIds } = await import('../units/service.js');

    const scope = await getAdminScope(userId);

    if (!scope.isGlobal && scope.unitId) {
      const descendantIds = await getAllDescendantIds(scope.unitId);
      const userUnitIds = [scope.unitId, ...descendantIds];

      where = {
        ...where,
        event: {
          unitId: {
            in: userUnitIds
          }
        }
      };
    } else if (!scope.isGlobal && !scope.unitId) {
      // No scope = no groups visible
      return {
        groups: [],
        meta: { total: 0, page: Number(page), limit: Number(limit), pages: 0 }
      };
    }
  }

  console.log('[GroupsService] listGroupsByEvent called', { eventId, params, isGlobalAdmin });
  console.log('[GroupsService] Prisma Query Where:', where);

  const [groups, total] = await Promise.all([
    prisma.eventGroup.findMany({
      where,
      skip,
      take: Number(limit),
      include: {
        _count: {
          select: { assignments: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.eventGroup.count({ where })
  ]);
  console.log(`[GroupsService] Found ${groups.length} groups. Total: ${total}`);

  return {
    groups: groups.map(g => ({
      ...g,
      memberCount: g._count.assignments
    })),
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit))
    }
  };
};

/**
 * Update group
 */
export const updateGroup = async (groupId, data, userId) => {
  const group = await prisma.eventGroup.findUnique({
    where: { id: groupId },
    include: { event: true },
  });

  if (!group) {
    throw new NotFoundError('Group not found');
  }

  // Permission Check
  if (userId) {
    const hasAccess = await checkScopeAccess(userId, group.event.unitId);
    if (!hasAccess) {
      throw new ForbiddenError('You do not have permission to update groups for this event');
    }
  }

  const { name, description } = data;

  const updated = await prisma.eventGroup.update({
    where: { id: groupId },
    data: {
      ...(name && { name }),
      ...(description && { description }),
    },
    include: {
      _count: {
        select: { assignments: true },
      },
    },
  });

  return {
    ...updated,
    memberCount: updated._count.assignments,
  };
};

/**
 * Assign member to group
 */
export const assignMemberToGroup = async (groupId, memberId, userId) => {
  if (!userId) throw new AppError('User ID is required for assignment', 400);

  const group = await prisma.eventGroup.findUnique({
    where: { id: groupId },
    include: {
      event: true,
      _count: {
        select: { assignments: true },
      },
    },
  });

  if (!group) {
    throw new NotFoundError('Group not found');
  }

  // Permission Check
  if (userId) {
    const hasAccess = await checkScopeAccess(userId, group.event.unitId);
    if (!hasAccess) {
      throw new ForbiddenError('You do not have permission to manage groups for this event');
    }
  }

  // Check capacity - Removed
  // if (group.capacity && group._count.assignments >= group.capacity) {
  //   throw new AppError('Group is at full capacity', 400);
  // }

  // Find registration for this member in this event
  const registration = await prisma.registration.findFirst({
    where: {
      memberId,
      eventId: group.eventId,
    },
  });

  if (!registration) {
    throw new NotFoundError('Registration not found for member in this event');
  }

  // Check for existing assignments for this event
  const existingAssignments = await prisma.groupAssignment.findMany({
    where: { registrationId: registration.id },
    include: { group: true }
  });

  // Find if we have an assignment of same TYPE
  const sameTypeAssignment = existingAssignments.find(a => a.group.type === group.type);

  if (sameTypeAssignment) {
    // Update existing assignment of same type
    return prisma.groupAssignment.update({
      where: { id: sameTypeAssignment.id },
      data: {
        groupId,
        assignedBy: userId,
        assignedAt: new Date(),
      },
    });
  }

  // Create new assignment
  return prisma.groupAssignment.create({
    data: {
      groupId,
      registrationId: registration.id,
      memberId,
      assignedBy: userId,
    },
  });
};

/**
 * Remove member from group
 */
export const removeMemberFromGroup = async (groupId, memberId, userId) => {
  const group = await prisma.eventGroup.findUnique({ where: { id: groupId }, include: { event: true } });
  if (!group) throw new NotFoundError('Group not found');

  // Permission Check
  if (userId) {
    const hasAccess = await checkScopeAccess(userId, group.event.unitId);
    if (!hasAccess) {
      throw new ForbiddenError('You do not have permission to manage groups for this event');
    }
  }

  // Find registration
  const registration = await prisma.registration.findFirst({
    where: {
      memberId,
      eventId: group.eventId
    },
  });

  if (!registration) {
    throw new NotFoundError('Registration not found');
  }

  const assignment = await prisma.groupAssignment.findFirst({
    where: {
      registrationId: registration.id,
      groupId: groupId
    }
  });

  if (!assignment || assignment.groupId !== groupId) {
    throw new NotFoundError('Member not found in group');
  }

  await prisma.groupAssignment.delete({ where: { id: assignment.id } });

  return { success: true, message: 'Member removed from group' };
};

/**
 * Get group members
 */
export const getGroupMembers = async (groupId, params = {}) => {
  const { page = 1, limit = 10 } = params;
  const skip = (page - 1) * limit;

  const where = { groupId };

  const [assignments, total] = await Promise.all([
    prisma.groupAssignment.findMany({
      where,
      skip,
      take: Number(limit),
      include: {
        member: true
      },
      orderBy: { assignedAt: 'desc' }
    }),
    prisma.groupAssignment.count({ where })
  ]);

  return {
    members: assignments.map(a => a.member),
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit))
    }
  };
};

/**
 * Get group statistics
 */
export const getGroupStatistics = async (groupId) => {
  const group = await prisma.eventGroup.findUnique({
    where: { id: groupId },
    include: {
      _count: {
        select: { assignments: true }
      }
    }
  });

  if (!group) throw new NotFoundError('Group not found');

  return {
    memberCount: group._count.assignments,
  };
};

/**
 * Bulk assign members to groups (auto-assignment or manual)
 */
export const bulkAssignGroups = async (eventId, assignments, strategy = 'manual', userId) => {
  if (!userId) throw new AppError('User ID required for bulk assignment', 400);

  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  // Permission Check
  if (userId) {
    const hasAccess = await checkScopeAccess(userId, event.unitId);
    if (!hasAccess) {
      throw new ForbiddenError('You do not have permission to manage groups for this event');
    }
  }

  let results = {
    assigned: 0,
    failed: 0,
    errors: [],
  };

  if (strategy === 'manual') {
    // Manual assignments provided in array
    for (const assignment of assignments) {
      try {
        await assignMemberToGroup(assignment.groupId, assignment.memberId, userId);
        results.assigned++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          groupId: assignment.groupId,
          memberId: assignment.memberId,
          error: error.message,
        });
      }
    }
  } else if (strategy === 'auto') {
    // Auto-distribute members to groups evenly
    const groups = await prisma.eventGroup.findMany({
      where: { eventId },
    });

    if (groups.length === 0) {
      throw new AppError('No active groups found for this event', 400);
    }

    // Find registrations without a group assignment
    const unassignedRegistrations = await prisma.registration.findMany({
      where: {
        eventId,
        groupAssignments: { none: {} },
      },
    });

    let groupIndex = 0;
    for (const reg of unassignedRegistrations) {
      const targetGroup = groups[groupIndex % groups.length];
      try {
        await prisma.groupAssignment.create({
          data: {
            groupId: targetGroup.id,
            registrationId: reg.id,
            memberId: reg.memberId,
            assignedBy: userId
          }
        });
        results.assigned++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          registrationId: reg.id,
          error: error.message,
        });
      }
      groupIndex++;
    }
  }

  return results;
};

/**
 * Deactivate group
 */
export const deactivateGroup = async (groupId, userId) => {
  const group = await prisma.eventGroup.findUnique({
    where: { id: groupId },
    include: { event: true },
  });

  if (!group) {
    throw new NotFoundError('Group not found');
  }

  // Permission Check
  if (userId) {
    const hasAccess = await checkScopeAccess(userId, group.event.unitId);
    if (!hasAccess) {
      throw new ForbiddenError('You do not have permission to deactivate groups for this event');
    }
  }

  // Delete all assignments
  await prisma.groupAssignment.deleteMany({
    where: { groupId },
  });

  // const updated = await prisma.eventGroup.update({
  //   where: { id: groupId },
  //   data: { isActive: false },
  // });

  return group;
};

/**
 * Assign member to a Bible Study group (Random Balanced Strategy)
 */
export const assignToBibleStudy = async (eventId, registrationId, memberId, userId) => {
  // 1. Find all Bible Study groups for this event
  const groups = await prisma.eventGroup.findMany({
    where: {
      eventId,
      type: 'BIBLE_STUDY'
    },
    include: {
      _count: {
        select: { assignments: true }
      }
    }
  });

  if (groups.length === 0) {
    return null; // No bible study groups to assign to
  }

  // 2. Find minimum member count
  const minCount = Math.min(...groups.map(g => g._count.assignments));

  // 3. Filter groups that have the minimum count (candidates for assignment)
  const candidates = groups.filter(g => g._count.assignments === minCount);

  // 4. Pick a random candidate
  const selectedGroup = candidates[Math.floor(Math.random() * candidates.length)];

  // 5. Create assignment directly
  return prisma.groupAssignment.create({
    data: {
      groupId: selectedGroup.id,
      registrationId,
      memberId,
      assignedBy: userId || 'SYSTEM',
    }
  });
};
