// Maneja las acciones específicas para cada estado de la conversación

const productController = require('../controllers/productController');
const cartController = require('../controllers/cartController');
const carritoService = require('../services/carritoService');
const stateService = require('../services/botStateService');
const logger = require('../utils/logger');

const STATES = stateService.STATES;

/**
 * Maneja el estado ASKING_QUANTITY
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {string} text - Texto del mensaje
 * @param {object} intentAnalysis - Resultado del análisis de intención
 * @returns {Promise} - Promesa con la respuesta
 */
async function handleAskingQuantityState(bot, chatId, text, intentAnalysis) {
  try {
    const context = stateService.getContext(chatId);
    
    // Primero intentar extraer un número directamente
    const numberMatch = text.match(/\d+/);
    if (numberMatch) {
      return productController.handleQuantitySelection(
        bot, 
        chatId, 
        context.selectedArticleIndex, 
        parseInt(numberMatch[0])
      );
    }
    
    // Verificar si se detectó una cantidad en el análisis de intención
    if (intentAnalysis.intent === "QUANTITY" && 
        intentAnalysis.quantityMentioned && 
        intentAnalysis.quantityMentioned > 0) {
      
      logger.log(`Cantidad detectada en texto: ${intentAnalysis.quantityMentioned}`);
      
      return productController.handleQuantitySelection(
        bot, 
        chatId, 
        context.selectedArticleIndex, 
        intentAnalysis.quantityMentioned
      );
    }
    
    // Si no se puede extraer un número, pedir de nuevo
    return bot.sendMessage(
      chatId,
      "Por favor, introduce un número válido para la cantidad (puedes escribir el número o el nombre, como '2' o 'dos'):"
    );
  } catch (error) {
    logger.error(`Error al procesar cantidad: ${error.message}`);
    // Si hay un error, pedir de nuevo
    return bot.sendMessage(
      chatId,
      "Por favor, introduce un número válido para la cantidad:"
    );
  }
}

/**
 * Maneja el estado ADDING_UNITS o ASKING_ADD_QUANTITY
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {string} text - Texto del mensaje
 * @param {object} intentAnalysis - Resultado del análisis de intención
 * @returns {Promise} - Promesa con la respuesta
 */
async function handleAddingUnitsState(bot, chatId, text, intentAnalysis) {
  try {
    // Intentar extraer un número del texto
    const numberMatch = text.match(/\d+/);
    if (numberMatch) {
      const cantidad = parseInt(numberMatch[0]);
      return cartController.handleAddQuantity(bot, chatId, cantidad);
    }
    
    // Si hay una cantidad en el análisis de intención
    if (intentAnalysis.intent === "QUANTITY" && 
        intentAnalysis.quantityMentioned && 
        intentAnalysis.quantityMentioned > 0) {
      
      return cartController.handleAddQuantity(
        bot, 
        chatId, 
        intentAnalysis.quantityMentioned
      );
    }
    
    // Si no hay coincidencia numérica clara, informar al usuario
    return bot.sendMessage(
      chatId,
      "Por favor, indica un número válido para la cantidad adicional que deseas añadir."
    );
  } catch (error) {
    logger.error(`Error al procesar cantidad a añadir: ${error.message}`);
    return bot.sendMessage(
      chatId,
      "Hubo un error al procesar la cantidad. Por favor, intenta de nuevo."
    );
  }
}

/**
 * Maneja el estado REMOVING_ITEM
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {string} text - Texto del mensaje
 * @returns {Promise} - Promesa con la respuesta
 */
async function handleRemovingItemState(bot, chatId, text) {
  const items = carritoService.getCart(chatId.toString())?.items || [];
  
  if (items.length === 0) {
    bot.sendMessage(chatId, "Tu carrito está vacío. No hay productos para eliminar.");
    stateService.setState(chatId, STATES.INITIAL);
    return;
  }
  
  // Primero intentar por número
  let productIndex = -1;
  
  // Si el texto contiene números, intentar extraer el índice
  const matches = text.match(/\d+/);
  if (matches) {
    const num = parseInt(matches[0]);
    if (num > 0 && num <= items.length) {
      productIndex = num - 1; // Ajustar al índice base-0
    }
  }
  
  // Si no se encontró por número, buscar por nombre
  if (productIndex === -1) {
    const query = text.toLowerCase().trim();
    productIndex = items.findIndex(item => 
      item.DescripcionArticulo.toLowerCase().includes(query)
    );
  }
  
  if (productIndex >= 0) {
    // Eliminar el producto
    const removedItem = items[productIndex].DescripcionArticulo;
    carritoService.removeFromCart(chatId.toString(), productIndex);
    
    bot.sendMessage(
      chatId, 
      `✅ Producto "${removedItem}" eliminado del carrito.`
    );
    
    // Mostrar carrito actualizado
    cartController.handleCartCommand(bot, chatId);
  } else {
    bot.sendMessage(
      chatId,
      "No pude identificar el producto que deseas eliminar. Por favor, indica el número exacto del producto (1, 2, 3...) o su nombre preciso."
    );
  }
  
  // Restablecer estado
  stateService.setState(chatId, STATES.INITIAL);
}

/**
 * Maneja el estado ASKING_REMOVE_QUANTITY
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {string} text - Texto del mensaje
 * @param {object} intentAnalysis - Resultado del análisis de intención
 * @returns {Promise} - Promesa con la respuesta
 */
async function handleAskingRemoveQuantityState(bot, chatId, text, intentAnalysis) {
  try {
    // Primero intentar extraer un número directamente
    const numberMatch = text.match(/\d+/);
    if (numberMatch) {
      return cartController.handleRemoveQuantity(
        bot, 
        chatId, 
        parseInt(numberMatch[0])
      );
    }
    
    // Si no hay número directo, usar análisis de intención
    if (intentAnalysis.intent === "QUANTITY" && 
        intentAnalysis.quantityMentioned && 
        intentAnalysis.quantityMentioned > 0) {
      
      return cartController.handleRemoveQuantity(
        bot, 
        chatId, 
        intentAnalysis.quantityMentioned
      );
    }
    
    // Palabras clave para eliminar todo
    if (/tod[oa]s|completo|enter[oa]/i.test(text)) {
      return cartController.handleRemoveQuantity(bot, chatId, 'all');
    }
    
    // Si no se pudo extraer una cantidad, pedir de nuevo
    return bot.sendMessage(
      chatId,
      "Por favor, especifica cuántas unidades quieres eliminar, o escribe 'todas' para eliminar el producto completo."
    );
  } catch (error) {
    logger.error(`Error al procesar cantidad a eliminar: ${error.message}`);
    return bot.sendMessage(
      chatId,
      "Hubo un error al procesar la cantidad. Por favor, intenta de nuevo."
    );
  }
}

/**
 * Maneja el estado CONFIRMING_REMOVE_ITEM
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {object} intentAnalysis - Resultado del análisis de intención
 * @returns {Promise} - Promesa con la respuesta
 */
async function handleConfirmingRemoveItemState(bot, chatId, intentAnalysis) {
  if (intentAnalysis.intent === "CONFIRMATION") {
    return cartController.handleConfirmRemove(bot, chatId);
  } 
  else if (intentAnalysis.intent === "REJECTION") {
    stateService.setState(chatId, STATES.INITIAL);
    return bot.sendMessage(
      chatId,
      "Operación cancelada. No se ha eliminado nada de tu carrito."
    );
  }
  else {
    return bot.sendMessage(
      chatId,
      "Por favor, confirma si quieres eliminar el producto o no."
    );
  }
}

/**
 * Maneja el estado CONFIRMING_REMOVE_ALL
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {object} intentAnalysis - Resultado del análisis de intención
 * @returns {Promise} - Promesa con la respuesta
 */
async function handleConfirmingRemoveAllState(bot, chatId, intentAnalysis) {
  if (intentAnalysis.intent === "CONFIRMATION") {
    await cartController.handleClearCartCommand(bot, chatId);
    stateService.setState(chatId, STATES.INITIAL);
    return bot.sendMessage(
      chatId,
      "✅ Tu carrito ha sido vaciado completamente."
    );
  } 
  else if (intentAnalysis.intent === "REJECTION") {
    stateService.setState(chatId, STATES.INITIAL);
    return bot.sendMessage(
      chatId,
      "Operación cancelada. Tu carrito no ha sido modificado."
    );
  }
  else {
    return bot.sendMessage(
      chatId,
      "Por favor, confirma si quieres vaciar completamente tu carrito o no."
    );
  }
}

/**
 * Maneja un estado específico según el contexto actual
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {string} text - Texto del mensaje
 * @param {object} intentAnalysis - Resultado del análisis de intención
 * @returns {Promise} - Promesa con la respuesta
 */
async function handleStateBasedAction(bot, chatId, text, intentAnalysis) {
  const context = stateService.getContext(chatId);
  
  switch (context.state) {
    case STATES.ASKING_QUANTITY:
      return handleAskingQuantityState(bot, chatId, text, intentAnalysis);
      
    case STATES.ADDING_UNITS:
    case STATES.ASKING_ADD_QUANTITY:
      return handleAddingUnitsState(bot, chatId, text, intentAnalysis);

    case STATES.REMOVING_ITEM:
      return handleRemovingItemState(bot, chatId, text);

    case STATES.ASKING_FOR_MORE:
      // Si el usuario quiere seguir comprando, resetear al estado inicial
      stateService.setState(chatId, STATES.INITIAL);
      return null;
      
    case STATES.ASKING_REMOVE_QUANTITY:
      return handleAskingRemoveQuantityState(bot, chatId, text, intentAnalysis);
      
    case STATES.CONFIRMING_REMOVE_ITEM:
      return handleConfirmingRemoveItemState(bot, chatId, intentAnalysis);
      
    case STATES.CONFIRMING_REMOVE_ALL:
      return handleConfirmingRemoveAllState(bot, chatId, intentAnalysis);
      
    default:
      return null; // Indica que no se manejó ningún estado específico
  }
}

/**
 * Verifica si estamos en un estado especial que debe manejarse sin análisis de intención
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {string} text - Texto del mensaje
 * @returns {boolean} - Indica si se manejó el estado
 */
function handleSpecialState(bot, chatId, text) {
  const context = stateService.getContext(chatId);
  
  // Verificar si estamos en estados de confirmación que pueden procesarse sin análisis de intención
  if (context.state === STATES.CONFIRMING_REMOVE_ITEM) {
    // Para el caso de confirmación simple, verificar patrones afirmativos/negativos directamente
    const affirmativePatterns = /^(s[iíì]|yes|confirmar|confirmo|claro|adelante|ok|aceptar|acepto)$/i;
    const negativePatterns = /^(no|nop|cancel|cancelar|cancelo)$/i;
    
    if (affirmativePatterns.test(text)) {
      cartController.handleConfirmRemove(bot, chatId);
      return true;
    } 
    else if (negativePatterns.test(text)) {
      stateService.setState(chatId, STATES.INITIAL);
      bot.sendMessage(
        chatId,
        "Operación cancelada. No se ha eliminado nada de tu carrito."
      );
      return true;
    }
  }
  
  return false;
}

module.exports = {
  handleAskingQuantityState,
  handleAddingUnitsState,
  handleRemovingItemState,
  handleAskingRemoveQuantityState,
  handleConfirmingRemoveItemState,
  handleConfirmingRemoveAllState,
  handleStateBasedAction,
  handleSpecialState
};