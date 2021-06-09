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
            auth: {
                updateableBy: 'editor',
            },
            allowNull: false,
            defaultValue: 0,
        },

        status: {
            type: DataTypes.ENUM('CONCEPT', 'CLOSED', 'ACCEPTED', 'DENIED', 'BUSY'),
            auth: {
                updateableBy: 'editor',
            },
            defaultValue: 'CONCEPT',
            allowNull: false
        },

        userId: {
            type: DataTypes.INTEGER,
            auth: {
                updateableBy: 'editor',
            },
            allowNull: false,
            defaultValue: 0,
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

        live: getExtraDataConfig(DataTypes.JSON, 'tours'),

        revisions: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: '[]',
            get: function () {
                let value = this.getDataValue('revisions');
                try {
                    if (typeof value == 'string') {
                        value = JSON.parse(value);
                    }
                } catch (err) {
                }

                return value;
            },
            set: function (value) {
                try {
                    if (typeof value == 'string') {
                        value = JSON.parse(value);
                    }
                } catch (err) {
                }
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

            forSiteId: function (siteId) {
                return {
                    where: {
                        accountId: [sequelize.literal(`select id FROM accounts WHERE siteId = ${siteId}`)]
                    }
                };
            },

            forUserId: function (userId) {
              return {
                where: {
                  userId: userId
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

    Tour.auth = Tour.prototype.auth = {
        listableBy: 'all',
        viewableBy: 'all',// ['admin', 'editor', 'owner', 'moderator'],
        createableBy: 'all',
        updateableBy: ['admin', 'editor', 'owner', 'moderator', 'all'],
        deleteableBy: ['admin', 'editor', 'owner', 'moderator'],
    }

    return Tour;


};
