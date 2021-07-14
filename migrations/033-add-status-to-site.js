var db = require('../src/db').sequelize;

module.exports = {
    up: function() {
        try {
            return db.query(`
			   ALTER TABLE sites ADD COLUMN status ENUM('concept', 'published', 'denied', 'archived') DEFAULT 'concept';
			`);
        } catch(e) {
            return true;
        }
    },
    down: function() {
        return db.query(`ALTER TABLE accounts DROP paymentStatus;`);
    }
}


