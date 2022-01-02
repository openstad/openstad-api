const Promise = require('bluebird');
const Sequelize = require('sequelize');
const express = require('express');
const moment = require('moment');
const createError = require('http-errors')
const config = require('config');
const db = require('../../db');
const auth = require('../../middleware/sequelize-authorization-middleware');
const mail = require('../../lib/mail');
const pagination = require('../../middleware/pagination');
const {Op} = require('sequelize');
const {createMollieClient} = require('@mollie/api-client');
const router = express.Router({mergeParams: true});
const generateToken = require('../../util/generate-token');
const PayStack = require('paystack-node')
const crypto = require('crypto');
const subscriptionService = require('../../services/subscription');
const mollieService = require('../../services/mollie')


const fetchOrderMw = function (req, res, next) {

  const orderId = req.params.orderId;

  const query = {where: {id: parseInt(orderId, 10)}}

  req.scope = req.scope ? req.scope : [];

  db.Order
    .scope(...req.scope)
    .findOne(query)
    .then(found => {
      if (!found) throw new Error('Order not found');
      req.results = found;
      req.order = found;
      next();
    })
    .catch(next);
}

const calculateOrderTotal = (orderItems, orderFees) => {
  let totals = 0.00;

  if (orderItems.length === 1 && orderItems[0].quantity === 1) {
    totals = orderItems[0].price;
  } else {
    orderItems.forEach(item => {
      let price = item.product.price;
      let qty = item.quantity;
      let amount = price * qty;
      amount = amount;

      totals += amount;
    });
  }

  orderFees.forEach(fee => {
    let price = fee.price;
    let qty = fee.quantity;
    let amount = price * qty;

    totals += amount;
  });

  return totals.toFixed(2);
}

// scopes: for all get requests
/*
router
	.all('*', function(req, res, next) {
		next();
	})
*/

router
  .all('*', function (req, res, next) {
    req.scope = [];
    //	req.scope = ['includeLog', 'includeItems', 'includeTransaction'];
    req.scope.push({method: ['forSiteId', req.params.siteId]});
    next();
  });

router.route('/')

  // list users
  // ----------
  .get(auth.can('Order', 'list'))
  .get(pagination.init)
  .get(function (req, res, next) {
    let queryConditions = req.queryConditions ? req.queryConditions : {};

    db.Order
      .scope(...req.scope)
      //	.scope()
      //	.findAll()
      .findAndCountAll({
        where: queryConditions,
        offset: req.pagination.offset,
        limit: req.pagination.limit
      })
      .then(function (result) {
        req.results = result.rows;
        req.pagination.count = result.count;
        return next();
      })
      .catch(next);
  })
  .get(auth.useReqUser)
  //	.get(searchResults)
  .get(pagination.paginateResults)
  .get(function (req, res, next) {
    res.json(req.results);
  })

  // create
  // -----------
  .post(auth.can('Order', 'create'))
  .post(function (req, res, next) {
    if (!req.site) return next(createError(403, 'Site niet gevonden'));
    return next();
  })
  .post(function (req, res, next) {
    if (!(req.site.config && req.site.config.order && req.site.config.order.canCreateNewOrders)) return next(createError(403, 'Order mogen niet aangemaakt worden'));
    return next();
  })
  .post(function (req, res, next) {
    const orderSiteConfig = req.site.config && req.site.config.order && req.site.config.order ? req.site.config.order : {};

    /**
     * para examplar
     * {
 			price: '2.95',
 			name: 'Verzendkosten',
 			quantity: 1
 		}
     */
    req.orderFees = orderSiteConfig && orderSiteConfig.orderFees ? orderSiteConfig.orderFees : [];

    next();
  })
  .post(async function (req, res, next) {
    if (req.body.orderItems) {
      const actions = [];
      req.body.orderItems.forEach((orderItem) => {
        actions.push(function () {
          return new Promise(async (resolve, reject) => {
            const product = await db.Product.findOne({where: {id: orderItem.productId}});
            console.log('productIDDDD', product.id);
            orderItem.product = product;

            resolve();
          })
        }())
      });

      return Promise.all(actions)
        .then(() => {
          next();
        })
        .catch(next)
    } else {
      next(createError(403, 'No order items send with order request'));
    }
  })
  /*
      Coupons is for later, basic logic is simple,
      buttt, needs some rules, tracking etc.

  .post(async function(req, res, next) {
      const coupon = req.body.coupon ?  await db.OrderCoupon.findOne({ where: { coupon: req.body.coupon, claimed: null } }) : null;

      if (coupon) {
          const amount = coupon.type === 'percentage' ? calculateOrderTotal(req.body.orderItems, req.orderFees) * (coupon.amount / 10) : coupon.amount;

          req.orderFees.push([
              price: amount,
              name: 'Kortingscode',
              quantity: 1
          ])
      }

      next();
  })
  */
  .post(function (req, res, next) {
    const paymentConfig = req.site.config && req.site.config.payment ? req.site.config.payment : {};
    const paymentProvider = paymentConfig.provider ? paymentConfig.provider : 'mollie';

    const firstOrderItem = req.body.orderItems[0];
    // console.log('firstOrderItem', firstOrderItem.produ);
    // derive accountId from the ordered products, which means for now only one order per account per time
    const accountId = firstOrderItem.product.accountId;

    if (firstOrderItem.product.subscription) {
      req.subscriptionProduct = firstOrderItem.product;
    }

    const data = {
      accountId: accountId,
      userId: req.user.id,
      email: req.body.email,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      phoneNumber: req.body.phoneNumber,
      streetName: req.body.streetName,
      houseNumber: req.body.houseNumber,
      postcode: req.body.postcode,
      hash: generateToken({length: 128}),
      city: req.body.city,
      suffix: req.body.suffix,
      phoneNumber: req.body.phoneNumber,
      total: calculateOrderTotal(req.body.orderItems, req.orderFees),
      extraData: {
        isSubscription: req.subscriptionProduct ? true : false,
        paymentProvider: paymentProvider,
        subscriptionInterval: req.subscriptionProduct ? req.subscriptionProduct.subscriptionInterval : '',
        paystackPlanCode: req.subscriptionProduct && req.subscriptionProduct.extraData ? req.subscriptionProduct.extraData.paystackPlanCode : '',
        subscriptionProductId: req.subscriptionProduct.id,
        currency: firstOrderItem.product.currency,
        orderNote: req.body.orderNote,
        test: 'add something',
        planId: req.subscriptionProduct && req.subscriptionProduct.extraData.planId ? req.subscriptionProduct.extraData.planId : '',
      }
    }


    db.Order
      .create(data)
      .then(result => {
        req.results = result;
        console.log('result order', req.results)
        next();
      })
      .catch(function (error) {
        console.log('result order error', error)

        // todo: dit komt uit de oude routes; maak het generieker
        if (typeof error == 'object' && error instanceof Sequelize.ValidationError) {
          let errors = [];
          error.errors.forEach(function (error) {
            // notNull kent geen custom messages in deze versie van sequelize; zie https://github.com/sequelize/sequelize/issues/1500
            // TODO: we zitten op een nieuwe versie van seq; vermoedelijk kan dit nu wel
            errors.push(error.type === 'notNull Violation' && error.path === 'location' ? 'Kies een locatie op de kaart' : error.message);
          });
          res.status(422).json(errors);
        } else {
          next(error);
        }
      });

  })
  .post(function (req, res, next) {
    const actions = [];

    req.body.orderItems.forEach((orderItem) => {
      actions.push(function () {
        return new Promise((resolve, reject) => {
          const product = orderItem.product;

          const data = {
            vat: product.vat,
            quantity: orderItem.quantity,
            orderId: req.results.id,
            productId: product.id,
            price: product.price,
            extraData: {
              product: product
            },
          };

          db.OrderItem
            .authorizeData(data, 'create', req.user)
            .create(data)
            .then((result) => {
              resolve();
            })
            .catch((err) => {
              console.log('err', err)
              reject(err);
            })

        })
      }())
    });

    return Promise.all(actions)
      .then(() => {
        next();
      })
      .catch(next)
  })
  .post(async function (req, res, next) {
    const paymentConfig = req.site.config && req.site.config.payment ? req.site.config.payment : {};
    const paymentProvider = paymentConfig.provider ? paymentConfig.provider : 'mollie';
    const paymentApiUrl = config.url + '/api/site/' + req.params.siteId + '/order/' + req.results.id + '/payment';
    const siteUrl = req.site.config.cms.url;

    const paymentModus = paymentConfig.paymentModus ? paymentConfig.paymentModus : 'live';

    if (paymentProvider === 'stripe') {

      const stripeApiKey = paymentConfig.stripeApiKey ? paymentConfig.stripeApiKey : '';
      const stripeTrialDays = paymentConfig.stripeTrialDays ? paymentConfig.stripeTrialDays : '';

      console.log('Stripe start creating subscription with stripeApiKey', stripeApiKey);

      const Stripe = require('stripe')(stripeApiKey);

      const stripeCustomerIdKey = paymentModus + '_stripeCustomerId';
      const stripeCustomerId = req.user.siteData[stripeCustomerIdKey];

      console.log('Stripe start creating subscription for stripeCustomerId', stripeCustomerId);

      let stripeCustomer;

      if (stripeCustomerId) {
        try {
          stripeCustomer = await Stripe.customers.retrieve(stripeCustomerId)
        } catch (e) {
          console.log('Stripe customer call error', stripeCustomerId, 'error: e', e);
        }
      }

      console.log('Stripe start creating found stripeCustomer', stripeCustomer);


      if (!stripeCustomer) {
        try {
          stripeCustomer = await Stripe.customers.create({
            email: req.user.email,
            name: req.user.firstName + ' ' + req.user.lastName
          });

          console.log('Stripe created stripeCustomer', stripeCustomer);

          const siteData = req.user.siteData;

          siteData[stripeCustomerIdKey] = stripeCustomer.id;

          await req.user.update({
            siteData
          })

        } catch (e) {
          console.log('Stripe customer call error', stripeCustomerId, 'error: e', e);
          next(e);
        }
      }


      let stripeSession;

      try {
        const subscriptionProduct = req.subscriptionProduct;

        let stripeInterval;
        const subscriptionInterval = req.subscriptionProduct ? req.subscriptionProduct.subscriptionInterval : '';

        switch (subscriptionInterval) {
          //interval: Either day, week, month or year.
          //interval_count: The number of intervals between subscription billings. For example, interval=month and interval_count=3 bills every 3 months. Maximum of one year interval allowed (1 year, 12 months, or 52 weeks).

          case '1 day':
            stripeInterval = {
              interval: 'day',
              interval_count: 1
            }
            break;

          case '1 week':
              stripeInterval = {
                interval: 'week',
                interval_count: 1
              }
              break;

          case '1 month':
            stripeInterval = {
              interval: 'month',
              interval_count: 1
            }
            break;

          case '3 months':
            stripeInterval = {
              interval: 'month',
              interval_count: 3
            }
            break;

          case '6 months':
            stripeInterval = {
              interval: 'month',
              interval_count: 3
            }
            break;

          case '1 year':
            stripeInterval = {
              interval: 'year',
              interval_count: 1
            }
            break;

          case '12 months':
            stripeInterval = {
              interval: 'year',
              interval_count: 1
            }
            break;


        }

        console.log('stripeInterval', stripeInterval)

        const stripeSessionConfig = {
          mode: 'subscription',
          currency: req.results.extraData.currency,
          payment_method_types: ['card'],
          stripeCustomer,
          line_items: [
            {
              price: req.results.total,
              quantity: 1,
              price_data: {
                recurring: stripeInterval
              }
            }
          ],
          subscription_data: {
            metadata: {
              planId: subscriptionProduct.extraData.planId,
              productId:  subscriptionProduct.id,
              orderId: req.results.id
            }
          },
          success_url: siteUrl + '/thankyou',
          //redirect will just send them back and see inactive account
          cancel_url:  siteUrl,// `http://localhost:4242/failed`
        }


        if (stripeTrialDays) {
          stripeSessionConfig.subscription_data.trial_period_days = stripeTrialDays;
        }

        console.log('Stripe create sessions with config', stripeSessionConfig);

        stripeSession = await Stripe.checkout.sessions.create(stripeSessionConfig)
      } catch (e) {
        console.log('Stripe create sessions call error', stripeCustomerId, 'found: e', e);
      }

      console.log('Stripe created sessions', stripeSession);

      return res.redirect(stripeSession.url);

    } else if (paymentProvider === 'paystack') {
      const paystackApiKey = paymentConfig.paystackApiKey ? paymentConfig.paystackApiKey : '';

      const PaystackClient = new PayStack(paystackApiKey);

      const customerUserIdKey = paymentModus + '_paystackCustomerId';
      const customerUserCodeKey = paymentModus + '_paystackCustomerCode';

      let customerCode;

      try {
        if (req.user.siteData && req.user.siteData[customerUserCodeKey]) {
          customerCode = req.user.siteData[customerUserCodeKey];
        } else {
          let createCustomerResponse = await PaystackClient.createCustomer({
            email: req.user.email,
            first_name: req.user.firstName,
            last_name: req.user.lastName,
          });

          createCustomerResponse = typeof createCustomerResponse === 'string' ? JSON.parse(createCustomerResponse) : createCustomerResponse;
          createCustomerResponse = createCustomerResponse.body;

          customerCode = createCustomerResponse.data.code;

          const siteData = req.user.siteData ? req.user.siteData : {};

          siteData[customerUserIdKey] = createCustomerResponse.data.id;
          siteData[customerUserCodeKey] = createCustomerResponse.data.customer_code;

          console.log('siteDatasiteData', siteData);

          await req.user.update({
            siteData: siteData
          })
        }

        let total = req.results.total;

        total = total.toFixed ? total.toFixed(2) : total;

        const paystackOptions = {
          amount: Math.round((total * 100)), // Paystack wants cents
          email: req.user.email,
          callback_url: paymentApiUrl,
        }

        if (req.subscriptionProduct) {
          paystackOptions['plan'] = req.subscriptionProduct.extraData.paystackPlanCode;
        }

        let createTransactionResponse = await PaystackClient.initializeTransaction(paystackOptions);

        createTransactionResponse = typeof createTransactionResponse === 'string' ? JSON.parse(createTransactionResponse) : createTransactionResponse;

        createTransactionResponse = createTransactionResponse.body;
        console.log('createTransactionResponse', createTransactionResponse);

        const orderExtraData = req.results.extraData;

        orderExtraData.paymentUrl = createTransactionResponse.data.authorization_url;
        orderExtraData.paystackAccessCode = createTransactionResponse.data.access_code;
        orderExtraData.paystackReference = createTransactionResponse.data.reference;
        orderExtraData.paymentProvider = paymentProvider;

        req.redirectUrl = orderExtraData.paymentUrl;

        await req.results.update({
          extraData: orderExtraData
        });

        next();
      } catch (error) {
        next(error);
      }

    } else if (paymentProvider === 'mollie') {
      const mollieApiKey = paymentConfig.mollieApiKey ? paymentConfig.mollieApiKey : '';

      // google pay, apple pay, paystack,
      const mollieClient = createMollieClient({apiKey: mollieApiKey});
      const customerUserKey = paymentModus + '_mollieCustomerId';
      const baseUrl = config.url;


      try {
        let customerId;

        if (req.user.siteData && req.user.siteData[customerUserKey]) {
          customerId = req.user.siteData[customerUserKey];
        } else {

          const customer = await mollieClient.customers.create({
            name: req.user.firstName + ' ' + req.user.lastName,
            email: req.user.email,
          });

          const siteData = req.user.siteData;

          siteData[customerUserKey] = customer.id;

          await req.user.update({siteData})

          customerId = req.user.siteData[customerUserKey];
        }


        const mollieOptions = {
          customerId: customerId,
          amount: {
            value: req.results.total,
            currency: req.results.extraData.currency
          },
          description: paymentConfig.description ? paymentConfig.description : 'Bestelling bij ' + req.site.name,
          redirectUrl: paymentApiUrl,
          webhookUrl: baseUrl + '/api/site/' + req.params.siteId + '/payment/mollie'
          //	webhookUrl:  paymentApiUrl,
        }

        if (req.subscriptionProduct) {
          mollieOptions['sequenceType'] = 'first';
        }

        const payment = await mollieClient.payments.create(mollieOptions);

        const orderExtraData = req.results.extraData ? req.results.extraData : {};
        orderExtraData.paymentIds = req.results.extraData.paymentIds ? req.results.extraData.paymentIds : [];
        orderExtraData.paymentIds.push(payment.id);
        orderExtraData.paymentId = payment.id;
        orderExtraData.paymentUrl = payment.getCheckoutUrl();
        orderExtraData.paymentProvider = paymentProvider;

        req.redirectUrl = orderExtraData.paymentUrl;

        await req.results.update({
          extraData: orderExtraData
        });

        next();
      } catch (error) {
        next(error);
      }

    }
  })
  .post(function (req, res, next) {
    const orderJson = req.results.get({plain: true});

    const returnValues = {
      ...orderJson,
      redirectUrl: req.redirectUrl
    };

    res.json(returnValues);
  })


// one user
// --------
router.route('/:orderId')
  .all(fetchOrderMw)

  // view idea
  // ---------
  .get(auth.can('Order', 'view'))
  .get(auth.useReqUser)
  .get(function (req, res, next) {
    res.json(req.results);
  })

  // update user
  // -----------
  .put(auth.useReqUser)
  .put(function (req, res, next) {

    const order = req.results;
    if (!(order && order.can && order.can('update'))) return next(new Error('You cannot update this Order'));

    let data = {
      ...req.body,
    }

    order
      .authorizeData(data, 'update')
      .update(data)
      .then(result => {
        req.results = result;
        next()
      })
      .catch(next);
  })
  .put(function (req, res, next) {
    if (req.body.orderItems) {
      req.body.orderItems.forEach((orderItem) => {
        actions.push(function () {
          return new Promise((resolve, reject) => {
            db.OrderItem
              .authorizeData(data, 'update', req.user)
              .update(data)
              .then((result) => {
                resolve();
              })
              .catch((err) => {
                console.log('err', err)
                reject(err);
              })
          })
        }())
      });
    }

    return Promise.all(actions)
      .then(() => {
        next();
      })
      .catch(next)
  })

  // delete idea
  // ---------
  .delete(auth.can('Order', 'delete'))
  .delete(function (req, res, next) {
    req.results
      .destroy()
      .then(() => {
        res.json({"order": "deleted"});
      })
      .catch(next);
  })

router.route('/:orderId(\\d+)/payment')
  .all(fetchOrderMw)
  .all(async function (req, res, next) {
    const siteUrl = req.site.config.cms.url + '/thankyou';

    const done = (orderId, orderHash, clearCart) => {
      const clearCartQuery = clearCart ? '&clearCart=1' : '';
      return res.redirect(siteUrl + '?resourceId=' + orderId + '&resourceType=order&hash=' + orderHash + clearCartQuery);
    }

    const paymentProvider = req.order.extraData && req.order.extraData.paymentProvider ? req.order.extraData.paymentProvider : 'mollie';
    const user = await db.User.findOne({where: {id: req.order.userId}});

    if (paymentProvider === 'paystack') {
      try {
        const paystackReference = req.order.extraData && req.order.extraData.paystackReference ? req.order.extraData.paystackReference : 'xxx';
        const paystackApiKey = req.site.config && req.site.config.payment && req.site.config.payment.paystackApiKey ? req.site.config.payment.paystackApiKey : '';
        const PaystackClient = new PayStack(paystackApiKey);

        let verifyResponse = await PaystackClient.verifyTransaction({
          reference: paystackReference
        });

        verifyResponse = typeof verifyResponse === 'string' ? JSON.parse(verifyResponse) : verifyResponse;
        verifyResponse = verifyResponse.body;

        if (verifyResponse.data.status === 'success') {
          let extraData = req.order.extraData;
          extraData = extraData ? extraData : {};

          extraData.paystackReference = paystackReference;


          req.order.set('paymentStatus', 'PAID');

          await req.order.save();
        }

        mail.sendThankYouMail(req.order, 'order', user);
        done(req.order.id, req.order.hash, true);

      } catch (e) {
        next(e)
      }

    } else {

      if (!req.order.extraData && !req.order.extraData.paymentIds && !req.order.extraData.paymentIds[0]) {
        return next(createError(500, 'No Payment IDs found for this order'));
      }

      const mollieApiKey = req.site.config && req.site.config.payment && req.site.config.payment.mollieApiKey ? req.site.config.payment.mollieApiKey : '';
      const paymentId = req.order.extraData.paymentIds ? req.order.extraData.paymentIds[0] : false;
      const order = req.order;
      const user = await db.User.findOne({where: {id: req.order.userId}});

      try {
        const result = await mollieService.processPayment(paymentId, mollieApiKey, req.site, order, user, mail, done);
      } catch (e) {
        console.log('Error processing payment: ', e)
        next(e);
      }
      /**
       * In future might be useful to seperate transactions and orders
       */

    }
  })


module.exports = router;
