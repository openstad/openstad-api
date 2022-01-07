var config = require('config')
    , log = require('debug')('app:user')
    , pick = require('lodash/pick');

var sanitize = require('../util/sanitize');


module.exports = function (db, sequelize, DataTypes) {
    var Product = sequelize.define('product', {
        name: {
            type: DataTypes.STRING(255),
            allowNull: false,
            validate: {
                // len: {
                //   args : [titleMinLength,titleMaxLength],
                //   msg  : `Titel moet tussen ${titleMinLength} en ${titleMaxLength} tekens lang zijn`
                // }
                textLength(value) {
                    let len = sanitize.title(value.trim()).length;
                    let titleMinLength = (this.config && this.config.products && this.config.products.nameMinLength || 10)
                    let titleMaxLength = (this.config && this.config.products && this.config.products.nameMaxLength || 50)
                    if (len < titleMinLength || len > titleMaxLength)
                        throw new Error(`Productnaam moet tussen ${titleMinLength} en ${titleMaxLength} tekens zijn`);
                }
            },
            set: function (text) {
                if (text) this.setDataValue('name', sanitize.title(text.trim()));
            }
        },

        currency: {
            type: DataTypes.STRING(5),
            defaultValue: 'EUR'
        },

        sku: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: null,
            set: function (text) {
                if (text) this.setDataValue('sku', sanitize.title(text.trim()));
            }
        },

        name: {
            type: DataTypes.STRING(255),
            allowNull: false,
            set: function (text) {
                if (text) this.setDataValue('name', sanitize.title(text.trim()));
            }
        },

        subscription: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },

        description: {
            type: DataTypes.TEXT,
            allowNull: true,
            set: function (text) {
                if (text) this.setDataValue('description', sanitize.content(text.trim()));
            }
        },

        vat: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 21,
        },

        accountId: {
            type: DataTypes.INTEGER,
            defaultValue: config.accountId && typeof config.accountId === 'number' ? config.accountId : 0,
        },

        productId: {
            type: DataTypes.INTEGER,
            defaultValue: config.accountId && typeof config.accountId === 'number' ? config.accountId : 0,
        },

        price: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
        },

        status: {
            type: DataTypes.ENUM('OPEN', 'CLOSED', 'ACCEPTED', 'DENIED', 'BUSY', 'DONE'),
            defaultValue: 'OPEN',
            allowNull: false
        },

        subscriptionInterval: {
            type: DataTypes.ENUM('14 days', '12 months', '1 week', '1 month', '3 months', 'once'),
            defaultValue: '1 month',
            allowNull: false
        },

        extraData: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: '{}',
            get: function () {
                let value = this.getDataValue('extraData');
                try {
                    if (typeof value == 'string') {
                        value = JSON.parse(value);
                    }
                } catch (err) {
                }
                return value;
            },
            set: function (value) {

                try {
                    if (typeof value == 'string') {
                        value = JSON.parse(value);
                    }
                } catch (err) {
                }

                let oldValue = this.getDataValue('extraData');
                try {
                    if (typeof oldValue == 'string') {
                        oldValue = JSON.parse(oldValue) || {};
                    }
                } catch (err) {
                }

                function fillValue(old, val) {
                    old = old || {};
                    Object.keys(old).forEach((key) => {
                        if (val[key] && typeof val[key] == 'object') {
                            return fillValue(old[key], val[key]);
                        }
                        if (val[key] === null) {
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

    Product.scopes = function scopes() {
        return {
            includeTags: {
                include: [{
                    model: db.Tag,
                    attributes: ['id', 'name'],
                    through: {attributes: []},
                }]
            },
            forSiteId: function (siteId) {
                return {
                    where: {
                        accountId: [sequelize.literal(`select id FROM accounts WHERE siteId = ${siteId}`)]
                    }
                };
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

    Product.auth = Product.prototype.auth = {
        listableBy: 'all',
        viewableBy: 'all',
        createableBy: 'admin',
        updateableBy: 'admin',
        deleteableBy: 'admin',
    }

    Product.associate = function (models) {
        this.hasMany(models.Order);
        this.belongsTo(models.Account);

        //variations
     //   this.belongsTo(models.Product);
        this.belongsToMany(models.Tag, {through: 'productTags'});
    }

    return Product;
};
