const roles = require('./roles');

module.exports = function hasRole(user, minRoles, ownerId, isValidHash) {

  minRoles = minRoles || 'admin'; // admin can do anything
  if (!Array.isArray(minRoles)) minRoles = [minRoles];

  let userRole = user && user.role;

  let valid = minRoles.find( minRole => {
    let x = roles[userRole] && roles[userRole].indexOf(minRole) != -1
    return x;
  });

  if (minRoles.includes('owner') && ownerId) {
    valid = valid || ( user.id == ownerId );
  }

  // hash is a somewhat weird role, but t
  if (minRoles.includes('hash') && isValidHash) {
    valid = true;
  }

  return valid
}
