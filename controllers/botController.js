const { DEFAULT_WELCOME_MESSAGE, DEFAULT_ERROR_MESSAGE } = require('../config/constants');
const telegramService = require('../services/telegramService');
const aiController = require('./aiController');
const logger = require('../utils/logger');

/**
 * Configura los manejadores del bot de Telegram
 * @param {Object} bot - Instancia del bot de Telegraf
 */
const setupBot = (bot) => {
  // Comando /start
  bot.start(async (ctx) => {
    try {
      await telegramService.saveUserMessage(ctx);
      
      await ctx.reply(DEFAULT_WELCOME_MESSAGE);
      
      // Registrar la respuesta del bot
      await telegramService.saveBotResponse(
        ctx.from.id,
        DEFAULT_WELCOME_MESSAGE,
        ctx.message.message_id
      );
    } catch (error) {
      logger.error(`Error en comando start: ${error.message}`);
      ctx.reply(DEFAULT_ERROR_MESSAGE);
    }
  });

  // Comando /help
  bot.help(async (ctx) => {
    try {
      await telegramService.saveUserMessage(ctx);
      
      const helpMessage = `
Comandos disponibles:
/start - Iniciar el bot
/help - Mostrar esta ayuda
/reset - Reiniciar la conversación

Puedes enviarme cualquier mensaje y te responderé usando IA.
      `;
      
      await ctx.reply(helpMessage);
      
      // Registrar la respuesta del bot
      await telegramService.saveBotResponse(
        ctx.from.id,
        helpMessage,
        ctx.message.message_id
      );
    } catch (error) {
      logger.error(`Error en comando help: ${error.message}`);
      ctx.reply(DEFAULT_ERROR_MESSAGE);
    }
  });

  // Comando /reset para reiniciar la conversación
  bot.command('reset', async (ctx) => {
    try {
      const user = await telegramService.saveUserMessage(ctx);
      
      // Reiniciar el historial de conversación (mantiene solo el último mensaje)
      if (user && user.user) {
        user.user.conversationHistory = [];
        await user.user.save();
      }
      
      const resetMessage = "La conversación ha sido reiniciada. ¿En qué puedo ayudarte ahora?";
      await ctx.reply(resetMessage);
      
      // Registrar la respuesta del bot
      await telegramService.saveBotResponse(
        ctx.from.id,
        resetMessage,
        ctx.message.message_id
      );
    } catch (error) {
      logger.error(`Error en comando reset: ${error.message}`);
      ctx.reply(DEFAULT_ERROR_MESSAGE);
    }
  });

  // Manejar todos los mensajes de texto que no son comandos
  bot.on('text', async (ctx) => {
    try {
      // Indicar al usuario que estamos procesando su mensaje
      const typingMessage = await ctx.reply("Procesando tu mensaje...");
      
      // Guardar mensaje del usuario
      const { user } = await telegramService.saveUserMessage(ctx);
      
      // Obtener respuesta de la IA
      const aiResponse = await aiController.processMessage(user.telegramId, ctx.message.text);
      
      // Eliminar mensaje de "procesando"
      await ctx.telegram.deleteMessage(ctx.chat.id, typingMessage.message_id).catch(() => {
        logger.warn('No se pudo eliminar el mensaje de "procesando"');
      });
      
      // Enviar respuesta
      await ctx.reply(aiResponse);
      
      // Guardar respuesta en la base de datos
      await telegramService.saveBotResponse(ctx.from.id, aiResponse, ctx.message.message_id);
    } catch (error) {
      logger.error(`Error al procesar mensaje: ${error.message}`);
      ctx.reply('Lo siento, ocurrió un error al procesar tu mensaje. Por favor, intenta nuevamente.');
    }
  });

  // Manejar mensajes de media (fotos, documentos, etc.)
  bot.on(['photo', 'document', 'video', 'voice'], async (ctx) => {
    try {
      // Guardar mensaje del usuario
      await telegramService.saveUserMessage(ctx);
      
      // Por ahora, solo responder que recibimos el archivo
      const mediaType = ctx.message.photo ? 'imagen' : 
                       ctx.message.document ? 'documento' :
                       ctx.message.video ? 'video' :
                       ctx.message.voice ? 'nota de voz' : 'archivo';
      
      const response = `He recibido tu ${mediaType}. Actualmente no puedo procesar este tipo de contenido, pero puedes enviarme un mensaje de texto para ayudarte.`;
      
      await ctx.reply(response);
      
      // Guardar respuesta del bot
      await telegramService.saveBotResponse(ctx.from.id, response, ctx.message.message_id);
    } catch (error) {
      logger.error(`Error al procesar mensaje de media: ${error.message}`);
      ctx.reply(DEFAULT_ERROR_MESSAGE);
    }
  });
};

module.exports = {
  setupBot
};
