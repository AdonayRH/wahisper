const productModules = require('./product');

/**
 * Maneja la selección de un producto
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
 * @param {number} productIndex - Índice del producto
 */
function handleProductSelection(bot, chatId, productIndex) {
  return productModules.handleProductSelection(bot, chatId, productIndex);
}

/**
 * Genera botones de cantidad adaptados al stock disponible
 * @param {number} productIndex - Índice del producto
 * @param {number} availableStock - Stock disponible
 * @returns {object} - Configuración de botones
 */
function generateQuantityButtonsWithStock(productIndex, availableStock) {
  return productModules.generateQuantityButtonsWithStock(productIndex, availableStock);
}

/**
 * Maneja la selección de cantidad
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
 * @param {number} productIndex - Índice del producto
 * @param {number} quantity - Cantidad seleccionada
 */
function handleQuantitySelection(bot, chatId, productIndex, quantity) {
  return productModules.handleQuantitySelection(bot, chatId, productIndex, quantity);
}

/**
 * Maneja la búsqueda de productos
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
 * @param {string} query - Consulta de búsqueda
 */
function handleProductSearch(bot, chatId, query) {
  return productModules.handleProductSearch(bot, chatId, query);
}

module.exports = {
  handleProductSelection,
  generateQuantityButtonsWithStock,
  handleQuantitySelection,
  handleProductSearch
};