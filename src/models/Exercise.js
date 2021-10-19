const convertDbPolygonToLatLng = require ('../util/convert-db-polygon-to-lat-lng');
const {formatPolygonToGeoJson} = require('../util/geo-json-formatter');

module.exports = function( db, sequelize, DataTypes ) {
  var Exercise = sequelize.define('exercise', {
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    level: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    force: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    primaryMuscles: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    instructions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    mechanic: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    equipment: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    videoData: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    images: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  });

  Exercise.associate = function( models ) {
    this.hasMany(models.Site);
  }


  Exercise.auth = Exercise.prototype.auth = {
    listableBy: 'all',
    viewableBy: 'all',
    createableBy: ['editor','owner', 'admin'],
    updateableBy: ['editor','owner', 'admin'],
    deleteableBy: ['editor','owner', 'admin'],
    toAuthorizedJSON: function(user, data) {
      return data;
    }
  }

  return Exercise;
}
