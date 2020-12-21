// ----------------------------------------------------------------------------------------------------
// check action on user roles
// ----------------------------------------------------------------------------------------------------

const config = require('config');
const db     = require('../../../db'); // TODO: dit moet dus anders

/**
 * Add authenticated user to the results object
 * to ensure when toAuthorizedJSON is called
 */
module.exports = function useReqUser( req, res, next ) {

  let results = req.results;

  console.log('use req users')

  if (Array.isArray(req.results)) {
    req.results.forEach( result => {
      result.auth = result.auth || {};
      result.auth.user = req.user;
      result.queryHash = req.query.hash;
    });
  } else {
    if (req.results) {
      req.results.auth = req.results.auth || {};
      req.results.auth.user = req.user;
      req.results.queryHash = req.query.hash;
    };
  }

  return next();
}
