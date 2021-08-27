module.exports = function (db, sequelize, DataTypes) {
  const OrganisationTag = sequelize.define(
    'organisationTag',
    {},
    {
      paranoid: false,
    }
  );

  // Organisation.auth = Organisation.prototype.auth = {
  //   listableBy: 'all',
  //   viewableBy: 'all',
  //   createableBy: 'editor',
  //   updateableBy: ['editor', 'owner'],
  //   deleteableBy: ['editor', 'owner'],
  // };

  // Organisation.sync()
  //   .then(() => log('synced organisation'))
  //   .catch(console.error);

  return OrganisationTag;
};
