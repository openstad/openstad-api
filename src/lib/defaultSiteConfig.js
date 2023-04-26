module.exports = {
  title: '',
  cms:   {
    url:      '',
    hostname: '',
  },
  ideas: {
    conceptEmail: {
      from:          '',
      subject:       'Bedankt voor je concept inzending!',
      inzendingPath: '/PATH/NAAR/INGEDIEND/PLAN/[[ideaId]]',
      template:      '',
      attachments:   []
    },
    conceptToPublishedEmail: {
      from:          '',
      subject:       'Bedankt voor je inzending!',
      inzendingPath: '/PATH/NAAR/INGEDIEND/PLAN/[[ideaId]]',
      template:      '',
      attachments:   []
    },
    feedbackEmail: {
      from:          '',
      subject:       'Bedankt voor je inzending!',
      inzendingPath: '/PATH/NAAR/INGEDIEND/PLAN/[[ideaId]]',
      template:      '',
      attachments:   []
    }
  },
  articles: {
    feedbackEmail: {
      from:          '',
      subject:       '',
      inzendingPath: '',
      template:      '',
      attachments:   []
    }
  },
  mail:  {
    method:    '',
    transport: {
      smtp: {
        pool:       '',
        direct:     '',
        port:       '',
        host:       '',
        requireSSL: true,
        name:       '',
        auth:       {
          user: '',
          pass: ''
        }
      }
    },
    sendgrid:  {
      auth: {
        api_user: '',
        api_key:  '',
      }
    }
  },
  newslettersignup: {
    confirmationEmail: {
      subject: '',
      url: '',
      template: '',
      attachments: []
    }
  },
  styling: {
    logo: ''
  }
};
