const emailAdapter = {
  isConfigured: false,
  async sendPasswordResetEmail() {
    throw new Error('No email provider is configured.');
  },
};

module.exports = emailAdapter;
