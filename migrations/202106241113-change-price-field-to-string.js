var db = require('../src/db').sequelize;

/**
 *
 */
module.exports = {
  up: function () {
    try {
      return db.query(`
        ALTER TABLE \`events\`
          MODIFY COLUMN \`price\` TEXT NULL;
      `);
    } catch (e) {
      console.error('Migration:up failed:', e.message);
      return true;
    }
  },
  down: function () {
    return db.query(`
      ALTER TABLE \`events\`
        MODIFY COLUMN \`price\` INTEGER(11) NULL;
    `);
  },
};
