const k8s = require('@kubernetes/client-node');
const serverPublicIP = process.env.PUBLIC_IP;
const dns = require('dns');
const db = require('../db');

/**
 * Ingress files get created / deleted
 *
 * Principle is auto correct everything. Not CRUD one by one, but
 *
 * Ingress files are the vhosts of Kubernetes, they tell the server what code should manage what domain, what server settings and headers are connected
 * and what SSL certs should be loaded
 *
 * On a CRUD action we run through all sites, and check if changes, so EDIT / DELETE / CREATE, is all the same logic.
 * This is because, edit of a domain is sometimes also a delete. (if we go from denhaag.cms.openstad.org to stem.denhaag.nl the old domain should be removed)
 * And some sites run on a subdirectory: openstad.org/site1. Then we need to make sure the openstad.org domain exists.
 * So there can be sites with domain.com, domain.com/site, etc. In this case only one ingress file should be made, handling multiple sites
 *
 *
 *
 * Some other caveats:
 *  - Some sites have www added, some not
 *    If we add www. standard always then the auto certificates won't be valid for wildcard dns because Let's encrypt will try to validate both www. and non www
 *    and it's DNS wise not allowed to set www.*.subdomain, so therefore if www. is wanted it can be turned on in the site settings via the UI (site.config.ingress.www)
 *
 *  - When DNS is not set to the server, then no ingress will be created, it will be deleted as long as DNS not properly set, then added again once turned on
 *
 *   - It's possible to not create ingress for site by adding site.config.ingress.disabled: true
 *
 *   - It's possible to set www. for site in site.config.ingress.www: true
 *
 *   - It's possible to set the secret tls key in ingress for custom ssl, this skips installing an automatic cert by certmanager, it doesn't validate whether the secret is a valid SSL or exists
 *
 *   Examples:
 *   - site.acc.openstad.org with site.config.ingress.www: true, should only make an ingress if both site.acc.openstad.org and www.site.acc.openstad.org point to the server, this because SSL won't be able to be validated by cert manager
 *   - in case DNS site.acc.openstad.org and www.site.acc.openstad.org is pointing to the server ip, and the www. gets deleted, the ingress will also be removed automatically once a check is done
 *   - in case of adding a secret tls key in ingress for custom ssl
 */

const dnsLookUp = (domain) => {
  return new Promise((resolve, reject) => {
    dns.lookup(domain, (err, address, family) => {
      if (err) reject(err);
      resolve(address);
    });
  });
};

const getHostnameFromRegex = (url) => {
  var prefix = 'https://';

  if (url.substr(0, prefix.length) !== prefix) {
    url = prefix + url;
  }
  // run against regex
  const matches = url ? url.match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i) : false;
  // extract hostname (will be null if no match is found)
  let hostname = matches && matches[1];

  console.log('hostname', hostname)

  if (hostname.startsWith('www.')) {
    hostname = url.substr('www.'.length);
  }

  return hostname;
}

const getK8sApi = () => {
  const kc = new k8s.KubeConfig();
  kc.loadFromCluster();
  return k8sApi = kc.makeApiClient(k8s.NetworkingV1beta1Api);
}


const shouldDomainHaveWww = (sites, domain) => {
  const sitesForDomain = getSitesForDomain(sites, domain);



  // if one site has www. set, we assume should be for all
  const sitesWithWww = sitesForDomain.filter((site) => {
    if (site.config) {
      console.log('shouldDomainHaveWww  site.config.ingress ', site.config.ingress )
    }

    return site.config && site.config.ingress && site.config.ingress.www && (site.config.ingress.www === 'true' || site.config.ingress.www === true);
  });

  console.log('shouldDomainHaveWww for domain', domain, sitesWithWww)

  return sitesWithWww && sitesWithWww.length > 0;
}

const getTlsSecretNameForDomain = (sites, domain) => {
  const sitesForDomain = getSitesForDomain(sites, domain);

  let secretName = '';

  // when multiple sites have different secretnames, that will cause an issue
  // will select the latest
  // it's unlikely to lead to bugs however.
  // since users only set this if they explicitly install tls
  // if empty let's encrypt takes care of it
  sitesForDomain.forEach((site) => {
    if (!secretName) {
      secretName = site.config && site.config.ingress && site.config.ingress.tlsSecretName ? site.config.ingress.tlsSecretName : false;
    }
  });

  return secretName ? secretName : false;
}

const getSitesForDomain = (sites, domain) => {
  return sites.filter((site) => {
    return domain === getHostnameFromRegex(site.domain);
  });
}


/**
 *
 * @param domain
 * @returns {Promise<*>}
 */
const deleteIngress = async (ingressName) => {
  return getK8sApi().deleteNamespacedIngress(ingressName, process.env.KUBERNETES_NAMESPACE);
};

const add = async (ingressName, domain, addWww, tslSecret) => {
  return getK8sApi().createNamespacedIngress(process.env.KUBERNETES_NAMESPACE, getIngressBody(ingressName, domain, addWww, tslSecret));
};

const update = async (ingressName, domain, addWww, tslSecret) => {
  return getK8sApi().replaceNamespacedIngress(ingressName, process.env.KUBERNETES_NAMESPACE, getIngressBody(ingressName, domain, addWww, tslSecret));
};


/**
 * Create a unique name based upon the domain
 * @param domain
 * @returns {*}
 */
const formatIngressName = (domain) => {
  return Math.round(new Date().getTime() / 1000) + domain.replace(/\W/g, '').slice(0, 40);
}

/**
 * Return the body to create / replace a namespaced ingress through the API
 *
 * @param domain
 * @returns {{metadata: {name: *, annotations: {"cert-manager.io/cluster-issuer": string, "kubernetes.io/ingress.class": string}}, apiVersions: string, kind: string, spec: {rules: [{host: *, http: {paths: [{path: string, backend: {servicePort: number, serviceName: string}}]}}], tls: [{secretName: *, hosts: [*]}]}}}
 */
const getIngressBody = (ingressName, domain, addWww, secretName) => {
  const domains = [domain];

  if (addWww) {
    domains.push('www.' + domain);
  }

  return {
    apiVersions: 'networking.k8s.io/v1beta1',
    kind: 'Ingress',
    metadata: {
      labels: {
        type: 'user-site'
      },
      name: ingressName,
      annotations: {
        'cert-manager.io/cluster-issuer': 'openstad-letsencrypt-prod', // Todo: make this configurable
        'kubernetes.io/ingress.class': 'nginx',
        'nginx.ingress.kubernetes.io/from-to-www-redirect': "true",
        'nginx.ingress.kubernetes.io/proxy-body-size': '5280m',
        'nginx.ingress.kubernetes.io/configuration-snippet': `more_set_headers "X-Content-Type-Options: nosniff";
more_set_headers "X-Frame-Options: SAMEORIGIN";
more_set_headers "X-Xss-Protection: 1";
more_set_headers "Referrer-Policy: same-origin";`
      }
    },
    spec: {
      rules: [{
        host: domain,
        http: {
          paths: [{
            backend: {
              serviceName: 'openstad-frontend', // Todo: make this configurable
              servicePort: 4444 // Todo: make this configurable
            },
            path: '/'
          }]
        }
      }],
      tls: [{
        secretName: secretName ? secretName : ingressName,
        hosts: domains
      }]
    }
  }
};
const getAll = async () => {
  let response = await getK8sApi().listNamespacedIngress(process.env.KUBERNETES_NAMESPACE);
  response = response.response ? response.response : {};
  return response.body && response.body.items ? response.body.items : [];
}

exports.getAll = getAll;

/***
 * There are many domains
 */
exports.ensureIngressForAllDomains = async () => {

  console.log('ensureIngressForAllDomains process.env.KUBERNETES_NAMESPACE', process.env.KUBERNETES_NAMESPACE);


  if (!process.env.KUBERNETES_NAMESPACE) {
    return false;
  }


  let sites;

  // fetch the domain fresh, so always the latest sites
  try {
    sites = await db.Site.fetchAll({
      raw: true
    });

    console.log('Sites: ', sites);

   /* sites = sites.map((site) => {
        return site.get({plain: true})
    })*/
  } catch (e) {
    console.log('error while fetching all sites')
    throw Error(e);
  }

  console.log('sites', sites)

  if (!Array.isArray(sites) || sites.length === 0) {
    return false;
  }

  let domains = sites.filter((site) => {
    const ingressDisabled = site && site.config && site.config.ingress && site.config.ingress.disabled;
    return !!site.domain && !ingressDisabled;
  }).map((site) => {
    return site.domain;
  });

  console.log('All domains 1', domains);

  // make sure we have a consistent root
  domains = domains.map((domain, index, self) => {
    return getHostnameFromRegex(domain);
  });

  console.log('All domains 2', domains);

  // filter to make sure unique domains
  domains = domains.filter((value, index, self) => {
    return self.indexOf(value) === index;
  });

  console.log('All domains 3', domains);

  const domainsToCreate = [];
  const domainsToUpdate = {};

  const ingresses = await getAll();

  domains.forEach((domain) => {
    domain = getHostnameFromRegex(domain);

    const ingress = ingresses.find((ingress) => {
      const domainsInThisIngress = ingress.spec && ingress.spec.rules && ingress.spec.rules.map((rule) => {
        return rule.host;
      });

      console.log('Get ingress for domain check see if domain is in here ', domain);

      return domainsInThisIngress.includes(domain);
    });

    console.log('Found ingress', ingress);

    /**
     * In case no ingress exists for this domain add to create
     */
    if (!ingress) {
      console.log('Create ingress for domain because no ingress is present', domain);
      domainsToCreate.push(domain);
    } else  {
      const domainsInThisIngress = ingress.spec && ingress.spec.rules && ingress.spec.rules.map((rule) => {
        return rule.host;
      });
      // if there is more then one, it\s www. and gets stripped anyway, so doesnt matter

      // if ingesss exists check if domain
      const hasWww = !!domainsInThisIngress.find((domain) => {
        domain.startsWith('www.')
      });

      const secretNameForDomain =  getTlsSecretNameForDomain(sites, domain);

      const addWww = shouldDomainHaveWww(sites, domain);

      const tslConfigForDomain = ingress.spec && ingress.spec.tls && ingress.spec.tls.find((config) => {
        return config.hosts.includes(domain);
      });

      const updateTlsSecretname = !!tslConfigForDomain.sercretName !== !!secretNameForDomain;

      if(addWww || updateTlsSecretname) {
        domainsToUpdate[domain] = {
          domain: domain,
          ingressName: ingress.metadata.name
        }
      }
    }
  });

  const domainsInIngress = {};

  ingresses.forEach((ingress) => {
    const domainsFound = ingress.spec && ingress.spec.rules && ingress.spec.rules.map((rule) => {
      return rule.host;
    });

    // cert manager makes temporary ingress files in order to be able to validate the domain for an SSL certificate,
    // dont use these ingresses
    // it's better to filter on the labels we add while creating the ingress via the admin panel
    // this is more stable, but because of backwards compatibmlity not implemented at the moment.
    const isCertManagerResolver = ingress && ingress.metadata && ingress.metadata.generateName && ingress.metadata.generateName === 'acm-acme-http-solver-';

    if (!isCertManagerResolver) {
      domainsFound.forEach((domain) => {
        domainsInIngress[domain] = {
          domain: domain,
          ingressName: ingress.metadata.name
        };
      })
    }

  });

  const systemIngresses = ['openstad-admin', "openstad-frontend", "openstad-image", "openstad-api", "openstad-auth"];

  // filter all domains present
  let domainsToDelete = Object.keys(domainsInIngress).filter((domainInIngress) => {
    // when domain is in ingress, but not in the database, remove it.

    return !domains.find(domain => domain === domainInIngress);
  }).filter((domainInIngress) => {
    const ingressData = domainsInIngress[domainInIngress];
    // never delete ingress from system
    return !systemIngresses.find(ingressName => ingressName === ingressData.ingressName)
  })

  console.log('domainsToCreate', domainsToCreate);
  console.log('domainsToUpdate', domainsToUpdate);

  /**
   * Get all site objects with domain as hostname
   * Often it's only one domain like: westbegroot.amsterdam.nl
   *
   * But also possible to have multiple:
   *
   * So for instance
   *  - stemmen.amsterdam.nl/site1
   *  - stemmen.amsterdam.nl
   *  - stemmen.amsterdam.nl/site3
   */
  for(const domainToCreate of domainsToCreate) {
    try {
      console.log('Start create', domainToCreate)
      await processIngressForDomain(domainToCreate, sites);
    } catch (e) {
      console.log('Errrr, e', e);
    }
  }


  for(let domainToUpdate of Object.keys(domainsToUpdate)) {
    try {
      console.log('domainToUpdate', domainToUpdate)
      const ingressName = domainsToUpdate[domainToUpdate].ingressName;

    //  console.log('Update domain ', domainToUpdate, ' with ingress name ', ingressName)
      await processIngressForDomain(domainToUpdate, sites, ingressName);
    } catch (e) {
      console.log('Errrr, e', e);
    }
  }

  console.log('domainsToDelete', domainsToDelete);


  // filter to make sure unique domains
  domainsToDelete = domainsToDelete.filter((value, index, self) => {
    return self.indexOf(value) === index;
  });

  domainsToDelete.forEach(async (domain) => {
    const ingressData = domainsInIngress[domain];
    try {
      console.log('Delete ingress with name ', ingressData);
      await deleteIngress(ingressData.ingressName);
    } catch (e) {
      console.log('Error when deleting ingress', e)
    }
  });
};


const processIngressForDomain = async (domain, sites, ingressName) => {
  console.log('start processIngressForDomain');

  const sitesForDomain = getSitesForDomain(sites, domain);
  const addWww = shouldDomainHaveWww(sites, domain);

  let ipAddressForDomain;
  let ipAddressForWWWDomain;

  try {
    ipAddressForDomain = await dnsLookUp(domain);
    ipAddressForWWWDomain = await dnsLookUp('www.' + domain);
  } catch(e ) {
    console.log('Error checking dns for domain', domain);
  }

  const dnsIsSet = ipAddressForDomain && ipAddressForDomain === serverPublicIP;
  const dnsIsSetForWWW  = ipAddressForWWWDomain && ipAddressForWWWDomain === serverPublicIP;

  console.log('ipAddressForDomain', ipAddressForDomain);
  console.log('serverPublicIP', serverPublicIP);

  console.log('dnsIsSet dnsIsSet', dnsIsSet);
  console.log('dnsIsSetForWWW dnsIsSetForWWW', dnsIsSetForWWW);


  // dns is valid when www is not required and default dns isset, otherwise we also need to check if www dns isset;
  const dnsIsValid = (!addWww && dnsIsSet) || (addWww && dnsIsSet && dnsIsSetForWWW);

  const ingressConfigFields = {
    dnsIsSet: dnsIsSet,
    dnsIsSetForWWW: dnsIsSetForWWW,
    ipAddressForDomain: ipAddressForDomain,
    ipAddressForWWWDomain: ipAddressForWWWDomain,
    dnsIsValid: dnsIsValid,
  }

  console.log('processIngressForDomain ingressConfigFields', ingressConfigFields);

  const secretNameForDomain =  getTlsSecretNameForDomain(sites, domain);

  try {
    let body = getIngressBody(formatIngressName(domain), domain, addWww, secretNameForDomain);
    body = body ? JSON.stringify(body) : false;
    console.log('getIngressBody ingressConfigFields for domain ', domain, body);
  } catch(e) {
    console.log('erroror loggin ingress body', e)
  }

  // in case
  if (dnsIsValid) {
    console.log('dnsIsValid and create')
    let response;

    if (ingressName) {
      console.log('ingressName so update', ingressName)

      response = await update(ingressName, domain, addWww, secretNameForDomain);
    } else {
      console.log('no ingressName so create', )
      response = await add(formatIngressName(domain), domain, addWww, secretNameForDomain);
    }

    console.log('Ingress create/update response', response);

    if (response) {
      ingressConfigFields.created = true;
      ingressConfigFields.ingressName = ingressName;
    } else {
      ingressConfigFields.created = false;
    }
    // in case dnsIs invalid and ingressName exists we "try to delete"
  } else if (ingressName) {
    console.log('Deletel ingressname: ', ingressName)
    try {
      await deleteIngress(ingressName)
    } catch (e) {
      console.log('Failed to delete ingress after dns not set', ingressName)
    }
  }




  for(const site of sitesForDomain) {
  //  console.log('site in sitesDomain', site);

    const config = site.config ? site.config : {};
//    console.log('config', config);

    config.ingress = config.ingress ? Object.assign(config.ingress, ingressConfigFields) : {};

    site.config = config;

    const siteModel = await db.Site.findOne({
      where: {
        id: site.id
      }
    })

    await siteModel.update(site);
  }
}

/**
 *
 * @param newSite
 * @returns {Promise<{response: http.IncomingMessage; body: NetworkingV1beta1Ingress}>}
 */
exports.add = add;




