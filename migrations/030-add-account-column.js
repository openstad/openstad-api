var db = require('../src/db').sequelize;

module.exports = {
    up: function() {
        try {
            return db.query(`
			  ALTER TABLE accounts DROP status;
			   ALTER TABLE accounts ADD COLUMN status ENUM('trial', 'active', 'denied', 'closed') DEFAULT 'trial';
			  ALTER TABLE accounts ADD COLUMN paymentStatus ENUM('failed','paid','none')  DEFAULT 'none';
			`);
        } catch(e) {
            return true;
        }
    },
    down: function() {
        return db.query(`ALTER TABLE accounts DROP paymentStatus;`);
    }
}
