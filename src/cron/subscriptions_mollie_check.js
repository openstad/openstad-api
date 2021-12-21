var Promise = require('bluebird');
var log     = require('debug')('app:cron');
var db      = require('../db');
const {createMollieClient} = require('@mollie/api-client');
const subscriptionService = require('../services/subscription')
const Sequelize = require('sequelize');


// Purpose
// -------
// Auto-close ideas that passed the deadline.
//
// Runs every night at 1:00.
module.exports = {
  //cronTime: '0 0 1 * * *',
  cronTime: '*/15 * * * *',
 // runOnInit: true,
  onTick: async function() {
    // first get all sites;
    const sites = await db.Site.findAll();

    console.log('Start cron check mollie subscriptions')

    for (const site of sites) {
      console.log('Checking site with ID: ', site.id)

      const paymentConfig = site.config && site.config.payment ? site.config.payment : {};
      const paymentModus = paymentConfig.paymentModus ? paymentConfig.paymentModus : 'live';
      const mollieApiKey = site.config && site.config.payment && site.config.payment.mollieApiKey ? site.config.payment.mollieApiKey : '';

      console.log('Error get mollie mollieApiKey', mollieApiKey)

      if (mollieApiKey) {
        const mollieClient = createMollieClient({apiKey: mollieApiKey});

        console.log('mollieClient: for mollieApiKey',mollieApiKey)

        const users = await db.User.findAll({
          where: {
            [Sequelize.Op.and]: db.sequelize.literal(`subscriptionData LIKE '%"subscriptionPaymentProvider": "mollie"%' AND email LIKE '%ymove.app'`),
          }
        });

        console.log('Amount of users found: ', users.length)

        for (const user of users) {
          console.log('Checking user with ID: ', user.id)

          const customerUserKey = paymentModus + '_mollieCustomerId';
          const mollieCustomerId = user.siteData[customerUserKey];

          if (mollieCustomerId) {
            console.log('Checking user with mollieCustomerId: ', mollieCustomerId)
            let mollieSubscriptions;

            try {
              mollieSubscriptions = await mollieClient.customers_subscriptions.all({
                customerId: mollieCustomerId,
              });
            } catch (e) {
              console.log('Error get mollie clients:e.status', e.status)
              console.log('Error get mollie clients:e.ApiError', e)

              // 410	Gone – You are trying to access an object, which has previously been deleted (only in v2).
              // Delete users subscriptions,
              if (e.status === 410) {
                try {
                  console.log('Error get mollie clients: ', e);

                  const userSubscriptionuserSubscriptionDataData = user.subscriptionData ? user.subscriptionData : {};
                  let userSubscriptions = userSubscriptionData && userSubscriptionData.subscriptions && Array.isArray(userSubscriptionData.subscriptions) ? userSubscriptionData.subscriptions : [];

                  userSubscriptions = userSubscriptions.map((userSubscription) => {
                    if (userSubscription.subscriptionPaymentProvider === 'mollie') {
                      userSubscription.active = false;
                    }

                    return userSubscription;
                  });

                  userSubscriptionData.subscriptions = userSubscriptions;
                  await user.update({subscriptionData: userSubscriptionData});

                  await db.Event.create({
                    status: 'activity',
                    siteId: req.site.id,
                    message: 'Mollie user was not found',
                    userId:  user.id,
                    resourceType: 'subscription',
                    name: 'mollieCancelledRemovedUser',
                    extraData: {
                      'mollieCustomerId': mollieCustomerId
                    }
                  });

                } catch (e) {
                  console.log('Error in deleting user in mollie', e);
                }
              }
            }

            console.log('Gettings users with mollieCustomerId: ', mollieCustomerId);

            if (mollieSubscriptions && mollieSubscriptions.length > 0) {

              for (const mollieSubscription of mollieSubscriptions) {
                console.log('Fetched mollieSubscriptions: ', mollieSubscription.id)
                console.log('Fetched mollieSubscriptions status ', mollieSubscription.status)

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

          } else {
            console.log('No user with mollieCustomerId found for user id ', mollieCustomerId)

          }
        }
      }
    }
  }
};


