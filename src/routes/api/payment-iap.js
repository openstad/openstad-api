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

let router = express.Router({mergeParams: true});

const formatOAuthApiCredentials = (site, which = 'default') => {
  let siteOauthConfig = (site && site.config && site.config.oauth && site.config.oauth[which]) || {};
  let authClientId = siteOauthConfig['auth-client-id'] || config.authorization['auth-client-id'];
  let authClientSecret = siteOauthConfig['auth-client-secret'] || config.authorization['auth-client-secret'];

  return {
    client_id: authClientId,
    client_secret: authClientSecret,
  }
}

const formatOAuthApiUrl = (site, which = 'default') => {
  let siteOauthConfig = (site && site.config && site.config.oauth && site.config.oauth[which]) || {};
  return siteOauthConfig['auth-server-url'] || config.authorization['auth-server-url'];
}

const filterBody = (req, res, next) => {
  const data = {};
  const keys = ['firstName', 'lastName', 'email', 'phoneNumber', 'streetName', 'houseNumber', 'city', 'suffix', 'postcode', 'extraData', 'listableByRole', 'detailsViewableByRole', 'password'];

  keys.forEach((key) => {
    if (req.body[key]) {
      data[key] = req.body[key];
    }
  });

  req.body = data;

  next();
}

router
  .all('*', function (req, res, next) {
    req.scope = [];
    req.scope.push('includeSite');
    next();
  });

router.route('/')
  .all((req, res, next) => {
    assert(req.body.email);
    next()
  })
  .all(filterBody)
  .all(function (req, res, next) {
    const authServerUrl = formatOAuthApiUrl(req.site, 'default');
    const apiCredentials = formatOAuthApiCredentials(req.site, 'default');
    const options = {
      uri: `${authServerUrl}/api/admin/users?email=${req.body.email}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      body: apiCredentials,
      json: true
    };

    console.log('options', options)

    rp(options)
      .then((result) => {
        if (result && result.data && result.data.length > 0) {
          throw createError(401, 'User already exists, login first');
          req.oAuthUser = result.data[0];
          //next();
        } else {
          next();
        }
      })
      .catch(next);
  })
  /**
   * In case a user exists for that e-mail in the oAuth api move on, otherwise create it
   * then create it
   */
  .all(function (req, res, next) {
    if (req.oAuthUser) {
      next();
    } else {
      // in case no oauth user is found with this e-mail create it
      const authServerUrl = formatOAuthApiUrl(req.site, 'default');
      const apiCredentials = formatOAuthApiCredentials(req.site, 'default');
      const apiOptions = formatOAuthApiCredentials(apiCredentials, req.body);
      const options = {
        uri: `${authServerUrl}/api/admin/user`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: Object.assign(req.body, apiCredentials),
        json: true
      }

      rp(options)
        .then((result) => {
          req.oAuthUser = result;
          next()
        })
        .catch(next);
    }
  })
  .all(function (req, res, next) {
    db.User
      .scope(...req.scope)
      .findOne({
        where: {email: req.body.email, siteId: req.params.siteId},
        //where: { id: userId }
      })
      .then(found => {
        if (found) {
          throw createError(401, 'User already exists, login');
        } else {
          next();
        }
      })
      .catch(next);
  })
  .all(function (req, res, next) {
    const {email, firstName, lastName} = req.body;

    const data = {
      email,
      firstName,
      lastName,
      password,
      role: 'member',
      siteId: req.site.id,
      role: req.body.role ? req.body.role : 'member',
      externalUserId: req.oAuthUser.id
    };

    db.User
      .authorizeData(data, 'create', req.user)
      .create(data)
      .then(result => {
        return res.json(result);
      })
      .catch(function (error) {
        // todo: dit komt uit de oude routes; maak het generieker
        if (typeof error == 'object' && error instanceof Sequelize.ValidationError) {
          let errors = [];

          error.errors.forEach(function (error) {
            errors.push(error.message);
          });

          res.status(422).json(errors);
        } else {
          next(error);
        }
      });
  })
  .all(async function (req, res, next) {
  try {

    console.log('IN APP payment with request received', req.body);

    assert(['ios', 'android'].includes(appType));

    const user = await db.User.findOne({where: {email: email, siteId: req.site.id}});



    if (!user) {
      await db.User.create({

      });
    }


    const androidAppSettings = req.site && req.site.config && req.site.config.appGoogle ? req.site.config.appGoogle : {};
    const iosAppSettings = req.site && req.site.config && req.site.config.appIos ? req.site.config.appIos : {};

    const receipt = appType === 'ios' ? purchase.transactionReceipt : {
      packageName: androidAppSettings.packageName,
      productId: purchase.productId,
      purchaseToken: purchase.purchaseToken,
      subscription: true,
    };

    await processPurchase(appType, user, receipt, androidAppSettings, req.site.id);

    res.end();
  } catch (e) {
    next(e);
  }
});

const processPurchase = async (app, user, receipt, androidAppSettings, siteId) => {
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


  await updateSubscription({
    user,
    provider: validationResponse.service,
    subscriptionActive: !isCancelled && !isExpired,
    subscriptionProductId: req.order.extraData.subscriptionProductId,
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


module.exports = router;
