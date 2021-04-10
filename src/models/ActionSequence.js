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

        polygon: {
            type: DataTypes.GEOMETRY,
            allowNull: false,
            set: function (polygon) {
                polygon = polygon ? polygon.map(polygon => {
                    return [polygon.lat, polygon.lng];
                }) : [];

                const formattedPolygon = {"type": "Polygon", coordinates: [polygon]};

                this.setDataValue('polygon',formattedPolygon);
            },
            get: function () {
                return convertDbPolygonToLatLng(this.getDataValue('polygon'));
            }
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


    // runtype : cron, or request


    ActionSequence.auth = Area.prototype.auth = {
        listableBy: 'all',
        viewableBy: 'all',
        createableBy: ['editor','owner', 'admin'],
        updateableBy: ['editor','owner', 'admin'],
        deleteableBy: ['editor','owner', 'admin'],
        toAuthorizedJSON: function(user, data) {
            data.geoJSON = formatPolygonToGeoJson(data.polygon);
            return data;
        }
    }


    return ActionSequence;
}
