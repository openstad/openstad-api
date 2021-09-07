const sanitize = require('../util/sanitize');

module.exports = function (db, sequelize, DataTypes) {
  var Grant = sequelize.define(
    'grant',
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
      url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      hooks: {},

      individualHooks: true,
    }
  );

  Grant.scopes = function scopes() {
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
    };
  };

  Grant.associate = function (models) {
    this.belongsToMany(models.Idea, {
      through: 'ideaGrants',
      constraints: false,
    });
    this.belongsTo(models.Site);
  };

  // dit is hoe het momenteel werkt; ik denk niet dat dat de bedoeling is, maar ik volg nu
  Grant.auth = Grant.prototype.auth = {
    listableBy: 'all',
    viewableBy: 'all',
    createableBy: 'admin',
    updateableBy: 'admin',
    deleteableBy: 'admin',
  };

  return Grant;
};
