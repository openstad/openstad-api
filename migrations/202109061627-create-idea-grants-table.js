var db = require('../src/db').sequelize;

/**
 *
 */
module.exports = {
  up: function () {
    try {
      return db.query(`CREATE TABLE \`ideaGrants\` (
        \`createdAt\` datetime NOT NULL,
        \`updatedAt\` datetime NOT NULL,
        \`grantId\` int(11) NOT NULL,
        \`ideaId\` int(11) NOT NULL,
        PRIMARY KEY (\`grantId\`,\`ideaId\`),
        KEY \`ideaId\` (\`ideaId\`),
        CONSTRAINT \`ideaGrants_ibfk_1\` FOREIGN KEY (\`grantId\`) REFERENCES \`grants\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT \`ideaGrants_ibfk_2\` FOREIGN KEY (\`ideaId\`) REFERENCES \`ideas\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8;
      `);
    } catch (e) {
      console.error('Migration:up failed:', e.message);
      return true;
    }
  },
  down: function () {
    return db.query(`
      DROP TABLE \`ideaGrants\`;
    `);
  },
};
