// Servicio para gestionar el inventario
const Articulo = require('../models/articulo');

/**
 * Verifica si hay suficiente stock para todos los artículos del carrito
 * @param {Array} items - Artículos del carrito
 * @returns {Promise<{success: boolean, insufficientItems: Array}>} - Resultado de la verificación
 */
async function verifyStock(items) {
  try {
    const insufficientItems = [];
    
    // Verificar cada artículo del carrito
    for (const item of items) {
      // Buscar el artículo en la BD para obtener el stock actual
      const articulo = await Articulo.findOne({ CodigoArticulo: item.CodigoArticulo });
      
      if (!articulo) {
        // Si el artículo ya no existe en la base de datos
        insufficientItems.push({
          codigo: item.CodigoArticulo,
          descripcion: item.DescripcionArticulo,
          cantidadSolicitada: item.cantidad,
          cantidadDisponible: 0,
          error: 'Producto no encontrado en el inventario'
        });
        continue;
      }
      
      // Verificar si hay suficiente stock
      if (articulo.unidades < item.cantidad) {
        insufficientItems.push({
          codigo: item.CodigoArticulo,
          descripcion: item.DescripcionArticulo, 
          cantidadSolicitada: item.cantidad,
          cantidadDisponible: articulo.unidades,
          error: 'Stock insuficiente'
        });
      }
    }
    
    return {
      success: insufficientItems.length === 0,
      insufficientItems
    };
  } catch (error) {
    console.error('Error al verificar stock:', error);
    throw error;
  }
}

/**
 * Actualiza el inventario descontando las unidades vendidas
 * @param {Array} items - Artículos vendidos
 * @returns {Promise<{success: boolean, updatedItems: number, errors: Array}>} - Resultado de la actualización
 */
async function updateInventory(items) {
  try {
    let updatedItems = 0;
    const errors = [];
    
    // Actualizar cada artículo
    for (const item of items) {
      try {
        // Buscar y actualizar el artículo en una sola operación
        const result = await Articulo.findOneAndUpdate(
          { 
            CodigoArticulo: item.CodigoArticulo,
            unidades: { $gte: item.cantidad } // Solo actualizar si hay suficiente stock
          },
          { 
            $inc: { unidades: -item.cantidad } // Decrementar el stock
          },
          { 
            new: true // Devolver el documento actualizado
          }
        );
        
        if (!result) {
          // Si no se pudo actualizar (probablemente por stock insuficiente)
          const currentItem = await Articulo.findOne({ CodigoArticulo: item.CodigoArticulo });
          
          errors.push({
            codigo: item.CodigoArticulo,
            descripcion: item.DescripcionArticulo,
            cantidadSolicitada: item.cantidad,
            cantidadDisponible: currentItem ? currentItem.unidades : 0,
            error: currentItem ? 'Stock insuficiente' : 'Producto no encontrado'
          });
        } else {
          updatedItems++;
        }
      } catch (itemError) {
        console.error(`Error al actualizar artículo ${item.CodigoArticulo}:`, itemError);
        errors.push({
          codigo: item.CodigoArticulo,
          descripcion: item.DescripcionArticulo,
          error: itemError.message
        });
      }
    }
    
    return {
      success: errors.length === 0,
      updatedItems,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    console.error('Error al actualizar inventario:', error);
    throw error;
  }
}

/**
 * Verifica stock y actualiza inventario en una sola operación
 * @param {Array} items - Artículos del carrito
 * @returns {Promise<{success: boolean, message: string, insufficientItems: Array}>} - Resultado de la operación
 */
async function processInventoryForOrder(items) {
  try {
    // Primero verificar si hay suficiente stock
    const stockVerification = await verifyStock(items);
    
    if (!stockVerification.success) {
      return {
        success: false,
        message: 'Stock insuficiente para algunos productos',
        insufficientItems: stockVerification.insufficientItems
      };
    }
    
    // Si hay suficiente stock, actualizar el inventario
    const inventoryUpdate = await updateInventory(items);
    
    if (!inventoryUpdate.success) {
      return {
        success: false,
        message: 'Error al actualizar el inventario',
        errors: inventoryUpdate.errors
      };
    }
    
    return {
      success: true,
      message: 'Inventario actualizado correctamente',
      updatedItems: inventoryUpdate.updatedItems
    };
  } catch (error) {
    console.error('Error al procesar inventario para pedido:', error);
    throw error;
  }
}

/**
 * Obtiene la disponibilidad de un producto específico
 * @param {string} codigoArticulo - Código del artículo
 * @returns {Promise<{available: boolean, stock: number}>} - Información de disponibilidad
 */
async function getProductAvailability(codigoArticulo) {
  try {
    const articulo = await Articulo.findOne({ CodigoArticulo: codigoArticulo });
    
    if (!articulo) {
      return {
        available: false,
        stock: 0,
        error: 'Producto no encontrado'
      };
    }
    
    return {
      available: articulo.unidades > 0,
      stock: articulo.unidades
    };
  } catch (error) {
    console.error(`Error al verificar disponibilidad del artículo ${codigoArticulo}:`, error);
    throw error;
  }
}

module.exports = {
  verifyStock,
  updateInventory,
  processInventoryForOrder,
  getProductAvailability
};