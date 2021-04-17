var db = require('../src/db').sequelize;

module.exports = {
    up: function() {
        try {
            return db.query(`
			  ALTER TABLE sites ADD COLUMN accountId int(11) DEFAULT '0';
			`);
        } catch(e) {
            return true;
        }
    },
    down: function() {
        return db.query(`ALTER TABLE accounts DROP paymentStatus;`);
    }
}
