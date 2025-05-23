// Maneja las funciones relacionadas con mostrar el carrito
const carritoService = require('../../services/carritoService');
const buttonGeneratorService = require('../../services/buttonGeneratorService');
const logger = require('../../utils/logger');

/**
 * Maneja el comando para mostrar el carrito
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @returns {Promise} - Promesa de la operación
 */
async function handleCartCommand(bot, chatId) {
  try {
    const carrito = carritoService.getCart(chatId.toString());
    
    if (!carrito || carrito.items.length === 0) {
      logger.log(`Usuario ${chatId}: Carrito vacío`);
      return bot.sendMessage(
        chatId, 
        "Tu carrito está vacío. ¿En qué puedo ayudarte hoy?", 
        buttonGeneratorService.generateEmptyCartButtons()
      );
    }
    
    let total = 0;
    let mensaje = "🛒 *Tu carrito de compra:*\n\n";
    
    carrito.items.forEach((item, index) => {
      // Asegurarse de que precio y cantidad sean números
      const precio = parseFloat(item.precio) || 0;
      const cantidad = parseInt(item.cantidad) || 0;
      
      const subtotal = precio * cantidad;
      total += subtotal;
      
      mensaje += `${index + 1}. ${item.DescripcionArticulo} - ${cantidad} unidad(es) x ${precio.toFixed(2)}€ = ${subtotal.toFixed(2)}€\n`;
    });
    
    mensaje += `\n*Total: ${total.toFixed(2)}€*\n\n`;
    
    logger.log(`Usuario ${chatId}: Mostrando carrito con ${carrito.items.length} productos`);
    
    // Enviar mensaje con botones adecuados según número de items
    return bot.sendMessage(chatId, mensaje, { 
      parse_mode: "Markdown",
      ...buttonGeneratorService.generateCartButtons(carrito.items.length)
    });
  } catch (error) {
    logger.error(`Error al mostrar el carrito para usuario ${chatId}: ${error.message}`);
    return bot.sendMessage(chatId, "Hubo un error al mostrar tu carrito. Inténtalo de nuevo.");
  }
}

/**
 * Formatea un carrito para mostrarlo al usuario
 * @param {object} carrito - Objeto del carrito
 * @returns {object} - Objeto con mensaje y total
 */
function formatCartForDisplay(carrito) {
  let total = 0;
  let mensaje = "🛒 *Tu carrito de compra:*\n\n";
  
  if (!carrito || !carrito.items || carrito.items.length === 0) {
    return {
      mensaje: "Tu carrito está vacío. ¿En qué puedo ayudarte hoy?",
      total: 0,
      isEmpty: true
    };
  }
  
  carrito.items.forEach((item, index) => {
    // Asegurarse de que precio y cantidad sean números
    const precio = parseFloat(item.precio) || 0;
    const cantidad = parseInt(item.cantidad) || 0;
    
    const subtotal = precio * cantidad;
    total += subtotal;
    
    mensaje += `${index + 1}. ${item.DescripcionArticulo} - ${cantidad} unidad(es) x ${precio.toFixed(2)}€ = ${subtotal.toFixed(2)}€\n`;
  });
  
  mensaje += `\n*Total: ${total.toFixed(2)}€*\n\n`;
  
  return {
    mensaje,
    total,
    isEmpty: false
  };
}

module.exports = {
  handleCartCommand,
  formatCartForDisplay
};