import { getPrismaClient } from '../../lib/prisma.js';
import { NotFoundError, AppError, ForbiddenError } from '../../middleware/error-handler.js';
import { checkScopeAccess } from '../users/service.js';

const prisma = getPrismaClient();

const generateUnitCode = (name, typeName) => {
  const prefix = 'FCS';
  const typeCode = typeName.substring(0, 3).toUpperCase();
  const nameCode = name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${typeCode}-${nameCode}-${random}`;
};

const UNIT_LEVELS = {
  'National': 1,
  'Area': 2,
  'State': 3,
  'Zone': 4,
  'Branch': 5
};

/**
 * Get all descendant unit IDs (looking down)
 */
export const getAllDescendantIds = async (unitId) => {
  const allIds = [];
  let currentLevelIds = [unitId];

  while (currentLevelIds.length > 0) {
    const children = await prisma.unit.findMany({
      where: { parentId: { in: currentLevelIds } },
      select: { id: true }
    });

    const childIds = children.map(c => c.id);
    allIds.push(...childIds);
    currentLevelIds = childIds;
  }

  return allIds;
};

/**
 * Get all ancestor unit IDs (looking up)
 */
export const getAllAncestorIds = async (unitId) => {
  const ancestors = [];
  let currentId = unitId;

  while (currentId) {
    const unit = await prisma.unit.findUnique({
      where: { id: currentId },
      select: { parentId: true }
    });

    if (unit && unit.parentId) {
      ancestors.push(unit.parentId);
      currentId = unit.parentId;
    } else {
      currentId = null;
    }
  }

  return ancestors;
};

/**
 * Create organizational unit
 */
export const createUnit = async (data, userId) => {
  const { name, type, parentUnitId, description, leaderId } = data;

  // Permission Check
  if (parentUnitId && userId) {
    const hasAccess = await checkScopeAccess(userId, parentUnitId);
    if (!hasAccess) {
      throw new ForbiddenError('You do not have permission to create units under this parent');
    }
  } else if (userId) {
    // Creating a root unit - strict check?
    // For now, rely on Role Middleware (Super Admin)
    // But if checkScopeAccess(userId, null) returns true, we are fine as long as route has role check.
  }

  // 1. Get or Create Unit Type
  let unitTypeRecord = await prisma.unitType.findFirst({
    where: {
      name: { equals: type, mode: 'insensitive' }
    },
  });


  if (!unitTypeRecord) {
    // Self-healing: Create the type if missing
    // Use Title Case for the name if possible, or just use provided type
    const normalizedType = Object.keys(UNIT_LEVELS).find(k => k.toLowerCase() === type.toLowerCase()) || type;
    const level = UNIT_LEVELS[normalizedType] || 99;


    try {
      unitTypeRecord = await prisma.unitType.create({
        data: {
          name: normalizedType,
          level: level,
          description: `${normalizedType} Level Unit`
        }
      });
    } catch (error) {
      // If creation failed (e.g. race condition or level conflict), try finding by Name OR Level
      // This handles cases where "National" (Level 1) exists as "National HQ"
      unitTypeRecord = await prisma.unitType.findFirst({
        where: {
          OR: [
            { name: { equals: type, mode: 'insensitive' } },
            { level: level }
          ]
        },
      });
    }
  }

  if (!unitTypeRecord) {
    throw new AppError(`Invalid unit type: ${type}`, 400);
  }

  // 2. Verify parent unit if provided
  if (parentUnitId) {
    const parentUnit = await prisma.unit.findUnique({
      where: { id: parentUnitId },
      include: { unitType: true }
    });

    if (!parentUnit) {
      throw new NotFoundError('Parent unit not found');
    }

    // Hierarchy Validation
    const parentType = parentUnit.unitType.name;
    const allowedParents = {
      'Area': ['National'],
      'State': ['Area'],
      'Zone': ['State'],
      'Branch': ['Zone']
    };

    if (allowedParents[type] && !allowedParents[type].includes(parentType)) {
      throw new AppError(`Invalid hierarchy: ${type} cannot be under ${parentType}`, 400);
    }
  } else if (type !== 'National') {
    // Non-national units must have a parent (except maybe Area/State in some legacy cases, 
    // but for new ones we should enforce it)
    throw new AppError(`${type} level units must have a parent unit`, 400);
  }

  // 3. Generate Code
  const code = generateUnitCode(name, type);

  // 4. Create Unit
  const unit = await prisma.unit.create({
    data: {
      name,
      unitTypeId: unitTypeRecord.id, // Use the resolved ID
      parentId: parentUnitId,
      description,
      code,
    },
    include: {
      unitType: true,
      parent: true
    }
  });

  return {
    ...unit,
    type: unit.unitType.name,
    parentUnitId: unit.parentId,
  };
};

/**
 * Get unit by ID
 */
export const getUnitById = async (unitId) => {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      parent: true,
      children: true,
      unitType: true,
      _count: {
        select: { children: true, events: true },
      }
    },
  });

  if (!unit) {
    throw new NotFoundError('Unit not found');
  }

  return {
    ...unit,
    type: unit.unitType.name,
    parentUnitId: unit.parentId,
    childUnits: unit.children,
    childUnitCount: unit._count.children,
  };
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
    recursive = false,
    search,
    ids,
  } = query;
  const skip = (page - 1) * limit;

  let unitIds = ids;
  if (parentUnitId && (recursive === true || recursive === 'true')) {
    const descendants = await getAllDescendantIds(parentUnitId);
    unitIds = ids ? ids.filter(id => [parentUnitId, ...descendants].includes(id)) : [parentUnitId, ...descendants];
  }

  const where = {
    isActive: true, // Only show active units by default
    ...(type && { unitType: { name: type } }),
    ...(parentUnitId && !(recursive === true || recursive === 'true') && { parentId: parentUnitId }),
    ...(unitIds && { id: { in: unitIds } }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [units, total] = await Promise.all([
    prisma.unit.findMany({
      where,
      include: {
        unitType: true,
        _count: {
          select: { children: true, events: true },
        },
      },
      orderBy: { name: 'asc' },
      skip: parseInt(skip),
      take: parseInt(limit),
    }),
    prisma.unit.count({ where }),
  ]);

  return {
    data: units.map((u) => ({
      ...u,
      type: u.unitType.name,
      parentUnitId: u.parentId,
      childUnitCount: u._count.children,
      eventCount: u._count.events,
    })),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Update unit
 */
export const updateUnit = async (unitId, data, userId) => {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    throw new NotFoundError('Unit not found');
  }

  // Permission Check
  if (userId) {
    const hasAccess = await checkScopeAccess(userId, unitId);
    if (!hasAccess) {
      throw new ForbiddenError('You do not have permission to update this unit');
    }
  }

  const { name, type, description, parentUnitId, leaderId } = data;

  let unitTypeId = undefined;
  if (type) {
    const typeRecord = await prisma.unitType.findFirst({
      where: { name: { equals: type, mode: 'insensitive' } }
    });
    if (typeRecord) unitTypeId = typeRecord.id;
  }

  // If parentUnitId is changed, validate hierarchy
  if (parentUnitId && parentUnitId !== unit.parentId) {
    // Basic cyclic check: cannot be its own parent
    if (parentUnitId === unitId) {
      throw new AppError('A unit cannot be its own parent', 400);
    }
  }

  const updated = await prisma.unit.update({
    where: { id: unitId },
    data: {
      ...(name && { name }),
      ...(unitTypeId && { unitTypeId }),
      ...(description !== undefined && { description }),
      ...(parentUnitId !== undefined && { parentId: parentUnitId || null }),
      ...(leaderId !== undefined && { leaderId: leaderId || null }),
    },
    include: {
      unitType: true
    }
  });

  return {
    ...updated,
    type: updated.unitType.name,
    parentUnitId: updated.parentId,
  };
};

/**
 * Get unit hierarchy
 */
export const getUnitHierarchy = async (rootUnitId = null) => {
  const getHierarchyRecursive = async (unitId) => {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        unitType: true,
        _count: { select: { children: true } }
      },
    });

    if (!unit) return null;

    const childUnits = await prisma.unit.findMany({
      where: { parentId: unitId },
    });

    const children = await Promise.all(
      childUnits.map((child) => getHierarchyRecursive(child.id))
    );

    return {
      ...unit,
      type: unit.unitType.name,
      children: children.filter((c) => c !== null),
    };
  };

  if (rootUnitId) {
    return getHierarchyRecursive(rootUnitId);
  }

  const rootUnits = await prisma.unit.findMany({
    where: { parentId: null },
  });

  return Promise.all(rootUnits.map((unit) => getHierarchyRecursive(unit.id)));
};

/**
 * Get child units
 */
export const getChildUnits = async (parentUnitId, recursive = false) => {
  const children = await prisma.unit.findMany({
    where: { parentId: parentUnitId },
    include: {
      unitType: true,
      _count: { select: { children: true } }
    },
    orderBy: { name: 'asc' },
  });

  return children.map((c) => ({
    ...c,
    type: c.unitType.name,
    childUnitCount: c._count.children,
  }));
};

/**
 * Add member to unit
 */
export const addMemberToUnit = async (unitId, memberId) => {
  // Placeholder: Member schema does not have direct unitId relation currently.
  // Implementation deferred.
  throw new AppError('Feature momentarily unavailable due to schema updates', 501);
};

/**
 * Remove member from unit
 */
export const removeMemberFromUnit = async (unitId, memberId) => {
  throw new AppError('Feature momentarily unavailable due to schema updates', 501);
};

/**
 * Get unit members
 */
export const getUnitMembers = async (unitId, query = {}) => {
  return {
    data: [],
    pagination: {
      page: 1,
      limit: 50,
      total: 0,
      pages: 0
    }
  };
};

/**
 * Get unit statistics
 */
export const getUnitStatistics = async (unitId) => {
  return {
    unit: { id: unitId },
    statistics: {
      members: 0,
      events: 0,
      registrations: 0,
      childUnits: 0
    },
    membersByState: []
  };
};

/**
 * Deactivate unit
 */
/**
 * Deactivate unit
 */
export const deactivateUnit = async (unitId, userId) => {
  if (userId) {
    const hasAccess = await checkScopeAccess(userId, unitId);
    if (!hasAccess) {
      throw new ForbiddenError('You do not have permission to deactivate this unit');
    }
  }

  const updated = await prisma.unit.update({
    where: { id: unitId },
    data: { isActive: false },
  });
  return updated;
};
