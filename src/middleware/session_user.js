const config = require('config');
const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const merge = require('merge');
const fetch = require('node-fetch');
const db = require('../db');

module.exports = function getSessionUser( req, res, next ) {

	if( !req.session ) {
		return next(Error('express-session middleware not loaded?'));
	}

	if(!req.headers('x-authorization')) {
		req.user = {};
		res.locals.user = {};

		return next();
	}

	let userId = null;
	let isFixedUser = false;

	// jwt overrules other settings
	if (req.headers['x-authorization'].match(/^bearer /i)) {
		// jwt overrules other settings
		const token = req.headers['x-authorization'].replace(/^bearer /i, '');
		const data = jwt.verify(token, config.authorization['jwt-secret']);

		if (data && data.userId) {
			userId = data.userId
		}
	}

	// auth token overrules other settings
	const tokens = config && config.authorization && config.authorization['fixed-auth-tokens'];

	if (tokens) {
		tokens.forEach((token) => {
			if (token.token === req.headers['x-authorization']) {
				userId = token.userId;
				isFixedUser = true;
			}
		});
	}

	const which = req.query.useOauth || 'default';
	const siteOauthConfig = ( req.site && req.site.config && req.site.config.oauth && req.site.config.oauth[which] ) || {};;

	getUserInstance(userId, siteOauthConfig, isFixedUser)
		.then(function( user ) {
			req.user = user;
			// Pass user entity to template view.
			res.locals.user = user;
			next();
		})
		.catch((err) => {
			console.log('ererer', err);
			next(err);
		});

}

function getUserInstance( userId, siteOauthConfig, isFixedUser ) {

	return db.User.findByPk(userId)
		.then(function( dbuser ) {
			if( !dbuser ) {
				return {};
			}
			return dbuser;
		})
		.then(function( dbuser ) {

			let user = dbuser;

			// fetch user data from mijnopenstad
			if (dbuser && dbuser.externalUserId && dbuser.externalAccessToken) {

				// get the user info using the access token
				let authServerUrl = siteOauthConfig['auth-internal-server-url'] || config.authorization['auth-server-url'];
				let authServerGetUserPath = siteOauthConfig['auth-server-get-user-path'] || config.authorization['auth-server-get-user-path'];
				let authClientId = siteOauthConfig['auth-client-id'] || config.authorization['auth-client-id'];
				let url = authServerUrl + authServerGetUserPath;
				url = url.replace(/\[\[clientId\]\]/, authClientId);

				return fetch(
					url, {
						method: 'get',
						headers: {
							authorization : 'Bearer ' + dbuser.externalAccessToken,
						},
						mode: 'cors',
					})
					.then(
						response => {

							if ( !response.ok ) {
								throw new Error('Error fetching user')
							}
							return response.json();
						},
						error => { throw createError(403, 'User niet bekend') }
					)
					.then(
						json => {
							json.role = json.role || user.role || 'member';
							user = merge(dbuser, json)
							return user;
						}
					)
					.catch(err => {
						console.error(err);
						console.error('Reset user');
						return resetSessionUser(user);
					})

			} else {
				if (isFixedUser) {
					return user;
				} else {
					console.error('Reset user');
			    return resetSessionUser(user);
				}
			}

		})
		.then(function( user ) {
			return user;
		})

}

function resetSessionUser(user) {

  if (!( user && user.update )) return {};
	return user.update({
		externalAccessToken: null
	})
		.then(user => {
			return {};
		})

}
