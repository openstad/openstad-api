const Promise = require('bluebird');
const Sequelize = require('sequelize');
const express = require('express');
const createError = require('http-errors');
const config = require('config');
const db = require('../../db');
const auth = require('../../middleware/sequelize-authorization-middleware');
const pagination = require('../../middleware/pagination');
const {Op} = require('sequelize');
const searchResults = require('../../middleware/search-results-user');
const fetch = require('node-fetch');
const rp = require('request-promise');


const formatOAuthApiCredentials = (site, which = 'default') => {
    let siteOauthConfig = (site && site.config && site.config.oauth && site.config.oauth[which]) || {};
    let authClientId = siteOauthConfig['auth-client-id'] || config.authorization['auth-client-id'];
    let authClientSecret = siteOauthConfig['auth-client-secret'] || config.authorization['auth-client-secret'];

    return {
        client_id: authClientId,
        client_secret: authClientSecret,
    }
}

const formatOAuthApiUrl = (site, which = 'default') => {
    let siteOauthConfig = (site && site.config && site.config.oauth && site.config.oauth[which]) || {};
    return siteOauthConfig['auth-server-url'] || config.authorization['auth-server-url'];
}

const filterBody = (req, res, next) => {
    const data = {};
    const keys = ['firstName', 'lastName', 'email', 'phoneNumber', 'streetName', 'houseNumber', 'city', 'suffix', 'postcode', 'password', 'extraData', 'listableByRole', 'detailsViewableByRole', 'password', 'siteData'];
    const adminKeys = ['extraData', 'listableByRole', 'detailsViewableByRole', 'password'];

    keys.forEach((key) => {
        if (req.body[key]) {
            data[key] = req.body[key];
        }
    });

    req.body = data;

    next();
}

const mergeData = (req, res, next) => {
    const data = req.body;
    const bodySiteData = req.body && req.body.siteData ? req.body.siteData : {};
    const userSiteData = req.body && req.body.userSiteData ? req.body.siteData : {};
    data.siteData  = Object.assign(userSiteData, bodySiteData);
    req.body = data;
    next();
}

const router = express.Router({mergeParams: true});

// scopes: for all get requests
/*
router
	.all('*', function(req, res, next) {
		next();
	})
*/

router
    .all('*', function (req, res, next) {

        req.scope = ['includeSite'];
        next();
    });

router.route('/')
    // list users
    // ----------
    // .get(auth.can('User', 'list')) -> now handled by onlyListable
    .get(function (req, res, next) {
        req.scope.push({method: ['onlyListable', req.user.id, req.user.role]});
        next();
    })
    .get(pagination.init)
    .get(function (req, res, next) {
        let {dbQuery} = req;

        if (!dbQuery.where) {
            dbQuery.where = {};
        }

        if (dbQuery.where.q) {
            dbQuery.search = {
                haystack: ['role', 'firstName', 'lastName'],
                needle: dbQuery.where.q,
                offset: dbQuery.offset,
                limit: dbQuery.limit,
                pageSize: dbQuery.pageSize,
            };

            delete dbQuery.where.q;
            delete dbQuery.offset;
            delete dbQuery.limit;
            delete dbQuery.pageSize;
        }

        /**
         * Add siteId to query conditions
         * @type {{siteId: *}}
         */
        const queryConditions = Object.assign(dbQuery.where, {siteId: req.params.siteId});

        db.User
            .scope(...req.scope)
            .findAndCountAll({
                ...dbQuery,
                where: queryConditions,
            })
            .then(function (result) {
                req.results = result.rows;
                req.dbQuery.count = result.count;
                return next();
            })
            .catch(next);
    })
    .get(auth.useReqUser)
    .get(searchResults)
    .get(pagination.paginateResults)
    .get(function (req, res, next) {
        res.json(req.results);
    })

    // create user
    // -----------

   // .post(auth.can('User', 'create'))
    .post(function (req, res, next) {
        if (!req.site) return next(createError(403, 'Site niet gevonden'));
        return next();
    })
    .post(function (req, res, next) {
        console.log('Step 1')
    //    if (!(req.site.config && req.site.config.users && req.site.config.users.canCreateNewUsers)) return next(createError(403, 'Gebruikers mogen niet aangemaakt worden'));
        return next();
    })
    .post(filterBody)
    .post(mergeData)
    .post(function (req, res, next) {
        console.log('Step 2 create a user')
        console.log('reqboy', req.body)

        // Look for an Openstad user with this e-mail
        if (!req.body.email) return next(createError(403, 'E-mail is a required field'));

        const authServerUrl = formatOAuthApiUrl(req.site, 'default');
        const apiCredentials = formatOAuthApiCredentials(req.site, 'default');
        const options = {
            uri: `${authServerUrl}/api/admin/users?email=${req.body.email}`,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            body: apiCredentials,
            json: true
        };

        rp(options)
            .then((result) => {
                if (result && result.data && result.data.length > 0) {
                    req.oAuthUser = result.data[0];
                    next();
                } else {
                    next();
                }
            })
            .catch(next);
    })
    /**
     * In case a user exists for that e-mail in the oAuth api move on, otherwise create it
     * then create it
     */
    .post(function (req, res, next) {
        console.log('Step 3 create a user if note exists')

        if (req.oAuthUser) {
            next();
        } else {
            // in case no oauth user is found with this e-mail create it
            const authServerUrl = formatOAuthApiUrl(req.site, 'default');
            const apiCredentials = formatOAuthApiCredentials(req.site, 'default');
            const apiOptions = formatOAuthApiCredentials(apiCredentials, req.body);
            const options = {
                uri: `${authServerUrl}/api/admin/user`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: Object.assign(req.body, apiCredentials),
                json: true
            }

            rp(options)
                .then((result) => {
                    req.oAuthUser = result;
                    next()
                })
                .catch(next);
        }
    })
    // check if user not already exists in API
    .post(function (req, res, next) {
        console.log('Step 4 check if a user exists')

        db.User
            .scope(...req.scope)
            .findOne({
                where: {email: req.body.email, siteId: req.params.siteId},
                //where: { id: userId }
            })
            .then(found => {
                if (found) {
                    throw createError(401, 'User already exists');
                } else {
                    next();
                }
            })
            .catch(next);
    })
    .post(function (req, res, next) {
        console.log('req.body', req.body)

        const data = {
            ...req.body,
            siteId: req.site.id,
            role: req.body.role ? req.body.role : 'member',
            externalUserId: req.oAuthUser.id
        };

        console.log('data', data)

        db.User
            //.authorizeData(data, 'create', req.user, null, req.site)
            .create(data)
            .then(result => {
                return res.json(result);
            })
            .catch(function (error) {
                // todo: dit komt uit de oude routes; maak het generieker
                if (typeof error == 'object' && error instanceof Sequelize.ValidationError) {
                    let errors = [];

                    error.errors.forEach(function (error) {
                        errors.push(error.message);
                    });

                    res.status(422).json(errors);
                } else {
                    next(error);
                }
            });
    });

// one user
// --------
router.route('/:userId(\\d+)')
    .all(function (req, res, next) {
        const userId = parseInt(req.params.userId) || 1;
        db.User
            .scope(...req.scope)
            .findOne({
                where: {id: userId, siteId: req.params.siteId},
                //where: { id: userId }
            })
            .then(found => {
                if (!found) throw new Error('User not found');
                req.results = found;
                next();
            })
            .catch(next);
    })

    // view idea
    // ---------
    .get(auth.can('User', 'view'))
    .get(auth.useReqUser)
    .get(function (req, res, next) {
        res.json(req.results);
    })

    // update user
    // -----------
    .put(auth.useReqUser)
    .put(filterBody)
    .put(function (req, res, next) {

        const user = req.results;

        if (!(user && user.can && user.can('update'))) return next(new Error('You cannot update this User'));

        const userId = parseInt(req.params.userId, 10);

        const data = req.body;

        if (data.setRole) {
            data.role = 'member';
        }

        /**
         * Update the user API first
         */
        let which = req.query.useOauth || 'default';
        let siteOauthConfig = (req.site && req.site.config && req.site.config.oauth && req.site.config.oauth[which]) || {};
        let authServerUrl = siteOauthConfig['auth-server-url'] || config.authorization['auth-server-url'];
        let authUpdateUrl = authServerUrl + '/api/admin/user/' + req.results.externalUserId;
        let authClientId = siteOauthConfig['auth-client-id'] || config.authorization['auth-client-id'];
        let authClientSecret = siteOauthConfig['auth-client-secret'] || config.authorization['auth-client-secret'];

        const apiCredentials = {
            client_id: authClientId,
            client_secret: authClientSecret,
        }

        const options = {
            method: 'post',
            headers: {
                'Content-Type': 'application/json',
            },
            mode: 'cors',
            body: JSON.stringify(Object.assign(apiCredentials, data))
        }

        fetch(authUpdateUrl, options)
            .then((response) => {
                if (response.ok) {
                    return response.json()
                }

                throw createError(401, 'User already exists, Try to login', response);
            })
            .then((json) => {
                return next();

                return db.User
                    .scope(['includeSite'])
                    .findAll({
                        where: {
                            externalUserId: json.id,
                            // old users have no siteId, this will break the update
                            // skip them
                            // probably should clean up these users
                            siteId:  req.site.id
                        }
                    })
                    .then(function (users) {
                        const actions = [];

                        if (users) {
                            users.forEach((user) => {
                                // only update users with active site (they can be deleteds)

                                /*
                                const keysToSync = ['firstName', 'lastName', 'extraData'];
                                const dataToSync = {};

                                keysToSync.forEach((key) => {
                                    if (data[key]) {
                                        dataToSync[key] = data[key];
                                    }
                                });

                                 */

                                if (user.site) {
                                    actions.push(function () {
                                        return new Promise((resolve, reject) => {
                                            user
                                                .authorizeData(data, 'update', req.user)
                                                .update(data)
                                                .then((result) => {
                                                    resolve();
                                                })
                                                .catch((err) => {
                                                    console.log('err', err)
                                                    reject(err);
                                                })
                                        })
                                    }())
                                }

                            });
                        }

                        return Promise.all(actions)
                            // response has been sent; next has no meaning here
                            // .then(() => { next(); })
                            .catch(err => {
                                console.log(err);
                                throw(err)
                            });

                    })
                    .catch(err => {
                        console.log(err);
                        throw(err)
                    });


            })
            .then((result) => {
                return db.User
                    .scope(['includeSite'])
                    .findOne({
                        where: {id: userId, siteId: req.params.siteId}
                        //where: { id: parseInt(req.params.userId) }
                    })
            })
            .then(found => {
                if (!found) throw new Error('User not found');
                res.json(found);
            })
            .catch(err => {
                console.log(err);
                return next(err);
            });
    })

    // delete idea
    // ---------
    .delete(auth.can('User', 'delete'))
    .delete(async function (req, res, next) {
        const user = req.results;

        /**
         * An oauth user can have multiple users in the api, every site has it's own user and right
         * In case for this oauth user there is only one site user in the API we also delete the oAuth user
         * Otherwise we keep the oAuth user since it's still needed for the other website
         */
        const userForAllSites = await db.User.findAll({where: {externalUserId: user.externalUserId}});


        if (userForAllSites.length <= 1) {
            /*
              @todo move this calls to oauth to own apiClient
             */
            let siteOauthConfig = (req.site && req.site.config && req.site.config.oauth && req.site.config.oauth['default']) || {};
            let authServerUrl = siteOauthConfig['auth-server-url'] || config.authorization['auth-server-url'];
            let authUserDeleteUrl = authServerUrl + '/api/admin/user/' + req.results.externalUserId + '/delete';
            let authClientId = siteOauthConfig['auth-client-id'] || config.authorization['auth-client-id'];
            let authClientSecret = siteOauthConfig['auth-client-secret'] || config.authorization['auth-client-secret'];

            const apiCredentials = {
                client_id: authClientId,
                client_secret: authClientSecret,
            }

            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                mode: 'cors',
                body: JSON.stringify(apiCredentials)
            }

            authUserDeleteUrl = authUserDeleteUrl + '?client_id=' + authClientId + '&client_secret=' + authClientSecret;

            const result = await fetch(authUserDeleteUrl, options);
        }

        /**
         * Delete all connected arguments, votes and ideas created by the user
         */
        await db.Idea.destroy({where: {userId: req.results.id}});
        await db.Argument.destroy({where: {userId: req.results.id}});
        await db.Vote.destroy({where: {userId: req.results.id}});

        /**
         * Make anonymous? Delete posts
         */
        return req.results
            .destroy({force: true})
            .then(() => {
                res.json({"user": "deleted"});
            })
            .catch(next);
    })

module.exports = router;
