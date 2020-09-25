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
const { createMollieClient } = require('@mollie/api-client');

const mollieClient = createMollieClient({ apiKey: 'test_dHar4XY7LxsDOtmnkVtjNVWXLSlXsM' });

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
		req.scope = ['includeLog', 'includeItems', 'includeTransaction', forSiteId];
		req.scope.push({method: ['forSiteId', req.params.siteId]});
		next();
	});

router.route('/')

// list users
// ----------
	.get(auth.can('Order', 'list'))
	.get(pagination.init)
	.get(function(req, res, next) {

		let queryConditions = req.queryConditions ? req.queryConditions : {};

		db.Order
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
	.post(auth.can('Order', 'create'))
	.post(function(req, res, next) {
		if (!req.site) return next(createError(401, 'Site niet gevonden'));
		return next();
	})
	.post(function( req, res, next ) {
		if (!(req.site.config && req.site.config.order && req.site.config.order.canCreateNewOrders)) return next(createError(401, 'Order mogen niet aangemaakt worden'));
		return next();
	})
	.post(function(req, res, next) {
		db.Order
			.create(req.body)
			.then(result => {
				req.results = result;
				next();

			})
			.catch(function( error ) {
				// todo: dit komt uit de oude routes; maak het generieker
				if( typeof error == 'object' && error instanceof Sequelize.ValidationError ) {
					let errors = [];
					error.errors.forEach(function( error ) {
						// notNull kent geen custom messages in deze versie van sequelize; zie https://github.com/sequelize/sequelize/issues/1500
						// TODO: we zitten op een nieuwe versie van seq; vermoedelijk kan dit nu wel
						errors.push(error.type === 'notNull Violation' && error.path === 'location' ? 'Kies een locatie op de kaart' : error.message);
					});
					res.status(422).json(errors);
				} else {
					next(error);
				}
			});

	})
	.post(function(req, res, next) {
		if (users) {
			users.forEach((user) => {
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
			});
		}

		return Promise.all(actions)
			 .then(() => { next(); })
			 .catch(next)
	})
	.post(function(req, res, next) {
		mollieClient.payments.create({
			amount: {
				value:    req.results.total,
				currency: 'EUR'
			},
			description: 'Bestelling bij ' + req.site,
			redirectUrl: 'https://'+req.site.domain+'/thankyou',
			webhookUrl:  'https://'+req.site.domain+'/api/site/'+req.params.siteId+'/order/'+req.params.orderId+'/payment-status'
		})
			.then(payment => {
				req.results.extraData.paymentIds = result.extraData.paymentIds ? result.extraData.paymentIds : [];
				req.results.extraData.paymentIds.push(payment.id);
				req.results.extraData.paymentUrl = payment.getCheckoutUrl();
				next();
			})
			.catch(err => {
				// Handle the errorz
				next(err);
			});

	})
	.post(function(req, res, next) {
		result
			.update(result)
			.then(result => {
				res.json(req.results);
				mail.sendThankYouMail(req.results, req.user, req.site) // todo: optional met config?
			})
			.catch(next);
	})

// one user
// --------
router.route('/:orderId(\\d+)')
	.all(function(req, res, next) {
		const orderId = parseInt(req.params.orderId) || 1;
		db.Order
			.scope(...req.scope)
			.findOne({
					where: { id: orderId }
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
	.get(auth.can('Order', 'view'))
	.get(auth.useReqUser)
	.get(function(req, res, next) {
		res.json(req.results);
	})
	.post('/payment-status', function(req, res, next) {
		res.json(req.results);
	})

// update user
// -----------
	.put(auth.useReqUser)
	.put(function(req, res, next) {

    const order = req.results;
    if (!( order && order.can && order.can('update') )) return next( new Error('You cannot update this Order') );

    let data = {
      ...req.body,
		}

    order
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
  .delete(auth.can('Order', 'delete'))
	.delete(function(req, res, next) {
		req.results
			.destroy()
			.then(() => {
				res.json({ "order": "deleted" });
			})
			.catch(next);
	})

module.exports = router;
