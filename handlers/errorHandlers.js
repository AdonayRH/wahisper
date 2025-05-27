// Maneja los errores que pueden ocurrir durante el procesamiento

const stateService = require('../services/botStateService');
const logger = require('../utils/logger');

/**
 * Maneja error durante el procesamiento del mensaje
 * @param {object} bot - Instancia del bot de Telegram
 * @param {object} msg - Mensaje de Telegram
 * @param {Error} error - Error ocurrido
*/
function handleProcessingError(bot, msg, error) {
  logger.error(`Error global en el manejador de mensajes: ${error.message}`);
  logger.error(error.stack);
  
  try {
    const chatId = msg.chat.id;
    bot.sendMessage(
      chatId,
      "Ha ocurrido un error inesperado. Por favor, intenta de nuevo o escribe /cancel para reiniciar."
    );
    
    // Restablecer estado a INITIAL para evitar que se quede en un estado inconsistente
    stateService.setState(chatId, stateService.STATES.INITIAL);
  } catch (sendError) {
    logger.error(`Error al enviar mensaje de error: ${sendError.message}`);
  }
}

/**
 * Maneja errores durante el procesamiento de callbacks
 * @param {object} bot - Instancia del bot de Telegram
 * @param {object} callbackQuery - Información del callback
 * @param {Error} error - Error ocurrido
*/
function handleCallbackError(bot, callbackQuery, error) {
  logger.error(`Error en el manejo de callback_query: ${error.message}`);
  logger.error(error.stack);
  
  try {
    const chatId = callbackQuery.message.chat.id;
    bot.sendMessage(
      chatId,
      "Ha ocurrido un error al procesar tu selección. Por favor, intenta de nuevo o escribe /cancel para reiniciar."
    );
    // Restablecer estado a INITIAL para evitar que se quede en un estado inconsistente
    stateService.setState(chatId, stateService.STATES.INITIAL);
  } catch (sendError) {
    logger.error(`Error al enviar mensaje de error: ${sendError.message}`);
  }
}

/**
 * Configura manejadores de errores a nivel de proceso
*/
function setupGlobalErrorHandlers() {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Promesa rechazada no manejada:');
    logger.error(reason);
    // La aplicación continúa ejecutándose
  });
  
  process.on('uncaughtException', (error) => {
    logger.error('Error no capturado:');
    logger.error(error);
    // La aplicación continúa ejecutándose
  });
  
  logger.log('Manejadores de errores globales configurados');
}

module.exports = {
  handleProcessingError,
  handleCallbackError,
  setupGlobalErrorHandlers
};