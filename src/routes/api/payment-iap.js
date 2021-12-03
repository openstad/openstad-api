const Promise = require('bluebird');
const express = require('express');
const db = require('../../db');
const config = require('config');
const rp = require('request-promise');
const Sequelize = require('sequelize');

const auth = require('../../middleware/sequelize-authorization-middleware');
const iap = require('in-app-purchase');
const {JWT} = require('google-auth-library');
const {google} = require('googleapis');
const assert = require('assert')

const iapTestMode = process.env.IAP_TEST_MODE === 'true';
const androidPackageName = process.env.ANDROID_PACKAGE_NAME;
const subscriptionService = require('../../services/subscription');

// https://www.appypie.com/faqs/how-can-i-get-shared-secret-key-for-in-app-purchase

const IAPservice = require('../../services/iap');

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

    let planId = req.body.planId;

    console.log('IN APP payment with request received', req.body, ' for plan ID ', planId);

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

    await IAPservice.processPurchase(appType, user, receipt, androidAppSettings, iosAppSettings, req.site.id, planId);

    res.end();
  } catch (e) {
    next(e);
  }
});


module.exports = router;


