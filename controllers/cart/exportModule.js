// Maneja las funciones relacionadas con exportar el carrito

const fs = require('fs');
const path = require('path');
const carritoService = require('../../services/carritoService');
const logger = require('../../utils/logger');


/**
 * Maneja el comando para exportar el carrito
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @returns {Promise} - Promesa de la operación
 */
async function handleExportCartCommand(bot, chatId) {
  try {
    const jsonData = carritoService.exportCartToJSON(chatId.toString());
    const carrito = carritoService.getCart(chatId.toString());
    
    if (!carrito || carrito.items.length === 0) {
      logger.log(`Usuario ${chatId}: Intento de exportar carrito vacío`);
      return bot.sendMessage(chatId, "Tu carrito está vacío. No hay nada que exportar.");
    }
    
    // Enviar el JSON como un mensaje
    await bot.sendMessage(chatId, "Aquí está el JSON de tu carrito para el frontend:");
    
    // Crear un archivo temporal con el JSON
    const tempDir = path.join(__dirname, '../../temp');
    
    // Asegurarse de que el directorio existe
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFilePath = path.join(tempDir, `carrito_${chatId}_${Date.now()}.json`);
    
    fs.writeFileSync(tempFilePath, jsonData);
    logger.log(`Usuario ${chatId}: Archivo de carrito creado en ${tempFilePath}`);
    
    // Enviar el archivo
    await bot.sendDocument(chatId, tempFilePath, { 
      caption: "Datos del carrito en formato JSON (incluye información del usuario)"
    });
    
    // Eliminar el archivo temporal después de enviarlo
    setTimeout(() => {
      try {

        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
          logger.log(`Usuario ${chatId}: Archivo temporal de carrito eliminado`);
        }
      } catch (cleanupError) {
        logger.error(`Error al eliminar archivo temporal para usuario ${chatId}: ${cleanupError.message}`);
      }
    }, 5000); // Esperar 5 segundos para asegurarse de que el archivo se envió correctamente
    
    return true;
  } catch (error) {
    logger.error(`Error al exportar el carrito para usuario ${chatId}: ${error.message}`);
    bot.sendMessage(chatId, "Hubo un error al exportar tu carrito. Inténtalo de nuevo.");
    return false;
  }
  
}

/**
 * Exporta el carrito en formato CSV
 * @param {number} chatId - ID del chat
 * @returns {Promise<string>} - Ruta al archivo CSV generado
 */
async function exportCartToCSV(chatId) {
  try {
    const carrito = carritoService.getCart(chatId.toString());
    
    if (!carrito || carrito.items.length === 0) {
      throw new Error("Carrito vacío");
    }
    
    // Crear contenido CSV
    let csvContent = "CodigoArticulo,DescripcionArticulo,Precio,Cantidad,Subtotal\n";
    
    carrito.items.forEach(item => {
      const precio = parseFloat(item.precio) || 0;
      const cantidad = parseInt(item.cantidad) || 0;
      const subtotal = precio * cantidad;
      
      
      // Escapar comas en la descripción
      const descripcionEscapada = item.DescripcionArticulo.includes(',') 
        ? `"${item.DescripcionArticulo}"`
        : item.DescripcionArticulo;
      
      csvContent += `${item.CodigoArticulo},${descripcionEscapada},${precio.toFixed(2)},${cantidad},${subtotal.toFixed(2)}\n`;
    });
    
    // Añadir línea de total
    const total = carrito.items.reduce((sum, item) => {
      const precio = parseFloat(item.precio) || 0;
      const cantidad = parseInt(item.cantidad) || 0;
      return sum + (precio * cantidad);
    }, 0);
    
    csvContent += `\nTOTAL,,,,"${total.toFixed(2)}"`;
    
    // Crear archivo temporal con el CSV
    const tempDir = path.join(__dirname, '../../temp');
    
    // Asegurarse de que el directorio existe
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFilePath = path.join(tempDir, `carrito_${chatId}_${Date.now()}.csv`);
    
    fs.writeFileSync(tempFilePath, csvContent);
    logger.log(`Usuario ${chatId}: Archivo CSV de carrito creado en ${tempFilePath}`);
    
    return tempFilePath;
  } catch (error) {
    logger.error(`Error al exportar el carrito a CSV para usuario ${chatId}: ${error.message}`);
    throw error;
  }
}

/**
 * Genera un resumen en texto del carrito
 * @param {number} chatId - ID del chat
 * @returns {string} - Texto con el resumen del carrito
 */
function generateCartSummary(chatId) {
  try {
    const carrito = carritoService.getCart(chatId.toString());
    
    if (!carrito || carrito.items.length === 0) {
      return "El carrito está vacío.";
    }
    
    let total = 0;
    let resumen = "RESUMEN DEL CARRITO:\n\n";
    
    carrito.items.forEach((item, index) => {
      const precio = parseFloat(item.precio) || 0;
      const cantidad = parseInt(item.cantidad) || 0;
      const subtotal = precio * cantidad;
      
      total += subtotal;
      
      resumen += `${index + 1}. ${item.DescripcionArticulo}\n`;
      resumen += `   ${cantidad} x ${precio.toFixed(2)}€ = ${subtotal.toFixed(2)}€\n\n`;
    });
    
    resumen += `TOTAL: ${total.toFixed(2)}€\n`;
    resumen += `Fecha: ${new Date().toLocaleString()}\n`;
    
    return resumen;
  } catch (error) {
    logger.error(`Error al generar resumen del carrito para usuario ${chatId}: ${error.message}`);
    return "Error al generar resumen del carrito.";
  }
}

module.exports = {
  handleExportCartCommand,
  exportCartToCSV,
  generateCartSummary
};