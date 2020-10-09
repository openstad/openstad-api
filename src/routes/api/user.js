const Promise = require('bluebird');
const Sequelize = require('sequelize');
const express = require('express');
const moment = require('moment');
const createError = require('http-errors');
const config = require('config');
const db = require('../../db');
const auth = require('../../middleware/sequelize-authorization-middleware');
const mail = require('../../lib/mail');
const pagination = require('../../middleware/pagination');
const {Op} = require('sequelize');


const router = express.Router({ mergeParams: true });

// scopes: for all get requests
/*
router
	.all('*', function(req, res, next) {
		next();
	})
*/

router
  .all('*', function(req, res, next) {
    req.scope = ['includeSite'];
    next();
  });

router.route('/')
  // list users
  // ----------
  .get(auth.can('User', 'list'))
  .get(pagination.init)
  .get(function(req, res, next) {
    let { dbQuery } = req;

    let queryConditions = req.queryConditions ? req.queryConditions : {};
    queryConditions = Object.assign(queryConditions, { siteId: req.params.siteId });

    db.User
      .scope(...req.scope)
      .findAndCountAll({
        where: queryConditions,
        offset: req.dbQuery.offset,
        limit: req.dbQuery.limit,
				...dbQuery,
      })
      .then(function(result) {
        req.results = result.rows;
        req.dbQuery.count = result.count;
        return next();
      })
      .catch(next);
  })
  .get(auth.useReqUser)
  //	.get(searchResults)
  .get(pagination.paginateResults)
  .get(function(req, res, next) {
    res.json(req.results);
  })

  // create user
  // -----------
  .post(auth.can('User', 'create'))
  .post(function(req, res, next) {
    if (!req.site) return next(createError(401, 'Site niet gevonden'));
    return next();
  })
  .post(function(req, res, next) {
    if (!(req.site.config && req.site.config.users && req.site.config.users.canCreateNewUsers)) return next(createError(401, 'Gebruikers mogen niet aangemaakt worden'));
    return next();
  })
  .post(function(req, res, next) {

    const data = {
      ...req.body,
    };

    db.User
      .authorizeData(data, 'create', req.user)
      .create(data)
      .then(result => {
        res.json(result);
      })
      .catch(function(error) {
        // todo: dit komt uit de oude routes; maak het generieker
        if (typeof error == 'object' && error instanceof Sequelize.ValidationError) {
          let errors = [];
          error.errors.forEach(function(error) {
            errors.push(error.message);
          });
          res.status(422).json(errors);
        } else {
          next(error);
        }
      });
  });

// one user
// --------
router.route('/:userId(\\d+)')
  .all(function(req, res, next) {
    const userId = parseInt(req.params.userId) || 1;
    db.User
      .scope(...req.scope)
      .findOne({
        where: { id: userId, siteId: req.params.siteId },
        //where: { id: userId }
      })
      .then(found => {
        if (!found) throw new Error('User not found');
        req.results = found;
        next();
      })
      .catch(next);
  })

  // view idea
  // ---------
  .get(auth.can('User', 'view'))
  .get(auth.useReqUser)
  .get(function(req, res, next) {
    res.json(req.results);
  })

  // update user
  // -----------
  .put(auth.useReqUser)
  .put(function(req, res, next) {

    const user = req.results;
    if (!(user && user.can && user.can('update'))) return next(new Error('You cannot update this User'));

    // todo: dit was de filterbody function, en dat kan nu via de auth functies, maar die is nog instance based
    let data = {}

	  const keys = [ 'firstName', 'lastName', 'email', 'phoneNumber', 'streetName', 'houseNumber', 'city', 'suffix', 'postcode', 'extraData'];
	  keys.forEach((key) => {
		  if (req.body[key]) {
			  data[key] = req.body[key];
		  }
	  });

		const userId = parseInt(req.params.userId, 10);

		/**
		 * Update the user API first
		 */
		 let which = req.query.useOauth || 'default';
		 let siteOauthConfig = ( req.site && req.site.config && req.site.config.oauth && req.site.config.oauth[which] ) || {};
		 let authServerUrl = siteOauthConfig['auth-server-url'] || config.authorization['auth-server-url'];
		 let authUpdateUrl = authServerUrl + '/api/admin/user/' + req.results.externalUserId;
		 let authClientId = siteOauthConfig['auth-client-id'] || config.authorization['auth-client-id'];
		 let authClientSecret = siteOauthConfig['auth-client-secret'] || config.authorization['auth-client-secret'];

		 const apiCredentials = {
			 client_id: authClientId,
			 client_secret: authClientSecret,
		 }
		 const options = {
			 method: 'post',
			 headers: {
				 'Content-Type': 'application/json',
			 },
			 mode: 'cors',
			 body: JSON.stringify(Object.assign(apiCredentials, data))
		 }


		 fetch(authUpdateUrl, options)
			 .then((response) => {
					 if (response.ok) {
						 return response.json()
					 }

					 throw createError('Updaten niet gelukt', response);
				})
			 .then((json) => {
				 //update values from API

				 db.User
				  .scope(['includeSite'])
				  .findAll({where : {
						externalUserId: json.id,
						// old users have no siteId, this will break the update
						// skip them
						// probably should clean up these users
						siteId: {
					    [Op.not]: 0
					  }
					}})
				  .then(function( users ) {
				     const actions = [];

				     if (users) {
				       users.forEach((user) => {

                 //only update users with active site (they can be deleteds)
                 if (user.site) {
  				         actions.push(function() {
  									 return new Promise((resolve, reject) => {
  				           user
  				            .authorizeData(data, 'update', req.user)
  				            .update(data)
  				            .then((result) => {
  				              resolve();
  				            })
  				            .catch((err) => {
  											console.log('err', err)
  				              reject(err);
  				            })
  									})}())
                  }

				       });
				     }

				     return Promise.all(actions)
				        .then(() => { next(); })
				        .catch(next)

				  })
				  .catch(next);
			  })
				.then( (result) => {
					return db.User
						.scope(['includeSite'])
						.findOne({
					 			where: { id: userId, siteId: req.params.siteId }
								//where: { id: parseInt(req.params.userId) }
						})
				})
				.then(found => {
					if ( !found ) throw new Error('User not found');
					res.json(found);
				})
			 .catch(err => {
				 console.log(err);
				 return next(err);
			 });
	})

// delete idea
// ---------
	.delete(auth.can('User', 'delete'))
	.delete(async function(req, res, next) {
    const user = req.results;

    /**
     * An oauth user can have multiple users in the api, every site has it's own user and right
     * In case for this oauth user there is only one site user in the API we also delete the oAuth user
     * Otherwise we keep the oAuth user since it's still needed for the other website
     */
    const userForAllSites = await db.User.findAndCountAll({ where: { externalUserId: user.externalUserId } });

    if (userForAllSites.length > 0) {
      let siteOauthConfig = ( req.site && req.site.config && req.site.config.oauth && req.site.config.oauth['default'] ) || {};
      let authServerUrl = siteOauthConfig['auth-server-url'] || config.authorization['auth-server-url'];
      let authUserDeleteUrl = authServerUrl + '/api/admin/user/' + req.results.externalUserId + '/delete';
      let authClientId = siteOauthConfig['auth-client-id'] || config.authorization['auth-client-id'];
      let authClientSecret = siteOauthConfig['auth-client-secret'] || config.authorization['auth-client-secret'];

      const apiCredentials = {
       client_id: authClientId,
       client_secret: authClientSecret,
      }

      const options = {
       method: 'post',
       hseaders: {
         'Content-Type': 'application/json',
       },
       mode: 'cors',
       body: JSON.stringify(Object.assign(apiCredentials, data))
      }

      await fetch(authUserDeleteUrl, options);
    }

   /**
    * Delete all connected arguments, votes and ideas created by the user
    */
    await db.Idea.where({ userId: req.results.id }).destroy();
    await db.Argument.where({ userId: req.results.id }).destroy();
    await db.Vote.where({ userId: req.results.id }).destroy();

    /**
     * Make anonymous? Delete posts
     */
		return req.results
			.destroy()
			.then(() => {
				res.json({ "user": "deleted" });
			})
			.catch(next);
	})

module.exports = router;
