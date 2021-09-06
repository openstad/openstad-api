var db = require('../src/db').sequelize;

/**
 *
 */
module.exports = {
  up: function () {
    try {
      return db.query(`CREATE TABLE \`targetAudiences\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`siteId\` int(11) NOT NULL DEFAULT '0',
        \`name\` varchar(255) NOT NULL,
        \`createdAt\` datetime NOT NULL,
        \`updatedAt\` datetime NOT NULL,
        \`deletedAt\` datetime DEFAULT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`siteId\` (\`siteId\`),
        CONSTRAINT \`target_audiences_ibfk_1\` FOREIGN KEY (\`siteId\`) REFERENCES \`sites\` (\`id\`) ON DELETE NO ACTION ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8;
      `);
    } catch (e) {
      console.error('Migration:up failed:', e.message);
      return true;
    }
  },
  down: function () {
    return db.query(`
      DROP TABLE \`targetAudiences\`;
    `);
  },
};
