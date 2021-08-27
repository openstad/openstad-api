const createError = require('http-errors');

const db = require('../../../../db');

module.exports = async function fetchEventByOrganisation(req, res, next) {
  try {
    const query = {
      where: {
        id: req.params.eventId,
        siteId: req.params.siteId,
        organisationId: req.user.organisationId,
      },
      include: [{ model: db.EventTimeslot, as: 'slots' }, db.Organisation],
    };

    if (['admin', 'moderator'].includes(req.user.role)) {
      delete query.where.organisationId;
    }

    const event = await db.Event.findOne(query);
    if (!event) {
      throw createError(404, 'Geen event gevonden');
    }

    res.locals.event = event;
    return next();
  } catch (err) {
    return next(err);
  }
};
