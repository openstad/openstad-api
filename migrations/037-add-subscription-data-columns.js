var db = require('../src/db').sequelize;

module.exports = {
  up: function() {
    try {
      return db.query(`
			      ALTER TABLE users ADD COLUMN siteData JSON NULL;
				    ALTER TABLE users ADD COLUMN subscriptionData JSON NULL;
			`);
    } catch(e) {
      return true;
    }
  },
  down: function() {
    return db.query(`ALTER TABLE tours DROP lastPublishedAt; ALTER TABLE tours DROP versionNumber;'`);
  }
}
