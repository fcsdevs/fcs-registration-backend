import { getPrismaClient } from '../../lib/prisma.js';
import { NotFoundError, AppError, ForbiddenError } from '../../middleware/error-handler.js';

const prisma = getPrismaClient();

/**
 * Create role
 */
export const createRole = async (data) => {
  const { name, description, permissions, unitScope } = data;

  // Check if role exists
  const existing = await prisma.role.findUnique({
    where: { name },
  });

  if (existing) {
    throw new AppError('Role already exists', 400);
  }

  const role = await prisma.role.create({
    data: {
      name,
      description,
      permissions,
      unitScope, // Can be null (global) or unitId (scoped to unit)
      isActive: true,
    },
  });

  return role;
};

/**
 * Get role by ID
 */
export const getRoleById = async (roleId) => {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: {
      _count: {
        select: { users: true },
      },
    },
  });

  if (!role) {
    throw new NotFoundError('Role not found');
  }

  return role;
};

/**
 * List roles
 */
export const listRoles = async (query = {}) => {
  const { page = 1, limit = 50, search, isActive = true } = query;
  const skip = (page - 1) * limit;

  const where = {
    ...(isActive !== null && { isActive }),
    ...(search && { name: { contains: search, mode: 'insensitive' } }),
  };

  const [roles, total] = await Promise.all([
    prisma.role.findMany({
      where,
      include: {
        _count: {
          select: { users: true },
        },
      },
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    }),
    prisma.role.count({ where }),
  ]);

  return {
    data: roles,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Update role
 */
export const updateRole = async (roleId, data) => {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
  });

  if (!role) {
    throw new NotFoundError('Role not found');
  }

  const { name, description, permissions, isActive } = data;

  const updated = await prisma.role.update({
    where: { id: roleId },
    data: {
      ...(name && { name }),
      ...(description && { description }),
      ...(permissions && { permissions }),
      ...(isActive !== undefined && { isActive }),
    },
    include: {
      _count: {
        select: { users: true },
      },
    },
  });

  return updated;
};

/**
 * Assign role to user
 */
export const assignRoleToUser = async (userId, roleId, unitId = null) => {
  const [user, role] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.role.findUnique({ where: { id: roleId } }),
  ]);

  if (!user) throw new NotFoundError('User not found');
  if (!role) throw new NotFoundError('Role not found');

  // If role has unitScope, verify unit exists
  if (role.unitScope && unitId) {
    const unit = await prisma.organizationalUnit.findUnique({
      where: { id: unitId },
    });

    if (!unit) throw new NotFoundError('Unit not found');
  }

  const assignment = await prisma.roleAssignment.create({
    data: {
      userId,
      roleId,
      unitId,
      assignedAt: new Date(),
    },
    include: {
      role: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return assignment;
};

/**
 * Remove role from user
 */
export const removeRoleFromUser = async (userId, roleId) => {
  const assignment = await prisma.roleAssignment.findFirst({
    where: { userId, roleId },
  });

  if (!assignment) {
    throw new NotFoundError('Role assignment not found');
  }

  await prisma.roleAssignment.delete({
    where: { id: assignment.id },
  });

  return { message: 'Role removed from user' };
};

/**
 * Get user roles
 */
export const getUserRoles = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const assignments = await prisma.roleAssignment.findMany({
    where: { userId },
    include: {
      role: true,
      unit: {
        select: { id: true, name: true },
      },
    },
    orderBy: { assignedAt: 'desc' },
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    roles: assignments,
  };
};

/**
 * Get role users
 */
export const getRoleUsers = async (roleId, query = {}) => {
  const { page = 1, limit = 50 } = query;
  const skip = (page - 1) * limit;

  const role = await prisma.role.findUnique({
    where: { id: roleId },
  });

  if (!role) {
    throw new NotFoundError('Role not found');
  }

  const [assignments, total] = await Promise.all([
    prisma.roleAssignment.findMany({
      where: { roleId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        unit: {
          select: { id: true, name: true },
        },
      },
      orderBy: { assignedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.roleAssignment.count({ where: { roleId } }),
  ]);

  return {
    role: {
      id: role.id,
      name: role.name,
    },
    users: assignments,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Check user permission
 */
export const checkUserPermission = async (userId, permission) => {
  const assignments = await prisma.roleAssignment.findMany({
    where: { userId },
    include: { role: true },
  });

  for (const assignment of assignments) {
    if (assignment.role.permissions.includes(permission)) {
      return true;
    }
  }

  return false;
};

/**
 * Get user permissions (aggregate all roles)
 */
export const getUserPermissions = async (userId) => {
  const assignments = await prisma.roleAssignment.findMany({
    where: { userId },
    include: { role: true },
  });

  const permissions = new Set();
  assignments.forEach((a) => {
    if (Array.isArray(a.role.permissions)) {
      a.role.permissions.forEach((p) => permissions.add(p));
    }
  });

  return Array.from(permissions);
};

/**
 * Create predefined roles
 */
export const createPredefinedRoles = async () => {
  const roles = [
    {
      name: 'ADMIN',
      description: 'System administrator with full access',
      permissions: [
        'view_all',
        'create_events',
        'edit_events',
        'delete_events',
        'manage_users',
        'manage_roles',
        'manage_centers',
        'view_reports',
        'export_data',
        'view_audit_logs',
      ],
      unitScope: null,
    },
    {
      name: 'UNIT_LEADER',
      description: 'Unit leader with unit-scoped access',
      permissions: [
        'view_unit_events',
        'create_unit_events',
        'edit_unit_events',
        'manage_unit_members',
        'view_unit_reports',
        'manage_centers',
        'assign_groups',
      ],
      unitScope: true,
    },
    {
      name: 'CENTER_ADMIN',
      description: 'Center administrator',
      permissions: [
        'check_in_members',
        'check_out_members',
        'view_center_attendance',
        'view_center_reports',
        'manage_center_groups',
        'generate_attendance_codes',
      ],
      unitScope: true,
    },
    {
      name: 'KIOSK_OPERATOR',
      description: 'Kiosk check-in operator',
      permissions: [
        'check_in_members',
        'check_out_members',
        'generate_attendance_codes',
        'sync_offline_data',
      ],
      unitScope: true,
    },
    {
      name: 'VIEWER',
      description: 'View-only access',
      permissions: [
        'view_events',
        'view_members',
        'view_reports',
      ],
      unitScope: false,
    },
  ];

  const created = [];
  for (const roleData of roles) {
    try {
      const role = await createRole(roleData);
      created.push(role);
    } catch (error) {
      // Role might already exist
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }
  }

  return created;
};

/**
 * Deactivate role
 */
export const deactivateRole = async (roleId) => {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
  });

  if (!role) {
    throw new NotFoundError('Role not found');
  }

  const updated = await prisma.role.update({
    where: { id: roleId },
    data: { isActive: false },
  });

  return updated;
};

/**
 * Get permission groups (for UI/documentation)
 */
export const getPermissionGroups = () => {
  return {
    events: [
      'view_events',
      'create_events',
      'edit_events',
      'delete_events',
      'publish_events',
    ],
    members: [
      'view_members',
      'create_members',
      'edit_members',
      'delete_members',
      'manage_unit_members',
    ],
    attendance: [
      'check_in_members',
      'check_out_members',
      'verify_attendance',
      'view_attendance',
      'generate_attendance_codes',
      'sync_offline_data',
    ],
    reports: [
      'view_reports',
      'view_audit_logs',
      'export_data',
    ],
    administration: [
      'manage_users',
      'manage_roles',
      'manage_centers',
      'manage_units',
    ],
    groups: [
      'create_groups',
      'assign_groups',
      'manage_group_members',
    ],
  };
};
