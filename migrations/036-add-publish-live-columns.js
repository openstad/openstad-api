var db = require('../src/db').sequelize;

module.exports = {
    up: function() {
        try {
            return db.query(`
			          ALTER TABLE tours ADD COLUMN lastPublishedAt datetime NULL DEFAULT NULL;
			          ALTER TABLE tours ADD COLUMN versionNumber INT NULL DEFAULT NULL;
			      `);
        } catch(e) {
            return true;
        }
    },
    down: function() {
        return db.query(`ALTER TABLE tours DROP lastPublishedAt; ALTER TABLE tours DROP versionNumber;'`);
    }
}
