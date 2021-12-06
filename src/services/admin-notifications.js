const db = require('../db');
const config = require('../lib/siteConfig');
const mail    = require('../lib/mail');
const htmlToText   = require('html-to-text');

var nunjucks = require('nunjucks');
var moment       = require('moment-timezone');
var env = nunjucks.configure('email');

const adminEventTypes = [
    'chatSupportMessage',
  //  'workoutFinished',
  //  'workoutProgramFinished',
  //  'newSubscription',
];


const getAdmins = (site) => {
    return db.Users({
        where: {
            role: ['moderator', 'admin'],
            siteId: site.id
        }
    });
}

const send = async (site) => {
    const eventGroups = [
        {
            title: 'New chat messages',
            description: '',
            eventName: 'chatSupportMessage'
        },
        {
            title: '',
            eventName: ''
        }

    ];


    const events = getEvents(site);

    // format email
    for (const eventGroup of eventGroups) {
        const events = db.Events({
            name: eventGroup.eventName
        });
    }

    const templateData = {
        eventGroups
    }

    const html = nunjucks.render(`admin_notifications.njk`, templateData);

    const text = htmlToText.fromString(html, {
        ignoreImage: true,
        hideLinkHrefIfSameAsText: true,
        uppercaseHeadings: false
    });

    const admins =  getAdmins(site);

    let fromAddress = siteConfig.getFeedbackEmailFrom(resourceType) || config.email;
    if (fromAddress.match(/^.+<(.+)>$/, '$1')) fromAddress = fromAddress.replace(/^.+<(.+)>$/, '$1');

    for (const admin of admins) {
        const response = await mail.sendMail({
            // in some cases the resource, like order or account has a different email from the submitted user, default to resource, otherwise send to owner of resource
            to: admin.email, //resource.email ?  resource.email : user.email,
            from: fromAddress,
            subject: "Your Move account updates",
            html: html,
          //  text: text,
        });
    }
}


exports.send = send;