// Maneja las funciones relacionadas con la selección de cantidad
const stateService = require('../../services/botStateService');
const buttonService = require('../../services/buttonGeneratorService');
const inventoryService = require('../../services/inventoryService');

/**
 * Genera botones de cantidad adaptados al stock disponible
 * @param {number} productIndex - Índice del producto
 * @param {number} availableStock - Stock disponible
 * @returns {object} - Configuración de botones
 */
function generateQuantityButtonsWithStock(productIndex, availableStock) {
  // Si hay stock limitado, ajustar los botones
  if (availableStock <= 5) {
    const buttons = [];
    const row1 = [];
    const row2 = [];
    
    // Crear botones solo para cantidades disponibles
    for (let i = 1; i <= Math.min(availableStock, 5); i++) {
      const button = { 
        text: i.toString(), 
        callback_data: `qty_${productIndex}_${i}` 
      };
      
      if (i <= 3) {
        row1.push(button);
      } else {
        row2.push(button);
      }
    }
    
    buttons.push(row1);
    if (row2.length > 0) {
      buttons.push(row2);
    }
    
    return {
      reply_markup: {
        inline_keyboard: buttons
      }
    };
  } else {
    // Si hay suficiente stock, usar botones normales
    return buttonService.generateQuantityButtons(productIndex);
  }
}

/**
 * Maneja la selección de cantidad
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
 * @param {number} productIndex - Índice del producto
 * @param {number} quantity - Cantidad seleccionada
 */
async function handleQuantitySelection(bot, chatId, productIndex, quantity) {
  try {
    const context = stateService.getContext(chatId);
    
    if (!context.lastMentionedArticles) {
      return bot.sendMessage(chatId, "Lo siento, ha ocurrido un error al procesar la cantidad.");
    }
    
    const product = context.lastMentionedArticles[productIndex];
    
    // Verificar que la cantidad solicitada esté disponible
    const availability = await inventoryService.getProductAvailability(product.CodigoArticulo);
    
    if (!availability.available) {
      return bot.sendMessage(
        chatId,
        `❌ Lo siento, el producto "${product.DescripcionArticulo}" ya no está disponible.`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔍 Buscar otro producto", callback_data: "search_products" }]
            ]
          }
        }
      );
    }
    
    if (quantity > availability.stock) {
      return bot.sendMessage(
        chatId,
        `❌ Lo siento, solo hay ${availability.stock} unidades disponibles de "${product.DescripcionArticulo}".\n\nPor favor, selecciona una cantidad menor.`,
        generateQuantityButtonsWithStock(productIndex, availability.stock)
      );
    }
    
    // Guardar la cantidad seleccionada
    stateService.setContextValue(chatId, 'selectedQuantity', quantity);
    
    // Actualizar estado
    stateService.setState(chatId, stateService.STATES.ASKING_CONFIRMATION);
    
    // Pedir confirmación final
    bot.sendMessage(
      chatId,
      `¿Quieres añadir ${quantity} unidad(es) de "${product.DescripcionArticulo}" a tu carrito?`,
      buttonService.generateConfirmButtons()
    );
  } catch (error) {
    console.error("Error al manejar selección de cantidad:", error);
    bot.sendMessage(chatId, "Hubo un error al procesar la cantidad. Por favor, inténtalo de nuevo.");
  }
}

module.exports = {
  generateQuantityButtonsWithStock,
  handleQuantitySelection
};