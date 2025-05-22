// Controlador para manejar mensajes de voz y audio
const whaisperService = require('../services/whaisperService');
const { analyzeIntent } = require('../services/intentAnalysisService');
const stateService = require('../services/botStateService');
const logger = require('../utils/logger');

/**
 * Maneja los mensajes de voz recibidos a través del bot
 * @param {object} bot - Instancia del bot de Telegram
 * @param {object} msg - Mensaje de Telegram
 */
async function handleVoiceMessage(bot, msg) {
  const chatId = msg.chat.id;
  
  try {
    logger.log(`Recibido mensaje de voz de usuario ${chatId}`);
    
    // Validar el mensaje de voz
    if (!msg.voice || !msg.voice.file_id) {
      logger.error('Mensaje de voz recibido sin file_id válido');
      return bot.sendMessage(chatId, "No se pudo procesar el mensaje de voz. Por favor, intenta de nuevo.");
    }
    
    // Enviar mensaje de procesamiento
    const processingMsg = await bot.sendMessage(
      chatId,
      "🎤 Procesando tu mensaje de voz, un momento por favor..."
    );
    
    try {
      // Procesar el mensaje de voz
      const transcription = await whaisperService.processVoiceMessage(bot, msg);
      
      // Validar el resultado de la transcripción
      if (!transcription || transcription.trim() === '') {
        await bot.deleteMessage(chatId, processingMsg.message_id)
          .catch(err => logger.error(`Error al eliminar mensaje de procesamiento: ${err.message}`));
        
        return bot.sendMessage(
          chatId,
          "Lo siento, no pude entender el mensaje de voz. ¿Puedes intentar de nuevo o escribir tu mensaje?"
        );
      }
      
      // Eliminar el mensaje de procesamiento
      await bot.deleteMessage(chatId, processingMsg.message_id)
        .catch(err => logger.error(`Error al eliminar mensaje de procesamiento: ${err.message}`));
      
      // Informar al usuario sobre lo que se entendió
      await bot.sendMessage(
        chatId,
        `🎤 He entendido: "${transcription}"`
      );
      
      // Procesar el mensaje transcrito
      await processTranscribedMessage(bot, msg, transcription);
      
    } catch (error) {
      // Si se produjo un error durante el procesamiento, eliminar el mensaje de procesamiento
      try {
        await bot.deleteMessage(chatId, processingMsg.message_id);
      } catch (deleteError) {
        logger.error(`Error al eliminar mensaje de procesamiento: ${deleteError.message}`);
      }
      
      // Verificar si es un error específico y dar una respuesta más detallada
      if (error.message.includes('file_id') || error.message.includes('temporarily unavailable')) {
        return bot.sendMessage(
          chatId,
          "Lo siento, no pude acceder al archivo de voz. Esto puede ocurrir si el mensaje es muy antiguo o demasiado grande. Por favor, intenta enviar un mensaje de voz más corto."
        );
      }
      
      throw error; // Relanzar el error para ser manejado por el catch externo
    }
    
  } catch (error) {
    logger.error(`Error al procesar mensaje de voz: ${error.message}`);
    
    bot.sendMessage(
      chatId,
      "❌ Lo siento, ha ocurrido un error al procesar tu mensaje de voz. Por favor, intenta de nuevo o escribe tu mensaje."
    );
  }
}

/**
 * Maneja los archivos de audio recibidos a través del bot
 * @param {object} bot - Instancia del bot de Telegram
 * @param {object} msg - Mensaje de Telegram
 */
async function handleAudioFile(bot, msg) {
  const chatId = msg.chat.id;
  
  try {
    logger.log(`Recibido archivo de audio de usuario ${chatId}`);
    
    // Validar el archivo de audio
    if (!msg.audio || !msg.audio.file_id) {
      logger.error('Archivo de audio recibido sin file_id válido');
      return bot.sendMessage(chatId, "No se pudo procesar el archivo de audio. Por favor, intenta de nuevo.");
    }
    
    // Enviar mensaje de procesamiento
    const processingMsg = await bot.sendMessage(
      chatId,
      "🎵 Procesando tu archivo de audio, un momento por favor..."
    );
    
    try {
      // Procesar el archivo de audio
      const transcription = await whaisperService.processAudioMessage(bot, msg);
      
      // Validar el resultado de la transcripción
      if (!transcription || transcription.trim() === '') {
        await bot.deleteMessage(chatId, processingMsg.message_id)
          .catch(err => logger.error(`Error al eliminar mensaje de procesamiento: ${err.message}`));
        
        return bot.sendMessage(
          chatId,
          "Lo siento, no pude entender el contenido del audio. ¿Puedes intentar de nuevo o escribir tu mensaje?"
        );
      }
      
      // Eliminar el mensaje de procesamiento
      await bot.deleteMessage(chatId, processingMsg.message_id)
        .catch(err => logger.error(`Error al eliminar mensaje de procesamiento: ${err.message}`));
      
      // Informar al usuario sobre lo que se entendió
      await bot.sendMessage(
        chatId,
        `🎵 He entendido: "${transcription}"`
      );
      
      // Procesar el mensaje transcrito
      await processTranscribedMessage(bot, msg, transcription);
      
    } catch (error) {
      // Si se produjo un error durante el procesamiento, eliminar el mensaje de procesamiento
      try {
        await bot.deleteMessage(chatId, processingMsg.message_id);
      } catch (deleteError) {
        logger.error(`Error al eliminar mensaje de procesamiento: ${deleteError.message}`);
      }
      
      // Verificar si es un error específico y dar una respuesta más detallada
      if (error.message.includes('file_id') || error.message.includes('temporarily unavailable')) {
        return bot.sendMessage(
          chatId,
          "Lo siento, no pude acceder al archivo de audio. Esto puede ocurrir si el archivo es muy antiguo o demasiado grande. Por favor, intenta enviar un archivo más pequeño."
        );
      }
      
      throw error; // Relanzar el error para ser manejado por el catch externo
    }
    
  } catch (error) {
    logger.error(`Error al procesar archivo de audio: ${error.message}`);
    
    bot.sendMessage(
      chatId,
      "❌ Lo siento, ha ocurrido un error al procesar tu archivo de audio. Por favor, intenta de nuevo o escribe tu mensaje."
    );
  }
}

/**
 * Procesa un mensaje transcrito como si fuera un mensaje de texto
 * @param {object} bot - Instancia del bot de Telegram
 * @param {object} originalMsg - Mensaje original de Telegram
 * @param {string} transcription - Texto transcrito del audio
 */
async function processTranscribedMessage(bot, originalMsg, transcription) {
  const chatId = originalMsg.chat.id;
  
  try {
    // Inicializar contexto si no existe
    stateService.initContext(chatId);
    
    // Actualizar actividad
    stateService.updateActivity(chatId);
    
    // Obtener el contexto de la conversación
    const context = stateService.getContext(chatId);
    
    // Añadir logs para diagnóstico
    logger.log(`[${new Date().toISOString()}] Usuario ${chatId} (audio transcrito): "${transcription}"`);
    logger.log(`Estado actual: ${context.state}`);
    
    // Preparar contexto para el análisis de intención
    const intentContext = {
      lastQuery: context.lastQuery,
      lastMentionedProducts: context.lastProductsShown,
      currentState: context.state
    };
    
    // Analizar la intención del mensaje transcrito
    let intentAnalysis;
    try {
      intentAnalysis = await analyzeIntent(transcription, intentContext);
      logger.log(`Intención detectada: ${intentAnalysis.intent} (${intentAnalysis.confidence})`);
    } catch (intentError) {
      logger.error(`Error al analizar intención: ${intentError.message}`);
      // Si falla el análisis de intención, continuamos igualmente para que al menos se procese como texto
    }
    
    // Simular un mensaje de texto para que sea procesado por el controlador principal del bot
    const simulatedTextMsg = {
      ...originalMsg,
      text: transcription,
      voice: undefined,
      audio: undefined
    };
    
    // Emitir evento de mensaje para que sea procesado por el controlador del bot
    bot.emit('message', simulatedTextMsg);
    
  } catch (error) {
    logger.error(`Error al procesar mensaje transcrito: ${error.message}`);
    bot.sendMessage(chatId, "Ha ocurrido un error al procesar tu mensaje. Por favor, inténtalo de nuevo.");
  }
}

module.exports = {
  handleVoiceMessage,
  handleAudioFile
};