const db = require('../../db');
const auth = require('../../middleware/sequelize-authorization-middleware');
const pagination = require('../../middleware/pagination');
const searchResults = require('../../middleware/search-results-static');
const convertDbPolygonToLatLng = require('../../util/convert-db-polygon-to-lat-lng');
const {formatGeoJsonToPolygon} = require('../../util/geo-json-formatter');

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
    .get(auth.can('Event', 'list'))
    .get(pagination.init)
    .get(function(req, res, next) {
        let { dbQuery } = req;

        return db.Events
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

module.exports = router;
