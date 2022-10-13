const { Sequelize, Op } = require('sequelize');
const log = require('debug')('app:cron');
const config = require('config');
const Notifications = require('../notifications');
const db = require('../db');
const UseLock = require('../lib/use-lock');

// Purpose
// -------
// Send emails to projectmanagers just before the enddate of their project is reached
// 
// Runs every day
module.exports = {
	cronTime: '*/10 * * * * *',
	runOnInit: true,
	// cronTime: '0 30 4 * * *',
	// runOnInit: false,
	onTick: UseLock.createLockedExecutable({
    name: 'send-enddate-notifications',
    task: async (next) => {

      let endDateConfig = config.notifications.sendEndDateNotifications;

      try {

        // for each site
        let targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - endDateConfig.XDaysBefore);
				let sites = await db.Site.findAll({
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
                    endDate: {
                      [Sequelize.Op.gte]: targetDate,
                    }
                  }
                }
//              }, {
//                config: {
//                  project: {
//                    endDateNotificationSent: false
//                  }
//                }
              }, {
                config: {
                  projectHasEnded: false,
                }
              }
            ]
          }
        });
				for (let i=0; i < sites.length; i++) {
					let site = sites[i];

          if (!site.config.project.endDateNotificationSent) { // todo: the where clause above does not work for reasons I do not have time for now

            let data = {
              from: site.config.notifications.fromAddress,
              to: site.config.notifications.projectmanagerAddress,
              subject:  endDateConfig.subject,
              template:  endDateConfig.template,
            };

					  // send notification
					  console.log('CRON send-enddate-notifications: send email to projectmanager');
					  Notifications.sendMessage({ site, data });
					  site.update({ config: { project: { endDateNotificationSent: true } } });

          }
        }
				
        return next();

      } catch (err) {
        console.log('error in send-enddate-notifications cron');
        next(err); // let the locked function handle this
      }
      
    }
  })

};

