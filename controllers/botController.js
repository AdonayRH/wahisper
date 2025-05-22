const bot = require("../services/telegramService");
const logger = require('../utils/logger');
const handlers = require('../handlers');
const audioController = require('./audioController');


// Configuración inicial
logger.log('Iniciando bot de Telegram...');

// Configurar intervalos de limpieza de contextos
setInterval(() => {
  logger.log("Ejecutando limpieza de contextos inactivos");
  const stateService = require('../services/botStateService');
  stateService.cleanupInactiveContexts(30); // 30 minutos
}, 30 * 60 * 1000);

// Registrar manejadores de comandos
handlers.commandHandlers.registerCommandHandlers(bot);

// Configurar manejador principal de mensajes
bot.on("message", async (msg) => {
  if (msg.text && !msg.text.startsWith('/')) {
    await handlers.messageHandlers.processUserMessage(bot, msg);
  }
});

// Configurar manejador de callbacks (botones)
bot.on('callback_query', async (callbackQuery) => {
  await handlers.callbackHandlers.processCallbackQuery(bot, callbackQuery);
});

// Manejar mensajes de voz
bot.on('voice', async (msg) => {
  try {
    // Comprobar si el archivo de voz es válido
    if (!msg.voice || !msg.voice.file_id) {
      return bot.sendMessage(msg.chat.id, "No se pudo procesar el mensaje de voz. Por favor, intenta de nuevo.");
    }
    
    // Procesar el mensaje de voz usando audioController
    await audioController.handleVoiceMessage(bot, msg);
  } catch (error) {
    console.error("Error global en el manejador de voz:", error);
    
    try {
      const chatId = msg.chat.id;
      bot.sendMessage(
        chatId,
        "Ha ocurrido un error inesperado al procesar el mensaje de voz. Por favor, intenta de nuevo o escribe tu mensaje."
      );
      
      // Restablecer estado a INITIAL para evitar que se quede en un estado inconsistente
      stateService.setState(chatId, stateService.STATES.INITIAL);
    } catch (sendError) {
      console.error("Error al enviar mensaje de error:", sendError);
    }
  }
});

// Manejar archivos de audio
bot.on('audio', async (msg) => {
  try {
    // Comprobar si el archivo de audio es válido
    if (!msg.audio || !msg.audio.file_id) {
      return bot.sendMessage(msg.chat.id, "No se pudo procesar el archivo de audio. Por favor, intenta de nuevo.");
    }
    
    // Procesar el archivo de audio usando audioController
    await audioController.handleAudioFile(bot, msg);
  } catch (error) {
    console.error("Error global en el manejador de audio:", error);
    
    try {
      const chatId = msg.chat.id;
      bot.sendMessage(
        chatId,
        "Ha ocurrido un error inesperado al procesar el archivo de audio. Por favor, intenta de nuevo o escribe tu mensaje."
      );
      
      // Restablecer estado a INITIAL para evitar que se quede en un estado inconsistente
      stateService.setState(chatId, stateService.STATES.INITIAL);
    } catch (sendError) {
      console.error("Error al enviar mensaje de error:", sendError);
    }
  }
});

// Configurar manejadores de errores globales
handlers.errorHandlers.setupGlobalErrorHandlers();

logger.log('Bot configurado y listo para recibir mensajes');

// Exportar bot para uso en otros módulos
module.exports = bot;