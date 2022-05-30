const sanitize = require('../util/sanitize');
const config = require('config');
const getExtraDataConfig = require('../lib/sequelize-authorization/lib/getExtraDataConfig');
const userHasRole = require('../lib/sequelize-authorization/lib/hasRole');
const getSequelizeConditionsForFilters = require('./../util/getSequelizeConditionsForFilters');

module.exports = function (db, sequelize, DataTypes) {
  var Tag = sequelize.define(
    'tag',
    {
      siteId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      name: {
        type: DataTypes.STRING,
        allowNull: false,
        set: function (text) {
          this.setDataValue('name', sanitize.title(text.trim()));
        },
      },

      extraData: Object.assign({}, getExtraDataConfig(DataTypes.JSON, 'tags'), {
        field: 'tagsExtraData'
      }),
    },
    {
      hooks: {},

      individualHooks: true,
    }
  );

  Tag.scopes = function scopes() {
    return {
      defaultScope: {},

      forSiteId: function (siteId) {
        return {
          where: {
            siteId: siteId,
          },
        };
      },

      includeSite: {
        include: [
          {
            model: db.Site,
          },
        ],
      },

      filter: function (filtersInclude, filtersExclude) {
        const filterKeys = [
          {
            key: 'theme',
            extraData: true,
          },
        ];

        return getSequelizeConditionsForFilters(
          filterKeys,
          filtersInclude,
          sequelize,
          filtersExclude,
          'tagsExtraData'
        );
      },
    };
  };

  Tag.associate = function (models) {
    this.belongsToMany(models.Idea, {
      through: 'ideaTags',
      constraints: false,
    });
    this.belongsToMany(models.Organisation, {
      through: 'organisationTags',
      constraints: false,
    });
    this.belongsToMany(models.Event, {
      through: 'eventTag',
    });
    this.belongsTo(models.Site);
  };

  // dit is hoe het momenteel werkt; ik denk niet dat dat de bedoeling is, maar ik volg nu
  Tag.auth = Tag.prototype.auth = {
    listableBy: 'all',
    viewableBy: 'all',
    createableBy: 'admin',
    updateableBy: 'admin',
    deleteableBy: 'admin',
  };

  return Tag;
};
