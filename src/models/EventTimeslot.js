const log = require('debug')('app:event-timeslot');

module.exports = function (db, sequelize, DataTypes) {
  const EventTimeslot = sequelize.define(
    'eventTimeslot',
    {
      startTime: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      endTime: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      charset: 'utf8',
    }
  );

  EventTimeslot.scopes = function scopes() {
    return {};
  };

  EventTimeslot.associate = function (models) {
    this.belongsTo(models.Event);
  };

  EventTimeslot.auth = EventTimeslot.prototype.auth = {
    listableBy: 'member',
    viewableBy: 'all',
    createableBy: 'member',
    updateableBy: ['member', 'owner'],
    deleteableBy: ['member', 'owner'],
  };

  return EventTimeslot;
};
