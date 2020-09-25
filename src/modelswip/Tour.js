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

  var Tour = sequelize.define('idea', {

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
      defaultValue: 'OPEN',
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


    extraData: getExtraDataConfig(DataTypes.JSON,  'ideas'),

    location: {
      type: DataTypes.GEOMETRY('POINT'),
      allowNull: !(config.ideas && config.ideas.location && config.ideas.location.isMandatory),
    },

    position: {
      type: DataTypes.VIRTUAL,
      get: function () {
        var location = this.get('location');
        var position;
        if (location && location.type && location.type == 'Point') {
          position = {
            lat: location.coordinates[0],
            lng: location.coordinates[1],
          };
        }
        return position
      }
    },

    modBreak: {
      type: DataTypes.TEXT,
      auth:  {
        createableBy: 'editor',
        updateableBy: 'editor',
      },
      allowNull: true,
      set: function (text) {
        this.setDataValue('modBreak', sanitize.content(text));
      }
    },

    modBreakUserId: {
      type: DataTypes.INTEGER,
      auth:  {
        createableBy: 'editor',
        updateableBy: 'editor',
      },
      allowNull: true
    },

    modBreakDate: {
      type: DataTypes.DATE,
      auth:  {
        createableBy: 'editor',
        updateableBy: 'editor',
      },
      allowNull: true
    },

    modBreakDateHumanized: {
      type: DataTypes.VIRTUAL,
      get: function () {
        var date = this.getDataValue('modBreakDate');
        try {
          if (!date)
            return undefined;
          return moment(date).format('LLL');
        } catch (error) {
          return (error.message || 'dateFilter error').toString()
        }
      }
    },

    // Counts set in `summary`/`withVoteCount` scope.
    no: {
      type: DataTypes.VIRTUAL
    },

    yes: {
      type: DataTypes.VIRTUAL
    },

    progress: {
      type: DataTypes.VIRTUAL,
      get: function () {
        var minimumYesVotes = (this.site && this.site.config && this.site.config.ideas && this.site.config.ideas.minimumYesVotes) || config.get('ideas.minimumYesVotes');
        var yes = this.getDataValue('yes');
        return yes !== undefined ?
          Number((Math.min(1, (yes / minimumYesVotes)) * 100).toFixed(2)) :
          undefined;
      }
    },

    argCount: {
      type: DataTypes.VIRTUAL
    },

    createDateHumanized: {
      type: DataTypes.VIRTUAL,
      get: function () {
        var date = this.getDataValue('createdAt');
        try {
          if (!date)
            return 'Onbekende datum';
          return moment(date).format('LLL');
        } catch (error) {
          return (error.message || 'dateFilter error').toString()
        }
      }
    },

  }, {

    hooks: {

      // onderstaand is een workaround: bij een delete wordt wel de vvalidatehook aangeroepen, maar niet de beforeValidate hook. Dat lijkt een bug.
    //  beforeValidate: beforeValidateHook,
  //    beforeDestroy: beforeValidateHook,

      afterCreate: function (instance, options) {
        notifications.addToQueue({
          type: 'idea',
          action: 'create',
          siteId: instance.siteId,
          instanceId: instance.id
        });
        // TODO: wat te doen met images
        // idea.updateImages(imageKeys, data.imageExtraData);
      },

      afterUpdate: function (instance, options) {
        notifications.addToQueue({
          type: 'idea',
          action: 'update',
          siteId: instance.siteId,
          instanceId: instance.id
        });
        // TODO: wat te doen met images
        // idea.updateImages(imageKeys, data.imageExtraData);
      },

    },



  });

  Tour.scopes = function scopes() {
    // Helper function used in `withVoteCount` scope.

    function argCount(fieldName) {
      return [sequelize.literal(`
				(SELECT
					COUNT(*)
				FROM
					arguments a
				WHERE
					a.deletedAt IS NULL AND
					a.ideaId = idea.id)
			`), fieldName];
    }

    return {

      // nieuwe scopes voor de api
      // -------------------------

      onlyVisible: function (userRole) {
        return {
          where: sequelize.or(
            {
              viewableByRole: 'all'
            },
            {
              viewableByRole: null
            },
            {
              viewableByRole: roles[userRole] || ''
            },
          )
        };
      },

      api: {},

      filter: function (filters) {
        let conditions = {};

        const filterKeys = [
          {
            'key': 'id'
          },
          {
            'key': 'title'
          },
          {
            'key': 'theme',
            'extraData': true
          },
          {
            'key': 'area',
            'extraData': true
          },
          {
            'key': 'vimeoId',
            'extraData': true
          },
        ];


        filterKeys.forEach((filter, i) => {
          const filterValue = filters[filter.key]
          if (filters[filter.key]) {
            if (filter.extraData) {
              conditions[Sequelize.Op.and] = sequelize.literal(`extraData->"$.${filter.key}"='${filterValue}'`)
            } else {
              conditions[filter.key] = filterValue;
            }
          }
        });

        return {
          where: conditions
        }
      },

      forSiteId: function( siteId ) {
				return {
					where: {
						accountId: [ sequelize.literal(`select id FROM accounts WHERE siteId = ${siteId}`) ]
					}
				};
			},

      includeReviews: function (userId) {
        return {
          include: [{
            model: db.Argument.scope(
              'defaultScope',
              {method: ['withVoteCount', 'argumentsAgainst']},
              {method: ['withUserVote', 'argumentsAgainst', userId]},
              'withReactions'
            ),
            as: 'argumentsAgainst',
            required: false,
            where: {
              sentiment: 'against',
              parentId: null
            }
          }, {
            model: db.Argument.scope(
              'defaultScope',
              {method: ['withVoteCount', 'argumentsFor']},
              {method: ['withUserVote', 'argumentsFor', userId]},
              'withReactions'
            ),
            as: 'argumentsFor',
            required: false,
            where: {
              sentiment: 'for',
              parentId: null
            }
          }],
          // HACK: Inelegant?
          order: [
            sequelize.literal(`GREATEST(0, \`argumentsAgainst.yes\` - ${argVoteThreshold}) DESC`),
            sequelize.literal(`GREATEST(0, \`argumentsFor.yes\` - ${argVoteThreshold}) DESC`),
            sequelize.literal('argumentsAgainst.parentId'),
            sequelize.literal('argumentsFor.parentId'),
            sequelize.literal('argumentsAgainst.createdAt'),
            sequelize.literal('argumentsFor.createdAt')
          ]
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
      includeArgsCount: {
        include: [{
          model: db.Site,
        }],
        attributes: {
          include: [
            argCount('reviewCount')
          ]
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
      withArguments: function (userId) {
        return {
          include: [{
            model: db.Argument.scope(
              'defaultScope',
              {method: ['withVoteCount', 'argumentsAgainst']},
              {method: ['withUserVote', 'argumentsAgainst', userId]},
              'withReactions'
            ),
            as: 'argumentsAgainst',
            required: false,
            where: {
              sentiment: 'against',
              parentId: null,
            }
          }, {
            model: db.Argument.scope(
              'defaultScope',
              {method: ['withVoteCount', 'argumentsFor']},
              {method: ['withUserVote', 'argumentsFor', userId]},
              'withReactions'
            ),
            as: 'argumentsFor',
            required: false,
            where: {
              sentiment: 'for',
              parentId: null,
            }
          }],
          // HACK: Inelegant?
          order: [
            sequelize.literal(`GREATEST(0, \`argumentsAgainst.yes\` - ${argVoteThreshold}) DESC`),
            sequelize.literal(`GREATEST(0, \`argumentsFor.yes\` - ${argVoteThreshold}) DESC`),
            'argumentsAgainst.parentId',
            'argumentsFor.parentId',
            'argumentsAgainst.createdAt',
            'argumentsFor.createdAt'
          ]
        };
      }
    }
  }

  Tour.associate = function (models) {
    this.belongsTo(models.Account);
    this.hasMany(models.TourStep);
    this.hasMany(models.Argument, {as: 'review'});
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
    createableBy: 'member',
    updateableBy: ['admin','editor','owner', 'moderator'],
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
