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
      //  req.scope = ['api'];
      //  req.scope.push('includeSite');
        return next();
    });

router.route('/')
    .get(auth.can('Event', 'list'))
    .get(pagination.init)
    .get(function(req, res, next) {
        let { dbQuery } = req;

        dbQuery.where = dbQuery.where ? dbQuery.where : {}

        dbQuery.where.siteId = req.site.id;

        if (req.query.names) {
            dbQuery.where.name = req.query.names;
        }

        if (req.query.userId) {
            dbQuery.where.userId = req.query.userId;
        }

        dbQuery.order = [
            ['createdAt', 'DESC'],
        ]

        return db.Event
            .scope('includeUser')
            .findAndCountAll(dbQuery)
            .then(function(result) {
                console.log('result', result.rows )
                req.results = result.rows || [];
                req.dbQuery.count = result.count;
                return next();
            })
            .catch(next);
    })
    .get(auth.useReqUser)
    .get(searchResults)
    .get(pagination.paginateResults)
    .get(function(req, res, next) {
        console.log('req.results', req.results)

        res.json(req.results);
    })

module.exports = router;