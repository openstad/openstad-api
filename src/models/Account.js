var config         = require('config')
, log            = require('debug')('app:user')
, pick           = require('lodash/pick');

var sanitize       = require('../util/sanitize');


module.exports = function( db, sequelize, DataTypes ) {
	var Account = sequelize.define('account', {
		siteId: {
			type         : DataTypes.INTEGER,
			defaultValue : config.siteId && typeof config.siteId == 'number' ? config.siteId : 0,
		},

		name: {
			type         : DataTypes.STRING(64),
			allowNull    : true,
			set          : function( value ) {
				this.setDataValue('name', sanitize.noTags(value));
			}
		},

		status: {
			type         : DataTypes.ENUM('OPEN','CLOSED','ACCEPTED','DENIED','BUSY','DONE'),
			defaultValue : 'OPEN',
			allowNull    : false
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



		extraData: {
			type				 : DataTypes.TEXT,
			allowNull		 : false,
			defaultValue : '{}',
			get					 : function() {
				let value = this.getDataValue('extraData');
				try {
					if (typeof value == 'string') {
						value = JSON.parse(value);
					}
				} catch(err) {}
				return value;
			},
			set: function(value) {

				try {
					if (typeof value == 'string') {
						value = JSON.parse(value);
					}
				} catch(err) {}

				let oldValue = this.getDataValue('extraData');
				try {
					if (typeof oldValue == 'string') {
						oldValue = JSON.parse(oldValue) || {};
					}
				} catch(err) {}

				function fillValue(old, val) {
					old = old || {};
					Object.keys(old).forEach((key) => {
						if ( val[key] && typeof val[key] == 'object' ) {
							return fillValue(old[key], val[key]);
						}
						if ( val[key] === null ) {
							// send null to delete fields
							delete val[key];
						} else if (typeof val[key] == 'undefined') {
							// not defined in put data; use old val
							val[key] = old[key];
						}
					});
				}
				fillValue(oldValue, value);

				this.setDataValue('extraData', JSON.stringify(value));
			}
		},


	}, {
		charset: 'utf8',
		validate: {},
	});

	Account.scopes = function scopes() {
		return {
			includeTags: {
				include: [{
					model: db.Tag,
					attributes: ['id', 'name'],
					through: {attributes: []},
				}]
			},
		}
	}

	Account.associate = function( models ) {
		this.hasMany(models.Product);
	 	this.hasMany(models.User);
		this.hasMany(models.Order);
		this.belongsTo(models.Site);
		this.belongsToMany(models.Tag, {through: 'accountTags'});
	}

	return Account;
};
