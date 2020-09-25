var config         = require('config')
, log            = require('debug')('app:user')
, pick           = require('lodash/pick');

var sanitize       = require('../util/sanitize');


module.exports = function( db, sequelize, DataTypes ) {
	var OrderItem = sequelize.define('orderItem', {

    vat: {
      type         : DataTypes.INTEGER,
      allowNull    : false,
      defaultValue: 21,
    },

    orderId: {
      type         : DataTypes.INTEGER,
      defaultValue : 0,
    },

		productId: {
			type         : DataTypes.INTEGER,
			defaultValue : 0,
		},

		price: {
       type: DataTypes.DECIMAL(10,2),
       allowNull: true,
    },

		extraData: getExtraDataConfig(DataTypes.JSON, 'orderItem'),

	}, {
		charset: 'utf8',
		validate: {},
	});

	OrderItem.auth = OrderItem.prototype.auth = {
		listableBy: ['admin','editor', 'moderator'],
		viewableBy: ['admin','editor', 'moderator'],
		createableBy: ['admin','editor', 'moderator'],
		updateableBy: ['admin','editor', 'moderator'],
		deleteableBy: ['admin','editor', 'moderator'],
	}

	OrderItem.associate = function( models ) {
		this.belongsTo(models.Order);
		this.belongsTo(models.Product);
	}

	return OrderItem;
};
