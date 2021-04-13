const Promise     = require('bluebird');
const express     = require('express');
const createError = require('http-errors')
const moment      = require('moment');
const db          = require('../../db');
const auth        = require('../../middleware/sequelize-authorization-middleware');
const config      = require('config');
const merge       = require('merge');
const bruteForce = require('../../middleware/brute-force');
const {Op} = require('sequelize');
const pagination = require('../../middleware/pagination');
const searchResults = require('../../middleware/search-results-static');

const router = express.Router({mergeParams: true});

const userhasModeratorRights = (user) => {
	return user && (user.role === 'admin' || user.role === 'editor' || user.role === 'moderator');
}

// basis validaties
// ----------------
router
	.route('*')

// bestaat de site config
	.get(function(req, res, next) {
		if (!( req.site && req.site.config && req.site.config.votes )) {
			return next(createError(403, 'Site niet gevonden of niet geconfigureerd'));
		}
		return next();
	})

// mag er gestemd worden
	.get(function( req, res, next ) {
		let isActive = req.site.config.votes.isActive;
		if ( isActive == null && req.site.config.votes.isActiveFrom && req.site.config.votes.isActiveTo ) {
			isActive = moment().isAfter(req.site.config.votes.isActiveFrom) && moment().isBefore(req.site.config.votes.isActiveTo)
		}
		if (!isActive) {
			return next(createError(403, 'Stemmen is gesloten'));
		}
		return next();
	})

// scopes
	.get(function(req, res, next) {
		req.scope = [
			{ method: ['forSiteId', req.site.id]}
    ];
    return next();
  })

// parse vote
	.get(function(req, res, next) {
    let signedresult = req.query && req.query.result;
    console.log(signedresult);
    try {
      signedresult = JSON.parse(signedresult)
      req.signedresult = signedresult;
    } catch (err) {
      console.log(err);
    }
    let votes = [];
    if (signedresult) {
      let match = signedresult.message && signedresult.message.match(/\((\d+)\)/g);
      if (match) {
        for (var i = 0; i < match.length; i++) {
          let id = match[i];
          id = id.replace(/[\(\)]/g, '');
			    votes.push({
				    ideaId: parseInt(id, 10),
				    opinion: 'yes',
			    })
        }
      }
    } else {
      let vote = req.query.vote;
      try {
        vote = JSON.parse(vote)
      } catch (err) {}
		  if (!Array.isArray(votes)) vote = [vote];
		  votes = vote.map((entry) => {
			  return {
				  ideaId: parseInt(entry.ideaId, 10),
				  opinion: 'yes',
			  }
		  });
    }
    req.votes = votes;
    return next();
	})

// bestaan de ideeen waar je op wilt stemmen
	.get(function(req, res, next) {
		let ids = req.votes.map( entry => entry.ideaId );
		db.Idea
			.findAll({ where: { id:ids, siteId: req.site.id } })
			.then(found => {
				if (req.votes.length != found.length) {
					console.log('req.votes', req.votes);
					console.log('found', found);
					console.log('req.body',req.body);
					return next(createError(400, 'Idee niet gevonden'));
				}
				req.ideas = found;
				return next();
			})
	})

// validaties voor voteType=count
	.get(function(req, res, next) {
		if (req.site.config.votes.voteType != 'count') return next();
		if (req.votes.length >= req.site.config.votes.minIdeas && req.votes.length <= req.site.config.votes.maxIdeas) {
			return next();
		}
		return next(createError(400, 'Aantal ideeen klopt niet'));
	})

// validaties voor voteType=budgeting
	.get(function(req, res, next) {
		if (req.site.config.votes.voteType != 'budgeting') return next();
		let budget = 0;
		req.votes.forEach((vote) => {
			let idea = req.ideas.find(idea => idea.id == vote.ideaId);
			budget += idea.budget;
		});
		if (!( budget >= req.site.config.votes.minBudget && budget <= req.site.config.votes.maxBudget )) {
		  return next(createError(400, 'Budget klopt niet'));
		}
		if (!( req.votes.length >= req.site.config.votes.minIdeas && req.votes.length <= req.site.config.votes.maxIdeas )) {
		  return next(createError(400, 'Aantal ideeen klopt niet'));
		}
		return next();
  })

// validaties voor voteType=count-per-theme
	.get(function(req, res, next) {
		if (req.site.config.votes.voteType != 'count-per-theme') return next();

    let themes = req.site.config.votes.themes || [];

    let totalNoOfVotes = 0;
    req.votes.forEach((vote) => {
			let idea = req.ideas.find(idea => idea.id == vote.ideaId);
      totalNoOfVotes += idea ? 1 : 0;
      let themename = idea && idea.extraData && idea.extraData.theme;
      let theme = themes.find( theme => theme.value == themename );
      if (theme) {
	      theme.noOf = theme.noOf || 0;
        theme.noOf++;
      }
		});

    let isOk = true;
    themes.forEach((theme) => {
	    theme.noOf = theme.noOf || 0;
		  if (theme.noOf < theme.minIdeas || theme.noOf > theme.maxIdeas) {
        isOk = false;
		  }
    });

		if (( req.site.config.votes.minIdeas && totalNoOfVotes < req.site.config.votes.minIdeas ) || ( req.site.config.votes.maxIdeas && totalNoOfVotes > req.site.config.votes.maxIdeas )) {
      isOk = false;
		}

		return next( isOk ? null : createError(400, 'Count per thema klopt niet') );

	})

// validaties voor voteType=budgeting-per-theme
	.get(function(req, res, next) {
		if (req.site.config.votes.voteType != 'budgeting-per-theme') return next();
    let themes = req.site.config.votes.themes || [];
		req.votes.forEach((vote) => {
			let idea = req.ideas.find(idea => idea.id == vote.ideaId);
      let themename = idea && idea.extraData && idea.extraData.theme;
      let theme = themes.find( theme => theme.value == themename );
      if (theme) {
	      theme.budget = theme.budget || 0;
        theme.budget += idea.budget;
      }
		});
    let isOk = true;
    themes.forEach((theme) => {
		  if (theme.budget < theme.minBudget || theme.budget > theme.maxBudget) {
        isOk = false;
		  }
  //    console.log(theme.value, theme.budget, theme.minBudget, theme.maxBudget, theme.budget < theme.minBudget || theme.budget > theme.maxBudget);
    });
		return next( isOk ? null : createError(400, 'Budget klopt niet') );
	})

// vote with irma 1
// ----------------
router
	.route('(/site/:siteId)?/vote')
// create vote for irma en redirect
	.get(function( req, res, next ) {
    let irmaVote = '';
    req.votes.map(entry => {
      let id = entry.ideaId;
      let idea = req.ideas.find(idea => idea.id == id);
      irmaVote += '\n' + idea.title + ' (' + id + ')';
    })
    console.log(irmaVote);
    let url = config.irma && config.irma.serverUrl && config.irma.serverUrl.replace('[[key]]', 'Uw%20keuze').replace('[[value]]', encodeURIComponent(irmaVote))
    let redurectUrl = config.url + '/irma/site/' + req.site.id + '/vote-is-signed';
    url += '&redirectUrl=' + encodeURIComponent(redurectUrl);
    console.log(url);
    res.redirect(url);
  });

// vote with irma 2
// ----------------
router
	.route('(/site/:siteId)?/vote-is-signed')

// check meegestuurde data
	.get(function(req, res, next) {
    if (!req.signedresult) return next(createError(403, 'Signed result not found'));
    if (!( req.signedresult.votingnumber && req.signedresult.message )) return next(createError(403, 'Signed result not found'));
    if (!req.ideas) return next(createError(403, 'Ideeen niet gevonden'));
    res.json({
      votingnumber: req.signedresult.votingnumber,
      message: req.signedresult.message,
      ideas: req.votes
    })
  })


// heb je al gestemd
	.get(function(req, res, next) {
		db.Vote // get existing votes for this user
			.scope(req.scope)
			.findAll({ where: { irmaSignedVote: req.signedresult.votingnumber } })
			.then(found => {
				if (req.site.config.votes.voteType !== 'likes' && req.site.config.votes.withExisting == 'error' && found && found.length ) throw new Error('Je hebt al gestemd');
				req.existingVotes = found.map(entry => entry.toJSON());
				return next();
			})
			.catch(next)
	})

// dump result
	.get(function(req, res, next) {
    res.json({
      votingnumber: req.signedresult.votingnumber,
      message: req.signedresult.message,
      ideas: req.votes
    })
  })

	.post(function( req, res, next ) {

    // parse vote
    let result = { what: 'STEM MET IRMA' };
    let vote = req.query.vote;
    try {
      vote = JSON.parse(vote)
    } catch (err) {}

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

	});


module.exports = router;

