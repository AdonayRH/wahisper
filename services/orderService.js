// Servicio para gestión de pedidos
const Pedido = require('../models/pedido');
const inventoryService = require('./inventoryService');

/**
 * Crea un nuevo pedido en la base de datos
 * @param {string} telegramId - ID de Telegram del usuario
 * @param {Array} items - Artículos del carrito
 * @param {object} userData - Datos del usuario
 * @returns {Promise<object>} - Resultado de la creación del pedido
 */
async function createOrder(telegramId, items, userData) {
  try {
    // Generar número de pedido único
    const orderNumber = generateOrderNumber();
    
    // Calcular subtotales y total
    let total = 0;
    const orderItems = items.map(item => {
      const precio = parseFloat(item.precio) || 0;
      const cantidad = parseInt(item.cantidad) || 0;
      const subtotal = precio * cantidad;
      
      total += subtotal;
      
      return {
        codigoArticulo: item.CodigoArticulo,
        descripcion: item.DescripcionArticulo,
        precio: precio,
        cantidad: cantidad,
        subtotal: subtotal
      };
    });
    
    // Verificar y actualizar el inventario
    const inventoryResult = await inventoryService.processInventoryForOrder(items);
    
    if (!inventoryResult.success) {
      return {
        success: false,
        message: inventoryResult.message,
        insufficientItems: inventoryResult.insufficientItems || inventoryResult.errors
      };
    }
    
    // Crear el pedido en la base de datos
    const newOrder = new Pedido({
      orderNumber,
      telegramId,
      items: orderItems,
      total,
      userData: {
        telegramId: userData.id,
        first_name: userData.first_name,
        last_name: userData.last_name,
        username: userData.username
      }
    });
    
    await newOrder.save();
    
    return {
      success: true,
      orderNumber,
      total,
      message: 'Pedido creado correctamente'
    };
  } catch (error) {
    console.error('Error al crear pedido:', error);
    throw error;
  }
}

/**
 * Obtiene los pedidos de un usuario
 * @param {string} telegramId - ID de Telegram del usuario
 * @param {number} limit - Límite de resultados
 * @returns {Promise<Array>} - Lista de pedidos
 */
async function getUserOrders(telegramId, limit = 5) {
  try {
    const orders = await Pedido.find({ telegramId })
      .sort({ createdAt: -1 })
      .limit(limit);
    
    return orders;
  } catch (error) {
    console.error('Error al obtener pedidos del usuario:', error);
    throw error;
  }
}

/**
 * Obtiene un pedido por su número
 * @param {string} orderNumber - Número de pedido
 * @returns {Promise<object>} - Pedido encontrado
 */
async function getOrderByNumber(orderNumber) {
  try {
    const order = await Pedido.findOne({ orderNumber });
    return order;
  } catch (error) {
    console.error('Error al obtener pedido por número:', error);
    throw error;
  }
}

/**
 * Actualiza el estado de un pedido
 * @param {string} orderNumber - Número de pedido
 * @param {string} status - Nuevo estado
 * @returns {Promise<object>} - Resultado de la actualización
 */
async function updateOrderStatus(orderNumber, status) {
  try {
    const validStatus = ['PENDIENTE', 'PAGADO', 'ENVIADO', 'ENTREGADO', 'CANCELADO'];
    
    if (!validStatus.includes(status)) {
      return {
        success: false,
        message: 'Estado de pedido no válido'
      };
    }
    
    const order = await Pedido.findOneAndUpdate(
      { orderNumber },
      { status },
      { new: true }
    );
    
    if (!order) {
      return {
        success: false,
        message: 'Pedido no encontrado'
      };
    }
    
    return {
      success: true,
      order,
      message: 'Estado de pedido actualizado correctamente'
    };
  } catch (error) {
    console.error('Error al actualizar estado del pedido:', error);
    throw error;
  }
}

/**
 * Genera un número de pedido único
 * @returns {string} - Número de pedido
 */
function generateOrderNumber() {
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  return `${year}${month}${day}-${randomNum}`;
}

module.exports = {
  createOrder,
  getUserOrders,
  getOrderByNumber,
  updateOrderStatus
};