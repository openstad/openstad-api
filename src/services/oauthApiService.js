const rp = require('request-promise');
const nestedObjectAssign = require('nested-object-assign');
const httpBuildQuery = require('../util/httpBuildQuery')
const config = require('config')

const apiUrl =  config.authorization['auth-server-url'] ;

const fetch = (clientId, apiCredentials) => {
    return rp({
        method: 'GET',
        uri: `${apiUrl}/api/admin/client/${clientId}`,
        headers: {
            'Accept': 'application/json'
        },
        body: apiCredentials,
        json: true // Automatically parses the JSON string in the response
    })
//  .then(response => response.json());
}

const fetchAll = (params, apiCredentials) => {
    const query = params ? httpBuildQuery(params) : '';

    return rp({
        method: 'GET',
        uri: `${apiUrl}/api/admin/clients?${query}`,
        headers: {
            'Accept': 'application/json'
        },
        body: apiCredentials,
        json: true // Automatically parses the JSON string in the response
    })
//  .then(response => response.json());
};


const create = (data, apiCredentials) => {
    let body = nestedObjectAssign(data, apiCredentials);

    return rp({
        method: 'POST',
        uri: `${apiUrl}/api/admin/client`,
        headers: {
            'Accept': 'application/json'
        },
        body: body,
        json: true // Automatically parses the JSON string in the response
    });
}

const update = (clientId, data, apiCredentials) => {
    return rp({
        method: 'POST',
        uri: `${apiUrl}/api/admin/client/${clientId}`,
        headers: {
            'Accept': 'application/json',
        },
        body: nestedObjectAssign(data, apiCredentials),
        json: true // Automatically parses the JSON string in the response
    });
}

const deleteClient = (clientId, apiCredentials) => {
    return rp({
        method: 'POST',
        uri: `${apiUrl}/api/admin/client/${clientId}/delete`,
        json: true, // Automatically parses the JSON string in the response
        body: apiCredentials,
    });
}

const fetchClientsForSite = async (site, oauthCredentials) => {
    const oauthTypes = site && site.config && site.config.oauth ? Object.keys(site.config.oauth) : [];
    const clients = [];

    for (const oauthType of oauthTypes) {
        let clientConfig = site.config.oauth[oauthType];
        const client = await fetch(clientConfig["auth-client-id"], oauthCredentials)
        client.apiType = oauthType;
        clients.push(client);
    }

    return clients;
}

const setRoleForUser = (clientId, externalUserId, role, apiCredentials) => {
    console.log('make user site admin');
    const roleMap = {'admin': 1, moderator: 5};
    const roleId = roleMap[role];

    if (!roleId) {
         //throw new Error('role not found');
        return
    }

    const url = apiUrl + '/api/admin/user/' + externalUserId;
    const body = {
        roles: {},
    };
    // Todo: is admin role always 1???
    body.roles[clientId] = roleId;

    return rp({
        method: 'POST',
        uri: url,
        json: true, // Automatically parses the JSON string in the response
        body: nestedObjectAssign(body, apiCredentials)
    })
};


module.exports ={
    fetchClientsForSite,
    create,
    update,
    deleteClient,
    setRoleForUser
}