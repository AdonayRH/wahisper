// Maneja las funciones relacionadas con eliminar productos del carrito
const carritoService = require('../../services/carritoService');
const stateService = require('../../services/botStateService');
const displayModule = require('./displayModule');
const logger = require('../../utils/logger');

const STATES = stateService.STATES;

/**
 * Maneja el comando para eliminar un artículo del carrito
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {number} index - Índice del artículo a eliminar
 * @returns {Promise} - Promesa de la operación
 */
async function handleRemoveFromCartCommand(bot, chatId, index) {
  try {
    const result = carritoService.removeFromCart(chatId.toString(), index);
    
    if (result) {
      logger.log(`Usuario ${chatId}: Artículo eliminado en posición ${index}`);
      await bot.sendMessage(chatId, "Artículo eliminado del carrito correctamente.");
      // Mostrar el carrito actualizado
      await displayModule.handleCartCommand(bot, chatId);
      return true;
    } else {
      logger.error(`Error: No se pudo eliminar el artículo ${index} para usuario ${chatId}`);
      await bot.sendMessage(chatId, "Hubo un error al eliminar el artículo. Inténtalo de nuevo.");
      return false;
    }
  } catch (error) {
    logger.error(`Error al eliminar del carrito para usuario ${chatId}: ${error.message}`);
    await bot.sendMessage(chatId, "Hubo un error al eliminar el artículo. Inténtalo de nuevo.");
    return false;
  }
}

/**
 * Inicia el proceso de eliminación de un producto específico
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {number|string} productIdentifier - Índice o identificador del producto
 * @returns {Promise} - Promesa de la operación
 */
async function handleStartRemoveItem(bot, chatId, productIdentifier) {
  try {
    const carrito = carritoService.getCart(chatId.toString());
    
    if (!carrito || carrito.items.length === 0) {
      logger.log(`Usuario ${chatId}: Intento de eliminar de carrito vacío`);
      return bot.sendMessage(chatId, "Tu carrito está vacío. No hay nada que eliminar.");
    }
    
    // Determinar el índice del producto
    let productIndex = -1;
    
    // Si es un número, asumimos que es el índice (1-based)
    if (!isNaN(productIdentifier)) {
      productIndex = parseInt(productIdentifier) - 1;
    } 
    // Si es texto, buscamos por descripción
    else if (typeof productIdentifier === 'string') {
      productIndex = carrito.items.findIndex(item => 
        item.DescripcionArticulo.toLowerCase().includes(productIdentifier.toLowerCase())
      );
    }
    
    // Verificar que el índice sea válido
    if (productIndex < 0 || productIndex >= carrito.items.length) {
      logger.log(`Usuario ${chatId}: Producto no encontrado para eliminar - ${productIdentifier}`);
      return bot.sendMessage(
        chatId, 
        "No he encontrado ese producto en tu carrito. Por favor, revisa tu carrito con el comando /carrito y especifica qué producto quieres eliminar."
      );
    }
    
    const product = carrito.items[productIndex];
    logger.log(`Usuario ${chatId}: Iniciando eliminación del producto ${product.DescripcionArticulo}`);
    
    // Guardar el índice y el producto en el contexto
    stateService.setContextValue(chatId, 'selectedRemoveIndex', productIndex);
    stateService.setContextValue(chatId, 'selectedRemoveProduct', product);
    
    // Si hay más de una unidad, preguntar cuántas eliminar
    if (product.cantidad > 1) {
      stateService.setState(chatId, STATES.ASKING_REMOVE_QUANTITY);
      
      return bot.sendMessage(
        chatId,
        `El producto "${product.DescripcionArticulo}" tiene ${product.cantidad} unidades en tu carrito. ¿Cuántas unidades quieres eliminar?`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "1", callback_data: `remove_qty_1` },
                { text: "2", callback_data: `remove_qty_2` },
                { text: "Todas", callback_data: `remove_qty_all` }
              ]
            ]
          }
        }
      );
    } 
    // Si solo hay una unidad, preguntar confirmación directamente
    else {
      stateService.setState(chatId, STATES.CONFIRMING_REMOVE_ITEM);
      stateService.setContextValue(chatId, 'removeQuantity', 1);
      
      return bot.sendMessage(
        chatId,
        `¿Estás seguro de que quieres eliminar "${product.DescripcionArticulo}" de tu carrito?`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Sí, eliminar", callback_data: "confirm_remove" },
                { text: "❌ No, cancelar", callback_data: "cancel_remove" }
              ]
            ]
          }
        }
      );
    }
  } catch (error) {
    logger.error(`Error al iniciar eliminación de producto para usuario ${chatId}: ${error.message}`);
    bot.sendMessage(chatId, "Hubo un error al procesar tu solicitud. Por favor, inténtalo de nuevo.");
    return null;
  }
}

/**
 * Maneja la especificación de cantidad a eliminar
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {number|string} quantity - Cantidad a eliminar
 * @returns {Promise} - Promesa de la operación
 */
async function handleRemoveQuantity(bot, chatId, quantity) {
  try {
    const context = stateService.getContext(chatId);
    const product = context.selectedRemoveProduct;
    
    if (!product) {
      logger.error(`Error: Producto no encontrado en contexto para usuario ${chatId}`);
      return bot.sendMessage(chatId, "Ha ocurrido un error. Por favor, inicia de nuevo el proceso de eliminación.");
    }
    
    // Convertir 'all' a la cantidad total
    let removeQuantity = quantity === 'all' ? product.cantidad : parseInt(quantity);
    
    // Validar la cantidad
    if (isNaN(removeQuantity) || removeQuantity <= 0) {
      return bot.sendMessage(chatId, "Por favor, especifica una cantidad válida.");
    }
    
    if (removeQuantity > product.cantidad) {
      removeQuantity = product.cantidad;
    }
    
    // Guardar la cantidad en el contexto
    stateService.setContextValue(chatId, 'removeQuantity', removeQuantity);
    stateService.setState(chatId, STATES.CONFIRMING_REMOVE_ITEM);
    
    logger.log(`Usuario ${chatId}: Cantidad a eliminar seleccionada: ${removeQuantity}`);
    
    // Mensaje de confirmación
    const message = removeQuantity === product.cantidad 
      ? `¿Estás seguro de que quieres eliminar todas las unidades de "${product.DescripcionArticulo}" de tu carrito?`
      : `¿Estás seguro de que quieres eliminar ${removeQuantity} unidad(es) de "${product.DescripcionArticulo}" de tu carrito?`;
    
    return bot.sendMessage(
      chatId,
      message,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Sí, eliminar", callback_data: "confirm_remove" },
              { text: "❌ No, cancelar", callback_data: "cancel_remove" }
            ]
          ]
        }
      }
    );
  } catch (error) {
    logger.error(`Error al procesar cantidad a eliminar para usuario ${chatId}: ${error.message}`);
    bot.sendMessage(chatId, "Hubo un error al procesar tu solicitud. Por favor, inténtalo de nuevo.");
    return null;
  }
}

/**
 * Confirma y ejecuta la eliminación de elementos del carrito
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @returns {Promise} - Promesa de la operación
 */
async function handleConfirmRemove(bot, chatId) {
  try {
    const context = stateService.getContext(chatId);
    const productIndex = context.selectedRemoveIndex;
    const product = context.selectedRemoveProduct;
    const removeQuantity = context.removeQuantity;
    
    if (productIndex === undefined || !product || !removeQuantity) {
      logger.error(`Error: Datos incompletos para eliminar producto de usuario ${chatId}`);
      return bot.sendMessage(chatId, "Ha ocurrido un error. Por favor, inicia de nuevo el proceso de eliminación.");
    }
    
    const carrito = carritoService.getCart(chatId.toString());
    
    // Si se van a eliminar todas las unidades
    if (removeQuantity >= product.cantidad) {
      carritoService.removeFromCart(chatId.toString(), productIndex);
      logger.log(`Usuario ${chatId}: Eliminado completamente ${product.DescripcionArticulo} del carrito`);
      await bot.sendMessage(chatId, `✅ He eliminado "${product.DescripcionArticulo}" de tu carrito.`);
    } 
    // Si solo se elimina una parte
    else {
      // Actualizar la cantidad en el carrito
      carritoService.updateItemQuantity(chatId.toString(), productIndex, product.cantidad - removeQuantity);
      logger.log(`Usuario ${chatId}: Eliminadas ${removeQuantity} unidades de ${product.DescripcionArticulo}`);
      await bot.sendMessage(
        chatId, 
        `✅ He eliminado ${removeQuantity} unidad(es) de "${product.DescripcionArticulo}" de tu carrito.`
      );
    }
    
    // Restablecer estado
    stateService.setState(chatId, STATES.INITIAL);
    
    // Mostrar el carrito actualizado
    setTimeout(() => {
      displayModule.handleCartCommand(bot, chatId);
    }, 500);
    
    return true;
  } catch (error) {
    logger.error(`Error al confirmar eliminación para usuario ${chatId}: ${error.message}`);
    bot.sendMessage(chatId, "Hubo un error al eliminar el producto. Por favor, inténtalo de nuevo.");
    stateService.setState(chatId, STATES.INITIAL);
    return false;
  }
}

/**
 * Inicia el proceso de vaciado del carrito
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @returns {Promise} - Promesa de la operación
 */
async function handleStartClearCart(bot, chatId) {
  try {
    const carrito = carritoService.getCart(chatId.toString());
    
    if (!carrito || carrito.items.length === 0) {
      logger.log(`Usuario ${chatId}: Intento de vaciar carrito ya vacío`);
      return bot.sendMessage(chatId, "Tu carrito ya está vacío.");
    }
    
    stateService.setState(chatId, STATES.CONFIRMING_REMOVE_ALL);
    logger.log(`Usuario ${chatId}: Iniciando proceso de vaciado del carrito`);
    
    return bot.sendMessage(
      chatId,
      "⚠️ ¿Estás seguro de que quieres vaciar completamente tu carrito? Esta acción no se puede deshacer.",
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Sí, vaciar carrito", callback_data: "confirm_clear_cart" },
              { text: "❌ No, cancelar", callback_data: "cancel_clear_cart" }
            ]
          ]
        }
      }
    );
  } catch (error) {
    logger.error(`Error al iniciar vaciado del carrito para usuario ${chatId}: ${error.message}`);
    bot.sendMessage(chatId, "Hubo un error al procesar tu solicitud. Por favor, inténtalo de nuevo.");
    return null;
  }
}

/**
 * Maneja el comando para limpiar el carrito
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @returns {Promise} - Promesa de la operación
 */
async function handleClearCartCommand(bot, chatId) {
  try {
    const result = carritoService.clearCart(chatId.toString());
    
    if (result.success) {
      logger.log(`Usuario ${chatId}: Carrito vaciado correctamente`);
      return bot.sendMessage(chatId, "✅ Tu carrito ha sido vaciado correctamente.");
    } else {
      logger.error(`Error al vaciar carrito para usuario ${chatId}: ${result.error}`);
      return bot.sendMessage(chatId, "Hubo un error al vaciar tu carrito. Inténtalo de nuevo.");
    }
  } catch (error) {
    logger.error(`Error al vaciar el carrito para usuario ${chatId}: ${error.message}`);
    return bot.sendMessage(chatId, "Hubo un error al vaciar tu carrito. Inténtalo de nuevo.");
  }
}

module.exports = {
  handleRemoveFromCartCommand,
  handleStartRemoveItem,
  handleRemoveQuantity,
  handleConfirmRemove,
  handleStartClearCart,
  handleClearCartCommand
};