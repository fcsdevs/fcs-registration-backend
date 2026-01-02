import {
  createGroup,
  getGroupById,
  listGroupsByEvent,
  updateGroup,
  assignMemberToGroup,
  removeMemberFromGroup,
  getGroupMembers,
  bulkAssignGroups,
  getGroupStatistics,
  deactivateGroup,
} from './service.js';
import { paginationSchema } from '../../lib/validation.js';
import Joi from 'joi';

const createGroupSchema = Joi.object({
  eventId: Joi.string().required(),
  name: Joi.string().required(),
  type: Joi.string().valid('BIBLE_STUDY', 'WORKSHOP', 'BREAKOUT').required(),
  description: Joi.string().allow(''),
  capacity: Joi.number().integer().min(1),
});

const updateGroupSchema = Joi.object({
  name: Joi.string(),
  description: Joi.string().allow(''),
  capacity: Joi.number().integer().min(1),
  isActive: Joi.boolean(),
});

const assignMemberSchema = Joi.object({
  groupId: Joi.string().required(),
  memberId: Joi.string().required(),
});

const bulkAssignSchema = Joi.object({
  eventId: Joi.string().required(),
  strategy: Joi.string().valid('manual', 'auto').required(),
  assignments: Joi.array().items(
    Joi.object({
      groupId: Joi.string(),
      memberId: Joi.string(),
    })
  ),
});

/**
 * POST /api/groups
 */
export const createGroupHandler = async (req, res, next) => {
  try {
    const { error, value } = createGroupSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const group = await createGroup(value, req.user.id);
    res.status(201).json({
      data: group,
      message: 'Group created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/groups/event/:eventId
 */
export const listGroupsHandler = async (req, res, next) => {
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

    const groups = await listGroupsByEvent(req.params.eventId, {
      ...value,
      type: req.query.type,
      isActive: req.query.isActive,
    });

    res.status(200).json({
      data: groups,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/groups/:groupId
 */
export const getGroupHandler = async (req, res, next) => {
  try {
    const group = await getGroupById(req.params.groupId);
    res.status(200).json({
      data: group,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/groups/:groupId
 */
export const updateGroupHandler = async (req, res, next) => {
  try {
    const { error, value } = updateGroupSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const group = await updateGroup(req.params.groupId, value, req.user.id);
    res.status(200).json({
      data: group,
      message: 'Group updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/groups/:groupId/members
 */
export const getGroupMembersHandler = async (req, res, next) => {
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

    const members = await getGroupMembers(req.params.groupId, value);
    res.status(200).json({
      data: members,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/groups/:groupId/assign
 */
export const assignMemberHandler = async (req, res, next) => {
  try {
    const { memberId } = req.body;

    if (!memberId) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'memberId is required',
        },
      });
    }

    const registration = await assignMemberToGroup(req.params.groupId, memberId, req.user.id);
    res.status(200).json({
      data: registration,
      message: 'Member assigned to group',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/groups/:groupId/members/:memberId
 */
export const removeMemberHandler = async (req, res, next) => {
  try {
    const registration = await removeMemberFromGroup(
      req.params.groupId,
      req.params.memberId,
      req.user.id
    );

    res.status(200).json({
      data: registration,
      message: 'Member removed from group',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/groups/bulk-assign
 */
export const bulkAssignHandler = async (req, res, next) => {
  try {
    const { error, value } = bulkAssignSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const result = await bulkAssignGroups(
      value.eventId,
      value.assignments || [],
      value.strategy,
      req.user.id
    );

    res.status(200).json({
      data: result,
      message: `Assigned ${result.assigned} members to groups`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/groups/:groupId/statistics
 */
export const getGroupStatsHandler = async (req, res, next) => {
  try {
    const stats = await getGroupStatistics(req.params.groupId);
    res.status(200).json({
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/groups/:groupId
 */
export const deactivateGroupHandler = async (req, res, next) => {
  try {
    const group = await deactivateGroup(req.params.groupId, req.user.id);
    res.status(200).json({
      data: group,
      message: 'Group deactivated',
    });
  } catch (error) {
    next(error);
  }
};
