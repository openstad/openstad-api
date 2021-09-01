const { v4: uuidv4 } = require('uuid');

const update = async ({user, provider, subscriptionActive, subscriptionProductId, siteId, paystackPlanCode, mollieSubscriptionId,
      productId, transactionId,
                        latestReceipt,
      validationResponse,
      startDate,
      endDate,
      isCancelled,
  }) => {

  try {

    const subscriptionData = {
      subscriptionProductId: subscriptionProductId,
      subscriptionPaymentProvider: provider,
      active: subscriptionActive ? 'yes' : 'no',
      siteId: siteId,
      uuid: uuidv4(),
      transactionId,
      startDate,
      endDate
    };

    switch (provider) {
      case "paystack":
        // code block
        subscriptionData.paystackPlanCode = paystackPlanCode;
        break;
      case "mollie":
        subscriptionData.mollieSubscriptionId = mollieSubscriptionId;
        console.log('Event paymentrequest.success', event);
        break;

      case "google":
        // code block
        //subscriptionData.paystackPlanCode = req.order.extraData.paystackPlanCode;

        subscriptionData.receipt = receipt;
        subscriptionData.productId = productId;

        break;
      case "apple":
        subscriptionData.receipt = receipt;
        subscriptionData.productId = productId;

        break

      case "stripe":

        break

      default:
      // code block
    }

    const extraData = user.extraData;

    extraData.subscriptions = extraData.subscriptions && Array.isArray(extraData.subscriptions) ? extraData.subscriptions : [];
    extraData.subscriptions.push(subscriptionData);

    const activeSubscription = extraData.subscriptions.find((subscription) => {
      return subscription.active === 'yes';
    })

    extraData.isActiveSubscriber = !!activeSubscription ? 'yes' : 'no';

    await user.update({extraData});

    return user;
  } catch (e) {
    throw Error(e);
  }
}

exports.update = update;