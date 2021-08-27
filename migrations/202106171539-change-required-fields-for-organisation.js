var db = require('../src/db').sequelize;

/**
 *
 */
module.exports = {
  up: function () {
    try {
      return db.query(`
        ALTER TABLE \`organisations\`
          MODIFY COLUMN \`street\` VARCHAR(255) NULL;
        ALTER TABLE \`organisations\`
          MODIFY COLUMN \`zip\` VARCHAR(10) NULL;
        ALTER TABLE \`organisations\`
          MODIFY COLUMN \`municipalityContactEmail\` VARCHAR(255) NULL;
        ALTER TABLE \`organisations\`
          MODIFY COLUMN \`municipalityContactPhone\` VARCHAR(10) NULL;
        ALTER TABLE \`organisations\`
          MODIFY COLUMN \`municipalityContactStatement\` TEXT NULL;
      `);
    } catch (e) {
      console.error('Migration:up failed:', e.message);
      return true;
    }
  },
  down: function () {
    return db.query(`
      ALTER TABLE \`organisations\`
        MODIFY COLUMN \`street\` VARCHAR(255) NOT NULL;
      ALTER TABLE \`organisations\`
        MODIFY COLUMN \`zip\` VARCHAR(10) NOT NULL;
      ALTER TABLE \`organisations\`
        MODIFY COLUMN \`municipalityContactEmail\` VARCHAR(255) NOT NULL;
      ALTER TABLE \`organisations\`
        MODIFY COLUMN \`municipalityContactPhone\` VARCHAR(10) NOT NULL;
      ALTER TABLE \`organisations\`
        MODIFY COLUMN \`municipalityContactStatement\` TEXT NOT NULL;
    `);
  },
};
