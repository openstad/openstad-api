module.exports = function hasPolicies(...policies) {
  return async function (req, res, next) {
    try {
      await Promise.all(
        policies.map((policy) => policy(req.user, req.site, { req, res, next }))
      );
      return next();
    } catch (error) {
      next(error);
    }
  };
};
