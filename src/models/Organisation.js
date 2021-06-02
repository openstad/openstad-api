var config = require('config'),
  log = require('debug')('app:organisation');

module.exports = function (db, sequelize, DataTypes) {
  const Organisation = sequelize.define(
    'organisation',
    {
      siteId: {
        type: DataTypes.INTEGER,
        defaultValue:
          config.siteId && typeof config.siteId == 'number' ? config.siteId : 0,
      },

      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },

      street: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },

      zip: {
        type: DataTypes.STRING(6),
        allowNull: false,
      },

      // Area?
      // district: {
      //   type: DataTypes.INTEGER,
      // },

      phone: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },

      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          isEmail: {
            msg: 'Geen geldig emailadres',
          },
          // notBlackListed: function (email) {
          //   var match = email && email.match(/^.+@(.+)$/);
          //   if (match) {
          //     let domainName = match[1];
          //     if (domainName in emailBlackList) {
          //       throw Error(
          //         'Graag je eigen emailadres gebruiken; geen tijdelijk account'
          //       );
          //     }
          //   }
          // },
        },
      },

      website: {
        type: DataTypes.STRING(2048),
        allowNull: true,
      },

      facebook: {
        type: DataTypes.STRING(2048),
        allowNull: true,
      },

      instagram: {
        type: DataTypes.STRING(2048),
        allowNull: true,
      },

      status: {
        type: DataTypes.ENUM('PENDING', 'VERIFIED', 'DENIED'),
        defaultValue: 'PENDING',
        allowNull: false,
      },

      contactName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        auth: {
          listableBy: ['editor', 'owner'],
          viewableBy: ['editor', 'owner'],
          createableBy: ['editor', 'owner'],
          updateableBy: ['editor', 'owner'],
        },
      },
      contactPosition: {
        type: DataTypes.STRING(255),
        allowNull: false,
        auth: {
          listableBy: ['editor', 'owner'],
          viewableBy: ['editor', 'owner'],
          createableBy: ['editor', 'owner'],
          updateableBy: ['editor', 'owner'],
        },
      },
      contactEmail: {
        type: DataTypes.STRING(255),
        allowNull: false,
        auth: {
          listableBy: ['editor', 'owner'],
          viewableBy: ['editor', 'owner'],
          createableBy: ['editor', 'owner'],
          updateableBy: ['editor', 'owner'],
        },
        validate: {
          isEmail: {
            msg: 'Geen geldig emailadres',
          },
          // notBlackListed: function (email) {
          //   var match = email && email.match(/^.+@(.+)$/);
          //   if (match) {
          //     let domainName = match[1];
          //     if (domainName in emailBlackList) {
          //       throw Error(
          //         'Graag je eigen emailadres gebruiken; geen tijdelijk account'
          //       );
          //     }
          //   }
          // },
        },
      },
      contactPhone: {
        type: DataTypes.STRING(10),
        allowNull: false,
        auth: {
          listableBy: ['editor', 'owner'],
          viewableBy: ['editor', 'owner'],
          createableBy: ['editor', 'owner'],
          updateableBy: ['editor', 'owner'],
        },
      },

      // Municipality contact details
      municipalityContactName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        auth: {
          listableBy: ['editor', 'owner'],
          viewableBy: ['editor', 'owner'],
          createableBy: ['editor', 'owner'],
          updateableBy: ['editor', 'owner'],
        },
      },
      municipalityContactEmail: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          isEmail: {
            msg: 'Geen geldig emailadres',
          },
          // notBlackListed: function (email) {
          //   var match = email && email.match(/^.+@(.+)$/);
          //   if (match) {
          //     let domainName = match[1];
          //     if (domainName in emailBlackList) {
          //       throw Error(
          //         'Graag je eigen emailadres gebruiken; geen tijdelijk account'
          //       );
          //     }
          //   }
          // },
        },
        auth: {
          listableBy: ['editor', 'owner'],
          viewableBy: ['editor', 'owner'],
          createableBy: ['editor', 'owner'],
          updateableBy: ['editor', 'owner'],
        },
      },
      municipalityContactPhone: {
        type: DataTypes.STRING(10),
        allowNull: false,
        auth: {
          listableBy: ['editor', 'owner'],
          viewableBy: ['editor', 'owner'],
          createableBy: ['editor', 'owner'],
          updateableBy: ['editor', 'owner'],
        },
      },
      municipalityContactStatement: {
        type: DataTypes.TEXT,
        allowNull: false,
        auth: {
          listableBy: ['editor', 'owner'],
          viewableBy: ['editor', 'owner'],
          createableBy: ['editor', 'owner'],
          updateableBy: ['editor', 'owner'],
        },
      },
    },
    {
      charset: 'utf8',
    }
  );

  Organisation.scopes = function scopes() {
    return {};
  };

  Organisation.associate = function (models) {
    this.hasMany(models.User);
    this.belongsTo(models.Area);
    this.belongsTo(models.Site);
    this.belongsToMany(models.Tag, {
      through: 'organisationTags',
      constraints: false,
    });
  };

  Organisation.auth = Organisation.prototype.auth = {
    listableBy: 'editor',
    viewableBy: 'all',
    createableBy: 'editor',
    updateableBy: ['editor', 'owner'],
    deleteableBy: ['editor', 'owner'],
  };

  // Organisation.sync()
  //   .then(() => log('synced organisation'))
  //   .catch(console.error);

  return Organisation;
};
