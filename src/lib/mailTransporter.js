const config     = require('config');
const siteConfig = require('./siteConfig');
const merge      = require('merge');
const nodemailer = require('nodemailer');

const transport = config.get('mail.transport');

exports.getTransporter = () => {
  
  const method = siteConfig.getMailMethod();
  const transporterConfig = siteConfig.getMailTransport();
  /*
  console.log('siteConfig', siteConfig);
  console.log('transporterConfig', transporterConfig);
  console.log('method', method);
*/

  let transporter;
  
  switch (method) {
    case 'smtp':
      transporter = nodemailer.createTransport(transporterConfig);
      break;
    
    case 'sendgrid':
      const sendGrid = require('nodemailer-sendgrid-transport');
      const sgConfig = sendGrid(transporterConfig);
      
      transporter = nodemailer.createTransport(sgConfig);
      break;
  }
  
  return transporter;
  
}
