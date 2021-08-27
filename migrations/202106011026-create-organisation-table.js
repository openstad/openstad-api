var db = require('../src/db').sequelize;

/**
 * @todo: Fix constraints
 */
module.exports = {
  up: function () {
    try {
      return db.query(`
        CREATE TABLE IF NOT EXISTS \`organisations\` (
          \`id\` INTEGER NOT NULL auto_increment, 
          \`siteId\` INTEGER DEFAULT 0, 
          \`name\` VARCHAR(255) NOT NULL, 
          \`street\` VARCHAR(255) NOT NULL, 
          \`zip\` VARCHAR(10) NOT NULL, 
          \`district\` VARCHAR(255) NOT NULL, 
          \`phone\` VARCHAR(10) NOT NULL, 
          \`email\` VARCHAR(255) NOT NULL, 
          \`website\` VARCHAR(2048), 
          \`facebook\` VARCHAR(2048), 
          \`instagram\` VARCHAR(2048), 
          \`contactName\` VARCHAR(255) NOT NULL,
          \`contactPosition\` VARCHAR(255) NOT NULL,
          \`contactEmail\` VARCHAR(255) NOT NULL,
          \`contactPhone\` VARCHAR(10) NOT NULL,
          \`municipalityContactName\` VARCHAR(255) NOT NULL,
          \`municipalityContactEmail\` VARCHAR(255) NOT NULL,
          \`municipalityContactPhone\` VARCHAR(10) NOT NULL,
          \`municipalityContactStatement\` TEXT NOT NULL,
          \`createdAt\` DATETIME NOT NULL, 
          \`updatedAt\` DATETIME NOT NULL, 
          \`deletedAt\` DATETIME, 
          PRIMARY KEY (\`id\`), 
          FOREIGN KEY (\`siteId\`) REFERENCES \`sites\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
        )
        ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        ALTER TABLE \`users\` 
          ADD COLUMN \`organisationId\` INTEGER;
        
        ALTER TABLE \`users\`
          ADD CONSTRAINT \`organisation_fk\` FOREIGN KEY (\`organisationId\`) REFERENCES organisations (\`id\`)
          ON DELETE SET NULL 
          ON UPDATE CASCADE;

        CREATE TABLE IF NOT EXISTS \`organisationTags\` (
          \`organisationId\` INTEGER,
          \`tagId\` INTEGER,
          \`createdAt\` DATETIME NOT NULL, 
          \`updatedAt\` DATETIME NOT NULL, 
          PRIMARY KEY (\`organisationId\`, \`tagId\`), 
          FOREIGN KEY (\`organisationId\`) REFERENCES \`organisations\` (\`id\`) ON UPDATE CASCADE,
          FOREIGN KEY (\`tagId\`) REFERENCES \`tags\` (\`id\`) ON UPDATE CASCADE
        )
        ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
			`);
    } catch (e) {
      console.error('Migration:up failed:', e.message);
      return true;
    }
  },
  down: function () {
    return db.query(`
      DROP TABLE \`organisationTags\`;
      
      ALTER TABLE \`users\`
        DROP FOREIGN KEY \`organisation_fk\`;
      
      ALTER TABLE \`users\`
        DROP COLUMN \`organisationId\`;

      DROP TABLE \`organisations\`;
    `);
  },
};
