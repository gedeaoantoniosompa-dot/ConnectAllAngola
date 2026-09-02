// Firebase Functions entrypoint.
// Keep all existing exports and add protected administrative operations.
const existing = require('./index');
const { adminOperation } = require('./adminGateway');
const { updateAdminProfile } = require('./updateAdminProfile');

module.exports = {
  ...existing,
  adminOperation,
  updateAdminProfile,
};
