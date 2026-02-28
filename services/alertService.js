
// services/alertService.js
// Purpose:  Generic alert utility for sending MongoDB connection and other system alerts 
// (e.g., API errors, service downtime, cache failures)

const { sendAlertEmail } = require('./mailer');

/**
 * Generic alert utility
 * Supports: console logging, email alerts, optional webhook integration
 */
async function sendAlert({ type = 'error', subject, message, webhookUrl = null }) {
  // Console log
  if (type === 'error') {
    console.error(` ALERT: ${subject} - ${message}`);
  } else {
    console.log(` ALERT: ${subject} - ${message}`);
  }

  // Email alert
  await sendAlertEmail(subject, message);

  // Optional webhook (e.g., Slack, Teams, custom monitoring)
  if (webhookUrl) {
    try {
      const axios = require('axios');
      await axios.post(webhookUrl, { subject, message, type });
      console.log(' Webhook alert sent successfully');
    } catch (err) {
      console.error(' Failed to send webhook alert:', err.message);
    }
  }
}

module.exports = { sendAlert };

