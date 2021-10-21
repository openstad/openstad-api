const db = require('../../db');
const auth = require('../../middleware/sequelize-authorization-middleware');
const router = require('express-promise-router')({ mergeParams: true });
var createError = require('http-errors');
const Pusher = require("pusher");

// scopes: for all get requests
router
  .all('*', function(req, res, next) {
    req.scope = ['api'];
    req.scope.push('includeSite');
    return next();
  });


const enrichMessagesWithUser = async (messages) => {
  const usersForChat = {};
  const enrichedMessages = [];

  for (let message of messages) {
    const userId =  message.user &&  message.user._id ?  message.user._id : false;
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
        id: user.id,
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
  .all(async function(req, res, next) {
    try {
      const requestingUserId = req.params.requestingUserId;

      let supportChat = await db.SupportChat.findOne({
        where: {userId: requestingUserId}
      });

      // is user a
      if (!supportChat) {
        supportChat = await db.SupportChat.create({userId: requestingUserId,  messages: []})
      }

      req.supportChat = supportChat;
      req.results = supportChat;
      console.log('req.supportChatreq.req.user', req.user.role)

      next();
    } catch (e) {
      next(e);
    }
  })
  .get(auth.useReqUser)
  //.get(auth.can('SupportChat', 'View'))
  .get(async function(req, res, next) {
      const usersForChat = {};

    var chat = req.results;

    console.log('chatchat', chat)

    if (!(chat && chat.can && chat.can('view'))) return next(new Error('You cannot view this Idea'));

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
  .put(async function(req, res, next) {
    try {
      const supportChat = req.supportChat;
      let messages = req.supportChat.messages && Array.isArray(req.supportChat.messages) ? req.supportChat.messages : [];

      const bodyMessage = req.body.message;

      console.log(' req.body',  req.body, bodyMessage)
      
      const message = {
        _id: bodyMessage._id,
        text: bodyMessage.text,
        createdAt: bodyMessage.createdAt,
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

      // update last message
      const pusher = new Pusher({
        appId: "1254886",
        key: "0dbd27bc173d515e4499",
        secret: "c2395c84ee290c1286d8",
        cluster: "eu",
        useTLS: true
      });

      const response = await pusher.trigger('support-chat-' + req.params.requestingUserId, 'new-message', message);

      res.json(message);
    } catch (e) {
      next(e);
    }
  });

module.exports = router;
