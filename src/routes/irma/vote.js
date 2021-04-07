const Sequelize 	= require('sequelize');
const express 		= require('express');
const createError = require('http-errors');
const fetch 			= require('isomorphic-fetch');
const jwt 				= require('jsonwebtoken');
const config 			= require('config');
const URL         = require('url').URL;
const db 					= require('../../db');

let router = express.Router({mergeParams: true});

/**
 * Check if redirectURI same host as registered
 */
const isAllowedRedirectDomain = (url, allowedDomains) => {
	let redirectUrlHost = '';
	try {
		redirectUrlHost = new URL(url).hostname;
	} catch(err) {}

	// throw error if allowedDomains is empty or the redirectURI's host is not present in the allowed domains
	return allowedDomains && allowedDomains.indexOf(redirectUrlHost) !== -1;
}

// vote with irma 1
// ----------------
router
	.route('(/site/:siteId)?/vote')
	.get(function( req, res, next ) {

    let result = { what: 'STEM MET IRMA' };
    let vote = req.query.vote;
    try {
      vote = JSON.parse(vote)
    } catch (err) {}

    let redirectUrl = req.query.redirectUrl;
    if (!redirectUrl.match(/\?/)) redirectUrl = redirectUrl + '?';

    result.vote = vote;

    console.log(result);

    res.redirect(`${redirectUrl}&votedWithIRMA=1`);

    return;

		if (req.query.forceNewLogin) {
      let baseUrl = config.url
			let backToHereUrl = baseUrl + '/oauth/site/' + req.site.id + '/login?' + ( req.query.useOauth ? 'useOauth=' + req.query.useOauth : '' ) + '&redirectUrl=' + req.query.redirectUrl
		  backToHereUrl = encodeURIComponent(backToHereUrl)
			let url = baseUrl + '/oauth/site/' + req.site.id + '/logout?redirectUrl=' + backToHereUrl;

			return res.redirect(url)
		}

		// Todo: Refactor this code, this logic also lives in the user middleware
		let which = req.query.useOauth || 'default';
		let siteOauthConfig = ( req.site && req.site.config && req.site.config.oauth && req.site.config.oauth[which] ) || {};;
		let authServerUrl = siteOauthConfig['auth-server-url'] || config.authorization['auth-server-url'];
		let authClientId = siteOauthConfig['auth-client-id'] || config.authorization['auth-client-id'];
		let authServerLoginPath = siteOauthConfig['auth-server-login-path'] || config.authorization['auth-server-login-path'];
		let authServerAdminLoginPath = siteOauthConfig['auth-server-admin-login-path'] || config.authorization['auth-server-admin-login-path'];

		authServerLoginPath = req.query.loginPriviliged ? authServerAdminLoginPath : authServerLoginPath;

		let url = authServerUrl + authServerLoginPath;
		url = url.replace(/\[\[clientId\]\]/, authClientId);
		//url = url.replace(/\[\[redirectUrl\]\]/, config.url + '/oauth/digest-login');
		url = url.replace(/\[\[redirectUrl\]\]/, encodeURIComponent(config.url + '/oauth/site/'+ req.site.id +'/digest-login?useOauth=' + which + '\&returnTo=' + req.query.redirectUrl));

		res.redirect(url);

	});


module.exports = router;
