const createError = require('http-errors');
const { isEmpty } = require('lodash');
const log = require('debug')(
  'app:api-organisation/can-create-organisation-policy'
);

const isEventProvider = require('./is-event-provider');

/**
 * Check if user can create an organisation.
 * @returns boolean
 * @throws Error
 */
async function canCreateOrganisationPolicy(user, site) {
  // Check is user is an event provider
  // await isEventProvider(user, site);
  log('isEmpty:', isEmpty(user))
  if (isEmpty(user)) {
    throw createError(400, 'Niet ingelogd')
  }

  // Check for existing organisation
  const hasNoOrganisation = !user.organisationId;
  if (!hasNoOrganisation) {
    throw createError(400, 'Je hebt al een organisatie');
  }

  return true;
}

/**
 * Middleware wrapper arround policy
 *
 * @param {*} req
 * @param {*} res
 * @param {*} next
 * @returns Express handler
 */
canCreateOrganisationPolicy.middleware = async function (req, res, next) {
  log('checking for permissions...');
  try {
    await canCreateOrganisationPolicy(req.user, req.site);
    log('allowed');
    return next();
  } catch (error) {
    log('no permission');
    return next(error);
  }
};

module.exports = canCreateOrganisationPolicy;
