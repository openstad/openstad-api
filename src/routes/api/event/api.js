const express = require('express');
const createError = require('http-errors');
const log = require('debug')('app:http:api-event');
const difference = require('lodash.difference');
const apicache = require('apicache-plus');
const { parseAsync, transforms: { flatten } } = require('json2csv')

const db = require('../../../db');
const hasPolicies = require('../../../middleware/has-policies');
const validateSchema = require('../../../middleware/validate-schema');
const fetchEventByOrganisation = require('./middleware/fetch-event-by-organisation');
const schemas = require('./schemas');
const isEventProvider = require('../organisation/policies/is-event-provider');
const hasOrganisation = require('./policies/has-organisation');
const withTransaction = require('./middleware/with-transaction');
const dbQuery = require('./middleware/db-query');
const sanitizeFields = require('../../../middleware/sanitize-fields');

const router = express.Router({ mergeParams: true });

const cache = apicache.options({
  headers: {
    'cache-control': 'no-cache',
  },
}).middleware;

/**
 * Create event
 */
router.post(
  `/`,
  [
    hasPolicies(isEventProvider, hasOrganisation),
    validateSchema(schemas.createEvent),
    sanitizeFields('information', 'description'),
    withTransaction,
  ],
  async function createEvent(req, res, next) {
    const transaction = res.locals.transaction;
    try {
      const values = {
        ...req.body,
        siteId: req.params.siteId,
        organisationId: req.user.organisationId,
      };

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

      apicache.clear();
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
router.get(
  '/',
  [
    cache('1 hour', (req) => req.headers['cache-control'] !== 'no-cache'),
    dbQuery,
  ],
  async function listEvents(req, res, next) {
    try {
      const query = res.locals.query;

      const count = await db.Event.count({ ...query, distinct: true });
      const events = await db.Event.findAll(query);

      return res.json({
        metadata: {
          page: req.query.page || 1,
          pageSize: query.limit,
          pageCount: 1,
          totalCount: count,
          links: {
            self: null,
            first: null,
            last: null,
            previous: null,
            next: null,
          },
        },
        records: events,
      });
    } catch (err) {
      return next(err);
    }
  }
);

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
  [
    hasPolicies(isEventProvider, hasOrganisation),
    validateSchema(schemas.patchEvent),
    sanitizeFields('information', 'description'),
    fetchEventByOrganisation,
    withTransaction,
  ],
  async function updateEvent(req, res, next) {
    const transaction = res.locals.transaction;
    try {
      const values = req.body;

      const event = res.locals.event;

      // Create, update or remove slots
      if (values.slots) {
        const slotsToRemove = difference(
          event.slots.map((s) => s.id),
          values.slots.filter((s) => s.id).map((s) => s.id)
        );

        await db.EventTimeslot.destroy({
          where: { id: slotsToRemove },
          transaction,
        });

        const slots = values.slots.map((slot) => ({
          id: slot.id || null,
          startTime: slot.startTime,
          endTime: slot.endTime,
          eventId: event.id,
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

        delete values.slots;
      }

      if (values.tagIds) {
        await event.setTags(values.tagIds, { transaction });
        delete values.tagIds;
      }

      await event.update(values, { transaction });

      await transaction.commit();
      await event.reload();
      apicache.clear();
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
  [hasPolicies(isEventProvider, hasOrganisation), fetchEventByOrganisation],
  async function deleteEvent(req, res, next) {
    try {
      const event = res.locals.event;

      await event.destroy();

      apicache.clear();
      return res.status(204).send();
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * Export
 */
router.get('/export', [dbQuery], async function exportEvents(req, res, next) {
  try {
    const query = res.locals.query;

    if (!req.query.dates) {
      const timeslotInclude = query.include.find(
        (include) => include.as === 'slots'
      );
      if (timeslotInclude) {
        delete timeslotInclude.where;
      }
    }

    if (query.limit) {
      delete query.limit;
    }
    if (query.offset) {
      delete query.offset;
    }

    const events = await db.Event.findAll(query);

    const csv = await parseAsync(JSON.parse(JSON.stringify(events)), { transforms: [flatten({ objects: true, arrays: true })] })
    res.setHeader('content-type', 'text/csv')
    return res.send(csv)
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
