import {
  createUnit,
  getUnitById,
  listUnits,
  updateUnit,
  getUnitHierarchy,
  getChildUnits,
  addMemberToUnit,
  removeMemberFromUnit,
  getUnitMembers,
  getUnitStatistics,
  deactivateUnit,
} from './service.js';
import { paginationSchema } from '../../lib/validation.js';
import Joi from 'joi';

const createUnitSchema = Joi.object({
  name: Joi.string().required(),
  type: Joi.string()
    .valid('National', 'Regional', 'State', 'Zone', 'Area', 'Branch')
    .required(),
  parentUnitId: Joi.string(),
  description: Joi.string().allow(''),
  leaderId: Joi.string(),
});

const updateUnitSchema = Joi.object({
  name: Joi.string(),
  type: Joi.string().valid('National', 'Regional', 'State', 'Zone', 'Area', 'Branch'),
  description: Joi.string().allow(''),
  leaderId: Joi.string(),
});

/**
 * POST /api/units
 */
export const createUnitHandler = async (req, res, next) => {
  try {
    console.log('[DEBUG] createUnitHandler called with body:', req.body);

    const { error, value } = createUnitSchema.validate(req.body);
    if (error) {
      console.log('[DEBUG] Validation error:', error.details[0].message);
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    console.log('[DEBUG] Calling createUnit with value:', value);
    const unit = await createUnit(value);
    console.log('[DEBUG] Unit created successfully:', unit.id);

    res.status(201).json({
      data: unit,
      message: 'Unit created successfully',
    });
  } catch (error) {
    console.error('[DEBUG] Error in createUnitHandler:', error);
    next(error);
  }
};

/**
 * GET /api/units
 */
export const listUnitsHandler = async (req, res, next) => {
  try {
    console.log('[DEBUG] listUnitsHandler called with query:', req.query);

    const { error, value } = paginationSchema.validate(req.query);
    if (error) {
      console.log('[DEBUG] Validation error:', error.details[0].message);
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    console.log('[DEBUG] Calling listUnits with params:', {
      ...value,
      type: req.query.type,
      parentUnitId: req.query.parentUnitId,
      search: req.query.search,
    });

    const result = await listUnits({
      ...value,
      type: req.query.type,
      parentUnitId: req.query.parentUnitId,
      search: req.query.search,
    });

    console.log('[DEBUG] listUnits returned:', JSON.stringify(result).substring(0, 200));

    // Service returns { data: [...], pagination: {...} }
    // Return it directly without wrapping
    res.status(200).json(result);
  } catch (error) {
    console.error('[DEBUG] Error in listUnitsHandler:', error);
    next(error);
  }
};

/**
 * GET /api/units/hierarchy
 */
export const getHierarchyHandler = async (req, res, next) => {
  try {
    const hierarchy = await getUnitHierarchy(req.query.rootUnitId);
    res.status(200).json({
      data: hierarchy,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/units/:unitId
 */
export const getUnitHandler = async (req, res, next) => {
  try {
    const unit = await getUnitById(req.params.unitId);
    res.status(200).json({
      data: unit,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/units/:unitId
 */
export const updateUnitHandler = async (req, res, next) => {
  try {
    const { error, value } = updateUnitSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const unit = await updateUnit(req.params.unitId, value);
    res.status(200).json({
      data: unit,
      message: 'Unit updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/units/:unitId/children
 */
export const getChildUnitsHandler = async (req, res, next) => {
  try {
    const recursive = req.query.recursive === 'true';
    const children = await getChildUnits(req.params.unitId, recursive);
    res.status(200).json({
      data: children,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/units/:unitId/members/:memberId
 */
export const addMemberHandler = async (req, res, next) => {
  try {
    const member = await addMemberToUnit(req.params.unitId, req.params.memberId);
    res.status(200).json({
      data: member,
      message: 'Member added to unit',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/units/:unitId/members/:memberId
 */
export const removeMemberHandler = async (req, res, next) => {
  try {
    const member = await removeMemberFromUnit(req.params.unitId, req.params.memberId);
    res.status(200).json({
      data: member,
      message: 'Member removed from unit',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/units/:unitId/members
 */
export const getUnitMembersHandler = async (req, res, next) => {
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

    const members = await getUnitMembers(req.params.unitId, {
      ...value,
      search: req.query.search,
      state: req.query.state,
    });

    res.status(200).json({
      data: members,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/units/:unitId/statistics
 */
export const getUnitStatsHandler = async (req, res, next) => {
  try {
    const stats = await getUnitStatistics(req.params.unitId);
    res.status(200).json({
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/units/:unitId
 */
export const deactivateUnitHandler = async (req, res, next) => {
  try {
    const unit = await deactivateUnit(req.params.unitId);
    res.status(200).json({
      data: unit,
      message: 'Unit deactivated',
    });
  } catch (error) {
    next(error);
  }
};
