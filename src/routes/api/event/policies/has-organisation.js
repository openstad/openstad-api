const createHttpError = require('http-errors');

module.exports = async function hasOrganisation(user) {
  if (!user.organisationId) {
    throw createHttpError(400, 'Je bent geen onderdeel van een organisatie');
  }
  return true;
};
