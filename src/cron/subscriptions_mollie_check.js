var Promise = require('bluebird');
var log     = require('debug')('app:cron');
var db      = require('../db');
const {createMollieClient} = require('@mollie/api-client');
const subscriptionService = require('../services/subscription')

// Purpose
// -------
// Auto-close ideas that passed the deadline.
//
// Runs every night at 1:00.
module.exports = {
  cronTime: '0 0 1 * * *',
  cronTime: '1 * * * * *',
  runOnInit: true,
  onTick: async function() {
    return;
    // first get all sites;
    const sites = await db.Site.findAll();

    console.log('Start cron check mollie subscriptions')

    for (const site of sites) {
      console.log('Checking site with ID: ', site.id)

      const paymentConfig = site.config && site.config.payment ? site.config.payment : {};
      const paymentModus = paymentConfig.paymentModus ? paymentConfig.paymentModus : 'live';

      const mollieApiKey = site.config && site.config.payment && site.config.payment.mollieApiKey ? site.config.payment.mollieApiKey : '';
      const mollieModus = site.config && site.config.payment && site.config.payment.mollieModus ? site.config.payment.mollieModus : 'live';

      if (mollieApiKey) {
        const mollieClient = createMollieClient({apiKey: mollieApiKey});

        console.log('mollieClient: ', mollieClient)

        const users = await db.User.findAll({
          where: {
            subscriptionData: {
              [Op.like]: `%"subscriptionPaymentProvider": "mollie"%`,
            }
          }
        });

        for (const user of users) {
          console.log('Checking user with ID: ', user.id)

          const customerUserKey =  paymentModus +'_mollieCustomerId';
          const mollieCustomerId = user.siteData[customerUserKey];

          console.log('Checking user with mollieCustomerId: ',mollieCustomerId)

          const mollieSubscriptions = await mollieClient.customers_subscriptions.all({
            customerId: mollieCustomerId,
          });

          console.log('Gettings users with mollieCustomerId: ',mollieCustomerId)


          for (const mollieSubscription of mollieSubscriptions) {
            console.log('Fetched mollieSubscriptions: ', mollieSubscription)

            await subscriptionService.createOrUpdate({
              user,
              provider: 'mollie',
              subscriptionActive: mollieSubscription.status === 'active',
              siteId: site.id,
              mollieSubscriptionId: mollieSubscription.id,
              mollieClient: mollieClient,
              mollieCustomerId: mollieCustomerId,
              update: true
            });

          }
        }
      }
    }
  }
};


