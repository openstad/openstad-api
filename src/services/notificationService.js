const mail = require('../lib/mail');
const config = require('config');
const nunjucks = require('nunjucks');

module.exports = {
  /**
   * Send notification to recipient
   * @param emailData
   * @param recipient
   */
  notify: async (emailData, recipient, siteId) => {
    const db = require('../db');
    const site = await db.Site.findByPk(siteId);
    const myConfig = Object.assign({}, config, site && site.config);

    const data = {};
    data.to = recipient.email;
    data.from = ( myConfig.notifications && myConfig.notifications.fromAddress ) || myConfig.mail.from;
    data.subject = emailData.subject;

    data.EMAIL = data.from;
    data.HOSTNAME = ( myConfig.cms && ( myConfig.cms.hostname || myConfig.cms.domain ) ) || myConfig.hostname || myConfig.domain;
    data.URL = ( myConfig.cms && myConfig.cms.url ) || myConfig.url || ( 'https://' + emailData.HOSTNAME );
    data.SITENAME = ( site && site.title ) || myConfig.siteName;

    emailData.SITENAME = data.SITENAME;
    emailData.logo = site.config.styling.logo;

    emailData.text = nunjucks.renderString(emailData.text, emailData);
    data.html = nunjucks.render(emailData.template, emailData);

    mail.sendNotificationMail(data);
  }
}
