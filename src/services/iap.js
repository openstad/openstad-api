const Sequelize = require('sequelize');

const iap = require('in-app-purchase');
const {JWT} = require('google-auth-library');
const {google} = require('googleapis');
const assert = require('assert')

const db = require('../db');


const iapTestMode = process.env.IAP_TEST_MODE === 'true';
const androidPackageName = process.env.ANDROID_PACKAGE_NAME;
const subscriptionService = require('../services/subscription');

exports.processPurchase = async (app, user, receipt, androidAppSettings, iosAppSettings, siteId, planId, updateAction, purchaseProductId) => {
  const iapConfig = {
    // If you want to exclude old transaction, set this to true. Default is false:
    appleExcludeOldTransactions: true,
    // this comes from iTunes Connect (You need this to valiate subscriptions):
    /* Configurations all platforms */
    // test: iapTestMode, // For Apple and Google Play to force Sandbox validation only
    verbose: false, // Output debug logs to stdout stream
  }

  if (iosAppSettings.sharedSecret) {
    iapConfig.applePassword = iosAppSettings.sharedSecret;
  }

  if (androidAppSettings.serviceAccountEmail && androidAppSettings.serviceAccountPrivateKey ) {
    iapConfig.googleServiceAccount = {
      clientEmail: androidAppSettings.serviceAccountEmail,//process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      privateKey: androidAppSettings.serviceAccountPrivateKey //process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    }
  }

  console.log('IAP iapConfig', iapConfig)


  iap.config(iapConfig);

  await iap.setup();

  const validationResponse = await iap.validate(receipt);

  console.log('IAP validationResponse', validationResponse)

  // Sanity check
  assert((app === 'android' && validationResponse.service === 'google')
    || (app === 'ios' && validationResponse.service === 'apple'));

  const purchaseData = iap.getPurchaseData(validationResponse);
  console.log('IN APP payment with request received', purchaseData)

  const firstPurchaseItem = purchaseData[0];


  const isCancelled = iap.isCanceled(firstPurchaseItem);
  const isExpired = iap.isExpired(firstPurchaseItem);

  console.log('IAP isCancelled', isCancelled)
  console.log('IAP isExpired', isExpired)

  // const isExpired = iap.isExpired(firstPurchaseItem);
  let { productId } = firstPurchaseItem;

  console.log('productId from first', firstPurchaseItem)

  productId = purchaseProductId  ? purchaseProductId : productId;

  console.log('productId from purchaseProductId', purchaseProductId;

  const origTxId = app === 'ios' ? firstPurchaseItem.originalTransactionId : firstPurchaseItem.transactionId;
  const latestReceipt = app === 'ios' ? validationResponse.latest_receipt : JSON.stringify(receipt);

  const startDate = app === 'ios' ? new Date(firstPurchaseItem.originalPurchaseDateMs) : new Date(parseInt(firstPurchaseItem.startTimeMillis, 10));
  const endDate = app === 'ios' ? new Date(firstPurchaseItem.expiresDateMs) : new Date(parseInt(firstPurchaseItem.expiryTimeMillis, 10));

  let environment = 'production';
  // validationResponse contains sandbox: true/false for Apple and Amazon
  // Android we don't know if it was a sandbox account

  if (app === 'ios') {
    environment = validationResponse.sandbox ? 'sandbox' : 'production';
  }

  try {
    const escapedValue = db.sequelize.escape('%' + productId + '%');

    console.log('Fetch IAP product with ID: ', escapedValue);

    const account = await db.Account.findOne({
      where: {
        siteId: siteId
      }
    });

    const accountId = account && account.id ? account.id : false;
    console.log('Fetch for account with  ID: ', accountId);

    const conditionalClause = {
      where: {
        [Sequelize.Op.and]: db.sequelize.literal(`extraData LIKE ${escapedValue}`),
      }
    }

    if (accountId) {
      conditionalClause.where.accountId = accountId;
    }

    const product = await db.Product.findOne(conditionalClause);


    const productPlanId = product && product.extraData && product.extraData.planId ? product.extraData.planId : false;
    console.log('Found plan ID for product: ', productPlanId);

    planId = productPlanId ? productPlanId : planId;
  } catch (e) {
    console.log('error trying to find correct planid for in app purchase', e)
  }


  console.log('environment', environment)
  console.log('user id', user.id)

  const subscriptionIsActive = !isCancelled && !isExpired;

  await subscriptionService.createOrUpdate({
    user,
    provider: validationResponse.service,
    subscriptionActive: subscriptionIsActive,
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
    planId
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

    console.log('Validate with androidGoogleApi validationResponse', validationResponse);

    // From https://developer.android.com/google/play/billing/billing_library_overview:
    // You must acknowledge all purchases within three days.
    // Failure to properly acknowledge purchases results in those purchases being refunded.
    // only do this check the first time not with update actions
    if (!updateAction && app === 'android' && validationResponse.acknowledgementState === 0) {
      console.log('Validate with androidGoogleApi')
      try {
        await androidGoogleApi.purchases.subscriptions.acknowledge({
          packageName: androidAppSettings.packageName,
          subscriptionId: productId,
          token: receipt.purchaseToken,
        });
      } catch (e) {
        console.warn('Error validating subscription purchase: ', e)
      }
    }

  }
}
