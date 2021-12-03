const {createMollieClient} = require('@mollie/api-client');
const subscriptionService = require('./subscription');
const config = require('config');

const formatIntervalDate = (interval) => {
  let startDate, nextDate;

  switch (interval) {
    case '12 months':
      nextDate = new Date(new Date().setMonth(new Date().getMonth() + 12));
      startDate = nextDate.toISOString().slice(0, 10);
      break;
    case '1 week':
      nextDate = new Date(new Date().setDate(new Date().getDate() + 7));
      startDate = nextDate.toISOString().slice(0, 10);
      break;
    case '1 month':
      nextDate = new Date(new Date().setMonth(new Date().getMonth() + 1));
      startDate = nextDate.toISOString().slice(0, 10);
      break;
    case '14 days':
      nextDate = new Date(new Date().setDate(new Date().getDate() + 14));
      startDate = nextDate.toISOString().slice(0, 10);
      break;
  }

  return startDate;
}
exports.processPayment = async (paymentId, mollieApiKey, site, order, user, mail, redirectUser) => {
  const mollieClient = createMollieClient({apiKey: mollieApiKey});
  const paymentConfig = site.config && site.config.payment ? site.config.payment : {};
  const payment = await mollieClient.payments.get(paymentId);
  const baseUrl = config.url;
  const paymentModus = paymentConfig.paymentModus ? paymentConfig.paymentModus : 'live';

  if (payment.isPaid() && order.paymentStatus !== 'PAID') {
    order.set('paymentStatus', 'PAID');
    await order.save();

    if (order.extraData && order.extraData.isSubscription && order.userId) {
      const customerUserKey =  paymentModus +'_mollieCustomerId';
      const mollieCustomerId = user.siteData[customerUserKey];
      const interval = order.extraData.subscriptionInterval

      console.log('order', order);
      console.log('user.id', user.id);
      console.log('mollieCustomerId', mollieCustomerId);
      console.log('interval', interval)

      let startDate =  formatIntervalDate(interval);
      console.log('Found startdate: ', startDate);

      if (!startDate) {
        throw new Error('Couldnt format new startdate for mollie subscription for interval ', interval, ' and order id ', order.id);
        return;
      }

      const mollieOptions = {
        customerId: mollieCustomerId,
        amount: {
          value: order.total.toString(),
          currency: order.extraData.currency
        },
        description: order.description ? order.description : 'Subscription order at ' + site.title,
        //  redirectUrl: paymentApiUrl,
        interval: order.extraData.subscriptionInterval,
        webhookUrl: baseUrl + '/api/site/' + site.id + '/order/' + order.id + '/payment/mollie',
        startDate: startDate
      };

      const subscription = await mollieClient.customers_subscriptions.create(mollieOptions);

      console.log('Found subscription: ', subscription);
      
      await subscriptionService.update({
        user,
        provider: 'mollie',
        subscriptionActive: true,
        subscriptionProductId: order.extraData.subscriptionProductId,
        siteId: site.id,
        mollieSubscriptionId: subscription.id,
        planId: order.extraData.planId,
        mollieClient: mollieClient,
        mollieFirstPaymentId: paymentId,
        mollieCustomerId: mollieCustomerId
      });
    }

    mail.sendThankYouMail(order, 'order', user);

    if (redirectUser) {
      redirectUser(order.id, order.hash, true);
    }

  } else if (payment.isCanceled()) {
    order.set('paymentStatus', 'CANCELLED');

  } else if (payment.isExpired()) {
    order.set('paymentStatus', 'EXPIRED');

  } else {
    if (redirectUser) {
      redirectUser(order.id, order.hash, true);
    }
  }
}