const db = require('../../db');
const auth = require('../../middleware/sequelize-authorization-middleware');
const router = require('express-promise-router')({mergeParams: true});
var createError = require('http-errors');
const Pusher = require("pusher");
const fetch = require('node-fetch');


// update last message
const pusher = new Pusher({
  appId: "1254886",
  key: "0dbd27bc173d515e4499",
  secret: "c2395c84ee290c1286d8",
  cluster: "eu",
  useTLS: true
});

const OnesignalService = {
  sendPushToUser : async ({userId, message, oneSignalAppId, oneSignalRestApiKey}) => {
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Authorization": "Basic " +  oneSignalRestApiKey
    };

    const messageData = {
      app_id: oneSignalAppId ? oneSignalAppId : "5eb5a37e-b458-11e3-ac11-000c2940e62c",
      contents: {"en": message},
      channel_for_external_user_ids: "push",
      include_external_user_ids: [userId]
    };

    const response = await fetch("https://onesignal.com/api/v1/notifications",
       {
         headers: headers,
         method: 'POST',
         body: JSON.stringify(messageData)
       }
    )
    console.log('response', response)

    const json = await response.json();


    console.log('json', json)

  }
}


// scopes: for all get requests
router
  .all('*', function (req, res, next) {
    req.scope = ['api'];
    req.scope.push('includeSite');
    return next();
  });

const addOne = async function (req, res, next) {
  try {
    const requestingUserId = req.params.requestingUserId;

    let supportChat = await db.SupportChat.findOne({
      where: {userId: requestingUserId}
    });

    // is user a
    if (!supportChat) {
      supportChat = await db.SupportChat.create({userId: requestingUserId, messages: []})
    }

    req.supportChat = supportChat;
    req.results = supportChat;

    next();
  } catch (e) {
    next(e);
  }
}

const enrichMessagesWithUser = async (messages) => {
  const usersForChat = {};
  const enrichedMessages = [];

  for (let message of messages) {
    const userId = message.user && message.user._id ? message.user._id : false;
    let user = usersForChat[userId];

    if (!user) {
      user = await db.User.findOne({
        where: {
          id: userId
        }
      });

      usersForChat[userId] = user;
    }

    if (user) {
      message.user = {
        avatar: user.extraData && user.extraData.profileImage ? user.extraData.profileImage : '',
        fullName: user.fullName,
        _id: user.id,
      };
    }

    enrichedMessages.push(message);
  }

  return enrichedMessages;
}

/**
 *  Standard Chat can always be with multiple people;
 *  But groups need to be made
 *
 *  For every user to a site they have a moderator group chat;
 *  So the user can chat with every moderator of the site
 *
 *  So in that case we make
 */
router.route('/:requestingUserId')
  .all(addOne)
  .get(auth.useReqUser)
  //.get(auth.can('SupportChat', 'View'))
  .get(async function (req, res, next) {
    const usersForChat = {};

    var chat = req.results;

    if (!(chat.can('view'))) return next(new Error('You cannot view this chat'));

    let messages = [];

    try {
      if (req.supportChat.messages && Array.isArray(req.supportChat.messages)) {
        messages = await enrichMessagesWithUser(req.supportChat.messages)
      }

      req.supportChat.messages = messages;

      next();
    } catch (e) {
      next(e);
    }
  })
  .get(function (req, res, next) {
    res.json(req.results);
  })
  // Persist an chat
  .put(auth.can('SupportChat', 'update'))
  .put(async function (req, res, next) {
    try {
      const supportChat = req.supportChat;
      let messages = req.supportChat.messages && Array.isArray(req.supportChat.messages) ? req.supportChat.messages : [];

      const bodyMessage = req.body.message;

      const message = {
        _id: bodyMessage._id,
        text: bodyMessage.text,
        createdAt: bodyMessage.createdAt,
        read: false,
        user: {
          _id: bodyMessage.user._id
        },
        serverSendTime: new Date().toString()
      }

      let messageAlreadyExists = messages.length > 0 && messages.find(existingMessage => existingMessage._id && existingMessage._id === message._id) ? true : false;

      if (messageAlreadyExists) {
        throw new Error('Message already added');
        return;
      }

      messages.push(message);

      messages = messages.sort(function (a, b) {
        var dateA = new Date(a.createdAt).getTime();
        var dateB = new Date(b.createdAt).getTime();

        if (dateA < dateB) {
          return 1;
        }
        if (dateA > dateB) {
          return -1;
        }

        return 0;
      });

      supportChat.set('messages', messages);

      await supportChat.save();

      const response = await pusher.trigger('support-chat-' + req.params.requestingUserId, 'new-message', message);

      try {
        await OnesignalService.sendPushToUser({
            userId: req.params.requestingUserId,
            oneSignalAppId: req.site.config && req.site.config.onesignal && req.site.config.onesignal.appId ? req.site.config.onesignal.appId : "f982611b-0019-47a6-bbf2-649444fae6dd",
            message: message.text,
            oneSignalRestApiKey: req.site.config && req.site.config.onesignal && req.site.config.onesignal.restApiKey ? req.site.config.onesignal.restApiKey : 'YzU4MWNkNzUtNWEwMy00OTY5LTlkNDktYTA2ZmY2ZmM0Mzcz'
          },
        );
      } catch (e) {
        console.log('Error sending onesignal push: ', e)
      }

      res.json(message);
    } catch (e) {
      next(e);
    }
  });

router.route('/:requestingUserId/read')
  .all(addOne)
  .put(auth.can('SupportChat', 'update'))
  .put(async function (req, res, next) {
    try {
      const userId = req.body.setToReadForUserId;
      let messages = req.supportChat.messages && Array.isArray(req.supportChat.messages) ? req.supportChat.messages : [];


      messages = messages.map((message) => {
        const readBy = message.readBy && Array.isArray(message.readBy) ? message.readBy : [];

        if (!readBy.includes(userId)) readBy.push(userId);

        return Object.assign(message, {
          readBy: readBy
        })
      });


      await req.supportChat.update({
        messages
      });

      const response = await pusher.trigger('support-chat-' + req.params.requestingUserId, 'read-messages', {
        status: 'ok'
      });

    } catch (e) {
      next(e);
    }
  })

module.exports = router;
