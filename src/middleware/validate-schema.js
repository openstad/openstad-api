const createError = require('http-errors');
const Joi = require('joi');
const log = require('debug')('app:middleware/validate-schema');

/**
 * Validates an Joi schema and updates requestProperty with serialized values.
 *
 * @param {Joi.Schema} schema
 * @param {*} options
 * @returns Express handler
 */
module.exports = function validateSchema(
  schema,
  options = {
    requestProperty: 'body',
  }
) {
  if (!Joi.isSchema(schema)) {
    throw new Error('Not a valid Joi schema provided');
  }

  return async function (req, res, next) {
    try {
      // Get payload from requestProperty
      const payload = req[options.requestProperty] || {};

      log('validating payload', payload);
      const values = await schema.validateAsync(payload);

      // Override requestPropery with new values
      req[options.requestProperty] = values;

      return next();
    } catch (err) {
      // Joi errors have an array with error details
      const errorDetails = err.details.map((e) => e.message).join(', ');
      log('schema not valid', errorDetails);
      return next(createError(400, errorDetails));
    }
  };
};
