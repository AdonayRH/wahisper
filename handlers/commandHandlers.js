// Maneja los comandos básicos del bot

const adminController = require('../controllers/adminController');
const conversationController = require('../controllers/conversationController');
const cartController = require('../controllers/cartController');
const fileProcessingService = require('../services/fileProcessingService');
const logger = require('../utils/logger');
const fs = require('fs-extra');
const path = require('path');

/**
 * Maneja el comando /admin
 * @param {object} bot - Instancia del bot de Telegram
 * @param {object} msg - Mensaje de Telegram
 */
function handleAdminCommand(bot, msg) {
  const chatId = msg.chat.id;
  logger.log(`Comando /admin recibido de usuario ${chatId}`);
  adminController.handleAdminCommand(bot, msg);
}

/**
 * Maneja el comando /cancel
 * @param {object} bot - Instancia del bot de Telegram
 * @param {object} msg - Mensaje de Telegram
 */
function handleCancelCommand(bot, msg) {
  const chatId = msg.chat.id;
  logger.log(`Comando /cancel recibido de usuario ${chatId}`);
  conversationController.handleCancelCommand(bot, chatId, fs, path);
}

/**
 * Maneja el comando /carrito
 * @param {object} bot - Instancia del bot de Telegram
 * @param {object} msg - Mensaje de Telegram
 */
function handleCartCommand(bot, msg) {
  const chatId = msg.chat.id;
  logger.log(`Comando /carrito recibido de usuario ${chatId}`);
  cartController.handleCartCommand(bot, chatId);
}

/**
 * Maneja el comando /limpiarcarrito
 * @param {object} bot - Instancia del bot de Telegram
 * @param {object} msg - Mensaje de Telegram
 */
function handleClearCartCommand(bot, msg) {
  const chatId = msg.chat.id;
  logger.log(`Comando /limpiarcarrito recibido de usuario ${chatId}`);
  cartController.handleClearCartCommand(bot, chatId);
}

/**
 * Maneja el comando /exportarcarrito
 * @param {object} bot - Instancia del bot de Telegram
 * @param {object} msg - Mensaje de Telegram
 */
function handleExportCartCommand(bot, msg) {
  const chatId = msg.chat.id;
  logger.log(`Comando /exportarcarrito recibido de usuario ${chatId}`);
  cartController.handleExportCartCommand(bot, chatId);
}

/**
 * Maneja el comando /eliminar con parámetro
 * @param {object} bot - Instancia del bot de Telegram
 * @param {object} msg - Mensaje de Telegram
 * @param {array} match - Coincidencia de regex
 */
function handleRemoveCommand(bot, msg, match) {
  const chatId = msg.chat.id;
  const index = parseInt(match[1]) - 1;
  logger.log(`Comando /eliminar ${index+1} recibido de usuario ${chatId}`);
  cartController.handleRemoveFromCartCommand(bot, chatId, index);
}

/**
 * Maneja la recepción de documentos
 * @param {object} bot - Instancia del bot de Telegram
 * @param {object} msg - Mensaje de Telegram
 */
async function handleDocumentUpload(bot, msg) {
  const chatId = msg.chat.id;
  logger.log(`Documento recibido de usuario ${chatId}: ${msg.document.file_name}`);
  
  await adminController.processAdminDocument(bot, msg, fileProcessingService);
}

// Registrar los comandos en el bot
function registerCommandHandlers(bot) {
  bot.onText(/\/admin/, (msg) => handleAdminCommand(bot, msg));
  bot.onText(/\/cancel/, (msg) => handleCancelCommand(bot, msg));
  bot.onText(/\/carrito/, (msg) => handleCartCommand(bot, msg));
  bot.onText(/\/limpiarcarrito/, (msg) => handleClearCartCommand(bot, msg));
  bot.onText(/\/exportarcarrito/, (msg) => handleExportCartCommand(bot, msg));
  bot.onText(/\/eliminar (.+)/, (msg, match) => handleRemoveCommand(bot, msg, match));
  bot.on('document', (msg) => handleDocumentUpload(bot, msg));
  
  logger.log('Comandos del bot registrados');
}

module.exports = {
  handleAdminCommand,
  handleCancelCommand,
  handleCartCommand,
  handleClearCartCommand,
  handleExportCartCommand,
  handleRemoveCommand,
  handleDocumentUpload,
  registerCommandHandlers
};