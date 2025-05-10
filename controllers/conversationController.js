// Este módulo gestiona las conversaciones y el estado del bot de Telegram.
const stateService = require('../services/botStateService');
const cartController = require('./cartController');
const productController = require('./productController');

/**
 * Procesa y guarda datos del usuario
 * @param {object} bot - Instancia del bot
 * @param {object} msg - Mensaje de Telegram
 * @param {object} carritoService - Servicio de carrito
 * @returns {object|null} - Datos del usuario o null
 */
function processUserData(msg, carritoService) {
  const chatId = msg.chat.id;
  const from = msg.from;
  
  if (!from) return null;
  
  // Extraer información del usuario
  const userData = {
    id: from.id,
    is_bot: from.is_bot || false,
    first_name: from.first_name || "",
    last_name: from.last_name || "",
    username: from.username || "",
    language_code: from.language_code || "",
    is_premium: from.is_premium || false
  };
  
  // Guardar en el carrito
  carritoService.saveUserData(chatId.toString(), userData);
  
  return userData;
}

/**
 * Maneja el fin de la conversación
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
 */
function handleEndConversation(bot, chatId) {
  stateService.setState(chatId, stateService.STATES.ENDING);
  
  bot.sendMessage(
    chatId, 
    "¡Perfecto! Ha sido un placer atenderte. Si necesitas cualquier otra cosa en el futuro, estaré aquí para ayudarte. ¡Que tengas un excelente día!"
  );
}

/**
 * Verifica si el texto indica fin de conversación
 * @param {string} text - Texto a verificar
 * @returns {boolean} - Indica si es fin de conversación
 */
function isEndingConversation(text) {
  const endingPatterns = [
    /^no,?\s*(gracias|thanks)/i,
    /^nada\s*m[áa]s/i,
    /^no\s*(quiero|necesito)\s*(nada\s*)?m[áa]s/i,
    /^eso\s*(es\s*)?(todo|all)/i,
    /^(es\s*)?suficiente/i,
    /^ya\s*est[áa]/i,
    /^listo/i,
    /^(así|asi)\s*(est[áa](\s*bien)?)?/i,
    /^no\s*por\s*ahora/i,
    /^(con\s*eso|esto)\s*(es\s*)?suficiente/i
  ];
  
  return endingPatterns.some(pattern => pattern.test(text));
}

/**
 * Maneja la confirmación final de añadir al carrito
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
 * @param {boolean} confirmed - Indica si se confirmó
 */
async function handleFinalConfirmation(bot, chatId, confirmed) {
  try {
    const context = stateService.getContext(chatId);
    
    if (!context.lastMentionedArticles) {
      return bot.sendMessage(chatId, "Lo siento, ha ocurrido un error al procesar tu confirmación.");
    }
    
    if (confirmed) {
      // Obtener el producto y cantidad
      const product = context.lastMentionedArticles[context.selectedArticleIndex];
      const quantity = context.selectedQuantity;
      
      // Añadir al carrito y actualizar estado
      const added = await cartController.addToCart(bot, chatId, product, quantity);
      stateService.setState(chatId, added ? stateService.STATES.ASKING_FOR_MORE : stateService.STATES.INITIAL);
    } else {
      // Actualizar estado
      stateService.setState(chatId, stateService.STATES.INITIAL);
      
      // Notificar al usuario
      bot.sendMessage(
        chatId,
        "De acuerdo, he cancelado la adición al carrito. ¿En qué más puedo ayudarte?"
      );
    }
  } catch (error) {
    console.error("Error al manejar confirmación final:", error);
    bot.sendMessage(chatId, "Hubo un error al procesar tu confirmación. Por favor, inténtalo de nuevo.");
  }
}

/**
 * Maneja el comando para cancelar operaciones en curso
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
 * @param {object} fs - Módulo fs
 * @param {string} path - Módulo path
 */
function handleCancelCommand(bot, chatId, fs, path) {
  const context = stateService.getContext(chatId);
  
  // Verificar si hay alguna operación pendiente
  if (context.state !== stateService.STATES.INITIAL) {
    // Si hay un archivo pendiente, eliminarlo
    const fileName = context.pendingFile;
    if (fileName) {
      const filePath = path.join(__dirname, '../uploads', fileName);
      if (fs.existsSync(filePath)) {
        fs.removeSync(filePath);
      }
    }
    
    // Restablecer estado
    stateService.setState(chatId, stateService.STATES.INITIAL);
    stateService.setContextValue(chatId, 'pendingFile', undefined);
    
    bot.sendMessage(chatId, "Operación cancelada. ¿En qué más puedo ayudarte?");
  }
}

module.exports = {
  processUserData,
  handleEndConversation,
  isEndingConversation,
  handleFinalConfirmation,
  handleCancelCommand
};