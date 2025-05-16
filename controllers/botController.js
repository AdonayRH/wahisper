const bot = require("../services/telegramService");
const logger = require('../utils/logger');
const handlers = require('../handlers');

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

// Configurar manejadores de errores globales
handlers.errorHandlers.setupGlobalErrorHandlers();

logger.log('Bot configurado y listo para recibir mensajes');

// Exportar bot para uso en otros módulos
module.exports = bot;