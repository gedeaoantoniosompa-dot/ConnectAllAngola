// Firebase Functions entrypoint.
// Load the existing function exports first (this also initializes firebase-admin),
// then expose the protected admin gateway without modifying the original index.js.
const existing = require('./index');
const { adminOperation } = require('./adminOperations');

module.exports = {
  ...existing,
  adminOperation,
};
