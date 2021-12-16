var db = require('../src/db').sequelize;

module.exports = {
    up: function() {
        try {
            return db.query(`
			          ALTER TABLE users ADD COLUMN chatToken varchar(255) DEFAULT '';
			      `);
        } catch(e) {
            return true;
        }
    },
    down: function() {
        return db.query(`ALTER TABLE events DROP chatToken;`);
    }
}


