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

const { createMollieClient } = require('@mollie/api-client');

const mollieClient = createMollieClient({ apiKey: 'test_QUGRvhJHDjsekFazFcDwxzrKNRcGMy' });

// scopes: for all get requests
router
	.all('*', function(req, res, next) {

		req.scope = ['api'];

		var sort = (req.query.sort || '').replace(/[^a-z_]+/i, '') || (req.cookies['order_sort'] && req.cookies['order_sort'].replace(/[^a-z_]+/i, ''));
		if (sort) {
			res.cookie('order_sort', sort, { expires: 0 });
			if (sort == 'votes_desc' || sort == 'votes_asc') {
				req.scope.push('includeVoteCount'); // het werkt niet als je dat in de sort scope functie doet...
			}
			req.scope.push({ method: ['sort', req.query.sort]});
		}

		if (req.query.mapMarkers) {
			req.scope.push('mapMarkers');
		}

		if (req.query.running) {
			req.scope.push('selectRunning');
		}

		if (req.query.includeArguments) {
			req.scope.push({ method: ['includeArguments', req.user.id]});
		}

		if (req.query.includeMeeting) {
			req.scope.push('includeMeeting');
		}

		if (req.query.includePosterImage) {
			req.scope.push('includePosterImage');
		}

		if (req.query.includeUser) {
			req.scope.push('includeUser');
		}

		// in case the votes are archived don't use these queries
		// this means they can be cleaned up from the main table for performance reason
		if (!req.site.config.archivedVotes) {
			if (req.query.includeVoteCount && req.site && req.site.config && req.site.config.votes && req.site.config.votes.isViewable) {
				req.scope.push('includeVoteCount');
			}

			if (req.query.includeUserVote && req.site && req.site.config && req.site.config.votes && req.site.config.votes.isViewable) {
				// ik denk dat je daar niet het hele object wilt?
				req.scope.push({ method: ['includeUserVote', req.user.id]});
			}
		}

		// todo? volgens mij wordt dit niet meer gebruikt
		// if (req.query.highlighted) {
		//  	query = db.Order.getHighlighted({ siteId: req.params.siteId })
		// }

		return next();

	})

router.route('/')

// list orders
// ----------
	.get(auth.can('orders:list'))
	.get(function(req, res, next) {
		db.Order
			.scope(...req.scope)
			.findAll({ where: { siteId: req.params.siteId } })
			.then( found => {
				return found.map( entry => {
					return createOrderJSON(entry, req.user, req);
				});
			})
			.then(function( found ) {
				res.json(found);
			})
			.catch(next);
	})

// create orders
// -----------
	.post(auth.can('order:create'))
	.post(function(req, res, next) {
		if (!req.site) return next(createError(401, 'Site niet gevonden'));
		return next();
	})
	.post(function( req, res, next ) {
		if (!(req.site.config && req.site.config.ideas && req.site.orders.open)) return next(createError(401, 'Winkel is gesloten'));
		return next();
	})
	.post(function(req, res, next) {
		filterBody(req);
		req.body.siteId = parseInt(req.params.siteId);
		req.body.userId = req.user.id;
		req.body.startDate = new Date();



	})

router.route('/:orderId(\\d+)/update-paymet')


// one idea
// --------
router.route('/:orderId(\\d+)')
	.all(function(req, res, next) {
		var ideaId = parseInt(req.params.orderId) || 1;

		db.Order
			.scope(...req.scope, 'includeVoteCount')
			.findOne({
				where: { id: ideaId, siteId: req.params.siteId }
			})
			.then(found => {
				if ( !found ) throw new Error('Idea not found');
				req.idea = found;
				next();
			})
			.catch(next);
	})

// view idea
// ---------
	.get(auth.can('order:view'))
	.get(function(req, res, next) {
		res.json(createOrderJSON(req.idea, req.user, req));
	})

// update idea
// -----------
	.put(auth.can('order:edit'))
	.put(function(req, res, next) {
		filterBody(req)
		if (req.body.location) {
			try {
				req.body.location = JSON.parse(req.body.location || null);
			} catch(err) {}
		} else {
			req.body.location = JSON.parse(null);
		}

		req.idea
			.update(req.body)
			.then(result => {
				res.json(createOrderJSON(result, req.user, req));
			})
			.catch(next);
	})

// delete idea
// ---------
	.delete(auth.can('order:delete'))
	.delete(function(req, res, next) {
		req.idea
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

	let keys;
	let hasModeratorRights = (req.user.role === 'admin' || req.user.role === 'editor' || req.user.role === 'moderator');

	if (hasModeratorRights) {
		keys = [ 'siteId', 'meetingId', 'userId', 'startDate', 'endDate', 'sort', 'status', 'title', 'posterImageUrl', 'summary', 'description', 'budget', 'extraData', 'location', 'modBreak', 'modBreakUserId', 'modBreakDate' ];
	} else {
		keys = [ 'title', 'summary', 'description', 'extraData', 'location' ];
	}

	keys.forEach((key) => {
		if (req.body[key]) {
			filteredBody[key] = req.body[key];
		}
	});

	if (hasModeratorRights) {
    if (filteredBody.modBreak) {
      if ( !req.idea || req.order.modBreak != filteredBody.modBreak ) {
        if (!req.body.modBreakUserId) filteredBody.modBreakUserId = req.user.id;
        if (!req.body.modBreakDate) filteredBody.modBreakDate = new Date().toString();
      }
    } else {
      filteredBody.modBreak = '';
      filteredBody.modBreakUserId = null;
      filteredBody.modBreakDate = null;
    }
  }

	req.body = filteredBody;
}

function createOrderJSON(idea, user, req) {
	let hasModeratorRights = (user.role === 'admin' || user.role === 'editor' || user.role === 'moderator');

	let can = {
		// edit: user.can('arg:edit', argument.idea, argument),
		// delete: req.user.can('arg:delete', entry.idea, entry),
		// reply: req.user.can('arg:reply', entry.idea, entry),
	};

	let result = order.toJSON();
	result.config = null;
	result.site = null;
	result.can = can;


// Fixme: hide email in arguments and their reactions
	function hideEmailsForNormalUsers(args) {
		return args.map((argument) => {
			argument.user.email = hasModeratorRights ? argument.user.email : '';

			if (argument.reactions) {
				argument.reactions = argument.reactions.map((reaction) => {
					reaction.user.email = hasModeratorRights ? reaction.user.email : '';

					return reaction;
				})
			}

			return argument;
		});
	}

	if (order.argumentsAgainst) {
		result.argumentsAgainst = hideEmailsForNormalUsers(result.argumentsAgainst);
	}

	if (order.argumentsFor) {
		result.argumentsFor = hideEmailsForNormalUsers(result.argumentsFor);
	}

	if (order.extraData && order.extraData.phone && hasModeratorRights) {
		delete result.extraData.phone;
	}


	if (order.user) {
		result.user = {
			firstName: order.user.firstName,
			lastName: order.user.lastName,
			fullName: order.user.fullName,
			nickName: order.user.nickName,
			isAdmin: hasModeratorRights,
			email: hasModeratorRights ? order.user.email : '',
		};
	} else {
		result.user = {
			isAdmin: hasModeratorRights,
		};
	}

	result.createdAtText = moment(order.createdAt).format('LLL');

	return result;
}

module.exports = router;
