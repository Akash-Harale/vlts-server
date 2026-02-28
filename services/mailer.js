const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587, // standard SMTP port
  secure: false, // true for 465, false for 587
  auth: {
    user: process.env.ALERT_EMAIL,
    pass: process.env.ALERT_EMAIL_PASSWORD
  }
});

async function sendAlertEmail(subject, message) {
  try {
    const info = await transporter.sendMail({
      from: `"Fleet Alert" <${process.env.ALERT_EMAIL}>`,
      to: process.env.ALERT_RECIPIENT,
      cc: process.env.ALERT_CC,
      bcc: process.env.ALERT_BCC,
      subject,
      text: message,
      html: `<p>${message}</p>`
    });

    console.log(`📧 Alert email sent: ${info.messageId}`);
  } catch (err) {
    console.error('❌ Failed to send alert email:', err.message);
  }
}

module.exports = { sendAlertEmail };

