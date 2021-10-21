var db = require('../src/db').sequelize;

module.exports = {
  up: function() {
    try {
      return db.query(`
				CREATE TABLE supportChats (
				  id int NOT NULL AUTO_INCREMENT,
				  userId int DEFAULT '0',				 
          messages json DEFAULT NULL,
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

