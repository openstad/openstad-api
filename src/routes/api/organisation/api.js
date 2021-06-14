// const Sequelize = require('sequelize');
const express = require('express');
const createError = require('http-errors');
// const config = require('config');
// const log = require('debug')('app:api-organisation');

const db = require('../../../db');
const validateSchema = require('../../../middleware/validate-schema');
const canCreateOrganisation = require('./policies/can-create-organisation');
const canUpdateOrganisation = require('./policies/can-update-organisation');
const schemas = require('./schemas');

const router = express.Router({ mergeParams: true });

/**
 * Create organisation
 */
router.post(
  `/`,
  [
    canCreateOrganisation.middleware,
    validateSchema(schemas.createOrganisation),
  ],
  async function createOrganisation(req, res, next) {
    try {
      const transaction = await db.sequelize.transaction();
      try {
        const values = {
          ...req.body,
          siteId: req.params.siteId,
        };

        const organisation = await db.Organisation.create(values, {
          transaction,
        });
        await organisation.addUser(req.user, { transaction });
        await organisation.setTags(values.tagIds, { transaction });

        await transaction.commit();
        await organisation.reload();

        // @todo: schedule notification to admin of site
        return res.status(201).json(organisation);
      } catch (err) {
        await transaction.rollback();
        return next(createError(500, err.message));
      }
    } catch (err) {
      return next(createError(500, err.message));
    }
  }
);

/**
 * List organisations
 */
router.get(`/`, async function listOrganisations(req, res, next) {
  try {
    const organisations = await db.Organisation.findAndCountAll({
      where: {
        siteId: req.site.id,
      },
      include: [db.Tag],
    });

    return res.json({
      metadata: {
        page: 1,
        pageSize: 25,
        pageCount: 1,
        totalCount: organisations.count,
        links: {
          self: '',
          first: '',
          last: '',
          previous: '',
          next: '',
        },
      },
      records: organisations.rows,
    });
  } catch (err) {
    return next(createError(500, err.message));
  }
});

/**
 * List own organisation
 */
router.get(`/me`, async function listOwnOrganisation(req, res, next) {
  try {
    const organisation =
      (await db.Organisation.findByPk(req.user.organisationId, {
        include: [db.Tag],
      })) || {};

    return res.json(organisation);
  } catch (err) {
    return next(createError(500, err.message));
  }
});

/**
 * Get organisation by id
 */
router.get(
  `/:organisationId(\\d+)`,
  async function getOrganisation(req, res, next) {
    try {
      const organisation = await db.Organisation.findByPk(
        req.params.organisationId,
        { include: [db.Tag] }
      );

      if (!organisation) {
        return next(
          createError(
            404,
            `Geen organisatie gevonden met id: ${req.params.organisationId}`
          )
        );
      }

      return res.json(organisation);
    } catch (err) {
      return next(createError(500, err.message));
    }
  }
);

/**
 * Update organisation
 */
router.put(
  '/:organisationId(\\d+)',
  [
    canUpdateOrganisation.middleware,
    validateSchema(schemas.updateOrganisation),
  ],
  async function updateOrganisation(req, res, next) {
    try {
      const transaction = await db.sequelize.transaction();
      try {
        const values = req.body;
        const query = {
          where: {
            id: req.params.organisationId,
            siteId: req.site.id,
          },
          transaction,
        };

        await db.Organisation.update(values, query);
        const organisation = await db.Organisation.findOne({
          ...query,
          include: [db.Tag],
        });

        // Update tags
        if (values.tagIds) {
          await organisation.setTags(values.tagIds, { transaction });
        }

        await transaction.commit();
        await organisation.reload();

        return res.json(organisation);
      } catch (err) {
        await transaction.rollback();
        return next(createError(500, err.message));
      }
    } catch (err) {
      return next(createError(500, err.message));
    }
  }
);

module.exports = router;
