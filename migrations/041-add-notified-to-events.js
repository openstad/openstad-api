var db = require('../src/db').sequelize;

module.exports = {
    up: function() {
        try {
            return db.query(`
			   ALTER TABLE events ADD COLUMN notified tinyint(1) NOT NULL DEFAULT '0';
			`);
        } catch(e) {
            return true;
        }
    },
    down: function() {
        return db.query(`ALTER TABLE events DROP siteId;`);
    }
}


