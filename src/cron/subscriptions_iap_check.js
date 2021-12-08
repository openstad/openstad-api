const Promise = require('bluebird');
const log     = require('debug')('app:cron');
const db      = require('../db');
const IAPservice = require('../services/iap');
const Sequelize = require('sequelize');


// Purpose
// -------
// Auto-close ideas that passed the deadline.
//
// Runs every night at 1:00.
module.exports = {
  cronTime: '*/15 * * * *',
//  runOnInit: true,
  onTick: async function() {
    // first get all sites;
    const sites = await db.Site.findAll();

    console.log('Start cron check IAP subscriptions')

    for (const site of sites) {

      console.log('Start checking site IAP for site.id ', site.id);

      for (const appType of ['apple', 'google']) {


         // add an active check??
        const users = await db.User.findAll({
          where: {
            [Sequelize.Op.and]: db.sequelize.literal(`subscriptionData LIKE '%"subscriptionPaymentProvider": "${appType}"%'`),
          }
        });

        const androidAppSettings = site && site.config && site.config.appGoogle ? site.config.appGoogle : {};
        const iosAppSettings = site && site.config && site.config.appIos ? site.config.appIos : {};

        console.log(' checking site IAP users lenght: ', users.length);

        for (const user of users) {
          try {

            console.log('checking site IAP user id ', user.id);

            const userSubscriptionData = user.subscriptionData ? user.subscriptionData : {};

            const activeSubscriptions = userSubscriptionData.subscriptions  && Array.isArray(userSubscriptionData.subscriptions) ?  userSubscriptionData.subscriptions.filter((subscription) => {
              return subscription.active;
            }) : [];




            for (const activeSubscription of activeSubscriptions) {
              console.log('checking activeSubscription.uuid  ', activeSubscription.uuid);

              const receipt = activeSubscription.receipt;

              const appTypes = {
                apple: 'ios',
                google: 'android',
              }

              await IAPservice.processPurchase(appTypes[appType], user, receipt, androidAppSettings, iosAppSettings, site.id);
            }

          } catch (e) {
            console.log('Error in IAP check cron: ', e);
          }
        }
      }
    }
  }
};


