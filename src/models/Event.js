const convertDbPolygonToLatLng = require ('../util/convert-db-polygon-to-lat-lng');
const {formatPolygonToGeoJson} = require('../util/geo-json-formatter');


module.exports = function( db, sequelize, DataTypes ) {
    var Event = sequelize.define('event', {
        status: {
            type         : DataTypes.ENUM('activity', 'error', 'log', 'warning', 'update'),
            defaultValue : 'log',
            allowNull    : false
        },

        message: {
            type: DataTypes.STRING,
            allowNull: false,
        },

        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },

        userId : {
            type         : DataTypes.INTEGER,
            defaultValue : 0,
        },

        resourceId : {
            type         : DataTypes.INTEGER,
            defaultValue : 0,
        },

        resourceType: {
            type: DataTypes.STRING,
            allowNull: false,
        },

        extraData : {
            type: DataTypes.JSON,
            allowNull : true,
            defaultValue : {},
        }
    });

    Event.associate = function( models ) {
        this.belongsTo(models.User);
    }


    Event.auth = Event.prototype.auth = {
        listableBy: 'admin',
        viewableBy: 'admin',
        createableBy: ['editor','owner', 'admin'],
        updateableBy: ['editor','owner', 'admin'],
        deleteableBy: ['editor','owner', 'admin'],
        toAuthorizedJSON: function(user, data) {
            return data;
        }
    }


    return Event;
}
