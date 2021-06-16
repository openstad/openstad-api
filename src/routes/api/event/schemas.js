const Joi = require('joi');

exports.createEvent = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  location: Joi.object().keys({
    type: Joi.string().required().valid('Point'),
    coordinates: Joi.array()
      .ordered(
        Joi.number().min(-180).max(180).required(),
        Joi.number().min(-90).max(90).required()
      )
      .required(),
  }),
  district: Joi.string().required(),
  minAge: Joi.number().required(),
  maxAge: Joi.number().required(),
  price: Joi.number().required(),
  attendees: Joi.number().required(),
  information: Joi.string().allow('', null),
  image: Joi.string().uri().required(),
  slots: Joi.array()
    .items(
      Joi.object({
        startTime: Joi.date().iso().greater('now').required(),
        endTime: Joi.date().iso().greater(Joi.ref('startTime')).required(),
      })
    )
    .min(1)
    .required(),
  tagIds: Joi.array().items(Joi.number()).min(1).required(),
}).options({ stripUnknown: true });

exports.patchEvent = Joi.object({
  name: Joi.string(),
  description: Joi.string(),
  location: Joi.object().keys({
    type: Joi.string().required().valid('Point'),
    coordinates: Joi.array().ordered(
      Joi.number().min(-180).max(180).required(),
      Joi.number().min(-90).max(90).required()
    ),
  }),
  district: Joi.string(),
  minAge: Joi.number(),
  maxAge: Joi.number(),
  price: Joi.number(),
  attendees: Joi.number(),
  information: Joi.string().allow('', null),
  image: Joi.string().uri(),
  slots: Joi.array()
    .items(
      Joi.object({
        id: Joi.number(),
        startTime: Joi.date().iso().greater('now'),
        endTime: Joi.date().iso().greater(Joi.ref('startTime')),
      })
    )
    .min(1),
  tagIds: Joi.array().items(Joi.number()).min(1),
}).options({ stripUnknown: true });

exports.queryEvents = Joi.object({
  page: Joi.number().default(0),
  organisationId: Joi.number(),
  q: Joi.string().allow(null, ''),
  dates: Joi.alternatives().try(Joi.array().items(Joi.date()), Joi.date()),
  tagIds: Joi.alternatives().try(Joi.array().items(Joi.number()), Joi.number()),
  districts: Joi.alternatives().try(
    Joi.array().items(Joi.string()),
    Joi.string()
  ),
}).options({ stripUnknown: true });
