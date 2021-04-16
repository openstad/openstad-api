var config = require('config')
    , log = require('debug')('app:user')
    , pick = require('lodash/pick');

var sanitize = require('../util/sanitize');


module.exports = function (db, sequelize, DataTypes) {
    var OrderLog = sequelize.define('orderLog', {
        event: {
            type: DataTypes.STRING(128),
            allowNull: true,
        },

        description: {
            type: DataTypes.TEXT,
            allowNull: true,
        },

    }, {
        charset: 'utf8',
        validate: {},
    });

    OrderLog.auth = OrderLog.prototype.auth = {
        listableBy: ['admin', 'editor', 'moderator'],
        viewableBy: ['admin', 'editor', 'moderator'],
        createableBy: ['admin', 'editor', 'moderator'],
        updateableBy: ['admin', 'editor', 'moderator'],
        deleteableBy: ['admin', 'editor', 'moderator'],
    }

    OrderLog.associate = function (models) {
        //variations
        this.belongsTo(models.Order);
    }

    return OrderLog;
};
