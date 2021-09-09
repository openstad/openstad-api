const Joi = require('joi');

exports.createGrant = Joi.object({
    name: Joi.string().required(),
    url: Joi.string().allow(null, '').uri()
}).options({ stripUnknown: true })

exports.updateGrant = Joi.object({
    name: Joi.string(),
    url: Joi.string().allow(null, '').uri()
}).options({ stripUnknown: true })