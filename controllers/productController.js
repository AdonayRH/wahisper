// Actualización a productController.js para verificar stock

const { buscarArticulosSimilares } = require('./aiController');
const { generarRespuestaComoVendedor } = require('../services/generarRespuestaComoVendedor');
const stateService = require('../services/botStateService');
const buttonService = require('../services/buttonGeneratorService');
const inventoryService = require('../services/inventoryService');

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
    bot.sendMessage(
      chatId,
      `Has seleccionado "${product.DescripcionArticulo}" (${product.PVP}€).${stockInfo}\n\n¿Cuántas unidades deseas?`,
      generateQuantityButtonsWithStock(productIndex, availability.stock)
    );
  } catch (error) {
    console.error("Error al manejar selección de producto:", error);
    bot.sendMessage(chatId, "Hubo un error al procesar tu selección. Por favor, inténtalo de nuevo.");
  }
}

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

/**
 * Maneja la búsqueda de productos
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
 * @param {string} query - Consulta de búsqueda
 */
async function handleProductSearch(bot, chatId, query) {
  try {
    const context = stateService.getContext(chatId);
    
    // Buscar artículos similares
    const resultados = await buscarArticulosSimilares(query);
    
    if (resultados.length === 0) {
      return bot.sendMessage(
        chatId, 
        "No encontré ningún artículo relacionado con tu búsqueda. ¿Puedes ser más específico o buscar algo diferente?"
      );
    }

    // Guardar artículos mencionados en el contexto
    stateService.setContextValue(chatId, 'lastMentionedArticles', resultados.map(r => r.articulo));
    stateService.setContextValue(chatId, 'lastQuery', query);
    stateService.setContextValue(chatId, 'lastProductsShown', resultados.map(r => r.articulo.DescripcionArticulo));
    stateService.setState(chatId, stateService.STATES.SHOWING_PRODUCTS);

    // Formatear los artículos y añadir información de stock
    const articulosConStock = [];
    
    for (const [i, { articulo }] of resultados.entries()) {
      const availability = await inventoryService.getProductAvailability(articulo.CodigoArticulo);
      let stockInfo = "";
      
      if (!availability.available) {
        stockInfo = " (Agotado)";
      } else if (availability.stock <= 5) {
        stockInfo = ` (¡Solo quedan ${availability.stock}!)`;
      }
      
      articulosConStock.push(`${i + 1}. ${articulo.DescripcionArticulo} (PVP: ${articulo.PVP} €)${stockInfo}`);
    }

    // Generar respuesta usando OpenAI
    const respuesta = await generarRespuestaComoVendedor(articulosConStock.join("\n\n"), query);

    // Enviar respuesta con botones para seleccionar productos
    await bot.sendMessage(chatId, respuesta);
    
    // Después de la respuesta, enviar botones para facilitar la selección
    bot.sendMessage(
      chatId, 
      "¿Cuál de estos productos te interesa?",
      buttonService.generateProductButtons(context.lastMentionedArticles)
    );
  } catch (error) {
    console.error("Error al buscar productos:", error);
    bot.sendMessage(chatId, "⚠️ Hubo un error al buscar artículos. Por favor, inténtalo de nuevo.");
  }
}

module.exports = {
  handleProductSearch,
  handleProductSelection,
  handleQuantitySelection
};