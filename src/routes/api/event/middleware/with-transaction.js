const db = require('../../../../db');

module.exports = async function withTransaction(req, res, next) {
  try {
    res.locals.transaction = transaction = await db.sequelize.transaction();
    return next();
  } catch (err) {
    return next(err);
  }
};
