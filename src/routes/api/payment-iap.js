const Promise = require('bluebird');
const express = require('express');
const db = require('../../db');
const config = require('config');
const rp = require('request-promise');

const auth = require('../../middleware/sequelize-authorization-middleware');
const iap = require('in-app-purchase');
const {JWT} = require('google-auth-library');
const {google} = require('googleapis');
const assert = require('assert')

const iapTestMode = process.env.IAP_TEST_MODE === 'true';
const androidPackageName = process.env.ANDROID_PACKAGE_NAME;
const subscriptionService = require('../../services/subscription');

// https://www.appypie.com/faqs/how-can-i-get-shared-secret-key-for-in-app-purchase


let router = express.Router({mergeParams: true});

router
  .all('*', function (req, res, next) {
    req.scope = [];
    req.scope.push('includeSite');
    next();
  });

router.route('/')
  .all(async function (req, res, next) {
  try {
    const {userId, purchase, appType} = req.body;
    console.log('IN APP payment with request received', req.body);

    assert(['ios', 'android'].includes(appType));

    const user = await db.User.findOne({where: {id: userId}});

    const androidAppSettings = req.site && req.site.config && req.site.config.appGoogle ? req.site.config.appGoogle : {};
    const iosAppSettings = req.site && req.site.config && req.site.config.appIos ? req.site.config.appIos : {};

    const receipt = appType === 'ios' ? purchase.transactionReceipt : {
      packageName: androidAppSettings.packageName,
      productId: purchase.productId,
      purchaseToken: purchase.purchaseToken,
      subscription: true,
    };

    await processPurchase(appType, user, receipt, androidAppSettings, iosAppSettings, req.site.id);

    res.end();
  } catch (e) {
    next(e);
  }
});

const processPurchase = async (app, user, receipt, androidAppSettings, iosAppSettings, siteId) => {
  iap.config({
    // If you want to exclude old transaction, set this to true. Default is false:
    appleExcludeOldTransactions: true,
    // this comes from iTunes Connect (You need this to valiate subscriptions):
    applePassword: iosAppSettings.sharedSecret, //'8e6d38101b384207b0d25c5914ce67c7', //process.env.APPLE_SHARED_SECRET,

     /* googleServiceAccount: {
        clientEmail: androidAppSettings.clientEmail,//process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        privateKey: androidAppSettings.privateKey //process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
      },*/

    /* Configurations all platforms */
   // test: iapTestMode, // For Apple and Google Play to force Sandbox validation only
     verbose: true, // Output debug logs to stdout stream
  });

  await iap.setup();
  const validationResponse = await iap.validate(receipt);

  console.log('IAP validationResponse', validationResponse)

  // Sanity check
  assert((app === 'android' && validationResponse.service === 'google')
    || (app === 'ios' && validationResponse.service === 'apple'));

  const purchaseData = iap.getPurchaseData(validationResponse);
  console.log('IAP purchaseData', purchaseData)

  const firstPurchaseItem = purchaseData[0];

  const isCancelled = iap.isCanceled(firstPurchaseItem);
  const isExpired = iap.isExpired(firstPurchaseItem);

  console.log('IAP isCancelled', isCancelled)
  console.log('IAP isExpired', isExpired)

  // const isExpired = iap.isExpired(firstPurchaseItem);
  const {productId} = firstPurchaseItem;

  const origTxId = app === 'ios' ? firstPurchaseItem.originalTransactionId : firstPurchaseItem.transactionId;
  const latestReceipt = app === 'ios' ? validationResponse.latest_receipt : JSON.stringify(receipt);

  const startDate = app === 'ios' ? new Date(firstPurchaseItem.originalPurchaseDateMs) : new Date(parseInt(firstPurchaseItem.startTimeMillis, 10));
  const endDate = app === 'ios' ? new Date(firstPurchaseItem.expiresDateMs) : new Date(parseInt(firstPurchaseItem.expiryTimeMillis, 10));

  let environment = '';
  // validationResponse contains sandbox: true/false for Apple and Amazon
  // Android we don't know if it was a sandbox account

  if (app === 'ios') {
    environment = validationResponse.sandbox ? 'sandbox' : 'production';
  }

  console.log('environment', environment)

  await subscriptionService.update({
    user,
    provider: validationResponse.service,
    subscriptionActive: !isCancelled && !isExpired,
   // subscriptionProductId: subscriptionProductId,
    siteId: siteId,
    environment,
    productId,
    transactionId: origTxId,
    receipt: latestReceipt,
    validationResponse,
    startDate,
    endDate,
    isCancelled,
  });

  if (app === 'android') {
    google.options({
      auth: new JWT(
        androidAppSettings.serviceAccountEmail,// GOOGLE_SERVICE_ACCOUNT_EMAIL,
        null,
        androidAppSettings.serviceAccountPrivateKey,// GOOGLE_SERVICE_ACCOUNT_EMAIL,
        ['https://www.googleapis.com/auth/androidpublisher'],
      )
    });

    const androidGoogleApi = google.androidpublisher({version: 'v3'});

    // From https://developer.android.com/google/play/billing/billing_library_overview:
    // You must acknowledge all purchases within three days.
    // Failure to properly acknowledge purchases results in those purchases being refunded.
    if (app === 'android' && validationResponse.acknowledgementState === 0) {
      await androidGoogleApi.purchases.subscriptions.acknowledge({
        packageName: androidAppSettings.packageName,
        subscriptionId: productId,
        token: receipt.purchaseToken,
      });
    }
  }
}


module.exports = router;
