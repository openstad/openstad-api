const {v4: uuidv4} = require('uuid');

const update = async ({
                        user,
                        provider,
                        subscriptionActive,
                        subscriptionProductId,
                        planId,
                        siteId,
                        paystackPlanCode,
                        paystackSubscriptionCode,
                        mollieSubscriptionId,
                        productId,
                        receipt,
                        transactionId,
                        latestReceipt,
                        validationResponse,
                        startDate,
                        endDate,
                        isCancelled,
                      }) =>
  {

  try {

    const subscriptionData = {
      subscriptionProductId: subscriptionProductId,
      subscriptionPaymentProvider: provider,
      active: subscriptionActive,
      siteId: siteId,
      uuid: uuidv4(),
      transactionId,
      startDate,
      endDate,
      planId
    };

    switch (provider) {
      case "paystack":
        // code block
        subscriptionData.paystackPlanCode = paystackPlanCode;
        subscriptionData.paystackSubscriptionCode = paystackSubscriptionCode;
        break;
      case "mollie":
        subscriptionData.mollieSubscriptionId = mollieSubscriptionId;
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

    const userSubscriptionData = user.subscriptionData ? user.subscriptionData : {};

    userSubscriptionData.subscriptions = userSubscriptionData && userSubscriptionData.subscriptions && Array.isArray(userSubscriptionData.subscriptions) ? userSubscriptionData.subscriptions : [];
    userSubscriptionData.subscriptions.push(subscriptionData);

    const activeSubscription = userSubscriptionData.subscriptions.find((subscription) => {
      return subscription.active;
    })

    userSubscriptionData.isActiveSubscriber = !!activeSubscription ? 'yes' : 'no';

    // check if more then one subscription so we can warn someone
    userSubscriptionData.activeSubscriptionCount = userSubscriptionData.subscriptions.filter((subscription) => {
      return subscription.active
    }).length;

    await user.update({subscriptionData: userSubscriptionData});

    return user;
  } catch (e) {
    throw Error(e);
  }
}

exports.update = update;