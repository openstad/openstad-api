const hasRole = require('../lib/hasRole');

module.exports = function can(action, user, self, hash) {

  self = self || this;

  if (!user) user = self.auth && self.auth.user;
  if (!user || !user.role) user = { role: 'all' };



  // use function defined on model
  let functionName = 'can' + action[0].toUpperCase() + action.slice(1);


  // in case a hash comes from browser, pass it along to see if it's listed as a valid method
  // not all models have this hash property
  const isValidHash  = self.hash && self.hash === hash;
  console.log('isValidHash', isValidHash);
  console.log('external hash', hash);
  console.log(' self.hash',  self.hash);

  if (self.auth && typeof self.auth[functionName] == 'function') return self.auth[functionName](user, self, isValidHash);

  // or fallback to default
  switch (action) {

    case 'list':
      return hasRole(user, self.auth && self.auth.listableBy, self.userId, isValidHash);
      break;

    case 'create':
      return hasRole(user, self.auth && self.auth.createableBy, self.userId, isValidHash);
      break;

    case 'view':
      return hasRole(user, self.auth && self.auth.viewableBy, self.userId, isValidHash);
      break;

    case 'update':
      return hasRole(user, self.auth && self.auth.updateableBy, self.userId, isValidHash);
      break;

    case 'delete':
      return hasRole(user, self.auth && self.auth.deleteableBy, self.userId, isValidHash);
      break;

    default:
      return false;
  }

}
