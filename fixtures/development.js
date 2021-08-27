const co = require('co');
const moment = require('moment-timezone');
const log = require('debug')('app:db');
const faker = require('faker');
faker.locale = 'nl';

const randomString = (length) => {
  var result = '';
  var characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

const removeProtocol = (url) => {
  return url
    ? url.replace('http://', '').replace('https://', '').replace(/\/$/, '')
    : '';
};

const removeWww = (url) => {
  return url ? url.replace('www.', '') : '';
};

const ensureProtocol = (url) => {
  if (!/^(?:f|ht)tps?\:\/\//.test(url)) {
    url = 'https://' + url;
  }
  return url;
};

module.exports = co.wrap(function* (db) {
  log('--> Creating sites');

  yield sites.map(function (siteData) {
    return db.Site.create(siteData);
  });

  log('Creating users');
  yield users.map(function (userData) {
    return db.User.create(userData, {
      include: [
        {
          model: db.Idea,
          include: [
            {
              model: db.Argument,
              as: 'argumentsAgainst',
            },
            {
              model: db.Argument,
              as: 'argumentsFor',
            },
            {
              model: db.Vote,
            },
          ],
        },
      ],
    });
  });

  log('Creating tags');
  yield tags.map((tagData) => db.Tag.create(tagData));

  log('Creating organisations');
  yield organisations.map((org) => db.Organisation.create(org));

  log('Creating events');
  yield events.map(function (eventData) {
    return db.Event.create(eventData, {
      include: [{ model: db.EventTimeslot, as: 'slots' }, db.Tag],
    });
  });

  log('test database complete');
});

var today = moment().endOf('day');

/**
 * In development setups allow redirect to localhost
 * @type {[type]}
 */
const allowedDomains =
  process.env.NODE_ENV === 'development' ? ['localhost'] : [];
allowedDomains.push(removeProtocol(process.env.ADMIN_URL));
allowedDomains.push(removeWww(removeProtocol(process.env.FRONTEND_URL)));

var sites = [
  {
    id: 1,
    name: 'site-one',
    domain: removeProtocol(process.env.ADMIN_URL),
    title: 'OpenStad Admin ',
    config: {
      oauth: {
        default: {
          'auth-server-url': process.env.AUTH_URL,
          'auth-client-secret': process.env.AUTH_ADMIN_CLIENT_SECRET,
          'auth-client-id': process.env.AUTH_ADMIN_CLIENT_ID,
          'auth-internal-server-url': process.env.AUTH_INTERNAL_SERVER_URL,
        },
      },
      allowedDomains: allowedDomains,
    },
  },
  {
    id: 2,
    name: 'site-one',
    domain: removeWww(removeProtocol(process.env.FRONTEND_URL)),
    title: 'OpenStad Default Site',
    config: {
      cms: {
        url: ensureProtocol(process.env.FRONTEND_URL),
        dbName: process.env.DEFAULT_DB ? process.env.DEFAULT_DB : 'default_db',
        hostname: removeProtocol(process.env.FRONTEND_URL),
      },
      oauth: {
        default: {
          'auth-server-url': process.env.AUTH_URL,
          'auth-client-secret': process.env.AUTH_FIRST_CLIENT_SECRET,
          'auth-client-id': process.env.AUTH_FIRST_CLIENT_ID,
          'auth-internal-server-url': process.env.AUTH_INTERNAL_SERVER_URL,
        },
      },
      allowedDomains: allowedDomains,
    },
  },
];

console.log(sites);
console.log(sites[0].config.oauth);
console.log(sites[1].config.oauth);

var users = [
  //fixed user for SITE and Admin to get admin right
  {
    id: process.env.AUTH_FIXED_USER_ID ? process.env.AUTH_FIXED_USER_ID : 2,
    siteId: 1,
    complete: true,
    role: 'admin',
    email: 'admin@openstad.org',
    password: randomString(10),
    firstName: 'Administrator',
    lastName: '',

    //Add one dummy Idea for fun
    ideas: [
      {
        id: 2,
        siteId: 2,
        startDate: moment(today).subtract(1, 'days'),
        title: 'Metro naar stadsdeel West',
        summary:
          'Een nieuwe metrobuis naar het Bos en Lommerplein om sneller thuis te zijn.',
        description:
          "Ik moet nu een half uur fietsen, dat vind ik veel te lang. Helemaal bezweet op m'n werk aankomen elke dag is echt geen doen; ik wil een extra metrobuis!",
        location: { type: 'Point', coordinates: [52.3779893, 4.8460973] },
        argumentsAgainst: [
          {
            userId: 2,
            sentiment: 'against',
            description:
              'De kosten van dit idee zullen veel te hoog zijn. Daarnaast zal dit project ook weer enorm uit de hand lopen waarschijnlijk, net zoals de vorige metro.',
          },
        ],
        argumentsFor: [
          {
            userId: 2,
            sentiment: 'for',
            description:
              'De metro is cool. Als ik iets mooi vind is het in mn leren jekkie en mn zonnebril op in zon zilveren ding stappen, echt geweldig. En de mensen maar denken, "waar komt die strakke vogel vandaan?"',
          },
        ],
        votes: [{ userId: 2, opinion: 'yes' }],
      },
    ],
  },
];

const now = moment();
const twoMonthsLater = moment().add(2, 'months');

var events = [];
var districs = [
  'Centrum',
  'Nieuw-West',
  'Noord',
  'Oost',
  'West',
  'Weesp',
  'Zuid',
  'Zuidoost',
];
var tags = [
  { id: 1, siteId: 2, name: 'Sport & spel' },
  { id: 2, siteId: 2, name: 'Kunst & cultuur' },
  { id: 3, siteId: 2, name: 'Natuur & gezondheid' },
  { id: 4, siteId: 2, name: 'Beroep & burgerschap' },
  { id: 5, siteId: 2, name: 'Media & techniek' },
  { id: 6, siteId: 2, name: 'Onderwijs' },
  { id: 7, siteId: 2, name: 'Overige' },
];

var organisations = [
  {
    id: 1,
    siteId: 2,
    name: faker.company.companyName(),
    district: districs[faker.mersenne.rand(0, districs.length - 1)],
    phone: faker.phone.phoneNumber('##########'),
    email: faker.internet.email(),
    contactName: faker.name.findName(),
    contactPosition: faker.name.jobTitle(),
    contactEmail: faker.internet.email(),
    contactPhone: faker.phone.phoneNumber('##########'),
    municipalityContactName: faker.name.findName(),
  },
  {
    id: 2,
    siteId: 2,
    name: faker.company.companyName(),
    district: districs[faker.mersenne.rand(0, districs.length - 1)],
    phone: faker.phone.phoneNumber('##########'),
    email: faker.internet.email(),
    contactName: faker.name.findName(),
    contactPosition: faker.name.jobTitle(),
    contactEmail: faker.internet.email(),
    contactPhone: faker.phone.phoneNumber('##########'),
    municipalityContactName: faker.name.findName(),
  },
  {
    id: 3,
    siteId: 2,
    name: faker.company.companyName(),
    district: districs[faker.mersenne.rand(0, districs.length - 1)],
    phone: faker.phone.phoneNumber('##########'),
    email: faker.internet.email(),
    contactName: faker.name.findName(),
    contactPosition: faker.name.jobTitle(),
    contactEmail: faker.internet.email(),
    contactPhone: faker.phone.phoneNumber('##########'),
    municipalityContactName: faker.name.findName(),
  },
];

for (let index = 0; index < 500; index++) {
  const event = {
    siteId: 2,
    name: faker.commerce.product(),
    description: faker.lorem.sentence(),
    location: {
      type: 'Point',
      coordinates: [
        faker.address.latitude(52.4103143, 52.3088568),
        faker.address.longitude(5.0398172, 4.749113),
      ],
    },
    district: districs[faker.mersenne.rand(0, districs.length - 1)],
    minAge: 0,
    maxAge: 18,
    price: faker.commerce.price(),
    attendees: 30,
    information: faker.lorem.sentence(),
    image: faker.image.sports(),
    organisationId: 1,
    tagIds: [1],
    slots: new Array(faker.mersenne.rand(1, 3)).fill(0).map(() => {
      const start = faker.date.between(now, twoMonthsLater);
      const end = moment(start).add(2, 'hours');
      return {
        startTime: start,
        endTime: end,
      };
    }),
  };

  events.push(event);
}
