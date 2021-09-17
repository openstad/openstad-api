const {createMollieClient} = require('@mollie/api-client');
const subscriptionService = require('./subscription');
const config = require('config');

exports.processPayment = async (paymentId, mollieApiKey, site, order, user, mail, redirectUser) => {
  const mollieClient = createMollieClient({apiKey: mollieApiKey});
  const payment = await mollieClient.payments.get(paymentId);
  const baseUrl = config.url;

  if (payment.isPaid() && order.paymentStatus !== 'PAID') {
    order.set('paymentStatus', 'PAID');
    await order.save();

    if (order.extraData && order.extraData.isSubscription && order.userId) {
      const customerUserKey = mollieApiKey + 'CustomerId';
      const mollieCustomerId = user.siteData[customerUserKey];

      console.log('order', order);
      console.log('user.id', user.id);
      console.log('mollieCustomerId', mollieCustomerId);

      const mollieOptions = {
        customerId: mollieCustomerId,
        amount: {
          value: order.total.toString(),
          currency: order.extraData.currency
        },
        description: order.description ? order.description : 'Subscription order at ' + site.title,
        //  redirectUrl: paymentApiUrl,
        interval: order.extraData.subscriptionInterval,
        webhookUrl: baseUrl + '/api/site/' + site.id + '/order/' + order.id + '/payment/mollie'
      };

      const subscription = await mollieClient.customers_subscriptions.create(mollieOptions);

      await subscriptionService.update({
        user,
        provider: 'mollie',
        subscriptionActive: true,
        subscriptionProductId: order.extraData.subscriptionProductId,
        siteId: site.id,
        mollieSubscriptionId: subscription.id
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