var db = require('../src/db').sequelize;

/**
 * @todo: Fix constraints
 */
module.exports = {
  up: function () {
    try {
      return db.query(`
        ALTER TABLE \`events\` 
          MODIFY COLUMN \`information\` TEXT;
      `);
    } catch (e) {
      console.error('Migration:up failed:', e.message);
      return true;
    }
  },
  down: function () {
    return db.query(`
      ALTER TABLE \`events\` 
        MODIFY COLUMN \`information\` VARCHAR(255);
    `);
  },
};
