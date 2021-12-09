const db = require('../db');
const config = require('../lib/siteConfig');
const mail = require('../lib/mail');
const htmlToText = require('html-to-text');


var nunjucks = require('nunjucks');
var moment = require('moment-timezone');
var env = nunjucks.configure('email');

const adminEventTypes = [
    'supportChatMessage',
    //  'workoutFinished',
    //  'workoutProgramFinished',
    //  'newSubscription',
];


const getAdmins = async (site) => {
    return await db.User.findAll({
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
            name: 'supportChatMessage'
        },
    ];

    console.log('Sending notifications for site.id ', site.id)

    let didWeFindAnyEventsLetsBeReal = false;

    // format email
    for (const eventGroup of eventGroups) {
        const events = await db.Event
            .scope(['includeUser'])
            .findAll({
                where: {
                    name: eventGroup.name,
                    siteId: site.id,
                    notified: false
                }
        });

        eventGroup.events = events;
        // console.log('Events found: ', events)
        //  console.log('Events found: ', events.length > 0)

        if (!didWeFindAnyEventsLetsBeReal && events.length > 0) {
            didWeFindAnyEventsLetsBeReal = true;
        }

    }

    // console.log('didWeFindAnyEventsLetsBeReal: ', didWeFindAnyEventsLetsBeReal)

    config.setFromSite(site);

    // if nothing found, do nothing
    if (!didWeFindAnyEventsLetsBeReal) {
        //     console.log('return: ')
        console.log('No new notifications for site.id ', site.id)

        return false;
    } else {
        console.log('Sending notifications for site.id ', site.id)

        console.log('eventGroups ', eventGroups)


        const templateData = {
            eventGroups,
            site
        }

        const html = nunjucks.render(`admin_notifications.njk`, templateData);

        const text = htmlToText.fromString(html, {
            ignoreImage: true,
            hideLinkHrefIfSameAsText: true,
            uppercaseHeadings: false
        });

        const admins = await getAdmins(site);

        let fromAddress = site && site.config.email && site.config.email.siteaddress ? site.config.email.siteaddress : config.emailAddress;

        if (fromAddress.match(/^.+<(.+)>$/, '$1')) fromAddress = fromAddress.replace(/^.+<(.+)>$/, '$1');

        for (const admin of admins) {
            console.log('Set email to admins:', admin.id, ' email ', admin.email);

            console.log('Options to send: ', {
                // in some cases the resource, like order or account has a different email from the submitted user, default to resource, otherwise send to owner of resource
                to: admin.email, //resource.email ?  resource.email : user.email,
                from: fromAddress,
                subject: "Your Move account updates",
                html: html,
                text: text,
            })

            const mailOptions = {
                // in some cases the resource, like order or account has a different email from the submitted user, default to resource, otherwise send to owner of resource
                to: admin.email, //resource.email ?  resource.email : user.email,
                from: fromAddress,
                subject: "New activity by your clients on Your Move ",
                html: html,
                text: text,
            }

            const response = await mail.sendMail(mailOptions);
        }

        for (const eventGroup of eventGroups) {

            if (eventGroup.events) {
                for (const eventToUpdate of eventGroup.events) {
                    eventToUpdate.set('notified', true)

                    const results = await eventToUpdate.save();

                }
            }
        }
    }


}

exports.send = send;