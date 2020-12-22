// ----------------------------------------------------------------------------------------------------
// check action on user roles
// ----------------------------------------------------------------------------------------------------

const config = require('config');
const db     = require('../../../db'); // TODO: dit moet dus anders

module.exports = function can(modelname, action) {
  return function( req, res, next ) {
    const model = db[modelname];
    if (!model) throw new Error('Model ' + modelname + ' not found');

    const can = model.can(action, req.user, req.results, req.query.hash);
    if (!can) return next(new Error('You cannot ' + action + ' this ' + modelname));
    return next();
  }

}
