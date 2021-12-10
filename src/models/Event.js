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
            allowNull: true,
        },

        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },

        userId : {
            type         : DataTypes.INTEGER,
            defaultValue : 0,
        },

        siteId : {
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
        },

        notified: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        }

    });

    Event.associate = function( models ) {
        this.belongsTo(models.User);
    }


    Event.auth = Event.prototype.auth = {
        listableBy:  ['moderator','owner', 'admin'],
        viewableBy: ['moderator','owner', 'admin'],
        createableBy: ['editor','owner', 'admin'],
        updateableBy: ['editor','owner', 'admin'],
        deleteableBy: ['editor','owner', 'admin'],
    }

    Event.scopes = () => {
        return {
            includeUser: {
                include: [{
                    model: db.User,
                    attributes: ['id', 'role', 'firstName', 'lastName']
                }]
            },
        }
    }



    return Event;
}
