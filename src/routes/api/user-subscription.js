const db = require('../../db');
const auth = require('../../middleware/sequelize-authorization-middleware');
const pagination = require('../../middleware/pagination');
const searchResults = require('../../middleware/search-results-static');
const convertDbPolygonToLatLng = require('../../util/convert-db-polygon-to-lat-lng');
const {formatGeoJsonToPolygon} = require('../../util/geo-json-formatter');
const {createMollieClient} = require('@mollie/api-client');

const router = require('express-promise-router')({ mergeParams: true });
var createError = require('http-errors');

// scopes: for all get requests
router
    .all('*', function(req, res, next) {
       // req.scope = ['api'];
       // req.scope.push('includeSite');
        return next();
    });

router.route('/:subscriptionId/cancel')
    .all(auth.useReqUser)
    .all(async (req, res, next) => {



        const user = await db.User.findOne({
            where: {
                id: req.params.userId,
                siteId: req.site.id
            }
        })

        if (!user) {
            throw createError(404, `User not found with id ${req.params.userId}`);
            return;
        }
        console.log('req.user', req.user)
        console.log('req.user.role', req.user.role)

        const role =  req.user.role;
        const reqUserId = req.user.id;


        if ((role !== 'moderator' && role !== 'admin') &&  user.id !== reqUserId) {
            return next(new Error('You cannot update this user 2'));
        }

        req.results = user;
        next();
    })
    //
    .all(async function(req, res, next) {
        try {



            const user = req.results;

            console.log('user is found???', !!user.id)
            console.log('user is found???', user.access)

            const userSubscriptionData = user.subscriptionData ? user.subscriptionData : {};

            let userSubscriptions = userSubscriptionData && userSubscriptionData.subscriptions && Array.isArray(userSubscriptionData.subscriptions) ? userSubscriptionData.subscriptions : [];

            const foundSubscription = userSubscriptions.find((userSubscription) => {
                return userSubscription.uuid === req.params.subscriptionId;
            });

            console.log('userSubscriptionData', userSubscriptionData)

            if (!foundSubscription) {
                throw createError(404, `Could not find subscription with id ${req.params.subscriptionId} and user id ${user.id}`);
                return;
            }

            switch (foundSubscription.subscriptionPaymentProvider) {
                case 'mollie':
                    /**
                     * Cancellation with mollie is directly, which sucks
                     * because users have paid the period
                     * so we need to add some logice to make it work
                     *
                     */
                    const site = req.site;
                    const mollieApiKey = site.config && site.config.payment && site.config.payment.mollieApiKey ? site.config.payment.mollieApiKey : '';
                    const paymentModus = site.config && site.config.payment && site.config.payment.mollieModus ? site.config.payment.mollieModus : 'live';
                    const customerUserKey = paymentModus + '_mollieCustomerId';

                    // fetch customer id


                    const mollieClient = createMollieClient({apiKey: mollieApiKey});



                    const originalOrder = await db.Order.findOne({
                        where: {
                            userId: user.id,
                            paymentStatus: 'PAID'
                        }
                    });

                    console.log('Found originalOrder id', originalOrder.id, originalOrder.extraData)

                    if (!originalOrder) {
                        throw createError(404, `Could not find original order for ${req.params.subscriptionId} and user id ${user.id}`);
                        return;
                    }

                    const paymentId = originalOrder.extraData && originalOrder.extraData.paymentId ? originalOrder.extraData.paymentId : false;

                    console.log('Found payment id', paymentId)

                    if (!paymentId) {
                        throw createError(404, `Could not find paymentId for ${req.params.subscriptionId} and user id ${user.id}`);
                        return;
                    }


                    const payment = await mollieClient.payments.get(paymentId);

                    console.log('Found payment', payment);

                    const mollieCustomerId = payment.customerId;

                    console.log('Found mollieCustomerId', mollieCustomerId);

                    const subscription = await mollieClient.customers_subscriptions.get(foundSubscription.mollieSubscriptionId, {
                        customerId: mollieCustomerId,
                    });

                    if (!subscription) {
                        throw createError(404, `Could not find  subscription in mollie with id ${req.params.subscriptionId} and user id ${user.id}`);
                        return;
                    }

                    if (subscription.status !== 'active') {
                        throw createError(403, `Error: subscription with id ${req.params.subscriptionId} and user id ${user.id} is already cancelled`);
                        return;
                    }

                    const nextPaymentDate = subscription.nextPaymentDate;

                    const response = await mollieClient.customers_subscriptions.delete(foundSubscription.mollieSubscriptionId, {
                        customerId: mollieCustomerId,
                    });

                    // We set the next payment date to valid
                    // This way
                    userSubscriptions = userSubscriptions.map((userSubscription) => {
                        console.log('foundSubscription.uuid', foundSubscription.uuid)
                        console.log('userSubscription.uuid', userSubscription.uuid)
                        console.log('subscription.nextPaymentDate.uuid', subscription.nextPaymentDate)

                        if (foundSubscription.uuid === userSubscription.uuid && nextPaymentDate) {
                            foundSubscription.subscriptionCancelledButStillValidTill = nextPaymentDate;
                            foundSubscription.active = false;
                        }

                        return userSubscription;
                    })

                    userSubscriptionData.subscriptions = userSubscriptions;

                    await user.update({
                        subscriptionData: userSubscriptionData
                    });


                    try {
                        await db.Event.create({
                            status: 'activity',
                            siteId: req.site.id,
                            message: 'App Subscription cancelled',
                            userId: user.id,
                            resourceType: 'subscription',
                            name: 'subscriptionCancelled' + 'mollie',
                        });
                    } catch (e) {
                        console.log('Error in creating event sub update', e)
                    }

                    console.log('response', response);

                    break;
                case 'paystack':
                    throw createError(405, `Paystack cancellation is currently not implemented via this API, use paystack panel`);
                    break;

                case 'stripe':
                    throw createError(405, `Stripe cancellation is currently not implemented via this API, use stripe panel`);
                    break;

                case 'apple':
                    throw createError(405, `Apple subscriptions can only be cancelled by users themselves in their Apple account`);
                    break;

                case 'google':
                    throw createError(405, `Google subscriptions can only be cancelled by users themselves in their Apple account`);
                    break;

                default:
                    break;

            }

            return res.json({
                result: 'ok'
            })

        } catch (e) {
            next(e);
        }
    })

module.exports = router;
