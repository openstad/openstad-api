var db = require('../src/db').sequelize;

/**
 * @todo: Fix constraints
 */
module.exports = {
  up: function () {
    try {
      return db.query(`
      CREATE TABLE \`events\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`siteId\` int(11) NOT NULL DEFAULT '0',
        \`name\` varchar(255) NOT NULL,
        \`description\` text NOT NULL,
        \`location\` point NOT NULL,
        \`district\` varchar(255) NOT NULL,
        \`minAge\` int(11) NOT NULL,
        \`maxAge\` int(11) NOT NULL,
        \`price\` int(11) DEFAULT '0',
        \`attendees\` int(11) DEFAULT NULL,
        \`information\` varchar(255) DEFAULT NULL,
        \`image\` varchar(2048) NOT NULL,
        \`createdAt\` datetime NOT NULL,
        \`updatedAt\` datetime NOT NULL,
        \`deletedAt\` datetime DEFAULT NULL,
        \`organisationId\` int(11) DEFAULT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`siteId\` (\`siteId\`),
        KEY \`organisationId\` (\`organisationId\`),
        CONSTRAINT \`events_ibfk_1\` FOREIGN KEY (\`siteId\`) REFERENCES \`sites\` (\`id\`) ON DELETE NO ACTION ON UPDATE CASCADE,
        CONSTRAINT \`events_ibfk_2\` FOREIGN KEY (\`organisationId\`) REFERENCES \`organisations\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8;

      CREATE TABLE \`eventTag\` (
        \`createdAt\` datetime NOT NULL,
        \`updatedAt\` datetime NOT NULL,
        \`eventId\` int(11) NOT NULL,
        \`tagId\` int(11) NOT NULL,
        PRIMARY KEY (\`eventId\`,\`tagId\`),
        KEY \`tagId\` (\`tagId\`),
        CONSTRAINT \`eventTag_ibfk_1\` FOREIGN KEY (\`eventId\`) REFERENCES \`events\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT \`eventTag_ibfk_2\` FOREIGN KEY (\`tagId\`) REFERENCES \`tags\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8;

      CREATE TABLE \`eventTimeslots\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`startTime\` datetime NOT NULL,
        \`endTime\` datetime NOT NULL,
        \`createdAt\` datetime NOT NULL,
        \`updatedAt\` datetime NOT NULL,
        \`deletedAt\` datetime DEFAULT NULL,
        \`eventId\` int(11) DEFAULT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`eventId\` (\`eventId\`),
        CONSTRAINT \`eventTimeslots_ibfk_1\` FOREIGN KEY (\`eventId\`) REFERENCES \`events\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8;
			`);
    } catch (e) {
      console.error('Migration:up failed:', e.message);
      return true;
    }
  },
  down: function () {
    return db.query(`
      DROP TABLE \`eventTimeslots\`;
      DROP TABLE \`eventTags\`;
      DROP TABLE \`events\`;
    `);
  },
};
