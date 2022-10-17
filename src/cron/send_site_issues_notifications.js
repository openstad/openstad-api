const { Sequelize, Op } = require('sequelize');
const log = require('debug')('app:cron');
const config = require('config');
const Notifications = require('../notifications');
const db = require('../db');
const UseLock = require('../lib/use-lock');
const sitesWithIssues = require('../services/sites-with-issues');

// Purpose
// -------
// Send emails to projectmanagers just before the enddate of their project is reached
// 
// Runs every day
module.exports = {
  // cronTime: '*/10 * * * * *',
  // runOnInit: true,
  cronTime: '0 15 4 * * *',
  runOnInit: false,
  onTick: UseLock.createLockedExecutable({
    name: 'send-site-issues-notifications',
    task: async (next) => {

      try {

        let notoficationsToBeSent = {};

        // sites that should be ended but are not
        let result = await sitesWithIssues.shouldHaveEndedButAreNot({});
        let shouldHaveEndedButAreNot = result.rows;

        // for each site
        for (let i=0; i < shouldHaveEndedButAreNot.length; i++) {
          let site = shouldHaveEndedButAreNot[i];
          if (!notoficationsToBeSent[ site.id ]) notoficationsToBeSent[ site.id ] = { site, messages: [] };
          notoficationsToBeSent[ site.id ].messages.push(`Site ${ site.title } (${ site.domain }) has an endDate in the past but projectHasEnded is not set.`);
        }

        // sites that have ended but are not anonimized
        result = await sitesWithIssues.endedButNotAnonimized({})
        let endedButNotAnonimized = result.rows;

        // for each site
        for (let i=0; i < endedButNotAnonimized.length; i++) {
          let site = endedButNotAnonimized[i];
          if (!notoficationsToBeSent[ site.id ]) notoficationsToBeSent[ site.id ] = { site, messages: [] };
          notoficationsToBeSent[ site.id ].messages.push(`Project ${ site.title } (${ site.domain }) has ended but is not yet anonimized.`);
        }

        // send notifications
        Object.keys(notoficationsToBeSent).forEach(id => {
          let target = notoficationsToBeSent[ id ];
          let data = {
            from: target.site.config.notifications.fromAddress,
            to: target.site.config.notifications.siteadminAddress,
            subject: 'Sites with issues',
            template: target.messages.join('\r\n'),
          };
          Notifications.sendMessage({ site: target.site, data });
        });
        
        return next();

      } catch (err) {
        console.log('error in send-site-issues-notifications cron');
        next(err); // let the locked function handle this
      }
      
    }
  })

};

