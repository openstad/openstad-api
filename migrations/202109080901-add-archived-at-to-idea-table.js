var db = require('../src/db').sequelize;

/**
 *
 */
module.exports = {
  up: function () {
    try {
      return db.query(`
        ALTER TABLE \`ideas\`
        ADD COLUMN \`archivedAt\` datetime;
      `);
    } catch (e) {
      console.error('Migration:up failed:', e.message);
      return true;
    }
  },
  down: function () {
    return db.query(`
      ALTER TABLE \`ideas\`
      DROP COLUMN \`archivedAt\`;
    `);
  },
};
