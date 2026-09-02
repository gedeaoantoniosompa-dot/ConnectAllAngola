// Firebase Functions entrypoint.
// Keep all existing exports and add the protected administrative gateway.
const existing = require('./index');
const { adminOperation } = require('./adminGateway');

module.exports = {
  ...existing,
  adminOperation,
};
