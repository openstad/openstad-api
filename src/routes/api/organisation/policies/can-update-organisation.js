const createError = require('http-errors');
const log = require('debug')(
  'app:api-organisation/can-update-organisation-policy'
);

const isEventProvider = require('./is-event-provider');

/**
 * Check if user can update an organisation.
 * @returns boolean
 * @throws Error
 */
async function canUpdateOrganisationPolicy(organisationId, user, site) {
  // Check is user is an event provider
  await isEventProvider(user, site);

  // You can only update your own organisation unless you are an admin
  if (
    user.role !== 'admin' &&
    user.organisationId !== parseInt(organisationId)
  ) {
    throw createError(403, 'Je kunt deze organisatie niet aanpassen');
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
canUpdateOrganisationPolicy.middleware = async function (req, res, next) {
  log('checking for permissions...');
  try {
    await canUpdateOrganisationPolicy(
      req.params.organisationId,
      req.user,
      req.site
    );
    log('allowed');
    return next();
  } catch (error) {
    log('no permission');
    return next(error);
  }
};

module.exports = canUpdateOrganisationPolicy;
