module.exports = function( db, sequelize, DataTypes ) {
  var SupportChat = sequelize.define('supportChats', {

    id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },

    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    messages: {
      type: DataTypes.JSON,
      allowNull		 : true,
      defaultValue : null,
    },
  });

  SupportChat.associate = function( models ) {
    this.belongsTo(models.User);
  }

  SupportChat.auth = Chats.prototype.auth = {
    listableBy:  ['editor','owner', 'admin'],
    viewableBy:  ['editor','owner', 'admin'],
    createableBy: ['editor','owner', 'admin'],
    updateableBy: ['editor','owner', 'admin'],
    deleteableBy: ['editor','owner', 'admin'],
    toAuthorizedJSON: function(user, data) {
      return data;
    }
  }

  return Chats;
}
