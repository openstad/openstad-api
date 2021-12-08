var config = require('config')
    , log = require('debug')('app:user')
    , pick = require('lodash/pick');

const Password = require('../lib/password');
const sanitize = require('../util/sanitize');
const userHasRole = require('../lib/sequelize-authorization/lib/hasRole');
const getExtraDataConfig = require('../lib/sequelize-authorization/lib/getExtraDataConfig');
const roles = require('../lib/sequelize-authorization/lib/roles');

const mysqlDateToTime = (myDate) => {
    console.log('myDate', myDate);

    var dateStr=myDate; //returned from mysql timestamp/datetime field
    var a=dateStr.split(" ");
    var d=a[0].split("-");
    var t=a[1].split(":");

    console.log('myDate d', d);
    console.log('myDate d', t);


    var formattedDate = new Date(d[0],(d[1]-1),d[2],t[0],t[1],t[2]);
    return formattedDate;
}

// For detecting throwaway accounts in the email address validation.
var emailBlackList = require('../../config/mail_blacklist')

module.exports = function (db, sequelize, DataTypes) {
    var User = sequelize.define('user', {
        siteId: {
            type: DataTypes.INTEGER,
            defaultValue: config.siteId && typeof config.siteId == 'number' ? config.siteId : 0,
            auth: {
                listableBy: 'admin',
                viewableBy: 'admin',
                createableBy: 'anonymous',
                updateableBy: 'admin',
            }
        },

        accountId: {
            type: DataTypes.INTEGER,
            defaultValue: config.siteId && typeof config.siteId == 'number' ? config.siteId : 0,
        },


        externalUserId: {
            type: DataTypes.INTEGER,
            auth: {
                listableBy: 'admin',
                viewableBy: 'admin',
                createableBy: 'anonymous',
                updateableBy: 'admin',
            },
            allowNull: true,
            defaultValue: null
        },

        externalAccessToken: {
            type: DataTypes.STRING(2048),
            auth: {
                listableBy: 'admin',
                viewableBy: 'admin',
                createableBy: 'admin',
                updateableBy: 'admin',
            },
            allowNull: true,
            defaultValue: null
        },

        role: {
            type: DataTypes.STRING(32),
            allowNull: false,
            defaultValue: 'member',
            validate: {
                isIn: {
                    args: [['unknown', 'anonymous', 'member', 'admin', 'su', 'editor', 'moderator', 'superAdmin']],
                    msg: 'Unknown user role'
                }
            },
            auth:  {
				/**
				 * In case of setting the role
				 * Admin are allowed to set all roles, but moderators only are allowed
				 * to set members.
				 *
				 * @param actionUserRole
				 * @param action (c)
				 * @param user ()
				 * @param self (user model)
				 * @param site (site on which model is queried)
				 */
				authorizeData: function(actionUserRole, action, user, self, site) {
					if (!self) return;

					const updateAllRoles = ['admin'];
					const updateMemberRoles = ['moderator'];
					const fallBackRole = 'anonymous';
					const memberRole = 'member';

					// this is the role for User on which action is performed, not of the user doing the update
          actionUserRole = actionUserRole || self.role;

					// by default return anonymous role if none of the conditions are met
					let roleToReturn;

					// only for create and update check if allowed, the other option, view and list
					// for now its ok if a the public sees the role
					// for fields no DELETE action exists
					if (action === 'create' || action === 'update') {
						// if user is allowed to update all status
						if (userHasRole(user, updateAllRoles)) {
							roleToReturn = actionUserRole;
						// check if active user is allowed to set user's role to member
						} else if (userHasRole(user, updateMemberRoles) && actionUserRole === memberRole) {
							roleToReturn = actionUserRole;
						} else {
							roleToReturn = fallBackRole;
						}

					} else {
						roleToReturn = actionUserRole;
					}

					return roleToReturn;
				},
			},
        },
        // For unknown/anon: Always `false`.
        // For members: `true` when the user profile is complete. This is set
        //              to `false` by default, and should be set to `true`
        //              after the user has completed the registration. Until
        //              then, the 'complete registration' form should be displayed
        //              instead of any other content.

        complete: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },

        siteData : {
            type: DataTypes.JSON,
            allowNull : true,
            defaultValue : {},
            auth: {
                listableBy: ['editor', 'owner'],
                viewableBy: ['editor', 'owner'],
                createableBy: 'anonymous',
                updateableBy: ['editor', 'owner'],
            },
        },

        subscriptionData : {
            type: DataTypes.JSON,
            allowNull : true,
            defaultValue : {},
            auth: {
                listableBy: ['editor', 'owner'],
                viewableBy: ['editor', 'owner'],
                createableBy: ['editor'],
                updateableBy: ['editor'],
            },
        },

        extraData:  {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: {},
            get: function () {
                let value =  this.getDataValue('extraData');
                try {
                    if (typeof value == 'string') {
                        value = JSON.parse(value);
                    }
                } catch (err) {
                }

                return value;
            },
            set: function (value) {
                try {
                    if (typeof value == 'string') {
                        value = JSON.parse(value);
                    }
                } catch (err) {
                }

                let oldValue =  this.getDataValue('extraData') || {};

                // new images replace old images
                if (value && value.images) {
                    oldValue.images = [];
                }

                try {
                    if (typeof oldValue == 'string') {
                        oldValue = JSON.parse(oldValue) || {};
                    }
                } catch (err) {
                }

                function fillValue(old, val) {
                    old = old || {};
                    Object.keys(old).forEach((key) => {
                        if (val[key] && typeof val[key] == 'object') {
                            return fillValue(old[key], val[key]);
                        }
                        if (val[key] === null) {
                            // send null to delete fields
                            delete val[key];
                        } else if (typeof val[key] == 'undefined') {
                            // not defined in put data; use old val
                            val[key] = old[key];
                        }

                        if (typeof val[key] === 'string') {
                            val[key] = sanitize.safeTags(val[key]);
                        }
                    });
                }

                fillValue(oldValue, value);

                // ensure images is always an array
                if (value.images && typeof value.images === 'string') {
                    value.images = [value.images];
                }

                this.setDataValue('extraData', value);
            },
            auth: {
                listableBy: ['editor', 'owner'],
                viewableBy: ['editor', 'owner'],
                updateableBy: ['editor', 'owner'],
                authorizeData: function(data, action, user, self, site) {

                    if (!site) return; // todo: die kun je ophalen als eea. async is
                    data = data || self.extraData;
                    data = typeof data === 'object' ? data : {};
                    let result = {};

                    let userId = self.userId;
                    if (self.toString().match('SequelizeInstance:user')) { // TODO: find a better check
                        userId = self.id
                    }

                    if (data) {
                        Object.keys(data).forEach((key) => {

                            let testRole = site.config && site.config['users'] && site.config['users'].extraData && site.config['users'].extraData[key] && site.config['users'].extraData[key].auth && site.config['users'].extraData[key].auth[action+'ableBy'];
                            testRole = testRole || self.rawAttributes.extraData.auth[action+'ableBy'];
                            testRole = testRole || ( self.auth && self.auth[action+'ableBy'] ) || [];
                            if (!Array.isArray(testRole)) testRole = [testRole];

                            if (testRole.includes('detailsViewableByRole')) {
                                if (self.detailsViewableByRole) {
                                    testRole = [ self.detailsViewableByRole, 'owner' ];
                                }
                            }

                            if (userHasRole(user, testRole, userId)) {
                                result[key] = data[key];
                            }
                        });
                    }

                    return result;
                },
            }
        },

        email: {
            type: DataTypes.STRING(255),
            auth: {
                listableBy: ['editor', 'owner'],
                viewableBy: ['editor', 'owner'],
                createableBy: 'anonymous',
                updateableBy: ['editor', 'owner'],
            },
            allowNull: true,
            validate: {
                isEmail: {
                    msg: 'Invalid email address'
                },
                notBlackListed: function (email) {
                    var match = email && email.match(/^.+@(.+)$/);
                    if (match) {
                        let domainName = match[1];
                        if (domainName in emailBlackList) {
                            throw Error('Graag je eigen emailadres gebruiken; geen tijdelijk account');
                        }
                    }
                }
            }
        },

        password: {
            type: DataTypes.VIRTUAL,
            allowNull: true,
            defaultValue: null,
            auth: {
                listableBy: 'none',
                viewableBy: 'none',
            },
            validate: {
                len: {
                    args: [6, 64],
                    msg: 'Password should be between 6 and 64 characters'
                }
            },
            set: function (password) {
                var method = config.get('security.passwordHashing.currentMethod');
                this.setDataValue('password', password);
                this.set('passwordHash', password ?
                    Password[method].hash(password) :
                    null
                );
            }
        },

        passwordHash: {
            type: DataTypes.TEXT,
            auth: {
                listableBy: ['editor', 'owner'],
                viewableBy: ['editor', 'owner'],
                createableBy: ['editor', 'owner'],
                updateableBy: ['editor', 'owner'],
            },
            allowNull: true,
            set: function (hashObject) {
                var hash = hashObject ? JSON.stringify(hashObject) : null;
                this.setDataValue('passwordHash', hash);
            }
        },

        nickName: {
            type: DataTypes.STRING(64),
            auth: {
                listableBy: ['editor', 'owner'],
                viewableBy: ['editor', 'owner'],
                createableBy: ['editor', 'owner'],
                updateableBy: ['editor', 'owner'],
            },
            allowNull: true,
            set: function (value) {
                this.setDataValue('nickName', sanitize.noTags(value));
            }
        },

        firstName: {
            type: DataTypes.STRING(64),
            auth: {
                listableBy: ['editor', 'owner'],
                viewableBy: ['editor', 'owner'],
                createableBy: 'anonymous',
                updateableBy: ['editor', 'owner'],
            },
            allowNull: true,
            set: function (value) {
                this.setDataValue('firstName', sanitize.noTags(value));
            }
        },

        lastName: {
            type: DataTypes.STRING(64),
            auth: {
                listableBy: ['editor', 'owner'],
                viewableBy:  ['editor', 'owner'],
                createableBy: 'anonymous',
                updateableBy: ['editor', 'owner'],
            },
            allowNull: true,
            set: function (value) {
                this.setDataValue('lastName', sanitize.noTags(value));
            }
        },

        listableByRole: {
            type: DataTypes.ENUM('admin', 'moderator', 'editor', 'member', 'anonymous', 'all'),
            defaultValue: null,
            auth: {
                viewableBy: ['editor', 'owner'],
                updateableBy: ['editor', 'owner'],
            },
            allowNull: true,
        },

        detailsViewableByRole: {
            type: DataTypes.ENUM('admin', 'moderator', 'editor', 'member', 'anonymous', 'all'),
            defaultValue: null,
            auth: {
                viewableBy: ['editor', 'owner'],
                updateableBy: ['editor', 'owner'],
            },
            allowNull: true,
        },

        phoneNumber: {
            type: DataTypes.STRING(64),
            auth: {
                listableBy: ['editor', 'owner'],
                viewableBy: ['editor', 'owner'],
                createableBy: ['editor', 'owner'],
                updateableBy: ['editor', 'owner'],
            },
            allowNull: true,
            set: function (value) {
                this.setDataValue('phoneNumber', sanitize.noTags(value));
            }
        },

        streetName: {
            type: DataTypes.STRING(64),
            auth: {
                listableBy: ['editor', 'owner'],
                viewableBy: ['editor', 'owner'],
                createableBy: ['editor', 'owner'],
                updateableBy: ['editor', 'owner'],
            },
            allowNull: true,
            set: function (value) {
                this.setDataValue('streetName', sanitize.noTags(value));
            }
        },

        houseNumber: {
            type: DataTypes.STRING(64),
            auth: {
                listableBy: ['editor', 'owner'],
                viewableBy: ['editor', 'owner'],
                createableBy: ['editor', 'owner'],
                updateableBy: ['editor', 'owner'],
            },
            allowNull: true,
            set: function (value) {
                this.setDataValue('houseNumber', sanitize.noTags(value));
            }
        },

        postcode: {
            type: DataTypes.STRING(64),
            auth: {
                listableBy: ['editor', 'owner'],
                viewableBy: ['editor', 'owner'],
                createableBy: ['editor', 'owner'],
                updateableBy: ['editor', 'owner'],
            },
            allowNull: true,
            set: function (value) {
                this.setDataValue('postcode', sanitize.noTags(value));
            }
        },

        city: {
            type: DataTypes.STRING(64),
            auth: {
                listableBy: ['editor', 'owner'],
                viewableBy: ['editor', 'owner'],
                createableBy: ['editor', 'owner'],
                updateableBy: ['editor', 'owner'],
            },
            allowNull: true,
            set: function (value) {
                this.setDataValue('city', sanitize.noTags(value));
            }
        },

        suffix: {
            type: DataTypes.STRING(64),
            auth: {
                listableBy: ['editor', 'owner'],
                viewableBy: ['editor', 'owner'],
                createableBy: ['editor', 'owner'],
                updateableBy: ['editor', 'owner'],
            },
            allowNull: true,
            set: function (value) {
                this.setDataValue('suffix', sanitize.noTags(value));
            }
        },


        /**
         *
         */
        access: {
            auth: {
                listableBy: ['editor', 'owner'],
                viewableBy: ['editor', 'owner'],
                createableBy: ['editor', 'owner'],
                updateableBy: ['editor'],
            },
            type: DataTypes.VIRTUAL,
            allowNull: true,
            get: function () {
                const accountTypes = ['trial', 'paid', 'manual', 'none'];
               // const trialDate = this.getDataValue('trialDate');
                const subscriptionData = this.getDataValue('subscriptionData') ? this.getDataValue('subscriptionData') : {};
                const extraData = this.getDataValue('extraData') ? this.getDataValue('extraData') : {};

                const activeSubscription = subscriptionData && subscriptionData.subscriptions && subscriptionData.subscriptions.find((subscription) => {
                    console.log('MsubscriptionData.subscriptionCancelledButStillValidTill', subscription.subscriptionCancelledButStillValidTill)

                    // if not active but the cancellatidon date was before last payment was still vali
                    if (!subscription.active && subscription.subscriptionCancelledButStillValidTill) {
                        const nowTime = Date.now();
                        console.log('Mysql time in datatata', subscription.subscriptionCancelledButStillValidTill)

                     //   const mysqlTime = mysqlDateToTime(subscription.subscriptionCancelledButStillValidTill + ' 23:00:00');

                        const mysqlTime = new Date(subscription.subscriptionCancelledButStillValidTill+ ' 06:00:00').getTime();

                        console.log('Mysql time in active', mysqlTime);

                        const isPassed =  mysqlTime < nowTime;
                        console.log('isPassed', isPassed);

                        // if not passed
                        return !isPassed;
                    } else {
                        return subscription.active;
                    }
                });

                const access = {};

                if (!!activeSubscription) {
                    access.subscriptionId = activeSubscription.subscriptionProductId;
                    access.active = true;
                }

                // true might be a string, sucks, but thats life for now
                if (!activeSubscription && subscriptionData && (subscriptionData.manualSubscription === 'true' || subscriptionData.manualSubscription === true)) {
                    access.active = true;
                    access.subscriptionId = subscriptionData.manualSubscriptionProductId;
                }

                //old way of setting isSubscriberActive

                if (activeSubscription && activeSubscription.planId) {
                    access.planId  = activeSubscription.planId;
                }

                if (!access.active && extraData && extraData.isActiveSubscriber && extraData.isActiveSubscriber === 'yes') {
                    access.active = true;
                    access.planId = access.planId ? access.planId : extraData &&  extraData.planId ?  extraData.planId : 1;
                }

                // mollie cancels subscriptions immedeatily, so we register the subscription as cancelled
                // and inactive. but we still allow access till
                console.log('MsubscriptionData.subscriptionCancelledButStillValidTill', subscriptionData.subscriptionCancelledButStillValidTill)



                /*
                if (!activeSubscription && trialDate) {
                    @todo implement trial
                }
                 */

                console.log('access', access)


                // if subscribers
                return access;
            }
        },

        fullName: {
            auth: {
                listableBy: ['editor', 'owner'],
                viewableBy: ['editor', 'owner'],
                createableBy: ['editor', 'owner'],
                updateableBy: ['editor', 'owner'],
            },
            type: DataTypes.VIRTUAL,
            allowNull: true,
            get: function () {
                var firstName = this.getDataValue('firstName') || '';
                var lastName = this.getDataValue('lastName') || '';
                return firstName || lastName ?
                    (firstName + ' ' + lastName) :
                    undefined;
            }
        },

        initials: {
            auth: {
                listableBy: ['editor', 'owner'],
                viewableBy: ['editor', 'owner'],
                createableBy: ['editor', 'owner'],
                updateableBy: ['editor', 'owner'],
            },
            type: DataTypes.VIRTUAL,
            allowNull: true,
            get: function () {
                var firstName = this.getDataValue('firstName') || '';
                var lastName = this.getDataValue('lastName') || '';
                var initials = (firstName ? firstName.substr(0, 1) : '') +
                    (lastName ? lastName.substr(0, 1) : '');
                return initials.toUpperCase();
            }
        },

        gender: {
            auth: {
                listableBy: ['editor', 'owner'],
                viewableBy: ['editor', 'owner'],
                createableBy: ['editor', 'owner'],
                updateableBy: ['editor', 'owner'],
            },
            type: DataTypes.ENUM('male', 'female'),
            allowNull: true,
            defaultValue: null,
        },

        zipCode: {
            auth: {
                listableBy: ['editor', 'owner'],
                viewableBy: ['editor', 'owner'],
                createableBy: ['editor', 'owner'],
                updateableBy: ['editor', 'owner'],
            },
            type: DataTypes.STRING(10),
            auth: {
                listableBy: ['editor', 'owner'],
                viewableBy: ['editor', 'owner'],
                createableBy: ['editor', 'owner'],
                updateableBy: ['editor', 'owner'],
            },
            allowNull: true,
            validate: {
                is: {
                    args: [/^\d{4} ?[a-zA-Z]{2}$/],
                    msg: 'Invalid postcode'
                }
            },
            set: function (zipCode) {
                zipCode = zipCode ? String(zipCode).trim() : null;
                this.setDataValue('zipCode', zipCode);
            },

            postcode: {
                auth: {
                    listableBy: ['editor', 'owner'],
                    viewableBy: ['editor', 'owner'],
                    createableBy: ['editor', 'owner'],
                    updateableBy: ['editor', 'owner'],
                },
                type: DataTypes.STRING(10),
                auth: {
                    listableBy: ['editor', 'owner'],
                    viewableBy: ['editor', 'owner'],
                    createableBy: ['editor', 'owner'],
                    updateableBy: ['editor', 'owner'],
                },
                allowNull: true,
                validate: {
                    is: {
                        args: [/^\d{4} ?[a-zA-Z]{2}$/],
                        msg: 'Invalid postcode'
                    }
                },
                set: function (zipCode) {
                    zipCode = zipCode != null ?
                        String(zipCode).trim() :
                        null;
                    this.setDataValue('zipCode', zipCode);
                },
            },
        },

        // signedUpForNewsletter: {
        //  	type         : DataTypes.BOOLEAN,
        //  	allowNull    : false,
        //  	defaultValue : false
        // },

    }, {
        charset: 'utf8',

        /*	indexes: [{
                fields: ['email'],
                unique: true
            }],*/


        validate: {
            hasValidUserRole: function () {
                if (this.id !== 1 && this.role === 'unknown') {
                    throw new Error('User role \'unknown\' is not allowed');
                }
            },
            // isValidAnon: function() {
            // 	if( this.role === 'unknown' || this.role === 'anonymous' ) {
            // 		if( this.complete || this.email ) {
            // 			throw new Error('Anonymous users cannot be complete profiles or have a mail address');
            // 		}
            // 	}
            // },
            isValidMember: function () {
                // dit is niet langer relevant; mijnopenstad bepaald wat je default rol is
                // if( this.role !== 'unknown' && this.role !== 'anonymous' ) {
                //  	if( !this.email ) {
                //  		throw new Error('Onjuist email adres');
                //  	} else if( this.complete && (!this.firstName || !this.lastName) ) {
                //  		throw new Error('Voor- en achternaam zijn verplichte velden');
                //  	}
                // }
            },
            onlyMembersCanLogin: function () {
                if (this.role === 'unknown' || this.role === 'anonymous') {
                    if (this.passwordHash) {
                        throw new Error('Anonymous profiles cannot have login credentials');
                    }
                }
            }
        },

    });

    User.scopes = function scopes() {

        return {
            includeSite: {
                include: [{
                    model: db.Site,
                }]
            },

            sort: function (sort) {

                let result = {};

                var order;
                switch (sort) {
                    case 'votes_desc':
                        // TODO: zou dat niet op diff moeten, of eigenlijk configureerbaar
                        order = sequelize.literal('yes DESC');
                        break;
                    case 'votes_asc':
                        // TODO: zou dat niet op diff moeten, of eigenlijk configureerbaar
                        order = sequelize.literal('yes ASC');
                        break;
                    case 'random':
                        // TODO: zou dat niet op diff moeten, of eigenlijk configureerbaar
                        order = sequelize.random();
                        break;
                    case 'createdate_asc':
                        order = [['createdAt', 'ASC']];
                        break;
                    case 'createdate_desc':
                        order = [['createdAt', 'DESC']];
                        break;
                    case 'budget_asc':
                        order = [['createdAt', 'ASC']];
                        break;
                    case 'budget_desc':
                        order = [['createdAt', 'DESC']];
                        break;

                    case 'date_asc':
                        order = [['endDate', 'ASC']];
                        break;
                    case 'date_desc':
                    default:
                        order = sequelize.literal(`
							CASE status
								WHEN 'ACCEPTED' THEN 4
								WHEN 'OPEN'     THEN 3
								WHEN 'BUSY'     THEN 2
								WHEN 'DENIED'   THEN 0
								                ELSE 1
							END DESC,
							endDate DESC
						`);

                }

                result.order = order;

                return result;

            },

            onlyListable: function (userId, userRole = 'all') {

                // todo: hij kan alleen tegen een enkelvoudige listableBy
                // todo: owner wordt nu altijd toegevoegd, dat moet alleen als die in listableBy staat, maar zie vorige regel
                // todo: gelijkttrekken met Idea.onlyVisible: die is nu exclusive en deze inclusive

                let requiredRole = this.auth && this.auth.listableBy || 'all';

                // if requiredRole == all then listableByRole is not relevant and neither is userRole
                if (requiredRole === 'all') return;

                // if requiredRole != all then listableByRole is allowing

                // null should be seen as requiredRole
                let requiredRoleEscaped = sequelize.escape(requiredRole);
                let rolesEscaped = sequelize.escape(roles[userRole])
                let nullCondition = `${requiredRoleEscaped} IN (${rolesEscaped})`;

                let where;
                if (userId) {
                    where = sequelize.or(
                        {id: userId}, // owner
                        {listableByRole: roles[userRole] || 'none'}, // allow when userRole is good enough
                        sequelize.and( // or null and userRole is at least requiredRole
                            {listableByRole: null},
                            sequelize.literal(nullCondition)
                        ),
                    )
                } else {
                    where = sequelize.or(
                        {listableByRole: roles[userRole] || 'none'}, // allow when userRole is good enough
                        sequelize.and( // or null and userRole is at least requiredRole
                            {listableByRole: null},
                            sequelize.literal(nullCondition)
                        ),
                    )
                }

                return {where};

            },

            includeVote: {
                include: [{
                    model: db.Vote,
                }]
            },


            onlyVisible: function (userId, userRole) {
                if (userId) {
                    return {
                        where: sequelize.or(
                            {id: userId},
                            {viewableByRole: 'all'},
                            {viewableByRole: roles[userRole] || 'all'},
                        )
                    };
                } else {
                    return {
                        where: sequelize.or(
                            {viewableByRole: 'all'},
                            {viewableByRole: roles[userRole] || 'all'},
                        )
                    };
                }
            },

        }
    }

    User.associate = function (models) {
        this.hasMany(models.Article);
        this.hasMany(models.Idea);
        this.hasMany(models.Vote);
        this.hasMany(models.Argument);
        this.belongsTo(models.Site);
    }

    User.prototype.authenticate = function (password) {
        var method = config.get('security.passwordHashing.currentMethod');
        if (!this.passwordHash) {
            log('user %d has no passwordHash', this.id);
            return false;
        } else {
            var hash = JSON.parse(this.passwordHash);
            var result = Password[method].compare(password, hash);
            log('authentication for user %d %s', this.id, result ? 'succeeded' : 'failed');
            return result;
        }
    }

    User.prototype.hasCompletedRegistration = function () {
        return this.email && this.complete // && this.isMember();
    }

    User.prototype.isUnknown = function () {
        return this.role === 'unknown';
    }

    User.prototype.isAnonymous = function () {
        return this.role === 'anonymous';
    }

    User.prototype.isMember = function () {
        return this.role !== 'unknown' && this.role !== 'anonymous';
    }

    User.prototype.isAdmin = function () {
        return this.role === 'admin' || this.role === 'su';
    }

    User.prototype.isLoggedIn = function () {
        return this.id && this.id !== 1 && this.isMember();
    }

    User.prototype.getUserVoteIdeaId = function () {
        let self = this;
        return db.Vote
            .findOne({where: {userId: self.id}})
            .then(vote => {
                return vote ? vote.ideaId : undefined;
            })
    }

    User.prototype.hasVoted = function () {
        let self = this;
        return db.Vote
            .findOne({where: {userId: self.id}})
            .then(vote => {
                return vote ? true : false;
            })
    }

    User.prototype.hasConfirmed = function () {
        let self = this;
        return db.Vote
            .findOne({where: {userId: self.id, confirmed: 1, confirmIdeaId: null}})
            .then(vote => {
                return vote ? true : false;
            })
    }

    User.auth = User.prototype.auth = {
        listableBy: 'editor',
        viewableBy: 'all',
        createableBy: 'editor',
        updateableBy: ['editor', 'owner'],
        deleteableBy: ['editor', 'owner'],


        canCreate: function(user, self) {

            // copy the base functionality
            self = self || this;

            if (!user) user = self.auth && self.auth.user;
            if (!user || !user.role) user = { role: 'all' };

            let valid = userHasRole(user, self.auth && self.auth.updateableBy, self.id);

            // extra: geen acties op users met meer rechten dan je zelf hebt
            valid = valid && (!self.role || userHasRole(user, self.role));

            return valid;

        },

        canUpdate: function(user, self) {

            // copy the base functionality
            self = self || this;

            if (!user) user = self.auth && self.auth.user;
            if (!user || !user.role) user = { role: 'all' };

            let valid = userHasRole(user, self.auth && self.auth.updateableBy, self.id);

            // extra: isOwner through user on different site
            valid = valid || ( self.externalUserId && self.externalUserId == user.externalUserId );

            // extra: geen acties op users met meer rechten dan je zelf hebt
            valid = valid && userHasRole(user, self.role);

            return valid;

        },

        canDelete: function(user, self) {

            // copy the base functionality
            self = self || this;

            if (!user) user = self.auth && self.auth.user;
            if (!user || !user.role) user = { role: 'all' };

            let valid = userHasRole(user, self.auth && self.auth.updateableBy, self.id);

            // extra: geen acties op users met meer rechten dan je zelf hebt
            valid = valid && userHasRole(user, self.role);

            return valid;

        },
    }



    return User;
};
