const db = require('../../db');
const auth = require('../../middleware/sequelize-authorization-middleware');s
const router = require('express-promise-router')({ mergeParams: true });
var createError = require('http-errors');

// scopes: for all get requests
router
  .all('*', function(req, res, next) {
    req.scope = ['api'];
    req.scope.push('includeSite');
    return next();
  });


const enrichMessagesWithUser = async (messages) => {
  const enrichedMessages = [];

  for (let message of messages) {
    let user = usersForChat[message.userId];

    if (!user) {
      user = await db.User.findOne({
        where: {
          userId: user.id
        }
      })

      usersForChat[message.userId] = user;
    }

    message.user = {
      profileImage: user.extraData &&  user.extraData.profileImage ? user.extraData.profileImage : '',
      fullName: user.fullName,
      id: user.id,
    };

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
  .all(async () => {
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
      next();
    } catch (e) {
      next(e);
    }
  })
  .get(auth.can('SupportChat', 'View'))
  .get(async function(req, res, next) {
      const usersForChat = {};

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
  .get(function () {
    res.json(req.supportChat);
  })
  // Persist an chat
  .put(auth.can('SupportChat', 'update'))
  .put(async function(req, res, next) {
    try {
      const supportChat = req.supportChat;
      let messages = req.supportChat.messages && Array.isArray(req.supportChat.messages) ? req.supportChat.messages : [];

      const message = {
        id: req.body.messageId,
        message: req.body.message,
        sendTime: req.body.sendTime,
        userId: req.user.id,
        serverSendTime: new Date().toString()
      }

      let messageAlreadyExists = messages.length > 0 && messages.find(message => message.id === newMessage.id) ? true : false;

      if (messageAlreadyExists) {
        throw new Error('Message already added');
        return;
      }

      messages.push(message);

      messages = messages.sort(function (a, b) {
        var dateA = new Date(a.sendTime).getTime();
        var dateB = new Date(b.sendTime).getTime();

        if (dateA > dateB) {
          return 1;
        }
        if (dateA < dateB) {
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

      const response = await pusher.trigger('editor-update', 'editor-refresh-resources', {
        resources: req.query.resourcesChanged,
        editorSession: req.query.editorSession
      });

      res.json(message);
    } catch (e) {
      next(e);
    }
  });

module.exports = router;
