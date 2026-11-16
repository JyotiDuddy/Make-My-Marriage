const nodemailer = require('nodemailer');
const config = require('../../config/env');

let transport;

function getTransport() {
  if (!config.smtp) {
    throw new Error('SMTP email delivery is not configured.');
  }

  if (!transport) {
    const { host, port, secure, auth } = config.smtp;
    transport = nodemailer.createTransport({ host, port, secure, auth });
  }

  return transport;
}

function activationUrl(token) {
  if (!config.frontendOrigin) {
    throw new Error('FRONTEND_ORIGIN is required to create a Manager activation link.');
  }

  return new URL(`/activate-manager/${encodeURIComponent(token)}`, config.frontendOrigin).toString();
}

const emailAdapter = {
  get isConfigured() {
    return Boolean(config.smtp);
  },

  async sendPasswordResetEmail({ to, name, token }) {
    const recipientName = name ? ` ${name}` : '';
    await getTransport().sendMail({
      from: config.smtp.from,
      to,
      subject: 'Make My Marriage password reset',
      text: `Hello${recipientName},\n\nUse this password reset token in Make My Marriage:\n\n${token}\n\nIf you did not request a password reset, you can ignore this email.`,
    });
  },

  async sendManagerInvitationEmail({ to, name, token, expiresAt }) {
    const recipientName = name ? ` ${name}` : '';
    const link = activationUrl(token);
    await getTransport().sendMail({
      from: config.smtp.from,
      to,
      subject: 'You are invited to manage a wedding on Make My Marriage',
      text: `Hello${recipientName},\n\nYou have been invited to manage a wedding on Make My Marriage. Open this link to set your password and activate your account:\n\n${link}\n\nThis link expires at ${expiresAt.toISOString()}.`,
    });
  },
};

module.exports = emailAdapter;
