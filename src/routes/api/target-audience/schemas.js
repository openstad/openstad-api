const Joi = require('joi');

exports.createTargetAudience = Joi.object({
    name: Joi.string().required()
}).options({ stripUnknown: true })

exports.updateTargetAudience = Joi.object({
    name: Joi.string()
}).options({ stripUnknown: true })