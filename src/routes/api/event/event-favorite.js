const express = require('express');
const createHttpError = require('http-errors');
const log = require('debug')('app:http:api-event/favorite');

const db = require('../../../db');

const router = express.Router({ mergeParams: true });

function isLoggedIn(req, res, next) {
  if (!req.user.id) {
    log(`not logged in`);
    throw createHttpError(401);
  }
  return next();
}

router.post(
  `/:eventId(\\d+)/favorite`,
  [isLoggedIn],
  async function favoriteEvent(req, res, next) {
    try {
      log(`favorite event (${req.params.eventId}) for user (${req.user.id})`);

      await req.user.addFavoriteEvent(req.params.eventId);

      return res.status(204).send();
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError')
        return res.status(204).send();
      log(`could not favorite event: ${error.name} ${error.message}`, error);
      return next(error);
    }
  }
);

router.delete(
  `/:eventId(\\d+)/favorite`,
  [isLoggedIn],
  async function unfavoriteEvent(req, res, next) {
    try {
      log(`unfavorite event (${req.params.eventId}) for user (${req.user.id})`);

      await req.user.removeFavoriteEvent(req.params.eventId);

      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  }
);

router.get(
  `/favorites`,
  [isLoggedIn],
  async function listFavorites(req, res, next) {
    try {
      const events = await req.user.getFavoriteEvents({ include: [db.Organisation, db.Tag]});
      return res.json(events);
    } catch (err) {
      log(
        `could not list favorites for user (${req.user.id}): ${err.name} ${err.message}`,
        err
      );
      return next(err);
    }
  }
);

module.exports = router;
