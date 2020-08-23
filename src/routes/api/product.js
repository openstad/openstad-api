const Promise = require('bluebird');
const Sequelize = require('sequelize');
const express = require('express');
const moment			= require('moment');
const createError = require('http-errors')
const config = require('config');
const db = require('../../db');
const auth = require('../../middleware/sequelize-authorization-middleware');
const mail = require('../../lib/mail');

let router = express.Router({mergeParams: true});

// scopes: for all get requests
router
	.all('*', function(req, res, next) {
		return next();
	})

router.route('/')

// list ideas
// ----------
	.get(auth.can('products:list'))
	.get(function(req, res, next) {
		db.Product
		//	.scope(...req.scope)
	//		.findAll({ where: { siteId: req.params.siteId } })
			.findAll()
			.then( found => {
				return found.map( entry => {
					return createProductJSON(entry, req.user, req);
				});
			})
			.then(function( found ) {
				const queryTotal = found.length;
				const total = found.length;
				res.set('Access-Control-Expose-Headers', 'Content-Range');
				res.set('Content-Range', `posts 0-${queryTotal}/${total}`);
				res.json(found);
			})
			.catch((err) => {
				console.log('err', err)
				next(err);
			});
	})

// create idea
// -----------
	.post(auth.can('product:create'))
	.post(function(req, res, next) {
		if (!req.site) return next(createError(401, 'Site niet gevonden'));
		return next();
	})
	.post(function( req, res, next ) {
		if (!(req.site.config && req.site.config.ideas && req.site.config.ideas.canAddNewIdeas)) return next(createError(401, 'Inzenden is gesloten'));
		return next();
	})
	.post(function(req, res, next) {
		filterBody(req);
		req.body.siteId = parseInt(req.params.siteId);
		req.body.userId = req.user.id;

		db.Product
			.create(req.body)
			.then(result => {
				//console.log('result', result)
				res.json(createProductJSON(result, req.user, req));
				//mail.sendThankYouMail(result, req.user, req.site) // todo: optional met config?
			})
			.catch(function( error ) {
				console.log('ererer', error)
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

// one idea
// --------
router.route('/:productId(\\d+)')
	.all(function(req, res, next) {
		var productId = parseInt(req.params.productId) || 1;

		db.Product
			.findOne({
				where: { id: productId, siteId: req.params.siteId }
			})
			.then(found => {
				if ( !found ) throw new Error('Product not found');
				req.product = found;
				next();
			})
			.catch(next);
	})

// view product
// ---------
	.get(auth.can('product:view'))
	.get(function(req, res, next) {
		res.json(createProductJSON(req.product, req.user, req));
	})

// update idea
// -----------
	.put(auth.can('product:edit'))
	.put(function(req, res, next) {
		console.log('req.body 1', req.body);
		filterBody(req)
		console.log('req.body 2', req.body);

		req.product
			.update(req.body)
			.then(result => {
				res.json(createProductJSON(result, req.user, req));
			})
			.catch(next);
	})

// delete idea
// ---------
	.delete(auth.can('product:delete'))
	.delete(function(req, res, next) {
		req.product
			.destroy()
			.then(() => {
				res.json({ "idea": "deleted" });
			})
			.catch(next);
	})

// extra functions
// ---------------

function filterBody(req) {
	let filteredBody = {};

	let keys = [ 'sku', 'name', 'description', 'image', 'images','product_status', 'regular_price', 'discount_price', 'quantity', 'vat' ];

	console.log('req.body.image', req.body.image);
	if (req.body.image && !req.body.images) {
		req.body.images = [req.body.image];
	}

	let hasModeratorRights = (req.user.role === 'admin' || req.user.role === 'editor' || req.user.role === 'moderator');

	if (hasModeratorRights) {
		//keys.concat([]);
	}

	keys.forEach((key) => {
		if (req.body[key]) {
			filteredBody[key] = req.body[key];
		}
	});

	req.body = filteredBody;
}

function createProductJSON(product, user, req) {
	let hasModeratorRights = (user.role === 'admin' || user.role === 'editor' || user.role === 'moderator');

	let can = {
		// edit: user.can('arg:edit', argument.idea, argument),
		// delete: req.user.can('arg:delete', entry.idea, entry),
		// reply: req.user.can('arg:reply', entry.idea, entry),
	};

	let result = product.toJSON();
	result.config = null;
	result.site = null;
	result.can = can;


	if (product.user) {
		result.user = {
			firstName: product.user.firstName,
			lastName: product.user.lastName,
			fullName: product.user.fullName,
			nickName: product.user.nickName,
			isAdmin: hasModeratorRights,
			email: hasModeratorRights ? product.user.email : '',
		};
	} else {
		result.user = {
			isAdmin: hasModeratorRights,
		};
	}

	result.createdAtText = moment(product.createdAt).format('LLL');

	return result;
}

module.exports = router;
