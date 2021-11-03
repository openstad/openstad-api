let db = require('../src/db').sequelize;

module.exports = {
  up: function() {
    try {
      return db.query(`
        DROP TABLE meetings;
        ALTER TABLE articles DROP duration;
        ALTER TABLE articles DROP endDate;
        ALTER TABLE ideas DROP duration;
        ALTER TABLE ideas DROP endDate;
			`);
    } catch(e) {
      return true;
    }
  }
}
