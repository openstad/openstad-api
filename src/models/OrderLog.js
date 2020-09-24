var config         = require('config')
, log            = require('debug')('app:user')
, pick           = require('lodash/pick');

var sanitize       = require('../util/sanitize');


module.exports = function( db, sequelize, DataTypes ) {
	var OrderLog = sequelize.define('orderLog', {
		event: {
			type : DataTypes.STRING(128),
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
		listableBy: 'all',
		viewableBy: 'all',
		createableBy: 'admin',
		updateableBy: 'admin',
		deleteableBy: 'admin',
	}

	OrderLog.associate = function( models ) {
		//variations
		this.belongsTo(models.Order);
	}

	return OrderLog;
};
