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

    orderItems.forEach(item => {
        let price = item.product.price;
        let qty = item.quantity;
        let amount = price * qty;

        totals += amount;
    });

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
                subscriptionInterval: req.subscriptionProduct.subscriptionInterval,
                currency: firstOrderItem.product.currency,
                orderNote: req.body.orderNote,
                test: 'add something'
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

        if (paymentProvider === 'mollie') {
            const mollieApiKey = paymentConfig.mollieApiKey ? paymentConfig.mollieApiKey : '';

            // google pay, apple pay, paystack,
            const paymentApiUrl = config.url + '/api/site/' + req.params.siteId + '/order/' + req.results.id + '/payment';
            const mollieClient = createMollieClient({apiKey: mollieApiKey});

            console.log('paymentProvider', paymentProvider)
            console.log('req.user', req.user)
            console.log('req.subscriptionProduct', req.subscriptionProduct);

            try {
                let customerId;
                console.log('req.user.extraData', req.user.extraData);

                if (req.user.extraData && req.user.extraData.mollieCustomerId) {

                    customerId = req.user.extraData.mollieCustomerId;
                } else {
                    const customer = await mollieClient.customers.create({
                        name: req.user.firstName + ' ' + req.user.lastName,
                        email: req.user.email,
                    });

                    const extraData = req.user.extraData;

                    extraData.mollieCustomerId = customer.id;

                    await req.user.update({extraData})

                    customerId = req.user.extraData.mollieCustomerId;
                }


                const mollieOptions = {
                    customerId: customerId,
                    amount: {
                        value: req.results.total,
                        currency: req.results.extraData.currency
                    },
                    description: paymentConfig.description ? paymentConfig.description : 'Bestelling bij ' + req.site.name,
                    redirectUrl: paymentApiUrl,
                    webhookUrl: 'https://' + req.site.domain + '/api/site/' + req.params.siteId + '/order/' + req.results.id + '/payment'
                    //	webhookUrl:  paymentApiUrl,
                }


                const payment = await mollieClient.payments.create(mollieOptions);

                req.results.extraData = req.results.extraData ? req.results.extraData : [];
                req.results.extraData.paymentIds = req.results.extraData.paymentIds ? req.results.extraData.paymentIds : [];
                req.results.extraData.paymentIds.push(payment.id);
                req.results.extraData.paymentUrl = payment.getCheckoutUrl();
                await req.results.save();

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
            redirectUrl: req.results.extraData.paymentUrl
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
    .all(function (req, res, next) {
        const siteUrl = req.site.config.cms.url + '/thankyou';

        const done = (orderId, orderHash, clearCart) => {
            const clearCartQuery = clearCart ? '&clearCart=1' : '';
            return res.redirect(siteUrl + '?resourceId=' + orderId + '&resourceType=order&hash=' + orderHash + clearCartQuery);
        }

        if (!req.order.extraData && !req.order.extraData.paymentIds && !req.order.extraData.paymentIds[0]) {
            return next(createError(500, 'No Payment IDs found for this order'));
        }

        /*	if (!req.order.extraData.paymentIds.includes(paymentId)) {
                return next(createError(403, 'Payment ID not for this order'));
            }*/

        const mollieApiKey = req.site.config && req.site.config.payment && req.site.config.payment.mollieApiKey ? req.site.config.payment.mollieApiKey : '';

        const mollieClient = createMollieClient({apiKey: mollieApiKey});

        const paymentId = req.order.extraData.paymentIds ? req.order.extraData.paymentIds[0] : false;

        console.log('Payment processing paymentId', paymentId, ' orderId: ', req.params.orderId);

        /**
         * In future might be useful to seperate transactions and orders
         */
        mollieClient.payments.get(paymentId)
            .then(async payment => {

                if (payment.isPaid() && req.order.paymentStatus !== 'PAID') {
                    req.order.set('paymentStatus', 'PAID');

                    await req.order.save();
                    const user = await db.User.findOne({where: {id: req.order.userId}});

                    console.log('req.order', req.order)

                    if (req.order.extraData && req.order.extraData.isSubscription && req.order.userId) {
                        try {
                            console.log('req.order', req.order);
                            console.log('user', user);

                            const mollieOptions = {
                                customerId: user.extraData.mollieCustomerId,
                                amount: {
                                    value: req.order.total.toString(),
                                    currency: req.order.extraData.currency
                                },
                                description:  req.order.description,
                                //  redirectUrl: paymentApiUrl,
                                interval: req.order.extraData.subscriptionInterval,
                                webhookUrl: 'https://' + req.site.domain + '/api/site/' + req.params.siteId + '/order/' + req.order.id + '/payment'
                            };

                            console.log('mollieOptions', mollieOptions);

                            const subscription = await mollieClient.customers_subscriptions.create(mollieOptions);

                            const extraData = user.extraData;
                            extraData.mollieSubscriptionId = subscription.id;
                            extraData.isActiveSubscriber = 'yes';
                            extraData.subscriptionPaymentProvider = 'mollie';

                            console.log('extraData', extraData);

                            await user.update({extraData});
                        } catch(e) {
                            next(e)
                        }
                    }


                    mail.sendThankYouMail(req.order, 'order', user);
                    done(req.order.id, req.order.hash, true);

                } else if (payment.isCanceled()) {
                    req.order.set('paymentStatus', 'CANCELLED');

                } else if (payment.isExpired()) {
                    req.order.set('paymentStatus', 'EXPIRED');

                } else {
                    done(req.order.id, req.order.hash);
                }
            })
            .catch(error => {
                console.log('Error', error)
                // don't through an error for now
                done(req.order.id, req.order.hash);
            });
    })



module.exports = router;
