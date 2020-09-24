var config         = require('config')
, log            = require('debug')('app:user')
, pick           = require('lodash/pick');

var sanitize       = require('../util/sanitize');


module.exports = function( db, sequelize, DataTypes ) {
	var Transaction = sequelize.define('transaction', {
		provider: {
			type         : DataTypes.STRING(64),
			allowNull    : false,
		},

		status: {
			type         : DataTypes.ENUM('OPEN','PROCESSING', 'SUCCESS', 'CANCELLED', 'PENDING', 'EXPIRED'),
			defaultValue : 'OPEN',
			allowNull    : false
		},

    orderId: {
      type         : DataTypes.INTEGER,
      defaultValue : 0,
    },

		price: {
       type: DataTypes.DECIMAL(10,2),
       allowNull: true,
    },

		extraData: getExtraDataConfig(DataTypes.JSON, 'transaction'),

	}, {
		charset: 'utf8',
		validate: {},
	});



	Transaction.auth = Transaction.prototype.auth = {
		listableBy: 'all',
		viewableBy: 'all',
		createableBy: 'admin',
		updateableBy: 'admin',
		deleteableBy: 'admin',
	}

	Transaction.associate = function( models ) {
		this.belongsTo(models.Order);
	}

	return Transaction;
};
