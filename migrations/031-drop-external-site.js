let db = require('../src/db').sequelize;

module.exports = {
  up: function() {
    try {
      return db.query(`
        DROP TABLE IF EXISTS externalSites;
			`);
    } catch(e) {
      return true;
    }
  }
}
