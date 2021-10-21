var db = require('../src/db').sequelize;

/**
 *
 */
module.exports = {
  up: function () {
    try {
      return db.query(`
      CREATE TABLE \`eventUserFavorites\` (
        \`createdAt\` datetime NOT NULL,
        \`updatedAt\` datetime NOT NULL,
        \`eventId\` int(11) NOT NULL,
        \`userId\` int(11) NOT NULL,
        PRIMARY KEY (\`eventId\`,\`userId\`),
        KEY \`userId\` (\`userId\`),
        CONSTRAINT \`eventUserFavorites_ibfk_1\` FOREIGN KEY (\`eventId\`) REFERENCES \`events\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT \`eventUserFavorites_ibfk_2\` FOREIGN KEY (\`userId\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8;
      `);
    } catch (e) {
      console.error('Migration:up failed:', e.message);
      return true;
    }
  },
  down: function () {
    return db.query(`
      DROP TABLE \`eventUserFavorites\`;
    `);
  },
};
