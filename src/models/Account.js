var config         = require('config')
, log            = require('debug')('app:user')
, pick           = require('lodash/pick');

var sanitize       = require('../util/sanitize');

const isAccountActive = (account, site) => {
	const accountStatus = account.status;

	if (accountStatus === 'denied' || accountStatus === 'closed') {
		return false;
	}

	// if set to trial always true
	if (accountStatus === 'trial') {
		return true;
	}

	const siteAccountConfig = site.config && site.config.account ? site.config.account : {};

	/**
	 * In case payment is required
	 */
	if (siteAccountConfig.activePlanRequired) {
		if (account.paymentStatus === 'paid') {
			return true;
		} else {
			return false;
		}
	}

	// by default return true
	return true;
}


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
			type         : DataTypes.ENUM('trial', 'active', 'denied', 'closed'),
			defaultValue : 'trial',
			allowNull    : false
		},

		paymentStatus: {
			type         : DataTypes.ENUM('failed','paid','none'),
			defaultValue : 'none',
			allowNull    : false
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
			includeProduct: {
				include: [{
					model: db.Product,
				}]
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
		}
	}

	Account.associate = function( models ) {
		this.hasMany(models.Product);
	 	this.hasMany(models.User, {constraints: false});
		this.hasMany(models.Order);
		this.belongsTo(models.Site);

		//this.belongsTo(models.Product);

		this.belongsToMany(models.Tag, {through: 'accountTags'});
	}

	// dit is hoe het momenteel werkt; ik denk niet dat dat de bedoeling is, maar ik volg nu
	Account.auth = Account.prototype.auth = {
		listableBy: 'editor',
		viewableBy: ['editor', 'owner'],
		createableBy: 'all',
		updateableBy: ['editor', 'owner'],
		deleteableBy: ['editor', 'owner'],
		canConfirm: function (user, self) {
			// all; specific checks are in the route (TODO: move those to here)
			return true;
		},
		canSignout: function (user, self) {
			// all; specific checks are in the route (TODO: move those to here)
			return true;
		},
	}

	return Account;
};
