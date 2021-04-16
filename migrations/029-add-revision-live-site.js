var db = require('../src/db').sequelize;

module.exports = {
	up: function() {
		try {
			return db.query(`
			  	ALTER TABLE sites ADD COLUMN revisions JSON NULL AFTER domain;
				ALTER TABLE sites ADD COLUMN live JSON NULL AFTER domain;
				ALTER TABLE sites ADD COLUMN type enum('app','site') NOT NULL DEFAULT 'site' AFTER domain;
			`);
		} catch(e) {
			return true;
		}
	},
	down: function() {
		return db.query(`ALTER TABLE sites DROP revisions; ALTER TABLE sites DROP live;  ALTER TABLE sites DROP type;`);
	}
}
