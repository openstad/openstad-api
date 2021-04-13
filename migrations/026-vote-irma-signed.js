var db = require('../src/db').sequelize;

module.exports = {
	up: function() {
		try {
			return db.query(`
        ALTER TABLE votes ADD irmaSignedVote TEXT NULL DEFAULT NULL AFTER checked; 
			`);
		} catch(e) {
			return true;
		}
	},
	down: function() {
		return db.query(`ALTER votes DROP irmaSignedVote;`);
	}
}
