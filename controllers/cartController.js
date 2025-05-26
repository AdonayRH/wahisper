// Controlador principal para el manejo del carrito, refactorizado para usar módulos

const cartModules = require('./cart');

/**
 * Maneja el comando /carrito
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @returns {Promise} - Promesa de la operación
*/
function handleCartCommand(bot, chatId) {
  return cartModules.handleCartCommand(bot, chatId);
}

/**
 * Maneja el comando para exportar el carrito
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @returns {Promise} - Promesa de la operación
*/
function handleExportCartCommand(bot, chatId) {
  
  return cartModules.handleExportCartCommand(bot, chatId);
}

/**
 * Maneja el comando para eliminar un artículo del carrito
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {number} index - Índice del artículo a eliminar
 * @returns {Promise} - Promesa de la operación
*/
function handleRemoveFromCartCommand(bot, chatId, index) {
  return cartModules.handleRemoveFromCartCommand(bot, chatId, index);
}

/**
 * Maneja el comando para limpiar el carrito
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @returns {Promise} - Promesa de la operación
*/
function handleClearCartCommand(bot, chatId) {
  return cartModules.handleClearCartCommand(bot, chatId);
}

/**
 * Añade un producto al carrito verificando el stock disponible
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {object} product - Producto a añadir
 * @param {number} quantity - Cantidad
 * @returns {boolean} - Indica si se añadió correctamente
*/
function addToCart(bot, chatId, product, quantity) {
  return cartModules.addToCart(bot, chatId, product, quantity);
}

/**
 * Inicia el proceso de eliminación de un producto específico
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {number|string} productIdentifier - Índice o identificador del producto
 * @returns {Promise} - Promesa de la operación
*/
function handleStartRemoveItem(bot, chatId, productIdentifier) {
  return cartModules.handleStartRemoveItem(bot, chatId, productIdentifier);
}

/**
 * Maneja la especificación de cantidad a eliminar
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {number|string} quantity - Cantidad a eliminar
 * @returns {Promise} - Promesa de la operación
*/
function handleRemoveQuantity(bot, chatId, quantity) {
  return cartModules.handleRemoveQuantity(bot, chatId, quantity);
}

/**
 * Confirma y ejecuta la eliminación de elementos del carrito
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @returns {Promise} - Promesa de la operación
*/
function handleConfirmRemove(bot, chatId) {
  return cartModules.handleConfirmRemove(bot, chatId);
}

/**
 * Inicia el proceso de vaciado del carrito
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @returns {Promise} - Promesa de la operación
*/
function handleStartClearCart(bot, chatId) {
  return cartModules.handleStartClearCart(bot, chatId);
}

/**
 * Inicia el proceso para añadir unidades a un producto en el carrito
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {string|number} productReference - Referencia al producto (nombre o índice)
 * @returns {Promise} - Promesa de la operación
*/
function handleStartAddUnits(bot, chatId, productReference) {
  return cartModules.handleStartAddUnits(bot, chatId, productReference);
}

/**
 * Procesa la cantidad a añadir a un producto
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {number|string} quantity - Cantidad a añadir
 * @returns {Promise} - Promesa de la operación
*/
function handleAddQuantity(bot, chatId, quantity) {
  return cartModules.handleAddQuantity(bot, chatId, quantity);
}

/**
 * Actualiza la cantidad de un elemento en el carrito
 * @param {string} telegramId - ID de Telegram del usuario
 * @param {number} itemIndex - Índice del ítem
 * @param {number} newQuantity - Nueva cantidad
 * @returns {object} - Carrito actualizado
*/
function updateItemQuantity(telegramId, itemIndex, newQuantity) {
  return cartModules.updateItemQuantity(telegramId, itemIndex, newQuantity);
}

module.exports = {
  handleCartCommand,
  handleExportCartCommand,
  handleRemoveFromCartCommand,
  handleClearCartCommand,
  addToCart,
  handleStartRemoveItem,
  handleRemoveQuantity,
  handleConfirmRemove,
  handleStartClearCart,
  handleStartAddUnits,
  handleAddQuantity,
  updateItemQuantity
};