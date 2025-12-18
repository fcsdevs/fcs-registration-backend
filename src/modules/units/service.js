import { getPrismaClient } from '../../lib/prisma.js';
import { NotFoundError, AppError } from '../../middleware/error-handler.js';

const prisma = getPrismaClient();

/**
 * Create organizational unit
 */
export const createUnit = async (data) => {
  const { name, type, parentUnitId, description, leaderId } = data;

  // Verify parent unit if provided
  if (parentUnitId) {
    const parentUnit = await prisma.organizationalUnit.findUnique({
      where: { id: parentUnitId },
    });

    if (!parentUnit) {
      throw new NotFoundError('Parent unit not found');
    }
  }

  // Verify leader if provided
  if (leaderId) {
    const leader = await prisma.user.findUnique({
      where: { id: leaderId },
    });

    if (!leader) {
      throw new NotFoundError('Leader not found');
    }
  }

  const unit = await prisma.organizationalUnit.create({
    data: {
      name,
      type, // NATIONAL | REGIONAL | DISTRICT | LOCAL | CELL
      parentUnitId,
      description,
      leaderId,
    },
  });

  return unit;
};

/**
 * Get unit by ID
 */
export const getUnitById = async (unitId) => {
  const unit = await prisma.organizationalUnit.findUnique({
    where: { id: unitId },
    include: {
      parentUnit: true,
      childUnits: true,
      leader: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      members: {
        select: {
          id: true,
          name: true,
          fcsCode: true,
        },
      },
      events: true,
    },
  });

  if (!unit) {
    throw new NotFoundError('Unit not found');
  }

  return unit;
};

/**
 * List units with filtering
 */
export const listUnits = async (query = {}) => {
  const {
    page = 1,
    limit = 50,
    type,
    parentUnitId,
    search,
  } = query;
  const skip = (page - 1) * limit;

  const where = {
    ...(type && { type }),
    ...(parentUnitId && { parentUnitId }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [units, total] = await Promise.all([
    prisma.organizationalUnit.findMany({
      where,
      include: {
        leader: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { childUnits: true, members: true, events: true },
        },
      },
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    }),
    prisma.organizationalUnit.count({ where }),
  ]);

  return {
    data: units.map((u) => ({
      ...u,
      childUnitCount: u._count.childUnits,
      memberCount: u._count.members,
      eventCount: u._count.events,
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Update unit
 */
export const updateUnit = async (unitId, data) => {
  const unit = await prisma.organizationalUnit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    throw new NotFoundError('Unit not found');
  }

  const { name, type, description, leaderId } = data;

  // Verify leader if changing
  if (leaderId) {
    const leader = await prisma.user.findUnique({
      where: { id: leaderId },
    });

    if (!leader) {
      throw new NotFoundError('Leader not found');
    }
  }

  const updated = await prisma.organizationalUnit.update({
    where: { id: unitId },
    data: {
      ...(name && { name }),
      ...(type && { type }),
      ...(description && { description }),
      ...(leaderId && { leaderId }),
    },
    include: {
      leader: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return updated;
};

/**
 * Get unit hierarchy (tree structure)
 */
export const getUnitHierarchy = async (rootUnitId = null) => {
  const getHierarchyRecursive = async (unitId) => {
    const unit = await prisma.organizationalUnit.findUnique({
      where: { id: unitId },
      include: {
        leader: {
          select: { id: true, name: true },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    if (!unit) return null;

    const childUnits = await prisma.organizationalUnit.findMany({
      where: { parentUnitId: unitId },
    });

    const children = await Promise.all(
      childUnits.map((child) => getHierarchyRecursive(child.id))
    );

    return {
      ...unit,
      memberCount: unit._count.members,
      children: children.filter((c) => c !== null),
    };
  };

  if (rootUnitId) {
    return getHierarchyRecursive(rootUnitId);
  }

  // Get all root units
  const rootUnits = await prisma.organizationalUnit.findMany({
    where: { parentUnitId: null },
  });

  return Promise.all(rootUnits.map((unit) => getHierarchyRecursive(unit.id)));
};

/**
 * Get child units
 */
export const getChildUnits = async (parentUnitId, recursive = false) => {
  if (!recursive) {
    const children = await prisma.organizationalUnit.findMany({
      where: { parentUnitId },
      include: {
        leader: {
          select: { id: true, name: true },
        },
        _count: {
          select: { members: true, childUnits: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return children.map((c) => ({
      ...c,
      memberCount: c._count.members,
      childUnitCount: c._count.childUnits,
    }));
  }

  // Recursive - get all descendants
  const getDescendants = async (unitId) => {
    const children = await prisma.organizationalUnit.findMany({
      where: { parentUnitId: unitId },
    });

    let allDescendants = [...children];
    for (const child of children) {
      const descendants = await getDescendants(child.id);
      allDescendants = [...allDescendants, ...descendants];
    }

    return allDescendants;
  };

  return getDescendants(parentUnitId);
};

/**
 * Add member to unit
 */
export const addMemberToUnit = async (unitId, memberId) => {
  const unit = await prisma.organizationalUnit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    throw new NotFoundError('Unit not found');
  }

  const member = await prisma.member.findUnique({
    where: { id: memberId },
  });

  if (!member) {
    throw new NotFoundError('Member not found');
  }

  // Update member's unit assignment
  const updated = await prisma.member.update({
    where: { id: memberId },
    data: { unitId },
  });

  return updated;
};

/**
 * Remove member from unit
 */
export const removeMemberFromUnit = async (unitId, memberId) => {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
  });

  if (!member || member.unitId !== unitId) {
    throw new NotFoundError('Member not found in unit');
  }

  const updated = await prisma.member.update({
    where: { id: memberId },
    data: { unitId: null },
  });

  return updated;
};

/**
 * Get unit members
 */
export const getUnitMembers = async (unitId, query = {}) => {
  const { page = 1, limit = 50, search, state } = query;
  const skip = (page - 1) * limit;

  const unit = await prisma.organizationalUnit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    throw new NotFoundError('Unit not found');
  }

  const where = {
    unitId,
    isActive: true,
    ...(state && { state }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { fcsCode: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [members, total] = await Promise.all([
    prisma.member.findMany({
      where,
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    }),
    prisma.member.count({ where }),
  ]);

  return {
    data: members,
    unit: {
      id: unit.id,
      name: unit.name,
      type: unit.type,
    },
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get unit statistics
 */
export const getUnitStatistics = async (unitId) => {
  const unit = await prisma.organizationalUnit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    throw new NotFoundError('Unit not found');
  }

  const [
    memberCount,
    eventCount,
    childUnitCount,
    registrationCount,
  ] = await Promise.all([
    prisma.member.count({ where: { unitId } }),
    prisma.event.count({ where: { unitId } }),
    prisma.organizationalUnit.count({ where: { parentUnitId: unitId } }),
    prisma.registration.count({
      where: {
        member: { unitId },
      },
    }),
  ]);

  // Get members by state
  const membersByState = await prisma.member.groupBy({
    by: ['state'],
    where: { unitId },
    _count: {
      id: true,
    },
  });

  return {
    unit: {
      id: unit.id,
      name: unit.name,
      type: unit.type,
    },
    statistics: {
      members: memberCount,
      events: eventCount,
      registrations: registrationCount,
      childUnits: childUnitCount,
    },
    membersByState: membersByState.map((m) => ({
      state: m.state,
      count: m._count.id,
    })),
  };
};

/**
 * Deactivate unit (soft delete)
 */
export const deactivateUnit = async (unitId) => {
  const unit = await prisma.organizationalUnit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    throw new NotFoundError('Unit not found');
  }

  // Check if has child units
  const childCount = await prisma.organizationalUnit.count({
    where: { parentUnitId: unitId },
  });

  if (childCount > 0) {
    throw new AppError('Cannot deactivate unit with child units', 400);
  }

  // Remove member associations
  await prisma.member.updateMany({
    where: { unitId },
    data: { unitId: null },
  });

  const updated = await prisma.organizationalUnit.update({
    where: { id: unitId },
    data: { isActive: false },
  });

  return updated;
};
