var Sequelize = require('sequelize');
var co = require('co')
, config = require('config')
, moment = require('moment-timezone')
, pick = require('lodash/pick')
, Promise = require('bluebird');

var sanitize = require('../util/sanitize');
// var ImageOptim    = require('../ImageOptim');
var notifications = require('../notifications');

const merge = require('merge');

var argVoteThreshold = config.ideas && config.ideas.argumentVoteThreshold;
const userHasRole = require('../lib/sequelize-authorization/lib/hasRole');
const roles = require('../lib/sequelize-authorization/lib/roles');
const getExtraDataConfig = require('../lib/sequelize-authorization/lib/getExtraDataConfig');


module.exports = function (db, sequelize, DataTypes) {

  var Tour = sequelize.define('tour', {


    accountId: {
      type: DataTypes.INTEGER,
      auth:  {
        updateableBy: 'editor',
      },
      allowNull: false,
      defaultValue: 0,
    },

    status: {
      type: DataTypes.ENUM('CONCEPT', 'CLOSED', 'ACCEPTED', 'DENIED', 'BUSY'),
      auth:  {
        updateableBy: 'editor',
      },
      defaultValue: 'CONCEPT',
      allowNull: false
    },




    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        // len: {
        //   args : [titleMinLength,titleMaxLength],
        //   msg  : `Titel moet tussen ${titleMinLength} en ${titleMaxLength} tekens lang zijn`
        // }
        textLength(value) {
          let len = sanitize.title(value.trim()).length;
          let titleMinLength = (this.config && this.config.ideas && this.config.ideas.titleMinLength || 10)
          let titleMaxLength = (this.config && this.config.ideas && this.config.ideas.titleMaxLength || 50)
          if (len < titleMinLength || len > titleMaxLength)
            throw new Error(`Titel moet tussen ${titleMinLength} en ${titleMaxLength} tekens zijn`);
        }
      },
      set: function (text) {
        this.setDataValue('title', sanitize.title(text.trim()));
      }
    },

    live: getExtraDataConfig(DataTypes.JSON,  'tours'),

    revisions: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: '[]',
      get: function() {
        let value = this.getDataValue('revisions');
        try {
          if (typeof value == 'string') {
            value = JSON.parse(value);
          }
        } catch (err) {}
        
        return value;
      },
      set: function(value) {
        try {
          if (typeof value == 'string') {
            value = JSON.parse(value);
          }
        } catch (err) {}
        this.setDataValue('revisions', value);
      }
    },

  });

  Tour.scopes = function scopes() {
    // Helper function used in `withVoteCount` scope.


    return {

      // nieuwe scopes voor de api
      // -------------------------

      api: {},

      forSiteId: function( siteId ) {
				return {
					where: {
						accountId: [ sequelize.literal(`select id FROM accounts WHERE siteId = ${siteId}`) ]
					}
				};
			},


      includeTags: {
        include: [{
          model: db.Tag,
          attributes: ['id', 'name'],
          through: {attributes: []},
        }]
      },

      selectTags: function (tags) {
        return {
          include: [{
            model: db.Tag,
            attributes: ['id', 'name'],
            through: {attributes: []},
            where: {
              name: tags
            }
          }],
        }
      },


      includeUser: {
        include: [{
          model: db.User,
          attributes: ['role', 'nickName', 'firstName', 'lastName', 'email']
        }]
      },
      withUser: {
        include: [{
          model: db.User,
          attributes: ['role', 'nickName', 'firstName', 'lastName', 'email']
        }]
      },
    }
  }

  Tour.associate = function (models) {
    this.belongsTo(models.Account);
  //  this.hasMany(models.TourStep);
  //  this.hasMany(models.Argument, {as: 'review'});
    this.belongsToMany(models.Tag, {through: 'tourTags'});
  }

  let canMutate = function(user, self) {
    if (userHasRole(user, 'editor', self.userId) || userHasRole(user, 'admin', self.userId) || userHasRole(user, 'moderator', self.userId)) {
      return true;
    }


    if (!userHasRole(user, 'owner', self.userId)) {
      return false;
    }

    let config = self.site && self.site.config && self.site.config.ideas
    let canEditAfterFirstLikeOrArg = config && config.canEditAfterFirstLikeOrArg || false
		let voteCount = self.no + self.yes;
		let argCount  = self.argumentsFor && self.argumentsFor.length && self.argumentsAgainst && self.argumentsAgainst.length;
		return canEditAfterFirstLikeOrArg || ( !voteCount && !argCount );
  }

	Tour.auth = Tour.prototype.auth = {
    listableBy: 'all',
    viewableBy: 'all',
    createableBy: 'all',
    updateableBy: ['admin','editor','owner', 'moderator', 'all'],
    deleteableBy: ['admin','editor','owner', 'moderator'],
    canView: function(user, self) {
      if (self && self.viewableByRole && self.viewableByRole != 'all' ) {
        return userHasRole(user, self.viewableByRole, self.userId)
      } else {
        return true
      }
    },
    canVote: function(user, self) {
      // TODO: dit wordt niet gebruikt omdat de logica helemaal in de route zit. Maar hier zou dus netter zijn.
      return false
    },
    canUpdate: canMutate,
    canDelete: canMutate,
    canAddPoll: canMutate,
    toAuthorizedJSON: function(user, data, self) {

      if (!self.auth.canView(user, self)) {
        return {};
      }

	   /* if (idea.site.config.archivedVotes) {
		    if (req.query.includeVoteCount && req.site && req.site.config && req.site.config.votes && req.site.config.votes.isViewable) {
			      result.yes = result.extraData.archivedYes;
			      result.no = result.extraData.archivedNo;
		     }
	    }*/

      delete data.site;
      delete data.config;
      // dit zou nu dus gedefinieerd moeten worden op site.config, maar wegens backward compatible voor nu nog even hier:
	    if (data.extraData && data.extraData.phone) {
		    delete data.extraData.phone;
	    }
      // wordt dit nog gebruikt en zo ja mag het er uit
      if (!data.user) data.user = {};
      data.user.isAdmin = userHasRole(user, 'editor');
      // er is ook al een createDateHumanized veld; waarom is dit er dan ook nog?
	    data.createdAtText = moment(data.createdAt).format('LLL');

      data.can = {};
      // if ( self.can('vote', user) ) data.can.vote = true;
      if ( self.can('update', user) ) data.can.edit = true;
      if ( self.can('delete', user) ) data.can.delete = true;
      return data;

      return data;
    },
  }

  return Tour;


};
