var Promise = require('bluebird');
var log     = require('debug')('app:cron');
var db      = require('../db');
const {createMollieClient} = require('@mollie/api-client');
const adminNotificationsService = require('../services/admin-notifications')

// Purpose
// -------
// Auto-close ideas that passed the deadline.
//
// Runs every night at 1:00.
module.exports = {
    cronTime: '0 0 1 * * *',
    cronTime: '1 * * * * *',
    runOnInit: true,
    onTick: async function() {
        // first get all sites;
        try {
            const sites = await db.Site.findAll();

            for (const site of sites) {
                adminNotificationsService.send(site);
            }
        } catch (e) {
            console.log('Error in sending everyone notificatoins: ', e);
        }
    }
};


