var db = require('../src/db').sequelize;

module.exports = {
    up: function() {
        try {
            return db.query(`
			   ALTER TABLE events ADD siteId int(11) DEFAULT 0 AFTER id;
			`);
        } catch(e) {
            return true;
        }
    },
    down: function() {
        return db.query(`ALTER TABLE events DROP siteId;`);
    }
}


