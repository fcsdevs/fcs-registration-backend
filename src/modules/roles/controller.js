import {
  createRole,
  getRoleById,
  listRoles,
  updateRole,
  assignRoleToUser,
  removeRoleFromUser,
  getUserRoles,
  getRoleUsers,
  checkUserPermission,
  getUserPermissions,
  createPredefinedRoles,
  deactivateRole,
  getPermissionGroups,
} from './service.js';
import { paginationSchema } from '../../lib/validation.js';
import Joi from 'joi';

const createRoleSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string(),
  permissions: Joi.array().items(Joi.string()).required(),
  unitScope: Joi.boolean(),
});

const updateRoleSchema = Joi.object({
  name: Joi.string(),
  description: Joi.string(),
  permissions: Joi.array().items(Joi.string()),
  isActive: Joi.boolean(),
});

const assignRoleSchema = Joi.object({
  roleId: Joi.string().required(),
  unitId: Joi.string(),
});

/**
 * POST /api/roles
 */
export const createRoleHandler = async (req, res, next) => {
  try {
    const { error, value } = createRoleSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const role = await createRole(value);
    res.status(201).json({
      data: role,
      message: 'Role created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/roles
 */
export const listRolesHandler = async (req, res, next) => {
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

    const roles = await listRoles({
      ...value,
      search: req.query.search,
      isActive: req.query.isActive,
    });

    res.status(200).json({
      data: roles,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/roles/init
 */
export const initPredefinedRolesHandler = async (req, res, next) => {
  try {
    const roles = await createPredefinedRoles();
    res.status(201).json({
      data: roles,
      message: 'Predefined roles initialized',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/roles/:roleId
 */
export const getRoleHandler = async (req, res, next) => {
  try {
    const role = await getRoleById(req.params.roleId);
    res.status(200).json({
      data: role,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/roles/:roleId
 */
export const updateRoleHandler = async (req, res, next) => {
  try {
    const { error, value } = updateRoleSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const role = await updateRole(req.params.roleId, value);
    res.status(200).json({
      data: role,
      message: 'Role updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/roles/:roleId
 */
export const deactivateRoleHandler = async (req, res, next) => {
  try {
    const role = await deactivateRole(req.params.roleId);
    res.status(200).json({
      data: role,
      message: 'Role deactivated',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/roles/:roleId/users/:userId
 */
export const assignRoleHandler = async (req, res, next) => {
  try {
    const { error, value } = assignRoleSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const assignment = await assignRoleToUser(
      req.params.userId,
      req.params.roleId,
      value.unitId
    );

    res.status(201).json({
      data: assignment,
      message: 'Role assigned to user',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/roles/:roleId/users/:userId
 */
export const removeRoleHandler = async (req, res, next) => {
  try {
    const result = await removeRoleFromUser(req.params.userId, req.params.roleId);
    res.status(200).json({
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/roles/:roleId/users
 */
export const getRoleUsersHandler = async (req, res, next) => {
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

    const users = await getRoleUsers(req.params.roleId, value);
    res.status(200).json({
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/roles/users/:userId
 */
export const getUserRolesHandler = async (req, res, next) => {
  try {
    const roles = await getUserRoles(req.params.userId);
    res.status(200).json({
      data: roles,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/roles/users/:userId/permissions
 */
export const getUserPermissionsHandler = async (req, res, next) => {
  try {
    const permissions = await getUserPermissions(req.params.userId);
    res.status(200).json({
      data: {
        userId: req.params.userId,
        permissions,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/roles/users/:userId/permissions/:permission/check
 */
export const checkPermissionHandler = async (req, res, next) => {
  try {
    const has = await checkUserPermission(req.params.userId, req.params.permission);
    res.status(200).json({
      data: {
        userId: req.params.userId,
        permission: req.params.permission,
        hasPermission: has,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/roles/permissions/groups
 */
export const getPermissionGroupsHandler = async (req, res, next) => {
  try {
    const groups = getPermissionGroups();
    res.status(200).json({
      data: groups,
    });
  } catch (error) {
    next(error);
  }
};
