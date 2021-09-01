

/**
 * Logic for webhooks handlig the payment
 */


router.route('/mollie/payment', async function(req, res) {
  const paymentId = req.body.id; //tr_d0b0E3EA3v

  // 1. get payment
  const payment = await mollieClient.payments.get('tr_Eq8xzWUPA4');

  if (hash === req.headers['x-paystack-signature']) {
    // Retrieve the request's body
    var event = req.body;
    switch(event.name) {
      case "subscription.create":
        // code block

        console.log('Event subscription.create', event);

        break;
      case "paymentrequest.success":

        console.log('Event paymentrequest.success', event);

        break;
      default:
      // code block
    }
  }
  res.send(200);
});


router.route('/paystack', function(req, res) {
  const paystackApiKey = req.site.config && req.site.config.payment && req.site.config.payment.paystackApiKey ? req.site.config.payment.paystackApiKey : '';
  const hash = crypto.createHmac('sha512', paystackApiKey).update(JSON.stringify(req.body)).digest('hex');

  if (hash === req.headers['x-paystack-signature']) {
    // Retrieve the request's body
    var event = req.body;
    switch(event.name) {
      case "subscription.create":
        // code block

        console.log('Event subscription.create', event);

        break;
      case "paymentrequest.success":

        console.log('Event paymentrequest.success', event);

        break;
      default:
      // code block
    }
  }
  res.send(200);
});


router.route('/stripe', function(req, res, next) {
  /**
   * @TODO
   */

});