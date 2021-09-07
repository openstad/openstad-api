const Joi = require('joi');

exports.createGrant = Joi.object({
    name: Joi.string().required(),
    url: Joi.string().uri()
}).options({ stripUnknown: true })

exports.updateGrant = Joi.object({
    name: Joi.string(),
    url: Joi.string().uri()
}).options({ stripUnknown: true })