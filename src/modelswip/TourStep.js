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

  var TourStep = sequelize.define('tourStep', {

    tourId: {
      type: DataTypes.INTEGER,
      auth:  {
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

    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        // len: {
        //  	args : [( this.config && this.config.ideas && config.ideas.descriptionMinLength || 140 ) ,descriptionMaxLength],
        //  	msg  : `Beschrijving moet  tussen ${this.config && this.config.ideas && config.ideas.descriptionMinLength || 140} en ${descriptionMaxLength} tekens zijn`
        // },
        textLength(value) {
          let len = sanitize.summary(value.trim()).length;
          let descriptionMinLength = (this.config && this.config.ideas && this.config.ideas.descriptionMinLength || 140)
          let descriptionMaxLength = (this.config && this.config.ideas && this.config.ideas.descriptionMaxLength || 5000)
          if (len < descriptionMinLength || len > descriptionMaxLength)
            throw new Error(`Beschrijving moet tussen ${descriptionMinLength} en ${descriptionMaxLength} tekens zijn`);
        }
      },
      set: function (text) {
        this.setDataValue('description', sanitize.content(text.trim()));
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

  });


  TourStep.auth = Product.prototype.auth = {
    listableBy: 'all',
    viewableBy: 'all',
    createableBy: 'admin',
    updateableBy: 'admin',
    deleteableBy: 'admin',
  }

  TourStep.associate = function( models ) {
    this.belongsTo(models.Tour);
  }


  return TourStep;

};
