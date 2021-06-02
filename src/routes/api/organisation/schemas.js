const Joi = require('joi');

exports.createOrganisation = Joi.object({
  name: Joi.string().required(),
  street: Joi.string().required().max(2048),
  zip: Joi.string().required().max(6),
  phone: Joi.string().required().max(10),
  email: Joi.string().email().required(),
  website: Joi.string().uri(),
  facebook: Joi.string()
    .uri()
    .regex(
      /(?:(?:http|https):\/\/)?(?:www.)?(?:m.)?facebook.com\/(?:(?:\w)*#!\/)?(?:pages\/)?(?:[?\w\-]*\/)?(?:profile.php\?id=(?=\d.*))?([\w\-]*)?/m,
      {
        invert: true,
      }
    ),
  instagram: Joi.string()
    .uri()
    .regex(
      /https?:\/\/(www\.)?instagram\.com\/([A-Za-z0-9_](?:(?:[A-Za-z0-9_]|(?:\.(?!\.))){0,28}(?:[A-Za-z0-9_]))?)/,
      {
        invert: true,
      }
    ),
  areaId: Joi.number(),
  tagIds: Joi.array().items(Joi.number()).min(1).required(),

  // Contact details
  contactName: Joi.string().required(),
  contactPosition: Joi.string().required(),
  contactEmail: Joi.string().email().required(),
  contactPhone: Joi.string().min(10).max(10).required(),

  // Municipality contact details
  municipalityContactName: Joi.string().required(),
  municipalityContactEmail: Joi.string().email().required(),
  municipalityContactPhone: Joi.string().min(10).max(10).required(),
  municipalityContactStatement: Joi.string().required(),
}).options({ stripUnknown: true });

exports.updateOrganisation = Joi.object({
  name: Joi.string(),
  street: Joi.string().max(2048),
  zip: Joi.string().max(6),
  phone: Joi.string().max(10),
  email: Joi.string().email(),
  website: Joi.string().uri(),
  facebook: Joi.string()
    .uri()
    .regex(
      /(?:(?:http|https):\/\/)?(?:www.)?(?:m.)?facebook.com\/(?:(?:\w)*#!\/)?(?:pages\/)?(?:[?\w\-]*\/)?(?:profile.php\?id=(?=\d.*))?([\w\-]*)?/m,
      {
        invert: true,
      }
    ),
  instagram: Joi.string()
    .uri()
    .regex(
      /https?:\/\/(www\.)?instagram\.com\/([A-Za-z0-9_](?:(?:[A-Za-z0-9_]|(?:\.(?!\.))){0,28}(?:[A-Za-z0-9_]))?)/,
      {
        invert: true,
      }
    ),
  areaId: Joi.number(),
  tagIds: Joi.array().items(Joi.number()).min(1),
}).options({ stripUnknown: true });
