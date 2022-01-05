/**
 * Logic for webhooks handlig the payment
 */
const Promise = require('bluebird');
const express = require('express');
const db = require('../../db');
const config = require('config');
const rp = require('request-promise');
const crypto = require('crypto');
const mail = require('../../lib/mail');

const bodyParser = require('body-parser');


const auth = require('../../middleware/sequelize-authorization-middleware');
const Sequelize = require('sequelize');
const subscriptionService = require('../../services/subscription');
const mollieService = require('../../services/mollie')

let router = express.Router({mergeParams: true});


router.route('/mollie')
  .post(async function (req, res, next) {
    try {

      console.log('Webhook mollie start', req.body);

      const mollieApiKey = req.site.config && req.site.config.payment && req.site.config.payment.mollieApiKey ? req.site.config.payment.mollieApiKey : '';
      const paymentId = req.body.id; //tr_d0b0E3EA3v

      console.log('Webhook mollie start mollieApiKey', mollieApiKey);
      console.log('Webhook mollie start paymentId', paymentId);


    //  const escapedKey = db.sequelize.escape(`$.paymentId`);
      const escapedValue = db.sequelize.escape('%' + paymentId + '%');

      const query = db.sequelize.literal(`extraData LIKE ${escapedValue}`);

      console.log('Webhook mollie start query', query);


      const order = await db.Order.findOne({
        where : {
          [Sequelize.Op.and]: query,
   //       siteId: req.site.id
        }
      });

      if (order) {
        console.log('Webhook order found', order.id);
      } else {
        console.log('Webhook order not found', order);

      }

      const user = await db.User.findOne({where: {id: order.userId}});

      const result = await mollieService.processPayment(paymentId, mollieApiKey, req.site, order, user, mail, () => {
        console.log('Order completed')
      });

      await db.ActionLog.create({
        actionId: 0,
        log: {
          mollieEvent: true,
          body: req.body,
          // userId: user.id ? user.id : false
        },
        status: 'info'
      });
    } catch (e) {
      console.log('Error processing payment: ', e)
      next(e);
    }

    res.send(200);
  });


router.route('/paystack')
  .all(async function (req, res, next) {
    console.log('Paystack webhook start', req.body);
    const paymentConfig = req.site.config && req.site.config.payment && req.site.config.payment ? req.site.config.payment : {};

    const paystackApiKey = req.site.config && req.site.config.payment && req.site.config.payment.paystackApiKey ? req.site.config.payment.paystackApiKey : '';
    const hash = crypto.createHmac('sha512', paystackApiKey).update(JSON.stringify(req.body)).digest('hex');
    const paymentModus = paymentConfig.paymentModus ? paymentConfig.paymentModus : 'live';

    if (hash === req.headers['x-paystack-signature']) {
      // Retrieve the request's body
      const event = req.body;
      const eventData = event.data ? event.data : {};
      const paystackPlancode = eventData.plan && eventData.plan.plan_code ? eventData.plan.plan_code : false;
      const customerData = eventData && eventData.customer ? eventData.customer : {};
      const customerCode = customerData.customer_code;
      const customerUserCodeKey = paymentModus + '_paystackCustomerCode';
      const subscriptionCode = eventData.subscription_code;

      console.log('paystackPlancode', paystackPlancode)
      console.log('eventData', eventData)

      let user, userSubscriptionData;

      if (!customerCode) {
        throw  Error('No customer code received');
      }

      try {
        const escapedKey = db.sequelize.escape(`$.${customerUserCodeKey}`);
        const escapedValue = db.sequelize.escape(customerCode);

        const query = db.sequelize.literal(`siteData->${escapedKey}=${escapedValue}`);
        console.log('query', query)

        user = await db.User.findOne({
          where: {
            [Sequelize.Op.and]: query,
            siteId: req.site.id
          }
        });
      } catch (e) {
        console.warn('Error in fetching a user', e);
        next(e);
      }

      //console.log('user', user);

      try {
        await db.ActionLog.create({
          actionId: 0,
          log: {
            paystackEvent: event,
            userId: user.id ? user.id : false
          },
          status: 'info'
        });
      } catch (e) {
        console.warn('Error in creating log a user', e);
      }

      if (!user) {
        // return 200 for now otherwise keeps firing
        // it can be a bug, but can also be they create a subscription / user that doesnt exist in our database
        return res.send(200);
      }


      if (subscriptionCode) {

      }

      try {
        switch (event.event) {
          case "subscription.create":
            // code block
            console.log('Event subscription.create', event);
            console.log('EventsubscriptionCodee', subscriptionCode);

            // fetch product

            let product;


            try {
              const paystackPlancodeKey = 'paystackPlancode';

              const escapedKey = db.sequelize.escape(`$.${paystackPlancodeKey}`);
              const escapedValue = db.sequelize.escape('%' + paystackPlancode + '%');
              const query = db.sequelize.literal(`extraData LIKE ${escapedValue}`);

              product = await db.Product.findOne({
                where: {
                  [Sequelize.Op.and]: query
                }
              });
            } catch (e) {
              console.warn('Error in product a user', e);
              next(e);
            }

            console.log('product', product)

            await subscriptionService.createOrUpdate({
              user,
              provider: 'paystack',
              subscriptionActive: true,
              subscriptionProductId: product ? product.id : '',
              paystackSubscriptionCode: subscriptionCode,
              siteId: req.site.id,
              paystackPlanCode: paystackPlancode,
              planId: product && product.extraData && product.extraData.planId ? product.extraData.planId : ''
            });

            break;
          case "subscription.disable":
            console.log('Event subscription.disable', event);

            userSubscriptionData = user.subscriptionData;

            console.log('EventsubscriptionCodee', subscriptionCode);

            if (!userSubscriptionData && !userSubscriptionData.subscriptions) {
              throw  Error('No subscription data for user with id', user.id, ' for event: ', JSON.stringify(event));
            }

            userSubscriptionData.subscriptions = userSubscriptionData.subscriptions.map((subscription) => {
              if (subscription.paystackSubscriptionCode && subscription.paystackSubscriptionCode === subscriptionCode) {
                subscription.active = false;
              }

              return subscription;
            });

            await user.update({subscriptionData: userSubscriptionData});

            break;

          case "subscription.enable":

            userSubscriptionData = user.subscriptionData;

            if (!userSubscriptionData && !userSubscriptionData.subscriptions) {
              throw  Error('No subscription data for user with id', user.id, ' for event: ', JSON.stringify(event));
            }

            userSubscriptionData.subscriptions = userSubscriptionData.subscriptions.map((subscription) => {
              if (subscription.paystackSubscriptionCode && subscription.paystackSubscriptionCode === subscriptionCode) {
                subscription.active = true;
              }

              return subscription;
            });

            await user.update({subscriptionData: userSubscriptionData});

            break;

          /*
        case "paymentrequest.success":

          const user = await db.User.findOne({where: {id: req.order.userId}});

          await subscriptionService.createOrUpdate({
            user,
            provider: 'paystack',
            subscriptionActive : true,
            subscriptionProductId: req.order.extraData.subscriptionProductId,
            siteId: req.site.id,
            paystackPlanCode:  req.order.extraData.paystackPlanCode
          });

          break;

           */
          default:
          // code block
        }
      } catch (e) {
        console.log('Erorororor: ', e);
        next(e);
      }
    }
    res.send(200);
  });


router.route('/stripe')
  .all(express.raw({type: 'application/json'}))
  .all(async (req, res, next) => {
    const paymentConfig = req.site.config && req.site.config.payment ? req.site.config.payment : {};
    const paymentModus = paymentConfig.paymentModus ? paymentConfig.paymentModus : 'live';
    const stripeApiKey = paymentConfig.stripeApiKey ? paymentConfig.stripeApiKey : '';
    const stripeWebhookSecret = paymentConfig.stripeWebhookSecret ? paymentConfig.stripeWebhookSecret : '';

    const Stripe = require('stripe')(stripeApiKey);

    /**
     * @TODO
     */

    let event;

    console.log('Stripe webhook: eventData start');


    // Verify the event came from Stripe
    try {
      const sig = req.headers['stripe-signature'];
      console.log('Try Stripe req.body', req.body)
      console.log('Try Stripe sig',sig)
      console.log('Try Stripe stripeWebhookSecret',stripeWebhookSecret)

      event = Stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
    } catch (err) {
      // On error, log and return the error message
      console.log(`❌ Error message: ${err.message}`);
      next(err)
    }
    console.log('Stripe webhook: event', event);
    console.log('✅ Success:', event.id);


    const eventData = event.data.object;

    console.log('Stripe webhook: eventData received', eventData);

    const stripeCustomerId = eventData && data.customer ? eventData.customer : '';
    const stripeCustomerIdKey = paymentModus + '_stripeCustomerId';
    let user;

    try {
      const escapedKey = db.sequelize.escape(`$.${stripeCustomerIdKey}`);
      const escapedValue = db.sequelize.escape(stripeCustomerId);
      const query = db.sequelize.literal(`siteData->${escapedKey}=${escapedValue}`);

      console.log('query', query)

      user = await db.User.findOne({
        where: {
          [Sequelize.Op.and]: query,
          siteId: req.site.id
        }
      });
    } catch(e) {
      console.warn('Webhook stripe: Error in fetching a user', e);
      next(e);
    }


    // Successfully constructed event
    switch (event.type) {
      case 'customer.subscription.created': {
        try {
          await subscriptionService.createOrUpdate({
            user,
            provider: 'stripe',
            subscriptionActive: true,
            stripeSubscriptionId: eventData.id,
            siteId: req.site.id,
            subscriptionProductId: eventData.metadata.productId,
            planId: eventData.metadata.planId
          });

        } catch (e) {
          console.log('Webhook stripe: ErrorsubscriptionService.createOrUpdate ', order.id, e);
          next(e);
        }

        try {
          const order = await db.Order.findOne({
            where: {
              id: eventData.metadata.orderId
            }
          });

          order.set('paymentStatus', 'PAID');
          await order.save();
          mail.sendThankYouMail(order, 'order', user);
        } catch (e) {
          console.log('Webhook stripe: Error processing order ', order.id, e);
          next(e);
        }

        break
      }
      default:
    }

  });

module.exports = router;
