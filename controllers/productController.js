const { buscarArticulosSimilares } = require('./aiController');
const { generarRespuestaComoVendedor } = require('../services/generarRespuestaComoVendedor');
const stateService = require('../services/botStateService');
const buttonService = require('../services/buttonGeneratorService');

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

    // Formatear los artículos para mostrárselos al usuario
    const articulos = resultados.map(({ articulo }, i) =>
      `${i + 1}. ${articulo.DescripcionArticulo} (PVP: ${articulo.PVP} €)`
    ).join("\n\n");

    // Generar respuesta usando OpenAI
    const respuesta = await generarRespuestaComoVendedor(articulos, query);

    // Enviar respuesta con botones para seleccionar productos
    await bot.sendMessage(chatId, respuesta);
    
    // Después de la respuesta, enviar botones para facilitar la selección
    bot.sendMessage(
      chatId, 
      "¿Cuál de estos productos te interesa?",
      context.lastMentionedArticles
      // buttonService.generateProductButtons(context.lastMentionedArticles)
    );
  } catch (error) {
    console.error("Error al buscar productos:", error);
    bot.sendMessage(chatId, "⚠️ Hubo un error al buscar artículos. Por favor, inténtalo de nuevo.");
  }
}

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
    
    // Actualizar estado
    stateService.setState(chatId, stateService.STATES.ASKING_QUANTITY);
    
    // Preguntar cantidad con botones
    bot.sendMessage(
      chatId,
      `Has seleccionado "${product.DescripcionArticulo}" (${product.PVP}€). ¿Cuántas unidades deseas?`,
      // buttonService.generateQuantityButtons(productIndex)
    );
  } catch (error) {
    console.error("Error al manejar selección de producto:", error);
    bot.sendMessage(chatId, "Hubo un error al procesar tu selección. Por favor, inténtalo de nuevo.");
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
    
    // Guardar la cantidad seleccionada
    stateService.setContextValue(chatId, 'selectedQuantity', quantity);
    const product = context.lastMentionedArticles[productIndex];
    
    // Actualizar estado
    stateService.setState(chatId, stateService.STATES.ASKING_CONFIRMATION);
    
    // Pedir confirmación final
    bot.sendMessage(
      chatId,
      `¿Quieres añadir ${quantity} unidad(es) de "${product.DescripcionArticulo}" a tu carrito?`,
      // buttonService.generateConfirmButtons()
    );
  } catch (error) {
    console.error("Error al manejar selección de cantidad:", error);
    bot.sendMessage(chatId, "Hubo un error al procesar la cantidad. Por favor, inténtalo de nuevo.");
  }
}

module.exports = {
  handleProductSearch,
  handleProductSelection,
  handleQuantitySelection
};