require('dotenv').config();
const { Telegraf } = require('telegraf');
const mongoose = require('mongoose');
const connectDB = require('./config/database');
const botController = require('./controllers/botController');
const logger = require('./utils/logger');

// Conexión a la base de datos
connectDB();

// Inicialización del bot
const bot = new Telegraf(process.env.MY_TOKEN);

// Middleware para registrar mensajes entrantes
bot.use((ctx, next) => {
  logger.info(`[${ctx.from?.username || 'Unknown'}]: ${ctx.message?.text || 'Non-text message'}`);
  return next();
});

// Configurar manejadores de comandos y mensajes
botController.setupBot(bot);

// Manejo de errores
bot.catch((err, ctx) => {
  logger.error(`Error en el bot: ${err.message}`);
  ctx.reply('Ocurrió un error al procesar tu mensaje. Por favor, intenta nuevamente más tarde.');
});

// Iniciar el bot
bot.launch().then(() => {
  logger.info('Bot iniciado correctamente! 🚀');
}).catch(err => {
  logger.error(`Error al iniciar el bot: ${err.message}`);
});

// Manejo de cierre elegante
const gracefulShutdown = () => {
  bot.stop('SIGINT');
  mongoose.connection.close();
  process.exit(0);
};

process.once('SIGINT', gracefulShutdown);
process.once('SIGTERM', gracefulShutdown);

// Servidor web opcional para mantener el bot activo en servicios como Heroku
if (process.env.NODE_ENV === 'production') {
  const express = require('express');
  const app = express();
  const PORT = process.env.PORT || 3000;
  
  app.get('/', (req, res) => {
    res.send('Bot está funcionando correctamente');
  });
  
  app.listen(PORT, () => {
    logger.info(`Servidor web iniciado en el puerto ${PORT}`);
  });
}