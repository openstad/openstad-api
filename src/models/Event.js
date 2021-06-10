const config = require('config');
const log = require('debug')('app:event');

module.exports = function (db, sequelize, DataTypes) {
  const Event = sequelize.define(
    'event',
    {
      siteId: {
        type: DataTypes.INTEGER,
        defaultValue:
          config.siteId && typeof config.siteId == 'number' ? config.siteId : 0,
        allowNull: false,
      },

      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },

      description: {
        type: DataTypes.TEXT(),
        allowNull: false,
      },

      location: {
        type: DataTypes.GEOMETRY('POINT'),
        allowNull: false,
      },

      district: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },

      minAge: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      maxAge: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      // Price is in cents
      price: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },

      attendees: {
        type: DataTypes.INTEGER,
        default: 0,
      },

      information: {
        type: DataTypes.STRING(255),
      },

      image: {
        type: DataTypes.STRING(2048),
        allowNull: false,
      },
    },
    {
      charset: 'utf8',
    }
  );

  Event.scopes = function scopes() {
    return {};
  };

  Event.associate = function (models) {
    this.belongsTo(models.Site);
    this.belongsTo(models.Organisation, {});
    this.belongsToMany(models.Tag, {
      through: 'eventTag',
    });
    this.hasMany(models.EventTimeslot);
  };

  Event.auth = Event.prototype.auth = {
    listableBy: 'member',
    viewableBy: 'all',
    createableBy: 'member',
    updateableBy: ['member', 'owner'],
    deleteableBy: ['member', 'owner'],
  };

  return Event;
};
