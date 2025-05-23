// Este archivo exporta todos los handlers para facilitar su importación

const commandHandlers = require('./commandHandlers');
const messageHandlers = require('./messageHandlers');
const callbackHandlers = require('./callbackHandlers');
const stateHandlers = require('./stateHandlers');
const intentHandlers = require('./intentHandlers');
const errorHandlers = require('./errorHandlers');

module.exports = {
  commandHandlers,
  messageHandlers,
  callbackHandlers,
  stateHandlers,
  intentHandlers,
  errorHandlers
};