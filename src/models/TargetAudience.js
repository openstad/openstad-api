const sanitize = require('../util/sanitize');

module.exports = function (db, sequelize, DataTypes) {
  var TargetAudience = sequelize.define(
    'targetAudience',
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
    },
    {
      hooks: {},

      individualHooks: true,
    }
  );

  TargetAudience.scopes = function scopes() {
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

  TargetAudience.associate = function (models) {
    this.belongsToMany(models.Idea, {
      through: 'ideaTargetAudiences',
      constraints: false,
    });
    // this.belongsToMany(models.Organisation, {
    //   through: 'organisationTags',
    //   constraints: false,
    // });
    // this.belongsToMany(models.Event, {
    //   through: 'eventTag',
    // });
    this.belongsTo(models.Site);
  };

  // dit is hoe het momenteel werkt; ik denk niet dat dat de bedoeling is, maar ik volg nu
  TargetAudience.auth = TargetAudience.prototype.auth = {
    listableBy: 'all',
    viewableBy: 'all',
    createableBy: 'admin',
    updateableBy: 'admin',
    deleteableBy: 'admin',
  };

  return TargetAudience;
};
