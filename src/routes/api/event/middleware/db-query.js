const { Op } = require('sequelize');
const moment = require('moment');

const db = require('../../../../db');
const schemas = require('../schemas');

module.exports = async function (req, res, next) {
  try {
    req.query = await schemas.queryEvents.validateAsync(req.query);

    // @todo: implement pagination without offset: https://use-the-index-luke.com/sql/partial-results/fetch-next-page
    const query = {
      where: {
        siteId: req.params.siteId,
      },
      limit: 25,
      offset: req.query.page === 1 ? 0 : req.query.page * 25 - 25,
      include: [db.Organisation],
      // order all events on starttime
      order: [[{ model: db.EventTimeslot, as: 'slots' }, 'startTime', 'ASC']],
    };

    if (req.query.organisationId) {
      query.where.organisationId = req.query.organisationId;
    }

    if (req.query.q) {
      query.where[Op.or] = [
        { name: { [Op.like]: `%${req.query.q}%` } },
        { description: { [Op.like]: `%${req.query.q}%` } },
      ];
    }

    if (req.query.districts) {
      query.where.district = {
        [Op.or]: [].concat(req.query.districts),
      };
    }

    if (req.query.tagIds) {
      query.include.push({
        model: db.Tag,
        where: { id: [].concat(req.query.tagIds) },
        required: true,
      });
    } else {
      query.include.push(db.Tag);
    }

    if (req.query.dates) {
      const dates = [].concat(req.query.dates).map((date) => {
        const between = [
          moment(date).startOf('day').toDate(),
          moment(date).endOf('day').toDate(),
        ];

        return {
          startTime: {
            [Op.between]: between,
          },
          endTime: {
            [Op.between]: between,
          },
        };
      });

      query.include.push({
        model: db.EventTimeslot,
        as: 'slots',
        required: true,
        where: {
          [Op.or]: dates,
        },
      });
    } else {
      // Only include events that are in the future
      const include = {
        model: db.EventTimeslot,
        as: 'slots',
        required: true,
        where: {
          startTime: {
            [Op.gte]: moment().startOf('day'),
          },
        },
      };

      // If you filter on organisation and you are part of the organisation then also fetch events from the past, this allows you to edit events from the past.
      if (
        req.query.organisationId &&
        req.user.organisationId === req.query.organisationId
      ) {
        delete include.where;
      }
      query.include.push(include);
    }

    res.locals.query = query;

    return next();
  } catch (err) {
    next(err);
  }
};
