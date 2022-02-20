const fetch = require('node-fetch');
const createError = require('http-errors');
const config = require('config');
const db = require('../../db');
const auth = require('../../middleware/sequelize-authorization-middleware');
const pagination = require('../../middleware/pagination');
const searchResults = require('../../middleware/search-results-static');

const router = require('express-promise-router')({ mergeParams: true });

// backwards compatibility
router.route('/$')
  .get(function(req, res, next) {
    res.redirect('/api/template/site');
  })

router.route('/site')
  // .get(auth.can('ExternalSite', 'list')) // hoort hier wel, maar naamgeving is niet correct
  .get(pagination.init)
  .get(function(req, res, next) {

    if (config.templateSource === 'DB' || config.templateSource === 'DATABASE') {

      // this is the old version; in a new setup the database could have a templates table. ExternalSite ha been removed completely
      // return db.ExternalSite
      //   .findAndCountAll({offset: req.dbQuery.offset, limit: req.dbQuery.limit})
      //   .then(function(result) {
      //     req.results = result.rows || [];
      //     req.dbQuery.count = result.count;
      //     return next();
      //   })
      //   .catch(next);

      req.results = {'Too soon': 'Not yet implemented'};
      next();

    } else {

      return fetch(config.templateSource, {
	      headers: { "Content-type": "application/json" },
      })
	      .then((response) => {
		      if (!response.ok) throw Error(response)
		      return response.json();
	      })
	      .then(json => {
          req.results = json;
          return next();
	      })
	      .catch((err) => {
		      console.log('Fetch templates: niet goed');
		      next({'message': 'Error fetching templates'});
	      });

    }
  })
  .get(searchResults)
  .get(pagination.paginateResults)
  .get(function(req, res, next) {
    res.json(req.results);
  })

module.exports = router;
