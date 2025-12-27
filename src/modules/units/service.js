import { getPrismaClient } from '../../lib/prisma.js';
import { NotFoundError, AppError } from '../../middleware/error-handler.js';

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
  'Regional': 2,
  'State': 3,
  'Zone': 4,
  'Area': 5,
  'Branch': 6
};

/**
 * Create organizational unit
 */
export const createUnit = async (data) => {
  const { name, type, parentUnitId, description, leaderId } = data;

  // 1. Get or Create Unit Type
  let unitTypeRecord = await prisma.unitType.findFirst({
    where: {
      name: { equals: type, mode: 'insensitive' }
    },
  });

  console.log(`[DEBUG] Looking for type '${type}':`, unitTypeRecord);

  if (!unitTypeRecord) {
    // Self-healing: Create the type if missing
    // Use Title Case for the name if possible, or just use provided type
    const normalizedType = Object.keys(UNIT_LEVELS).find(k => k.toLowerCase() === type.toLowerCase()) || type;
    const level = UNIT_LEVELS[normalizedType] || 99;

    console.log(`[DEBUG] Attempting to create type '${normalizedType}' with level ${level}`);

    try {
      unitTypeRecord = await prisma.unitType.create({
        data: {
          name: normalizedType,
          level: level,
          description: `${normalizedType} Level Unit`
        }
      });
      console.log(`[DEBUG] Created type:`, unitTypeRecord);
    } catch (error) {
      console.log(`[DEBUG] Creation failed:`, error.message);
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
      console.log(`[DEBUG] Retry find result (by name/level):`, unitTypeRecord);
    }
  }

  if (!unitTypeRecord) {
    throw new AppError(`Invalid unit type: ${type}`, 400);
  }

  // 2. Verify parent unit if provided
  if (parentUnitId) {
    const parentUnit = await prisma.unit.findUnique({
      where: { id: parentUnitId },
    });

    if (!parentUnit) {
      throw new NotFoundError('Parent unit not found');
    }
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
    search,
  } = query;
  const skip = (page - 1) * limit;

  const where = {
    ...(type && { unitType: { name: type } }),
    ...(parentUnitId && { parentId: parentUnitId }),
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
export const updateUnit = async (unitId, data) => {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    throw new NotFoundError('Unit not found');
  }

  const { name, type, description } = data;

  let unitTypeId = undefined;
  if (type) {
    const typeRecord = await prisma.unitType.findUnique({ where: { name: type } });
    if (typeRecord) unitTypeId = typeRecord.id;
  }

  const updated = await prisma.unit.update({
    where: { id: unitId },
    data: {
      ...(name && { name }),
      ...(unitTypeId && { unitTypeId }),
      ...(description && { description }),
    },
    include: {
      unitType: true
    }
  });

  return {
    ...updated,
    type: updated.unitType.name,
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
export const deactivateUnit = async (unitId) => {
  const updated = await prisma.unit.update({
    where: { id: unitId },
    data: { isActive: false },
  });
  return updated;
};
