var db = require('../src/db').sequelize;

module.exports = {
	up: function() {
		try {
			return db.query(`
			  CREATE TABLE \`events\` (
			  \`id\` int NOT NULL AUTO_INCREMENT,
			  \`status\` enum('activity','error','log','warning','update') NOT NULL DEFAULT 'log',
			  \`message\` varchar(255) NOT NULL,
			  \`name\` varchar(255) NOT NULL,
			  \`userId\` int DEFAULT '0',
			  \`resourceId\` int DEFAULT '0',
			  \`resourceType\` varchar(255) NOT NULL,
			  \`extraData\` json DEFAULT NULL,
			  \`createdAt\` datetime NOT NULL,
			  \`updatedAt\` datetime NOT NULL,
			  \`deletedAt\` datetime DEFAULT NULL,
			  PRIMARY KEY (\`id\`),
			  KEY \`userId\` (\`userId\`),
			  CONSTRAINT \`events_ibfk_1\` FOREIGN KEY (\`userId\`) REFERENCES \`users\` (\`id\`) ON UPDATE CASCADE
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
			`);
		} catch(e) {
			return true;
		}
	},
	down: function() {
		return db.query(`ALTER TABLE choicesGuideQuestions DROP moreInfo;`);
	}
}
