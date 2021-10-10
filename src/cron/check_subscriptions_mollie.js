var Promise = require('bluebird');
var log     = require('debug')('app:cron');
var db      = require('../db');
const {createMollieClient} = require('@mollie/api-client');

// Purpose
// -------
// Auto-close ideas that passed the deadline.
//
// Runs every night at 1:00.
module.exports = {
  //cronTime: '0 0 1 * * *',
  cronTime: '1 * * * * *',
  runOnInit: true,
  onTick: async function() {
    return;
      // first get all sites;
    const sites = await db.Site.findAll();

    console.log('Start cron check mollie subscriptions')

    for (const site of sites) {
      console.log('Checking site with ID: ', site.id)

      const mollieApiKey = site.config && site.config.payment && site.config.payment.mollieApiKey ? site.config.payment.mollieApiKey : '';
      const mollieModus = site.config && site.config.payment && site.config.payment.mollieModus ? site.config.payment.mollieModus : 'live';

      if (mollieApiKey) {

        const mollieClient = createMollieClient({apiKey: mollieApiKey});

        console.log('mollieClient: ', mollieClient)

        const users = await db.User.findAll({
          where: {
            siteData: {
              [Op.like]: '%mollieCustomerId%',
            }
          }
        });

        for (const user of users) {
          console.log('Checking user with ID: ', user.id)

          const mollieCustomerId = user.siteData.mollieCustomerId;

          const mollieSubscriptions = await mollieClient.customers_subscriptions.all({
            customerId: mollieCustomerId,
          });

          console.log('Fetched mollieSubscriptions: ', mollieSubscriptions)

          const subscriptionData = user.subscriptionData;
          subscriptionData.subscriptions = subcriptionData.subscriptions ? subcriptionData.subscriptions : [];

          subscriptionData.subscriptions.map((subscription) => {
            const mollieSubscription = mollieSubscriptions.find(mollieSub => mollieSub.id === subscription.id);

            if (subscription.mollieSubscriptionId === subscription.id) {
              subscription.active = subscription.active === 'active';
            }
            return subscription;
          });


          const activeSubscriptionIds = mollieSubscriptions.filter((mollieSubscription) => {
            return mollieSubscription.status === 'active';
          }).map((mollieSubscription) => {
            return mollieSubscription.id;
          });

          console.log('Active activeSubscriptionIds: ', activeSubscriptionIds)


          subscriptionData.subscriptions = subcriptionData.subscriptions.map((subscription) => {
            subscription.active = activeSubscriptionIds.includes(subscription.id);
            return subscription;
          });

          console.log('USer subscriptionData: ', subscriptionData)


          const result = await user.update({
            subscriptionData
          });
        }
      }
    }
  }
};


