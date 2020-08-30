const Promise = require('bluebird');
const Sequelize = require('sequelize');
const express = require('express');
const moment			= require('moment');
const createError = require('http-errors')
const config = require('config');
const db = require('../../db');
const auth = require('../../middleware/sequelize-authorization-middleware');
const mail = require('../../lib/mail');
const pagination = require('../../middleware/pagination');
const {Op} = require('sequelize');


const router = express.Router({mergeParams: true});

// scopes: for all get requests
/*
router
	.all('*', function(req, res, next) {
		next();
	})
*/

router
	.all('*', function(req, res, next) {
		req.scope = ['includeSite', 'includeTags'];
		next();
	});

router.route('/')

// list users
// ----------
	.get(auth.can('Product', 'list'))
	.get(pagination.init)
	.get(function(req, res, next) {
		let queryConditions = req.queryConditions ? req.queryConditions : {};
		queryConditions = Object.assign(queryConditions, { siteId: req.params.siteId });

		db.Product
			.scope(...req.scope)
		//	.scope()
		//	.findAll()
			.findAndCountAll({
				where:queryConditions,
				 offset: req.pagination.offset,
				 limit: req.pagination.limit
			})
			.then(function( result ) {
				req.results = result.rows;
				req.pagination.count = result.count;
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

// create
// -----------
	.post(auth.can('Product', 'create'))
	.post(function(req, res, next) {
		if (!req.site) return next(createError(401, 'Site niet gevonden'));
		return next();
	})
	.post(function( req, res, next ) {
		if (!(req.site.config && req.site.config.product && req.site.config.product.canCreateNewProducts)) return next(createError(401, 'Product mogen niet aangemaakt worden'));
		return next();
	})
	.post(function(req, res, next) {

		console.log('createte')

		const data = {
      ...req.body,
		}

		db.Product
			.authorizeData(data, 'create', req.user)
			.create(data)
			.then(result => {
				 req.results = result;
				 next();
			})
			.catch(function( error ) {
				console.log(error)
				// todo: dit komt uit de oude routes; maak het generieker
				if( typeof error == 'object' && error instanceof Sequelize.ValidationError ) {
					let errors = [];
					error.errors.forEach(function( error ) {
						errors.push(error.message);
					});
					res.status(422).json(errors);
				} else {
					next(error);
				}
			});
	})
	.post(function(req, res, next) {
    if (!req.body.tags) return next();

 		let instance = req.results;

		instance
		  .setTags(req.body.tags)
			.then((instance) => {
				console.log('updated')
				return next();
		  })
			.catch((err) => {
				console.log('errr', err);
				next(err);
			});
	})
	.post(function(req, res, next) {
		res.json(req.results);
		//mail.sendThankYouMail(req.results, req.user, req.site) // todo: optional met config?
	})



// one user
// --------
router.route('/:productId(\\d+)')
	.all(function(req, res, next) {
		const productId = parseInt(req.params.productId) || 1;
		db.Product
			.scope(...req.scope)
			.findOne({
					where: { id: productId, siteId: req.params.siteId }
					//where: { id: userId }
			})
			.then(found => {
				if ( !found ) throw new Error('User not found');
				req.results = found;
				next();
			})
			.catch(next);
	})

// view idea
// ---------
	.get(auth.can('Product', 'view'))
	.get(auth.useReqUser)
	.get(function(req, res, next) {
		res.json(req.results);
	})

// update user
// -----------
	.put(auth.useReqUser)
	.put(function(req, res, next) {

    const product = req.results;
    if (!( product && product.can && product.can('update') )) return next( new Error('You cannot update this product') );

    let data = {
      ...req.body,
		}


    product
      .authorizeData(data, 'update')
      .update(data)
      .then(result => {
        req.results = result;
        next()
      })
      .catch(next);
	})

// delete idea
// ---------
  .delete(auth.can('Product', 'delete'))
	.delete(function(req, res, next) {
		req.results
			.destroy()
			.then(() => {
				res.json({ "product": "deleted" });
			})
			.catch(next);
	})

module.exports = router;
