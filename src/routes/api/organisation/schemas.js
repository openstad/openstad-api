const Joi = require('joi');

exports.createOrganisation = Joi.object({
  name: Joi.string().required(),
  street: Joi.string().max(2048),
  zip: Joi.string().regex(/^[1-9][0-9]{3} ?(?!sa|sd|ss)[a-zA-Z]{2}$/),
  phone: Joi.string().max(10),
  district: Joi.string().required(),
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
  contactPhone: Joi.string().max(10).required(),

  // Municipality contact details
  municipalityContactName: Joi.string().required(),
  municipalityContactEmail: Joi.string().email(),
  municipalityContactPhone: Joi.string().min(10).max(10),
  municipalityContactStatement: Joi.string(),
}).options({ stripUnknown: true });

exports.updateOrganisation = Joi.object({
  name: Joi.string(),
  street: Joi.string().max(2048),
  zip: Joi.string().regex(/^[1-9][0-9]{3} ?(?!sa|sd|ss)[a-zA-Z]{2}$/),
  district: Joi.string(),
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
  tagIds: Joi.array().items(Joi.number()).min(1),
}).options({ stripUnknown: true });
