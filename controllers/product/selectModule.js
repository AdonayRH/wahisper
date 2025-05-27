// Maneja las funciones relacionadas con la selección de productos
const stateService = require('../../services/botStateService');
const inventoryService = require('../../services/inventoryService');

/**
 * Maneja la selección de un producto
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
 * @param {number} productIndex - Índice del producto
*/
async function handleProductSelection(bot, chatId, productIndex) {
  try {
    const context = stateService.getContext(chatId);
    
    if (!context.lastMentionedArticles || productIndex >= context.lastMentionedArticles.length) {
      return bot.sendMessage(chatId, "Lo siento, ha ocurrido un error al seleccionar el producto.");
    }
    
    // Guardar el producto seleccionado
    stateService.setContextValue(chatId, 'selectedArticleIndex', productIndex);
    const product = context.lastMentionedArticles[productIndex];
    
    // Verificar disponibilidad en inventario
    const availability = await inventoryService.getProductAvailability(product.CodigoArticulo);
    
    if (!availability.available) {
      return bot.sendMessage(
        chatId,
        `❌ Lo siento, el producto "${product.DescripcionArticulo}" no está disponible actualmente.`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔍 Buscar otro producto", callback_data: "search_products" }]
            ]
          }
        }
      );
    }
    
    // Mensaje con información de stock
    let stockInfo = "";
    if (availability.stock <= 5) {
      stockInfo = `\n⚠️ ¡Solo quedan ${availability.stock} unidades disponibles!`;
    }
    
    // Actualizar estado
    stateService.setState(chatId, stateService.STATES.ASKING_QUANTITY);
    
    // Preguntar cantidad con botones, modificados según disponibilidad
    const quantityModule = require('./quantityModule');
    bot.sendMessage(
      chatId,
      `Has seleccionado "${product.DescripcionArticulo}" (${product.PVP}€).${stockInfo}\n\n¿Cuántas unidades deseas?`,
      quantityModule.generateQuantityButtonsWithStock(productIndex, availability.stock)
    );
  } catch (error) {
    console.error("Error al manejar selección de producto:", error);
    bot.sendMessage(chatId, "Hubo un error al procesar tu selección. Por favor, inténtalo de nuevo.");
  }
}

module.exports = {
  handleProductSelection
};