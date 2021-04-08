const stripe = require('stripe')('sk_test_4eC39HqLyjWDarjtT1zdp7dc');
//const events = require('../../services/events.js')
const Promise = require('bluebird');
const Sequelize = require('sequelize');
const express = require('express');
const moment			= require('moment');
const createError = require('http-errors')
const config = require('config');
const db = require('../../db');
const auth = require('../../middleware/sequelize-authorization-middleware');
const mail = require('../../lib/mail');
const pagination = require('../../middleware/pagination');
const {Op} = require('sequelize');


const router = express.Router({mergeParams: true});

// scopes: for all get requests
/*
router
	.all('*', function(req, res, next) {
		next();
	})
*/
router
    .all('*', function(req, res, next) {
        const accountId = parseInt(req.params.accountId) || false;
        if (accountId) {
            throw new Error('Account Id not found');
        } else {
            db.Account
                .scope(...req.scope)
                .findOne({
                    where: {id: accountId, siteId: req.params.siteId}
                    //where: { id: userId }
                })
                .then(found => {
                    if (!found) throw new Error('Account not found for account id: ' + accountId);
                    req.account = found;
                    next();
                })
                .catch(next);
        }
        next();
    });

router
    .get("/stripe-checkout", async(req, res, next) => {
        const siteUrl = req.site.config.cms.url;
        const accountUrl = `${siteUrl}/site/${req.site.id}/account/{req.account.id}`;
        const productId = req.query.productId;

        if (!productId) {
            throw new Error('Product Id not found');
        }

        const product = await db.Product.findOne({ id: productId });

        if (!product) {
            throw new Error('Product not not found');
        }

        if (!stripeConfig.secretKey) {
            throw new Error('Stripe secret key not set for account: ' + req.account.id)
        }

        const stripe = require('stripe')(stripeConfig.secretKey);

        if (!req.account.stripeCustomerId) {
            const customer = await stripe.customers.create({
                description: 'My First Test Customer (created for API docs)',
            });

            console.log('Customer stripe object', customer);

            req.account = await req.account.update({
                stripeCustomerId : customer.id,
                email: req.account.email
            });

            console.log('Req.account should contain customer: ',  req.account)
        }

        const session = await stripe.checkout.sessions.create({
            // if sepa debit is wanted: currency: 'eur', 'card'
            payment_method_types: ['card'],
            customer: req.account.stripeCustomerId,
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: product.name,
                            images: product.extraData && product.extraData.images ? product.extraData.images : [],
                        },
                        unit_amount: product.price * 100, // price is in decimals
                    },
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${accountUrl}/success`,
            cancel_url: `${accountUrl}/cancel`,
        });

        stripe.redirectToCheckout({ sessionId: session.id })
    });

router
    .get("/success", async(req, res, next) => {
        const session = await stripe.checkout.sessions.retrieve(req.query.session_id);
        const customer = await stripe.customers.retrieve(session.customer);

        console.log('Success url for account ID: ', req.account.id)
        console.log(`With stripe customer: ${JSON.stringify(customer)} and stripe checkout session  ${JSON.stringify(session)}.`);

        // validate customer.id and account stripeId is the same
        if (customer.id === req.account.stripeCustomerId && session) {
            await req.account.update({ paymentStatus: 'paid'});
        }

        const siteUrl = req.site.config.cms.url;
        res.redirect(`${siteUrl}/subscription-paid`);
    });

router
    .get("/cancel", () => {
        const siteUrl = req.site.config.cms.url;
        res.redirect(`${siteUrl}/subscription-cancelled`);
    });


router
    .get("/stripe-account", async() => {
        const siteUrl = req.site.config.cms.url;


        if (!req.account.stripeCustomerId) {
            throw new Error('Wanting to go to stripe account, but no stripeCustomerID is present for accountID: ', req.account.id)
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: req.account.stripeCustomerId,
            return_url: `${siteUrl}/my-account`,
        });

        res.redirect(session.url);
    });



router
    .post("/webhook", async (req, res) => {
        const accountConfig = req.account.config;
        const stripeConfig = accountConfig.stripe;

        if (!stripeConfig.secretKey) {
            throw new Error('Stripe secret key not set for account: ' + req.account.id)
        }
        const stripe = require('stripe')(stripeConfig.secretKey);

        /*if (!stripeConfig.webhookSecret) {
            throw new Error('Webhook secret key not set for account' + req.account.id)
        }*/


        let data;
        let eventType;
        // Check if webhook signing is configured.
        const webhookSecret = stripeConfig.webhookSecret;

        if (webhookSecret) {
            // Retrieve the event by verifying the signature using the raw body and secret.
            let event;
            let signature = req.headers["stripe-signature"];

            try {
                event = stripe.webhooks.constructEvent(
                    req.rawBody,
                    signature,
                    webhookSecret
                );
            } catch (err) {
                console.log(`⚠️  Webhook signature verification failed.`);
                return res.sendStatus(400);
            }
            // Extract the object from the event.
            data = event.data;
            eventType = event.type;
        } else {
            // Webhook signing is recommended, but if the secret is not configured in `config.js`,
            // retrieve the event data directly from the request body.
            data = req.body.data;
            eventType = req.body.type;
        }

        switch (event.type) {
            case 'checkout.session.completed':
                // Payment is successful and the subscription is created.
                // You should provision the subscription.
                await req.account.update({
                    paymentStatus: 'paid'
                });

                break;
            case 'invoice.paid':
                // Continue to provision the subscription as payments continue to be made.
                // Store the status in your database and check when a user accesses your service.
                // This approach helps you avoid hitting rate limits.
                await req.account.update({
                    paymentStatus: 'paid'
                });
                break;
            case 'invoice.payment_failed':
                // The payment failed or the customer does not have a valid payment method.
                // The subscription becomes past_due. Notify your customer and send them to the
                // customer portal to update their payment information.
                await req.account.update({
                    paymentStatus: 'failed'
                });

                break;
            default:
            // Unhandled event type
        }

        res.sendStatus(200);
    });