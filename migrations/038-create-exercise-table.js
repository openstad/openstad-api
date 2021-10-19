var db = require('../src/db').sequelize;

module.exports = {
  up: function() {
    try {
      return db.query(`
				CREATE TABLE exercises (
				  id int NOT NULL AUTO_INCREMENT,
				  siteId int DEFAULT '0',
				  title varchar(200) DEFAULT NULL,
				  \`slug\` varchar(210) DEFAULT NULL,
          \`level\` varchar(210) DEFAULT NULL,
          \`force\` varchar(210) DEFAULT NULL,
				  primaryMuscles varchar(210) DEFAULT NULL,
          instructions text NOT NULL,
				  mechanic varchar(210) DEFAULT NULL,
				  equipment varchar(210) DEFAULT NULL,
				  category varchar(210) DEFAULT NULL,
				  videoData json DEFAULT NULL,
          images json DEFAULT NULL,
				  createdAt datetime NOT NULL,
				  updatedAt datetime NOT NULL,
				  deletedAt datetime DEFAULT NULL,
				  PRIMARY KEY (id)
				) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8;
			`);
    } catch(e) {
      return true;
    }
  },
  down: function() {
    return db.query(`DROP TABLE exercises;`);
  }
}

