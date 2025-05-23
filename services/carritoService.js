// Objeto para almacenar los carritos en memoria
const carritos = {};

/**
 * Añade un artículo al carrito
 * @param {string} telegramId - ID del usuario en Telegram
 * @param {object} articulo - Objeto con los datos del artículo
 * @param {number} cantidad - Cantidad del artículo a añadir
 * @returns {object} - El carrito actualizado
 */
function addToCart(telegramId, articulo, cantidad = 1) {
  try {
    // Inicializar carrito si no existe
    if (!carritos[telegramId]) {
      carritos[telegramId] = {
        telegramId,
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userData: null // Campo para almacenar datos del usuario
      };
    }

     // Procesar el precio para asegurar que sea un número
    let precio = 0;
    if (articulo.PVP) {
      // Si el precio tiene el símbolo de euro o comas, limpiarlo
      if (typeof articulo.PVP === 'string') {
        precio = parseFloat(articulo.PVP.replace(/[€,]/g, '.').replace(/[^\d.]/g, ''));
      } else {
        precio = parseFloat(articulo.PVP);
      }
    }

    // Asegurarse de que precio sea un número válido
    if (isNaN(precio)) {
      precio = 0;
      console.warn(`Precio inválido para artículo ${articulo.DescripcionArticulo}, establecido a 0`);
    }

    // Buscar si el artículo ya está en el carrito
    const carritoItems = carritos[telegramId].items;
    const existingItemIndex = carritoItems.findIndex(item => 
      item.CodigoArticulo === articulo.CodigoArticulo
    );

    if (existingItemIndex >= 0) {
      // Si el artículo ya existe, incrementar la cantidad
      carritoItems[existingItemIndex].cantidad += cantidad;
    } else {
      // Si no existe, añadir el nuevo artículo
      carritoItems.push({
        CodigoArticulo: articulo.CodigoArticulo || `CODE-${Date.now()}`,
        DescripcionArticulo: articulo.DescripcionArticulo,
        precio: precio, // Precio ya procesado
        cantidad
      });
    }

    // Actualizar timestamp
    carritos[telegramId].updatedAt = new Date().toISOString();
    
    return carritos[telegramId];
  } catch (error) {
    console.error("Error al añadir al carrito:", error);
    throw error;
  }
}

/**
 * Guarda los datos del usuario en el carrito
 * @param {string} telegramId - ID del usuario en Telegram
 * @param {object} userData - Datos del usuario
 * @returns {object} - El carrito actualizado
 */
function saveUserData(telegramId, userData) {
  try {
    // Inicializar carrito si no existe
    if (!carritos[telegramId]) {
      carritos[telegramId] = {
        telegramId,
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userData: null
      };
    }

    // Guardar datos del usuario
    carritos[telegramId].userData = userData;
    carritos[telegramId].updatedAt = new Date().toISOString();
    
    return carritos[telegramId];
  } catch (error) {
    console.error("Error al guardar datos del usuario:", error);
    throw error;
  }
}

/**
 * Obtiene el carrito completo de un usuario
 * @param {string} telegramId - ID del usuario en Telegram
 * @returns {object|null} - El carrito del usuario o null si no existe
 */
function getCart(telegramId) {
  return carritos[telegramId] || null;
}

/**
 * Elimina un artículo del carrito por su índice
 * @param {string} telegramId - ID del usuario en Telegram
 * @param {number} itemIndex - Índice del artículo a eliminar
 * @returns {object} - El carrito actualizado
 */
function removeFromCart(telegramId, itemIndex) {
  try {
    const carrito = carritos[telegramId];
    if (!carrito || !carrito.items[itemIndex]) {
      throw new Error("Artículo no encontrado en el carrito");
    }

    // Eliminar el artículo
    carrito.items.splice(itemIndex, 1);
    carrito.updatedAt = new Date().toISOString();
    
    return carrito;
  } catch (error) {
    console.error("Error al eliminar del carrito:", error);
    throw error;
  }
}

/**
 * Vacía el carrito de un usuario
 * @param {string} telegramId - ID del usuario en Telegram
 * @returns {object} - Objeto con estado de éxito
 */
function clearCart(telegramId) {
  try {
    if (carritos[telegramId]) {
      carritos[telegramId].items = [];
      carritos[telegramId].updatedAt = new Date().toISOString();
    }
    return { success: true };
  } catch (error) {
    console.error("Error al vaciar el carrito:", error);
    throw error;
  }
}


/**
 * Actualiza un artículo en el carrito
 * @param {string} telegramId - ID del usuario en Telegram
 * @param {number} itemIndex - Índice del artículo a actualizar
 * @param {object} updatedItem - Objeto con los datos actualizados
 * @returns {object} - El carrito actualizado
 */
function updateCartItem(telegramId, itemIndex, updatedItem) {
  try {
    const carrito = carritos[telegramId];
    
    if (!carrito || !carrito.items || carrito.items.length <= itemIndex) {
      throw new Error("Artículo no encontrado en el carrito");
    }
    
    // Actualizar el artículo
    carrito.items[itemIndex] = updatedItem;
    carrito.updatedAt = new Date().toISOString();
    
    return carrito;
  } catch (error) {
    console.error("Error al actualizar artículo del carrito:", error);
    throw error;
  }
}

/**
 * Actualiza la cantidad de un artículo en el carrito
 * @param {string} telegramId - ID del usuario en Telegram
 * @param {number} itemIndex - Índice del artículo a actualizar
 * @param {number} newQuantity - Nueva cantidad
 * @returns {object} - El carrito actualizado
 */
function updateItemQuantity(telegramId, itemIndex, newQuantity) {
  try {
    const carrito = carritos[telegramId];
    if (!carrito || !carrito.items[itemIndex]) {
      throw new Error("Artículo no encontrado en el carrito");
    }

    // Si la cantidad es 0 o negativa, eliminar el item
    if (newQuantity <= 0) {
      return removeFromCart(telegramId, itemIndex);
    }

    // Actualizar la cantidad
    carrito.items[itemIndex].cantidad = newQuantity;
    carrito.updatedAt = new Date().toISOString();
    
    return carrito;
  } catch (error) {
    console.error("Error al actualizar cantidad:", error);
    throw error;
  }
}

/**
 * Exporta el carrito completo en formato JSON para enviar al frontend
 * @param {string} telegramId - ID del usuario en Telegram
 * @returns {string} - Cadena JSON con los datos del carrito
 */
function exportCartToJSON(telegramId) {
  const carrito = carritos[telegramId];
  if (!carrito) {
    return JSON.stringify({
      telegramId,
      items: [],
      total: 0,
      usuario: null,
      fecha: new Date().toISOString()
    }, null, 2);
  }

  // Calcular total asegurándose de que los valores sean numéricos
  const total = carrito.items.reduce((sum, item) => {
    const precio = parseFloat(item.precio) || 0;
    const cantidad = parseInt(item.cantidad) || 0;
    return sum + (precio * cantidad);
  }, 0);

  const exportData = {
    telegramId,
    items: carrito.items.map(item => ({
      ...item,
      precio: parseFloat(item.precio) || 0, // Asegurar que sea número
      cantidad: parseInt(item.cantidad) || 0 // Asegurar que sea número
    })),
    total,
    fecha: new Date().toISOString(),
    usuario: carrito.userData
  };

  return JSON.stringify(exportData, null, 2); // El último parámetro (2) da formato al JSON para mejor legibilidad
}

module.exports = {
  addToCart,
  getCart,
  removeFromCart,
  clearCart,
  exportCartToJSON,
  saveUserData,
  updateItemQuantity,
  updateCartItem
};