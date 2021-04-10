const convertDbPolygonToLatLng = require ('../util/convert-db-polygon-to-lat-lng');
const {formatPolygonToGeoJson} = require('../util/geo-json-formatter');

module.exports = function( db, sequelize, DataTypes ) {
    var ActionSequence = sequelize.define('area', {
        id: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },

        siteId: {
            type         : DataTypes.INTEGER,
            defaultValue : config.siteId && typeof config.siteId == 'number' ? config.siteId : 0,
        },

        accountId: {
            type         : DataTypes.INTEGER,
            defaultValue : config.siteId && typeof config.siteId == 'number' ? config.siteId : 0,
        },

        /*
        Virtual field would be a nice way to manage the geoJSON version of the data
        geoJSON: {
          type: DataTypes.VIRTUAL,
          get: function () {
            return formatPolygonToGeoJson(this.getDataValue('polygon'))
          }
        },
        */
    });

    ActionSequence.associate = function( models ) {
        this.belongsTo(models.Site);
        this.belongsTo(models.Account);
    }

    ActionSequence.auth = Area.prototype.auth = {
        listableBy: 'all',
        viewableBy: 'all',
        createableBy: ['editor','owner', 'admin'],
        updateableBy: ['editor','owner', 'admin'],
        deleteableBy: ['editor','owner', 'admin'],
        toAuthorizedJSON: function(user, data) {
            return data;
        }
    }


    return ActionSequence;
}
