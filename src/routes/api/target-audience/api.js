const express = require('express');
const createError = require('http-errors');

const db = require('../../../db');
const auth = require('../../../middleware/sequelize-authorization-middleware');
const validateSchema = require('../../../middleware/validate-schema');
const pagination = require('../../../middleware/pagination');
const schemas = require('./schemas');

const router = express.Router({ mergeParams: true });

/**
 * Create target audience
 */
router.post(
  `/`,
  [auth.can('Tag', 'create'), validateSchema(schemas.createTargetAudience)],
  async function createAudience(req, res, next) {
    try {
      const body = req.body;
      body.siteId = req.params.siteId;
      const audience = await db.TargetAudience.create(body);
      return res.status(201).json(audience);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * List target audiences
 */
router.get(
  `/`,
  [auth.can('Tag', 'list'), auth.useReqUser, pagination.init],
  async function listTargetAudiences(req, res, next) {
    try {
      const query = {
          ...req.dbQuery,
        where: {
          siteId: req.params.siteId,
        },
      };

      const result =  await db.TargetAudience.findAndCountAll(query);
      let listLength = query.pageSize ? result.count : result.rows.length;

      return res.json({
        metadata: {
          page: parseInt(req.query.page) || 0,
          pageSize: query.pageSize,
          pageCount: parseInt( listLength / query.pageSize ) + ( listLength % query.pageSize ? 1 : 0 ),
          totalCount: result.count,
          links: {
            self: null,
            first: null,
            last: null,
            previous: null,
            next: null,
          },
        },
        records: result.rows,
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * Get target audience by id
 */
router.get(
  '/:id(\\d+)',
  [auth.can('Tag', 'view')],
  async function getTargetAudience(req, res, next) {
    try {
      const audience = await db.TargetAudience.findOne({
        where: {
          id: req.params.id,
          siteId: req.params.siteId,
        },
      });
      return res.json(audience);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * Update target audience
 */
router.put(
  '/:id(\\d+)',
  [validateSchema(schemas.updateTargetAudience)],
  async function updateTargetAudience(req, res, next) {
    try {
      const audience = await db.TargetAudience.findOne({
        where: {
          id: req.params.id,
          siteId: req.params.siteId,
        },
      });
      await audience.update(req.body);
      await audience.reload();
      return res.json(audience);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * Remove target audience
 */
router.delete(
  '/:id(\\d+)',
  [auth.can('Tag', 'delete')],
  async function deleteTargetAudience(req, res, next) {
    try {
      const audience = await db.TargetAudience.findOne({
        where: {
          id: req.params.id,
          siteId: req.params.siteId,
        },
      });
      await audience.destroy();
      return res.status(204).send();
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
