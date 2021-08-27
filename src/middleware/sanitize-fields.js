const log = require('debug')('app:middleware/sanitize-fields');
const sanitize = require('../util/sanitize');

module.exports = function sanitizeFields(...fields) {
  return function (req, res, next) {
    try {
      log('sanitzing fields', fields);
      fields.forEach((fieldName) => {
        if (req.body[fieldName]) {
          req.body[fieldName] = sanitize.content(req.body[fieldName]);
        }
      });
      return next();
    } catch (err) {
      return next(err);
    }
  };
};
