const express = require('express');
const createError = require('http-errors');
const log = require('debug')('app:http:api-event');

const db = require('../../../db');
const sanitize = require('../../../util/sanitize');
const hasPolicies = require('../../../middleware/has-policies');
const validateSchema = require('../../../middleware/validate-schema');
const fetchEventByOrganisation = require('./middleware/fetch-event-by-organisation');
const schemas = require('./schemas');
const isEventProvider = require('../organisation/policies/is-event-provider');
const hasOrganisation = require('./policies/has-organisation');
const withTransaction = require('./middleware/with-transaction');

const router = express.Router({ mergeParams: true });

/**
 * Create event
 */
router.post(
  `/`,
  hasPolicies(isEventProvider, hasOrganisation),
  validateSchema(schemas.createEvent),
  withTransaction,
  async function createEvent(req, res, next) {
    const transaction = res.locals.transaction;
    try {
      const values = {
        ...req.body,
        siteId: req.params.siteId,
        organisationId: req.user.organisationId,
      };

      values.description = sanitize.summary(values.description);

      const event = await db.Event.create(values, {
        include: [
          { model: db.EventTimeslot, as: 'slots' },
          db.Organisation,
          db.Tag,
        ],
        transaction,
      });
      await event.setTags(values.tagIds, { transaction });

      await transaction.commit();
      await event.reload();

      return res.status(201).json(event);
    } catch (err) {
      await transaction.rollback();
      return next(err);
    }
  }
);

/**
 * List events
 */
router.get('/', async function listEvents(req, res, next) {
  try {
    const query = {
      where: {
        siteId: req.params.siteId,
      },
    };

    if (req.query.organisationId) {
      query.where.organisationId = req.query.organisationId;
    }

    const events = await db.Event.findAndCountAll({
      ...query,
      include: [
        { model: db.EventTimeslot, as: 'slots' },
        db.Organisation,
        db.Tag,
      ],
    });

    return res.json({
      metadata: {
        page: 1,
        pageSize: 25,
        pageCount: 1,
        totalCount: events.count,
        links: {
          self: '',
          first: '',
          last: '',
          previous: '',
          next: '',
        },
      },
      records: events.rows,
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * Get event by id
 */
router.get('/:eventId(\\d+)', async function getEvent(req, res, next) {
  try {
    const event = await db.Event.findByPk(req.params.eventId, {
      where: { siteId: req.params.siteId },
      include: [
        { model: db.EventTimeslot, as: 'slots' },
        db.Organisation,
        db.Tag,
      ],
    });

    if (!event) {
      throw createError(404, 'Geen event gevonden');
    }

    return res.json(event);
  } catch (err) {
    return next(err);
  }
});

/**
 * Update event
 */
router.patch(
  '/:eventId(\\d+)',
  hasPolicies(isEventProvider, hasOrganisation),
  validateSchema(schemas.patchEvent),
  fetchEventByOrganisation,
  withTransaction,
  async function updateEvent(req, res, next) {
    const transaction = res.locals.transaction;
    try {
      const values = req.body;
      if (values.description) {
        values.description = sanitize.summary(values.description);
      }

      const event = res.locals.event;
      await event.update(values, { transaction });

      // Update or create timeslots
      if (values.slots) {
        const slots = values.slots.map((slot) => ({
          ...slot,
          eventId: res.locals.event.id,
        }));

        await Promise.all(
          slots.map((slot) => {
            if (slot.id) {
              return db.EventTimeslot.update(slot, {
                where: { eventId: slot.eventId, id: slot.id },
                transaction,
              });
            }
            return db.EventTimeslot.create(slot, { transaction });
          })
        );
      }

      if (values.tagIds) {
        await event.setTags(values.tagIds, { transaction });
      }

      await transaction.commit();
      await event.reload();
      return res.json(event);
    } catch (err) {
      await transaction.rollback();
      return next(err);
    }
  }
);

/**
 * Delete event
 */
router.delete(
  '/:eventId(\\d+)',
  hasPolicies(isEventProvider, hasOrganisation),
  fetchEventByOrganisation,
  async function deleteEvent(req, res, next) {
    try {
      const event = res.locals.event;

      await event.destroy();

      return res.status(204).send();
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
