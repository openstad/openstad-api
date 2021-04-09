var config         = require('config')
    , log            = require('debug')('app:user')
    , pick           = require('lodash/pick');

var sanitize       = require('../util/sanitize');

module.exports = function( db, sequelize, DataTypes ) {
    var Action = sequelize.define('account', {
        siteId: {
            type         : DataTypes.INTEGER,
            defaultValue : config.siteId && typeof config.siteId == 'number' ? config.siteId : 0,
        },

        accountId: {
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

        // If triggered auto
        trigger: {
            type         : DataTypes.ENUM('cron', 'url'),
            defaultValue : 'url',
            allowNull    : false
        },

        status: {
            type         : DataTypes.ENUM('concept', 'paused', 'active'),
            defaultValue : 'TRIAL',
            allowNull    : false
        },

        conditions: {
            type: DataTypes.JSON,
            allowNull		 : false,
            defaultValue : [],
        },

        actions: {
            type: DataTypes.JSON,
            allowNull		 : false,
            defaultValue : [],
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
        this.belongsTo(models.Account);
    }

    Account.types = [
        {
            name: 'createModel',
            act: async (variables) => {
                const {modelName, values} = variables;

                if (!modelName) {
                    throw new Error('No model name defined for create resource action');
                }

                if (!db[resource]) {
                    throw new Error('No modelname defined for create resource action');
                }

                try {
                    await db[resource].create(values);
                } catch(e) {
                    throw new Error('Error while creating model in createModel action for variables: '+ JSON.stringify(variables));
                }

            }
        },
    ]

    return Account;
};
