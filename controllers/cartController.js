// Este módulo gestiona el carrito de compras en memoria para un bot de Telegram.
const fs = require('fs');
const carritoService = require('../services/carritoService');
const buttonService = require('../services/buttonGeneratorService');
const stateService = require('../services/botStateService');

/**
 * Maneja el comando /carrito
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
 */
async function handleCartCommand(bot, chatId) {
  try {
    const carrito = carritoService.getCart(chatId.toString());
    
    if (!carrito || carrito.items.length === 0) {
      return bot.sendMessage(chatId, "Tu carrito está vacío. ¿En qué puedo ayudarte hoy?");
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
    
    // Enviar mensaje con botones
    bot.sendMessage(chatId, mensaje, { 
      parse_mode: "Markdown",
      ...buttonService.generateCartButtons()
    });
  } catch (error) {
    console.error("Error al mostrar el carrito:", error);
    bot.sendMessage(chatId, "Hubo un error al mostrar tu carrito. Inténtalo de nuevo.");
  }
}

/**
 * Maneja el comando para exportar el carrito
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
 */
async function handleExportCartCommand(bot, chatId) {
  try {
    const jsonData = carritoService.exportCartToJSON(chatId.toString());
    const carrito = carritoService.getCart(chatId.toString());
    
    if (!carrito || carrito.items.length === 0) {
      return bot.sendMessage(chatId, "Tu carrito está vacío. No hay nada que exportar.");
    }
    
    // Enviar el JSON como un mensaje
    bot.sendMessage(chatId, "Aquí está el JSON de tu carrito para el frontend:");
    
    // Crear un archivo temporal con el JSON
    const tempFilePath = `./carrito_${chatId}.json`;
    
    fs.writeFileSync(tempFilePath, jsonData);
    
    // Enviar el archivo
    bot.sendDocument(chatId, tempFilePath, { 
      caption: "Datos del carrito en formato JSON (incluye información del usuario)"
    }).then(() => {
      // Eliminar el archivo temporal después de enviarlo
      fs.unlinkSync(tempFilePath);
    });
    
  } catch (error) {
    console.error("Error al exportar el carrito:", error);
    bot.sendMessage(chatId, "Hubo un error al exportar tu carrito. Inténtalo de nuevo.");
  }
}

/**
 * Maneja el comando para eliminar un artículo del carrito
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
 * @param {number} index - Índice del artículo a eliminar
 */
async function handleRemoveFromCartCommand(bot, chatId, index) {
  try {
    carritoService.removeFromCart(chatId.toString(), index);
    bot.sendMessage(chatId, "Artículo eliminado del carrito correctamente.");
    // Mostrar el carrito actualizado
    handleCartCommand(bot, chatId);
  } catch (error) {
    console.error("Error al eliminar del carrito:", error);
    bot.sendMessage(chatId, "Hubo un error al eliminar el artículo. Inténtalo de nuevo.");
  }
}

/**
 * Maneja el comando para limpiar el carrito
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
 */
async function handleClearCartCommand(bot, chatId) {
  try {
    carritoService.clearCart(chatId.toString());
    bot.sendMessage(chatId, "Tu carrito ha sido vaciado correctamente.");
  } catch (error) {
    console.error("Error al vaciar el carrito:", error);
    bot.sendMessage(chatId, "Hubo un error al vaciar tu carrito. Inténtalo de nuevo.");
  }
}

/**
 * Añade un producto al carrito
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
 * @param {object} product - Producto a añadir
 * @param {number} quantity - Cantidad
 * @returns {boolean} - Indica si se añadió correctamente
 */
async function addToCart(bot, chatId, product, quantity) {
  try {
    // Añadir al carrito
    carritoService.addToCart(chatId.toString(), product, quantity);
    
    // Notificar al usuario
    bot.sendMessage(
      chatId,
      `✅ He añadido ${quantity} unidad(es) de "${product.DescripcionArticulo}" a tu carrito.\n\n¿Deseas algo más?`,
      buttonService.generatePostAddButtons()
    );
    
    return true;
  } catch (error) {
    console.error("Error al añadir al carrito:", error);
    bot.sendMessage(chatId, "Hubo un error al añadir el producto al carrito. Inténtalo de nuevo.");
    return false;
  }
}

module.exports = {
  handleCartCommand,
  handleExportCartCommand,
  handleRemoveFromCartCommand,
  handleClearCartCommand,
  addToCart
};