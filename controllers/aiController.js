const openaiService = require('../services/openaiService');
const telegramService = require('../services/telegramService');
const logger = require('../utils/logger');

/**
 * Procesa un mensaje de usuario a través de la IA
 * @param {Number} telegramId - ID de Telegram del usuario
 * @param {String} message - Mensaje del usuario
 * @returns {Promise<String>} - Respuesta generada por la IA
 */
const processMessage = async (telegramId, message) => {
  try {
    // Obtener historial de conversación del usuario
    const conversationHistory = await telegramService.getConversationHistory(telegramId);
    
    // Preparar contexto para OpenAI
    const context = openaiService.prepareContext(conversationHistory);
    
    // Generar respuesta
    const response = await openaiService.generateResponse(context);
    
    return response;
  } catch (error) {
    logger.error(`Error al procesar mensaje con IA: ${error.message}`);
    return 'Lo siento, ocurrió un error al procesar tu mensaje. Por favor, intenta nuevamente.';
  }
};

module.exports = {
  processMessage
};