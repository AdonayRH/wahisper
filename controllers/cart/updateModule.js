// Maneja las funciones relacionadas con actualizar el carrito
const carritoService = require('../../services/carritoService');
const logger = require('../../utils/logger');

/**
 * Actualiza la cantidad de un elemento en el carrito
 * @param {string} telegramId - ID de Telegram del usuario
 * @param {number} itemIndex - Índice del ítem
 * @param {number} newQuantity - Nueva cantidad
 * @returns {object} - Carrito actualizado
 */
function updateItemQuantity(telegramId, itemIndex, newQuantity) {
  try {
    const carrito = carritoService.getCart(telegramId);
    if (!carrito || !carrito.items[itemIndex]) {
      logger.error(`Error: Ítem no encontrado al actualizar cantidad para usuario ${telegramId}`);
      throw new Error("Ítem no encontrado");
    }
    
    const productName = carrito.items[itemIndex].DescripcionArticulo;
    
    // Actualizar la cantidad
    if (newQuantity <= 0) {
      // Si es 0 o menos, eliminar el ítem
      logger.log(`Usuario ${telegramId}: Eliminando producto ${productName} por cantidad 0`);
      carritoService.removeFromCart(telegramId, itemIndex);
    } else {
      // Si es mayor a 0, actualizar cantidad
      logger.log(`Usuario ${telegramId}: Actualizando cantidad de ${productName} a ${newQuantity}`);
      carrito.items[itemIndex].cantidad = newQuantity;
      carrito.updatedAt = new Date().toISOString();
    }
    
    return carrito;
  } catch (error) {
    logger.error(`Error al actualizar cantidad para usuario ${telegramId}: ${error.message}`);
    throw error;
  }
}

/**
 * Valida que la cantidad de un producto no exceda el stock disponible
 * @param {string} telegramId - ID de Telegram del usuario
 * @param {number} itemIndex - Índice del ítem
 * @param {number} requestedQuantity - Cantidad solicitada
 * @returns {Promise<object>} - Resultado de la validación
 */
async function validateQuantityAgainstStock(telegramId, itemIndex, requestedQuantity) {
  try {
    const carrito = carritoService.getCart(telegramId);
    if (!carrito || !carrito.items[itemIndex]) {
      return {
        valid: false,
        message: "Producto no encontrado en el carrito"
      };
    }
    
    const producto = carrito.items[itemIndex];
    
    // Verificar stock en la base de datos
    const Articulo = require('../../models/articulo');
    const articuloEnBD = await Articulo.findOne({ CodigoArticulo: producto.CodigoArticulo });
    
    if (!articuloEnBD) {
      return {
        valid: false,
        message: `El producto "${producto.DescripcionArticulo}" ya no está disponible en el inventario.`
      };
    }
    
    const stockDisponible = articuloEnBD.unidades || 0;
    
    if (requestedQuantity > stockDisponible) {
      return {
        valid: false,
        message: `Solo hay ${stockDisponible} unidades disponibles de "${producto.DescripcionArticulo}".`,
        availableStock: stockDisponible
      };
    }
    
    return {
      valid: true,
      availableStock: stockDisponible
    };
  } catch (error) {
    logger.error(`Error al validar cantidad contra stock para usuario ${telegramId}: ${error.message}`);
    return {
      valid: false,
      message: "Error al verificar disponibilidad",
      error: error.message
    };
  }
}

/**
 * Actualiza varios ítems en el carrito a la vez
 * @param {string} telegramId - ID de Telegram del usuario
 * @param {Array} updates - Array de actualizaciones {index, quantity}
 * @returns {Promise<object>} - Resultado de la actualización
 */
async function batchUpdateItems(telegramId, updates) {
  try {
    const results = {
      success: true,
      updated: [],
      errors: []
    };
    
    for (const update of updates) {
      try {
        // Validar disponibilidad
        const validation = await validateQuantityAgainstStock(telegramId, update.index, update.quantity);
        
        if (!validation.valid) {
          results.errors.push({
            index: update.index,
            message: validation.message
          });
          continue;
        }
        
        // Actualizar cantidad
        const carrito = carritoService.getCart(telegramId);
        if (!carrito || !carrito.items[update.index]) {
          results.errors.push({
            index: update.index,
            message: "Producto no encontrado"
          });
          continue;
        }
        
        const producto = carrito.items[update.index];
        const productoAntes = { ...producto };
        
        if (update.quantity <= 0) {
          // Eliminar producto
          carritoService.removeFromCart(telegramId, update.index);
          results.updated.push({
            index: update.index,
            description: producto.DescripcionArticulo,
            before: productoAntes.cantidad,
            after: 0,
            removed: true
          });
        } else {
          // Actualizar cantidad
          producto.cantidad = update.quantity;
          carritoService.updateCartItem(telegramId, update.index, producto);
          results.updated.push({
            index: update.index,
            description: producto.DescripcionArticulo,
            before: productoAntes.cantidad,
            after: producto.cantidad
          });
        }
      } catch (itemError) {
        results.errors.push({
          index: update.index,
          message: itemError.message
        });
      }
    }
    
    results.success = results.errors.length === 0;
    return results;
  } catch (error) {
    logger.error(`Error en actualización por lotes para usuario ${telegramId}: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  updateItemQuantity,
  validateQuantityAgainstStock,
  batchUpdateItems
};