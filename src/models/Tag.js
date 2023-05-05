const sanitize = require('../util/sanitize');
const config = require('config');
const getExtraDataConfig = require('../lib/sequelize-authorization/lib/getExtraDataConfig');
const userHasRole = require('../lib/sequelize-authorization/lib/hasRole');

module.exports = function( db, sequelize, DataTypes ) {

	var Tag = sequelize.define('tag', {

		siteId: {
			type         : DataTypes.INTEGER,
			allowNull    : false,
		},

		name: {
			type         : DataTypes.STRING,
			allowNull    : false,
			set          : function( text ) {
				this.setDataValue('name', sanitize.title(text.trim()));
			}
		},

		type: {
			type         : DataTypes.STRING,
			allowNull    : true,
			set          : function( text ) {
				this.setDataValue('type', sanitize.safeTags(text.trim()));
			}
		},

		extraData: getExtraDataConfig(DataTypes.JSON, 'tags')
	}, {

		hooks: {
		},

		individualHooks: true,

	});

	Tag.scopes = function scopes() {

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

	Tag.associate = function( models ) {
		this.belongsToMany(models.Idea, { through: 'ideaTags',constraints: false});
		this.belongsTo(models.Site);
	}

  // dit is hoe het momenteel werkt; ik denk niet dat dat de bedoeling is, maar ik volg nu
	Tag.auth = Tag.prototype.auth = {
    listableBy: 'all',
    viewableBy: 'all',
    createableBy: 'moderator',
    updateableBy: 'moderator',
    deleteableBy: 'moderator',
  }

	return Tag;

}
