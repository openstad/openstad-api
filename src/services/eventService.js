const jsonLogic = require('json-logic-js');
const notificationService = require('./notificationService')

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
 * @param {object} db
 * @param {int} siteId
 * @param {object} ruleSetData
 * @returns {Promise<void>}
 */
const publish = async (db, siteId, ruleSetData) => {
  const ruleSets = await db.NotificationRuleSet
    .scope('includeTemplate', 'includeRecipients')
    .findAll({where: { siteId, active: 1}})

  ruleSets.forEach((ruleset) => {
    const rulesetString = ruleset.body;

    if(!isJson(rulesetString)){
      return false;
    }

    if (jsonLogic.apply(JSON.parse(rulesetString), ruleSetData)) {
      const { notification_template, notification_recipients } = ruleset;

      const recipients = notification_recipients.map(recipient => {
        const user = {}
        if (recipient.emailType === 'field') {
          user.email = recipient.value.split('.').reduce((o,i)=>o[i], ruleSetData.instance)
        }
        if (recipient.emailType === 'fixed') {
          user.email = recipient.value
        }

        return user;
      })

      const emailData = {
        subject: notification_template.subject,
        text: notification_template.text,
        template: notification_template.templateFile
      }

      recipients
        .filter(recipient => recipient.email)
        .forEach(recipient => notificationService.notify(emailData, recipient, siteId));
    }
  });
}

module.exports = {
  publish
}
