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
	.get(auth.can('Account', 'list'))
	.get(pagination.init)
	.get(function(req, res, next) {
		let queryConditions = req.queryConditions ? req.queryConditions : {};
		queryConditions = Object.assign(queryConditions, { siteId: req.params.siteId });

		db.Account
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
	.post(auth.can('Account', 'create'))
	.post(function(req, res, next) {
		if (!req.site) return next(createError(401, 'Site niet gevonden'));
		return next();
	})
	.post(function( req, res, next ) {
		if (!(req.site.config && req.site.config.account && req.site.config.account.canCreateNewAccounts)) return next(createError(401, 'Account mogen niet aangemaakt worden'));
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

	})
	.post(function(req, res, next) {
		mollieClient.payments.create({
			amount: {
				value:    req.results.total,
				currency: 'EUR'
			},
			description: 'Bestelling bij ' + req.site,
			redirectUrl: 'https://'+req.site.domain+'/thankyou/123456',
			webhookUrl:  'https://'+req.site.domain+'/api/order/webhook'
		})
			.then(payment => {
				result.extraData.paymentIds = result.extraData.paymentIds ? result.extraData.paymentIds : [];
				result.extraData.paymentIds.push(payment.id);
				result.extraData.redirectUrl = payment.getCheckoutUrl();

				result
					.update(req.body)
					.then(result => {
						result.redirectUrl =	result.extraData.redirectUrl ;
						res.json(createOrderJSON(result, req.user, req));
						mail.sendThankYouMail(result, req.user, req.site) // todo: optional met config?
					})
					.catch(next);
			})
			.catch(error => {
				// Handle the error
			});

	})
	.post(function(req, res, next) {
		res.json(req.results);
		//mail.sendThankYouMail(req.results, req.user, req.site) // todo: optional met config?
	})



// one user
// --------
router.route('/:accountId(\\d+)')
	.all(function(req, res, next) {
		const accountId = parseInt(req.params.accountId) || 1;
		db.Account
			.scope(...req.scope)
			.findOne({
					where: { id: accountId, siteId: req.params.siteId }
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
	.get(auth.can('Account', 'view'))
	.get(auth.useReqUser)
	.get(function(req, res, next) {
		res.json(req.results);
	})

// update user
// -----------
	.put(auth.useReqUser)
	.put(function(req, res, next) {

    const account = req.results;
    if (!( account && account.can && account.can('update') )) return next( new Error('You cannot update this Account') );

    let data = {
      ...req.body,
		}


    account
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
  .delete(auth.can('Account', 'delete'))
	.delete(function(req, res, next) {
		req.results
			.destroy()
			.then(() => {
				res.json({ "account": "deleted" });
			})
			.catch(next);
	})

module.exports = router;
