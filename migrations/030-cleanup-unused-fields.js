let db = require('../src/db').sequelize;

module.exports = {
  up: function() {
    try {
      return db.query(`
        ALTER TABLE articles DROP endDate;
        ALTER TABLE ideas DROP endDate;
        ALTER TABLE ideas DROP INDEX meetingId;
        ALTER TABLE ideas DROP meetingId;
        DROP TABLE meetings;
			`);
    } catch(e) {
      return true;
    }
  }
}
