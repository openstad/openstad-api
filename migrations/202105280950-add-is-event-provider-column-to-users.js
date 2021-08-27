var db = require('../src/db').sequelize;

module.exports = {
	up: function() {
		try {
			return db.query(`
			  ALTER TABLE users ADD isEventProvider tinyint(1) NOT NULL DEFAULT '0' AFTER zipCode;
			`);
		} catch(e) {
			return true;
		}
	},
	down: function() {
		return db.query(`ALTER TABLE users DROP isEventProvider;`);
	}
}
