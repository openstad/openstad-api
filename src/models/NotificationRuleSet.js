module.exports = (db, sequelize, DataTypes) => {
  const NotificationRuleSet = sequelize.define('notification_rulesets', {
    notificationTemplateId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    siteId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    active: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    label: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: false,
    },
    body: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: false,
    },
  }, {});

  NotificationRuleSet.associate = function(models) {
    NotificationRuleSet.belongsTo(models.NotificationTemplate);
    NotificationRuleSet.hasMany(models.NotificationRecipient);
  };

  NotificationRuleSet.scopes = function scopes() {
    return {
      // defaults
      default: {
        include: [{
          model: db.Site,
        }]
      },
      includeSite: {
        include : [{
          model: db.Site,
        }]
      },
      includeTemplate: {
        include : [{
          model: db.NotificationTemplate,
        }]
      },
      includeRecipients: {
        include : [{
          model: db.NotificationRecipient,
        }]
      },
    }
  }

  NotificationRuleSet.auth = NotificationRuleSet.prototype.auth = {
    listableBy: 'admin',
    viewableBy: 'admin',
    createableBy: 'admin',
    updateableBy: 'admin',
    deleteableBy: 'admin',
  };

  return NotificationRuleSet;
};
