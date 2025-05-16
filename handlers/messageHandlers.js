// Maneja el procesamiento principal de mensajes

const { analyzeIntent } = require('../services/intentAnalysisService');
const stateService = require('../services/botStateService');
const conversationController = require('../controllers/conversationController');
const stateHandlers = require('./stateHandlers');
const intentHandlers = require('./intentHandlers');
const errorHandlers = require('./errorHandlers');
const logger = require('../utils/logger');

/**
 * Procesa el mensaje del usuario y responde adecuadamente
 * @param {object} bot - Instancia del bot de Telegram
 * @param {object} msg - Mensaje de Telegram
 * @returns {Promise} - Promesa con la respuesta
 */
async function processUserMessage(bot, msg) {
  try {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    // Ignorar mensajes que no son texto o comandos ya procesados
    if (!text || text.startsWith('/')) return;
    
    // Inicializar contexto si no existe
    stateService.initContext(chatId);
    
    // Procesar datos del usuario
    const carritoService = require('../services/carritoService');
    conversationController.processUserData(msg, carritoService);
    
    // Actualizar actividad
    stateService.updateActivity(chatId);
    
    // Obtener el contexto de la conversación
    const context = stateService.getContext(chatId);
    
    // Añadir logs para diagnóstico
    logger.log(`Usuario ${chatId}: "${text}"`);
    logger.log(`Estado actual: ${context.state}`);
    
    // Si el usuario está finalizando la conversación
    if (conversationController.isEndingConversation(text)) {
      return conversationController.handleEndConversation(bot, chatId);
    }
    
    // Preparar contexto para el análisis de intención
    const intentContext = {
      lastQuery: context.lastQuery,
      lastMentionedProducts: context.lastProductsShown,
      currentState: context.state
    };
    
    // Manejar estados especiales que no requieren análisis de intención
    if (stateHandlers.handleSpecialState(bot, chatId, text)) {
      return;
    }
    
    // Analizar la intención del mensaje
    const intentAnalysis = await analyzeIntent(text, intentContext);
    logger.log(`Intención detectada: ${intentAnalysis.intent} (${intentAnalysis.confidence})`);
    
    // Si la confianza es baja, solicitar clarificación
    if (intentAnalysis.confidence < 0.6) {
      return bot.sendMessage(
        chatId,
        "No estoy seguro de entender lo que quieres. ¿Podrías ser más específico?"
      );
    }
    
    // Intentar manejar según el estado actual
    const stateResponse = await stateHandlers.handleStateBasedAction(bot, chatId, text, intentAnalysis);
    
    // Si no se manejó por estado, manejar por intención
    if (stateResponse === null) {
      await intentHandlers.handleIntentBasedAction(bot, chatId, text, context, intentAnalysis);
    }
    
  } catch (error) {
    errorHandlers.handleProcessingError(bot, msg, error);
  }
}

module.exports = {
  processUserMessage
};