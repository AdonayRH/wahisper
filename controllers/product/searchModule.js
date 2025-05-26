// Maneja las funciones relacionadas con la búsqueda de productos
const { buscarArticulosSimilares } = require('../aiController');
const { generarRespuestaComoVendedor } = require('../../services/generarRespuestaComoVendedor');
const stateService = require('../../services/botStateService');
const buttonService = require('../../services/buttonGeneratorService');
const inventoryService = require('../../services/inventoryService');

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
  handleProductSearch
};