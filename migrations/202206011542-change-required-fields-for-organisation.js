var db = require('../src/db').sequelize;

/**
 *
 */
module.exports = {
  up: function () {
    try {
      return db.query(`
        ALTER TABLE \`organisations\`
          MODIFY COLUMN \`phone\` VARCHAR(10) NULL;
        ALTER TABLE \`organisations\`
          MODIFY COLUMN \`email\` VARCHAR(255) NULL;
        ALTER TABLE \`organisations\`
          MODIFY COLUMN \`municipalityContactName\` VARCHAR(255) NULL;
      `);
    } catch (e) {
      console.error('Migration:up failed:', e.message);s
      return true;
    }
  },
  down: function () {
    return db.query(`
        ALTER TABLE \`organisations\`
          MODIFY COLUMN \`phone\` VARCHAR(10) NOT NULL;
        ALTER TABLE \`organisations\`
          MODIFY COLUMN \`email\` VARCHAR(255) NOT NULL;
        ALTER TABLE \`organisations\`
          MODIFY COLUMN \`municipalityContactName\` VARCHAR(255) NOT NULL;
    `);
  },
};
