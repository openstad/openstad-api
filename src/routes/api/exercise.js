const db = require('../../db');
const auth = require('../../middleware/sequelize-authorization-middleware');
const pagination = require('../../middleware/pagination');
const searchResults = require('../../middleware/search-results-static');

const router = require('express-promise-router')({ mergeParams: true });
var createError = require('http-errors');

// scopes: for all get requests
router
  .all('*', function(req, res, next) {
    req.scope = ['api'];
    req.scope.push('includeSite');
    return next();
  });

router.route('/')
  .get(auth.can('Exercise', 'list'))
  .get(pagination.init)
  .get(function(req, res, next) {
    let { dbQuery } = req;

    return db.Exercise
      .findAndCountAll(dbQuery)
      .then(function(result) {
        req.results = result.rows || [];
        req.dbQuery.count = result.count;
        return next();
      })
      .catch(next);
  })
  .get(searchResults)
  .get(pagination.paginateResults)
  .get(function(req, res, next) {
    res.json(req.results);
  })

  // Persist an exercise
  .post(auth.can('Exercise', 'create'))
  .post(function(req, res, next) {
    // if geodata is set transform to polygon format this api expects
    if (req.body.geoJSON) {
      req.body.polygon = formatGeoJsonToPolygon(req.body.geoJSON);
    }

    next();
  })
  .post(function(req, res, next) {
    if (!req.body.name) return next(createError(403, 'Geen naam opgegeven'));
    if (!req.body.polygon) return next(createError(403, 'Geen polygoon opgegeven'));
    return next();
  })
  .post(function(req, res, next) {
    db.Exercise
      .create(req.body)
      .catch((err) => {
        console.log('errr', err);
        next(err);
      })
      .then(function(result) {
        res.json({ success: true, id: result.id });
      });
  });

router.route('/:exerciseIdOrSlug')
  .all(function(req, res, next) {

    var exerciseId = parseInt(req.params.exerciseIdOrSlug) || 1;
    const whereClause = typeof req.params.exerciseIdOrSlug == 'number' ?
      { id: req.params.exerciseIdOrSlug }
      :
      { slug: req.params.exerciseIdOrSlug };

    db.Exercise
      .findOne({
        // where: { id: exerciseId, siteId: req.params.siteId }
        where: whereClause,
      })
      .then(found => {
        if (!found) throw new Error('exercise not found');

        req.exercise = found;
        req.results = req.exercise;
        next();
      })
      .catch((err) => {
        console.log('errr', err);
        next(err);
      });
  })

  // view exercise
  // ---------
  // .get(auth.can('exercise', 'view'))
  .get(auth.useReqUser)
  .get(function(req, res, next) {
    res.json(req.results);
  })
  .put(function(req, res, next) {
    if (req.body.geoJSON) {
      req.body.polygon =  formatGeoJsonToPolygon(req.body.geoJSON);
    }

    next();
  })
  .put(function(req, res, next) {
    var exercise = req.results;

    exercise
      .authorizeData(exercise, 'update')
      .update({
        ...req.body,
      })
      .then(result => {
        req.results = result;
        next();
      })
      .catch(next);
  })
  .put(function(req, res, next) {
    let exerciseInstance = req.results;

    return db.Exercise
      .findOne({
        where: { id: exerciseInstance.id },
        // where: { id: exerciseInstance.id, siteId: req.params.siteId },
      })
      .then(found => {
        if (!found) throw new Error('exercise not found');
        req.results = found;
        next();
      })
      .catch(next);

  })
  .put(function(req, res, next) {
    res.json(req.results);
  })

  // delete exercise
  // ---------
  // .delete(auth.can('exercise', 'delete'))
  .delete(function(req, res, next) {
    req.results
      .destroy()
      .then(() => {
        res.json({ 'exercise': 'deleted' });
      })
      .catch(next);
  });

module.exports = router;
