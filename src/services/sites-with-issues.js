const Sequelize = require('sequelize');
const db = require('../db');

let sitesWithIssues = {};

sitesWithIssues.shouldHaveEndedButAreNot = function({ offset, limit }) {
  return db.Site
    .findAndCountAll({
      offset, limit,
      attributes: { 
        include: [
          [Sequelize.literal('"Site endDate is in the past but projectHasEnded is not set"'), 'issue'],
        ],
      },
      where: {
        [Sequelize.Op.and]: [
          {
            config: {
              project: {
                endDate: {
                  [Sequelize.Op.not]: null
                }
              }
            }
          }, {
            config: {
              project: {
                endDate: {
                  [Sequelize.Op.lte]: new Date(),
                }
              }
            }
          }, {
            config: {
              project: {
                projectHasEnded: false,
              }
            }
          }              
        ]
      }
    })
}

sitesWithIssues.endedButNotAnonymized = function({ offset, limit }) {
  return db.Site
    .findAndCountAll({
      offset, limit,
      attributes: { 
        include: [
          [Sequelize.literal('"Project has ended but is not yet anonymized"'), 'issue'],
          [Sequelize.fn("COUNT", Sequelize.col("users.id")), "userCount"]
        ],
      },
      include: [{
        model: db.User,
        attributes: [],
        where: {
          role: 'member',
        }
      }],
      group: ['users.siteId'],
      where: {
        [Sequelize.Op.and]: [
          // where site enddate is more then anonymizeUsersXDaysAfterEndDate days ago
          Sequelize.literal("DATE_ADD(CAST(JSON_UNQUOTE(JSON_EXTRACT(site.config,'$.project.endDate')) as DATETIME), INTERVAL json_extract(site.config, '$.anonymize.anonymizeUsersXDaysAfterEndDate') DAY) < NOW()"),
          { config: { project: { projectHasEnded: true } } },
        ]
      }
    })
}

module.exports = exports = sitesWithIssues;
