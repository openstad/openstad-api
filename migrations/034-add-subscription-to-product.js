var db = require('../src/db').sequelize;

module.exports = {
    up: function() {
        try {
            return db.query(`             
			   ALTER TABLE products ADD COLUMN currency varchar(5) NOT NULL DEFAULT  'EUR';
			   ALTER TABLE products ADD COLUMN subscription tinyint(1) NOT NULL DEFAULT '0';
			   ALTER TABLE products ADD COLUMN subscriptionInterval ENUM('14 days', '12 months', '1 week', '1 month') DEFAULT '1 month';
			`);
        } catch(e) {
            return true;
        }
    },
    down: function() {
        return db.query(`ALTER TABLE accounts DROP currency;`);
    }
}
