module.exports = function( req, res, next ) {
  const publishAsConcept = req.body.publishAsConcept;

  if(publishAsConcept === undefined || publishAsConcept === null) {
    return next();
  } else if (!publishAsConcept) {
    req.body['publishDate'] = new Date();
  } else {
    req.body['publishDate'] = null;
  }
    return next();
}