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
        req.scope = ['api'];
        req.scope.push('includeSite');
        return next();
    });

router.route('/:subscriptionId/cancel')
    .all(async function(req, res, next) {
        try {
            const user = await db.User.findOne({
                where: {
                    id: req.params.userId
                }
            })

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

                    const mollieCustomerId = user.siteData[customerUserKey];

                    const mollieClient = createMollieClient({apiKey: mollieApiKey});

                    const subscription = await mollieClient.customers_subscriptions.get(foundSubscription.mollieSubscriptionId, {
                        customerId: mollieCustomerId,
                    });

                    if (subscription.status !== 'active') {
                        throw createError(403, `Error: subscription with id ${req.params.subscriptionId} and user id ${user.id} is already cancelled`);
                        return;
                    }

                    // We set the next payment date to valid
                    // This way
                    userSubscriptions = userSubscriptions.map((userSubscription) => {
                        console.log('foundSubscription.uuid', foundSubscription.uuid)
                        console.log('userSubscription.uuid', userSubscription.uuid)
                        console.log('subscription.nextPaymentDate.uuid', subscription.nextPaymentDate)

                        if (foundSubscription.uuid === userSubscription.uuid && subscription.nextPaymentDate) {
                            foundSubscription.subscriptionCancelledButStillValidTill = subscription.nextPaymentDate;
                            foundSubscription.active = false;
                        }

                        return userSubscription;
                    })

                    userSubscriptionData.subscriptions = userSubscriptions;

                    await user.update({
                        subscriptionData: userSubscriptionData
                    });

                    if (!subscription) {
                        throw createError(404, `Could not find  subscription in mollie with id ${req.params.subscriptionId} and user id ${user.id}`);
                        return;
                    }

                    const response = await mollieClient.customers_subscriptions.delete(foundSubscription.mollieSubscriptionId, {
                        customerId: mollieCustomerId,
                    });

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
