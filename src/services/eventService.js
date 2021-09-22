const jsonLogic = require('json-logic-js');
const notificationService = require('./notificationService')

// Todo: move to helper or util file
/**
 * Checks if string is valid json
 * @param {string} str
 * @returns {boolean}
 */
function isJson(str) {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Publish an event
 * This method checks if there is any ruleset available for the published event
 *
 * @param {object} notificationRuleSet
 * @param {int} siteId
 * @param {{resource: string, eventType: string, instance: object}} ruleSetData
 * @returns {Promise<void>}
 */
const publish = async (notificationRuleSet, siteId, ruleSetData) => {

  console.log('Publish event called: ', ruleSetData.resource, ruleSetData.eventType);

  const ruleSets = await notificationRuleSet
    .scope('includeTemplate', 'includeRecipients')
    .findAll({where: { siteId, active: 1}})

  ruleSets.forEach((ruleset) => {
    const rulesetString = ruleset.body;

    if(!isJson(rulesetString)) {
      console.error('ruleset body is not a valid json', ruleset.id, rulesetString);
      return false;
    }

    if (jsonLogic.apply(JSON.parse(rulesetString), ruleSetData) === false) {
      console.log('ruleset doesnt match', ruleset.id, rulesetString);
      return false;
    }
    console.log('Matched ruleset', ruleSetData.resource, ruleSetData.eventType)
    const { notification_template, notification_recipients } = ruleset;

    const recipients = notification_recipients.map(recipient => {
      const user = {}
      if (recipient.emailType === 'field') {
        // get email field from resource instance, can be dot separated (e.g. submittedData.email)
        user.email = recipient.value.split('.').reduce((o,i)=>o[i], ruleSetData.instance)
      }
      if (recipient.emailType === 'fixed') {
        user.email = recipient.value
      }

      return user;
    });

    if (recipients.length === 0) {
      console.error('No recipients found for ruleset id: ', ruleset.id);
    }

    const emailData = {
      subject: notification_template.subject,
      text: notification_template.text,
      template: notification_template.templateFile,
      ...ruleSetData.instance.get()
    }

    // Todo: instead of directly notify we should use a decent queue
    recipients
      .filter(recipient => recipient.email)
      .forEach(recipient => {
        console.log('Notify recipient', recipient.email);
        notificationService.notify(emailData, recipient, siteId)
      });

  });
}

module.exports = {
  publish
}
