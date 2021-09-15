var db = require('../src/db').sequelize;

module.exports = {
	up: function() {
		return db.query(`
		  ALTER TABLE users ADD externalRefreshToken VARCHAR(2048) NULL AFTER externalAccessToken;
		`);
	},
	down: function() {
		return db.query(`ALTER TABLE users DROP externalRefreshToken;`);
	}
}
