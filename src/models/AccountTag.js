var sanitize = require('../util/sanitize');
var config = require('config')

module.exports = function( db, sequelize, DataTypes ) {

	var AccountTag = sequelize.define('accountTag', {}, {
        paranoid: false
	});

	AccountTag.scopes = function scopes() {
		return {
			defaultScope: {
			},

      forSiteId: function( siteId ) {
        return {
          where: {
            siteId: siteId,
          }
        };
      },

      includeSite: {
        include: [{
          model: db.Site,
        }]
      },

		}
	}

  // dit is hoe het momenteel werkt; ik denk niet dat dat de bedoeling is, maar ik volg nu
	AccountTag.auth = AccountTag.prototype.auth = {
        listableBy: 'all',
        viewableBy: 'all',
        createableBy: 'admin',
        updateableBy: 'admin',
        deleteableBy: 'admin',
    }

	return AccountTag;

}
