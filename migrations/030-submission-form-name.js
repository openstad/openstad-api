var db = require('../src/db').sequelize;

module.exports = {
  up: function() {
    try {
      return db.query(`
			  ALTER TABLE submissions ADD formName VARCHAR(255) NULL AFTER userId;
			`);
    } catch(e) {
      return true;
    }
  },
  down: function() {
    return db.query(`ALTER TABLE submissions DROP formName;`);
  }
}
