const User = require('../models/user');
const Message = require('../models/message');
const logger = require('../utils/logger');

/**
 * Guarda un mensaje de usuario en la base de datos
 * @param {Object} ctx - Contexto de Telegraf
 * @returns {Promise<Object>} - Objeto de mensaje guardado
 */
const saveUserMessage = async (ctx) => {
  try {
    // Obtener o crear usuario
    let user = await User.findOne({ telegramId: ctx.from.id });
    
    if (!user) {
      user = new User({
        telegramId: ctx.from.id,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name
      });
      await user.save();
      logger.info(`Nuevo usuario registrado: ${user.username || user.telegramId}`);
    }
    
    // Actualizar última interacción
    user.lastInteraction = new Date();
    
    // Determinar tipo de mensaje
    let mediaType = 'text';
    let mediaUrl = null;
    let text = ctx.message.text || '';
    
    if (ctx.message.photo) {
      mediaType = 'photo';
      mediaUrl = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    } else if (ctx.message.document) {
      mediaType = 'document';
      mediaUrl = ctx.message.document.file_id;
    } else if (ctx.message.voice) {
      mediaType = 'voice';
      mediaUrl = ctx.message.voice.file_id;
    } else if (ctx.message.video) {
      mediaType = 'video';
      mediaUrl = ctx.message.video.file_id;
    }
    
    // Guardar mensaje
    const message = new Message({
      user: user._id,
      telegramId: ctx.from.id,
      messageId: ctx.message.message_id,
      text: text,
      mediaType: mediaType,
      mediaUrl: mediaUrl
    });
    
    await message.save();
    
    // Agregar mensaje al historial de conversación del usuario
    user.conversationHistory.push({
      role: 'user',
      content: text
    });
    
    await user.save();
    
    return { user, message };
  } catch (error) {
    logger.error(`Error al guardar mensaje de usuario: ${error.message}`);
    throw error;
  }
};

/**
 * Guarda respuesta del bot en la base de datos
 * @param {Number} telegramId - ID de Telegram del usuario
 * @param {String} text - Texto de la respuesta
 * @param {Number} replyToMessageId - ID del mensaje al que se responde
 * @returns {Promise<Object>} - Objeto de mensaje guardado
 */
const saveBotResponse = async (telegramId, text, replyToMessageId) => {
  try {
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      throw new Error(`Usuario no encontrado: ${telegramId}`);
    }
    
    // Crear nuevo mensaje
    const message = new Message({
      user: user._id,
      telegramId: telegramId,
      messageId: Date.now(), // Temporal hasta que se obtenga el ID real
      text: text,
      isFromBot: true,
      processed: true
    });
    
    await message.save();
    
    // Agregar respuesta al historial de conversación
    user.conversationHistory.push({
      role: 'assistant',
      content: text
    });
    
    await user.save();
    
    return message;
  } catch (error) {
    logger.error(`Error al guardar respuesta del bot: ${error.message}`);
    throw error;
  }
};

/**
 * Obtiene el historial de conversación de un usuario
 * @param {Number} telegramId - ID de Telegram del usuario
 * @returns {Promise<Array>} - Historial de conversación
 */
const getConversationHistory = async (telegramId) => {
  try {
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return [];
    }
    
    return user.conversationHistory;
  } catch (error) {
    logger.error(`Error al obtener historial de conversación: ${error.message}`);
    throw error;
  }
};

module.exports = {
  saveUserMessage,
  saveBotResponse,
  getConversationHistory
};