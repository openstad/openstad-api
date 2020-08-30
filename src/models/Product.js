var Sequelize = require('sequelize');
var co        = require('co')
  , config        = require('config')
  , moment        = require('moment-timezone')
  , pick          = require('lodash/pick')
  , Promise       = require('bluebird');

var sanitize      = require('../util/sanitize');
// var ImageOptim    = require('../ImageOptim');
var notifications = require('../notifications');

const merge = require('merge');

var argVoteThreshold =  config.ideas && config.ideas.argumentVoteThreshold;

module.exports = function( db, sequelize, DataTypes ) {

	var Product = sequelize.define('product', {

		siteId: {
			type         : DataTypes.INTEGER,
			defaultValue : config.siteId && typeof config.siteId == 'number' ? config.siteId : 0,
		},

    accountId: {
      type         : DataTypes.INTEGER,
      defaultValue : config.accountId && typeof config.accountId == 'number' ? config.accountId : 0,
    },

    sku: {
      type         : DataTypes.STRING(255),
      allowNull    : false,
      validate     : {
        // len: {
        //   args : [titleMinLength,titleMaxLength],
        //   msg  : `Titel moet tussen ${titleMinLength} en ${titleMaxLength} tekens lang zijn`
        // }
        textLength(value) {
          let len = sanitize.title(value.trim()).length;
          let titleMinLength = ( this.config && this.config.products && this.config.products.skuMinLength || 1 )
          let titleMaxLength = ( this.config && this.config.products && this.config.products.skuMaxLength || 50 )
          if (len < titleMinLength || len > titleMaxLength)
          throw new Error(`Productnaam moet tussen ${titleMinLength} en ${titleMaxLength} tekens zijn`);
        }
      },
      set          : function( text ) {
        this.setDataValue('sku', sanitize.title(text.trim()));
      }
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

    name: {
      type         : DataTypes.STRING(255),
      allowNull    : false,
      validate     : {
        // len: {
        //   args : [titleMinLength,titleMaxLength],
        //   msg  : `Titel moet tussen ${titleMinLength} en ${titleMaxLength} tekens lang zijn`
        // }
        textLength(value) {
          console.log('value', value)
          let len = sanitize.title(value.trim()).length;
          let titleMinLength = ( this.config && this.config.products && this.config.products.nameMinLength || 10 )
          let titleMaxLength = ( this.config && this.config.products && this.config.products.nameMaxLength || 50 )
          if (len < titleMinLength || len > titleMaxLength)
          throw new Error(`Productnaam moet tussen ${titleMinLength} en ${titleMaxLength} tekens zijn`);
        }
      },
      set          : function( text ) {
        this.setDataValue('name', sanitize.title(text.trim()));
      }
    },

    description: {
			type         : DataTypes.TEXT,
			allowNull    : false,
			validate     : {
				// len: {
				//  	args : [( this.config && this.config.products && config.ideas.descriptionMinLength || 140 ) ,descriptionMaxLength],
				//  	msg  : `Beschrijving moet  tussen ${this.config && this.config.products && config.ideas.descriptionMinLength || 140} en ${descriptionMaxLength} tekens zijn`
				// },
				textLength(value) {
				 	let len = sanitize.summary(value.trim()).length;
					let descriptionMinLength = ( this.config && this.config.products && this.config.products.descriptionMinLength || 140 )
					let descriptionMaxLength = ( this.config && this.config.products && this.config.products.descriptionMaxLength || 5000 )
					if (len < descriptionMinLength || len > descriptionMaxLength)
					throw new Error(`Beschrijving moet tussen ${descriptionMinLength} en ${descriptionMaxLength} tekens zijn`);
				}
			},
			set          : function( text ) {
				this.setDataValue('description', sanitize.content(text.trim()));
			}
		},

		userId: {
			type         : DataTypes.INTEGER,
			allowNull    : false,
			defaultValue: 0,
		},

    vat: {
      type         : DataTypes.INTEGER,
      allowNull    : false,
      defaultValue: 21,
    },

		createDateHumanized: {
			type         : DataTypes.VIRTUAL,
			get          : function() {
				var date = this.getDataValue('createdAt');
				try {
					if( !date )
						return 'Onbekende datum';
					return  moment(date).format('LLL');
				} catch( error ) {
					return (error.message || 'dateFilter error').toString()
				}
			}
		},

    image: {
      type				 : DataTypes.TEXT,
      allowNull		 : false,
      defaultValue : {},
      get					 : function() {
        let value = this.getDataValue('image');
        try {
          if (typeof value == 'string') {
            value = JSON.parse(value);
          }
        } catch(err) {}
        return value;
      },
      set					 : function(value) {
        var currentconfig = this.getDataValue('image');
        try {
          if (typeof currentconfig == 'string') {	currentconfig = JSON.parse(currentconfig); }
        } catch(err) { currentconfig = {}; }
        value = value || {};
        value = merge.recursive(currentconfig, value);
        this.setDataValue('image', JSON.stringify(value));
      }
    },

	}, {

		hooks: {

      // onderstaand is een workaround: bij een delete wordt wel de vvalidatehook aangeroepen, maar niet de beforeValidate hook. Dat lijkt een bug.
			beforeValidate: beforeValidateHook,
      beforeDestroy: beforeValidateHook,

			afterCreate: function(instance, options) {
			//notifications.addToQueue({ type: 'idea', action: 'create', siteId: instance.siteId, instanceId: instance.id });
				// TODO: wat te doen met images
				// Product.updateImages(imageKeys, data.imageExtraData);
			},

			afterUpdate: function(instance, options) {
			//	notifications.addToQueue({ type: 'idea', action: 'update', siteId: instance.siteId, instanceId: instance.id });
				// TODO: wat te doen met images
				// Product.updateImages(imageKeys, data.imageExtraData);
			},

		},

		individualHooks: true,

		validate: {
	/*		validExtraData: function(next) {

        let self = this;
				let errors = [];
				let value = self.extraData || {}
        let validated = {};

				let configExtraData = self.config && self.config.ideas && self.config.ideas.extraData;

        function checkValue(value, config) {

				  if (config) {

            let key;
					  Object.keys(config).forEach((key) => {

              let error = false;

              // recursion on sub objects
              if (typeof value[key] == 'object' && config[key].type == 'object') {
                if (config[key].subset) {
                  checkValue(value[key], config[key].subset);
                } else {
                  errors.push(`Configuration for ${key} is incomplete`);
                }
              }

              // allowNull
						  if (config[key].allowNull === false && (typeof value[key] === 'undefined' || value[key] === '')) {
							  error = `${key} is niet ingevuld`;
						  }

              // checks op type
              if (value[key]) {
                switch (config[key].type) {

                  case 'boolean':
							      if ( typeof value[key] != 'boolean' ) {
								      error = `De waarde van ${key} is geen boolean`;
							      }
                    break;

                  case 'int':
							      if ( parseInt(value[key]) !== value[key] ) {
								      error = `De waarde van ${key} is geen int`;
							      }
                    break;

                  case 'string':
							      if ( typeof value[key] != 'string' ) {
								      error = `De waarde van ${key} is geen string`;
							      }
                    break;

                  case 'object':
							      if ( typeof value[key] != 'object' ) {
								      error = `De waarde van ${key} is geen object`;
							      }
                    break;

                  case 'arrayOfStrings':
							      if ( typeof value[key] !== 'object' || !Array.isArray(value[key]) || value[key].find(val => typeof val !== 'string') ) {
								      error = `Ongeldige waarde voor ${key}`;
							      }
                    break;

                  case 'enum':
							      if ( config[key].values.indexOf(value[key]) == -1) {
								      error = `Ongeldige waarde voor ${key}`;
							      }
                    break;

                  default:
                }
              }

              if (error) {
                validated[key] = false;
                errors.push(error)
              } else {
                validated[key] = true;
              }

					  });

            Object.keys(value).forEach((key) => {
              if (typeof validated[key] == 'undefined') {
                errors.push(`${key} is niet gedefinieerd in site.config`)
              }
            });

				  } else {
            // extra data not defined in the config
            if (!( self.config && self.config.ideas && self.config.ideas.extraDataMustBeDefined === false )) {
              errors.push(`Product.extraData is not configured in site.config`)
            }
          }
        }

        checkValue(value, configExtraData);

        if (errors.length) {
          console.log('Idea validation error:', errors);
          throw Error(errors.join('\n'));
        }

				return next();

			}*/
		},

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
    }
  }


	Product.associate = function( models ) {
    this.belongsTo(models.Account);
    this.belongsToMany(models.Tag, {through: 'productTags'});
	}

	Product.prototype.isOpen = function() {
		return this.status === 'OPEN';
	}

	return Product;

  function beforeValidateHook( instance, options ) {

		return new Promise((resolve, reject) => {
      resolve();


/*
			if (instance.siteId) {
				db.Site.findByPk(instance.siteId)
					.then( site => {
						instance.config = merge.recursive(true, config, site.config);
						return site;
					})
					.then( site => {

						// Automatically determine `endDate`
						if( instance.changed('startDate') ) {
							var duration = ( instance.config && instance.config.ideas && instance.config.ideas.duration ) || 90;
							var endDate  = moment(instance.startDate).add(duration, 'days').toDate();
							instance.setDataValue('endDate', endDate);
						}

						return resolve();

					}).catch(err => {
						throw err;
					})
			} else {
				instance.config = config;
        return resolve();
			}
*/
		});

	}

};
