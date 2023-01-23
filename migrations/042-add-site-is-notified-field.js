let db = require('../src/db').sequelize;

module.exports = {
  up: function() {

    try {
      return db.query(`
        ALTER TABLE sites ADD adminIsNotified DATETIME NULL DEFAULT NULL AFTER areaId; 
			`);
    } catch(e) {
      return true;
    }

  }
}
