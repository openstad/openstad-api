const Promise = require('bluebird');
const express = require('express');
const config = require('config');
const db = require('../../db');
const auth = require('../../middleware/sequelize-authorization-middleware');
const pagination = require('../../middleware/pagination');
const searchResults = require('../../middleware/search-results-user');
const oauthClients = require('../../middleware/oauth-clients');
const oauthService = require('../../services/oauthApiService')

const checkHostStatus = require('../../services/checkHostStatus')
const generateToken = require('../../util/generate-token');

let router = express.Router({mergeParams: true});

const cleanUrl = (url) => {
    return url.replace(/^https?:\/\//, '').replace('www.', '');
};


const refreshSiteConfigMw = function (req, res, next) {
    const site = req.results;

    // assume https, wont work for some dev environments
    const cmsUrl = site.config.cms && site.config.cms.url ? site.config.cms.url : false;

    //
    if (!cmsUrl) {
        next();
    }

    //return fetch(cmsUrl + '/modules/openstad-api/refresh')
    /*
        @todo The /modules/openstad-api/refresh is cleaner, doesn't require a restart
        but needs basichAuth headers in case a site is password protected
     */
    return fetch(cmsUrl + '/config-reset')
        .then(function () {
            next();
        })
        .catch(function (err) {
            console.log('errrr', err);
            next();
        });
}

router.route('/')

    // list sites
    // ----------
    .get(auth.can('Site', 'list'))
    .get(pagination.init)
    .get(function (req, res, next) {
        const scope = ['withArea'];

        db.Site
            .scope(scope)
            .findAndCountAll({offset: req.dbQuery.offset, limit: req.dbQuery.limit})
            .then(result => {
                req.results = result.rows;
                req.dbQuery.count = result.count;
                return next();
            })
            .catch(next);
    })
    .get(searchResults)
    .get(auth.useReqUser)
    .get(pagination.paginateResults)
    .get(function (req, res, next) {
        let records = req.results.records || req.results
        records.forEach((record, i) => {
            let site = record.toJSON()
            if (!(req.user && req.user.role && req.user.role == 'admin')) {
                site.config = undefined;
            }
            records[i] = site;
        });
        res.json(req.results);
    })

    // create site
    // -----------
    .post(auth.can('Site', 'create'))
    .post(async (req, res, next) => {
        const siteData = req.body;
        const allowedDomains = ['ymove.app'];

        if (req.body.copySiteId) {
            try {
                let {copySiteId, subDomain, mainDomain, name, appType} = req.body;
                mainDomain = mainDomain ? cleanUrl(mainDomain) : process.env.WILDCARD_HOST;

                if (!allowedDomains.includes(mainDomain)) {
                    throw new Error('Main domain ' + mainDomain + ' not allowed');
                    return
                }

                // format domain
                let domain = `${subDomain}.${mainDomain}`;
                domain = cleanUrl(domain);
                domain = domain.toLowerCase();

                const fullUrl = 'https://' + domain;

                const siteToCopy = await db.Site.findOne({where: {id: copySiteId}});

                // We take the copy config from the site we copy
                const copyConfig = siteToCopy.config && siteToCopy.config.copy ? siteToCopy.config.copy : {};

                if (!copyConfig.isAllowed) {
                    throw new Error('Copy site id: ' + copySiteId + ' not allowed');
                    return
                }

                const oauthCredentials = {
                    client_id:  process.env.USER_API_CLIENT_ID,
                    client_secret: process.env.USER_API_CLIENT_SECRET,
                }

                /**
                 * Copy SITE ID
                 */
                const siteWithDomainExists = await db.Site.findOne({where: {'domain': cleanUrl(domain)}})

                if (siteWithDomainExists) {
                    throw new Error('Site with domain ' + cleanUrl(domain) + ' already exists');
                    return
                }

                // clone to make sure it doesnt contain nested references
                const siteConfig = JSON.parse(JSON.stringify(siteToCopy.config));

                // we delete the copy config, not all site are allowed to be copied
                delete siteConfig.copy;

                siteConfig.cms.domain = domain;
                siteConfig.cms.url = fullUrl;
                siteConfig.installation = siteConfig.installation ? siteConfig.installation : {};
                siteConfig.installation.appType = appType;

                const oauthConfig = {};

                const oauthClientsToCopy = await oauthService.fetchClientsForSite(siteToCopy, oauthCredentials)

                for (const oauthClient of oauthClientsToCopy) {
                    const clientCreated = await oauthService.create({
                        name: name,
                        ...oauthClient,
                        redirectUrl: fullUrl,
                        siteUrl: fullUrl,
                        allowedDomains: [
                            domain,
                            apiUrl
                        ],
                    }, oauthCredentials);

                    oauthConfig[oauthClient.apiType] = {
                        "id": clientCreated.id,
                        "auth-client-id": clientCreated.clientId,
                        "auth-client-secret": clientCreated.clientSecret
                    }
                }

                siteConfig.oauth = oauthConfig;

                const amountOfTrialDays = copyConfig ? copyConfig.trialDays : 30;

                const future = new Date();
                future.setDate(future.getDate() + amountOfTrialDays);

                siteConfig.trial = siteConfig.trial ? siteConfig.trial : {};
                siteConfig.trial.trialUntilDate = future.toISOString().substring(0, 10);

                const siteData = {
                    name: name,
                    domain: domain,
                    config: siteConfig
                };

                console.log('Create site with siteData', siteData);

                const newSite = db.Site
                    .create(siteData)
                    .then((result) => {
                        req.results = result;
                    })
                    .catch(next)


                //Add admin users from site to copy
                //const users = req
                // await oauthProvider.makeUserSiteAdmin(user.externalUserId, apiData.site.config.oauth.default.id);

                //copy all users
                const usersFromCopySite = await db.User({
                    where: {
                        siteId: copySiteId,
                        $or: {
                            id: req.user.id
                        }
                        //role: ['admin', 'moderator']
                    }
                });

                console.log('Users to copy from site');

                for (const userToCopy of usersFromCopySite) {
                    console.log('userToCopy', userToCopy.id, userToCopy.email, userToCopy.role);

                    await db.User.create({
                        ...userToCopy,
                        // site and subcsription data are site specific, for convenience we copy extraData.
                        siteData: {},
                        subscriptionData: {},
                        siteId: newSite.id
                    });

                    console.log('Users to copy from userToCopy', userToCopy.id, userToCopy.role);

                    await oauthService.setRoleForUser(userToCopy.externalUserId, userToCopy.role, oauthCredentials);
                }

                /**
                 * This is not ideal.
                 * @type {*}
                 */
                // Resources to create
                const account = await db.Account.create({
                    siteId: newSite.id,
                    name: name,
                });

                // Resources to create
                const tour = await db.Tour.create({
                    siteId: newSite.id,
                    accountId: account.id,
                    title: name
                });

                /**
                 *
                 */
                if (copyConfig.redirectAppUrl) {
                    req.redirectUrl = fullUrl + copyConfig.redirectAppUrl + '/' + tour.id;
                } else {
                    req.redirectUrl = fullUrl;
                }

                next();
            } catch (e) {
                console.warn('Error in creating site from template, error: ', e);
                next(e)
            }
        } else {
            //name is required to be unique, it's used for db name, so not used for humans
            siteData.name = siteData.name ? siteData.name : generateToken({length: 50});

            db.Site
                .create(req.body)
                .then((result) => {
                    req.results = result;
                    next();
                    //return checkHostStatus({id: result.id});
                })
                .catch(next);
        }

    })
    .post(auth.useReqUser)
    .post(refreshSiteConfigMw)
    .post(function (req, res, next) {
        console.log(req.results);
        return res.json(req.results);
    })

// one site routes: get site
// -------------------------
router.route('/:siteIdOrDomain') //(\\d+)
    .all(auth.can('Site', 'view'))
    .all(function (req, res, next) {
        const siteIdOrDomain = req.params.siteIdOrDomain;
        let query;

        if (isNaN(siteIdOrDomain)) {
            query = {where: {domain: siteIdOrDomain}}
        } else {
            query = {where: {id: parseInt(siteIdOrDomain)}}
        }

        db.Site
            .scope('withArea')
            .findOne(query)
            .then(found => {
                if (!found) throw new Error('Site not found');
                req.results = found;
                req.site = req.results; // middleware expects this to exist
                next();
            })
            .catch(next);
    })

    // view site
    // ---------
    .get(auth.can('Site', 'view'))
    .get(auth.useReqUser)
    .get(function (req, res, next) {
        res.json(req.results);
    })

    // update site
    // -----------
    .put(auth.useReqUser)
    .put(oauthClients.withAllForSite)
    .put(function (req, res, next) {
        const site = req.results;

        console.log('req.user', req.user);

        if (!(site && site.can && site.can('update'))) return next(new Error('You cannot update this site'));

        console.log('req.body', req.body)

        req.results
            .authorizeData(req.body, 'update')
            .update(req.body)
            .then(result => {
                return checkHostStatus({id: result.id});
            })
            .then(() => {
                next();
            })
            .catch((e) => {
                console.log('eee', e);
                next();
            });
    })

    // update certain parts of config to the oauth client
    // mainly styling settings are synched so in line with the CMS
    .put(function (req, res, next) {
        const authServerUrl = config.authorization['auth-server-url'];
        const updates = [];

        req.siteOAuthClients.forEach((oauthClient, i) => {
            const authUpdateUrl = authServerUrl + '/api/admin/client/' + oauthClient.id;
            const configKeysToSync = ['styling', 'ideas'];

            oauthClient.config = oauthClient.config ? oauthClient.config : {};

            configKeysToSync.forEach(field => {
                oauthClient.config[field] = req.site.config[field];
            });

            const apiCredentials = {
                client_id: oauthClient.clientId,
                client_secret: oauthClient.clientSecret,
            }

            const options = {
                method: 'post',
                headers: {
                    'Content-Type': 'application/json',
                },
                mode: 'cors',
                body: JSON.stringify(Object.assign(apiCredentials, oauthClient))
            }

            updates.push(fetch(authUpdateUrl, options));
        });

        Promise.all(updates)
            .then(() => {
                next()
            })
            .catch((e) => {
                console.log('errr oauth', e);
                next(e)
            });
    })
    // call the site, to let the site know a refresh of the siteConfig is needed
    .put(refreshSiteConfigMw)
    .put(function (req, res, next) {
        // when succesfull return site JSON
        res.json(req.results);
    })
    // delete site
    // ---------
    .delete(auth.can('Site', 'delete'))
    .delete(function (req, res, next) {
        req.results
            .destroy()
            .then(() => {
                res.json({"site": "deleted"});
            })
            .catch(next);
    })

module.exports = router;
