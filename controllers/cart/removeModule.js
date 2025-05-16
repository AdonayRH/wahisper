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
      bot.sendMessage(chatId, `✅ He eliminado "${product.DescripcionArticulo}" de tu carrito.`);
    } 
    // Si solo se elimina una parte
    else {
      // Actualizar la cantidad en el carrito
      carritoService.updateItemQuantity(chatId.toString(), productIndex, product.cantidad - removeQuantity);
      logger.log(`Usuario ${chatId}: Eliminadas ${removeQuantity} unidades de ${product.DescripcionArticulo}`);
      bot.sendMessage(
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