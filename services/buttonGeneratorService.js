// Servicio para generar botones de Telegram

/**
 * Genera botones para seleccionar productos
 * @param {Array} products - Lista de productos
 * @param {string} action - Prefijo para el callback_data
 * @returns {object} - Objeto con configuración de botones
*/
function generateProductButtons(products, action = 'select') {
  const rows = [];
  
  // Crear botones para cada producto (máximo 3 por fila)
  products.forEach((product, index) => {
    const button = {
      text: `${index + 1}. ${product.DescripcionArticulo.substring(0, 20)}...`,
      callback_data: `${action}_${index}`
    };
    
    if (index % 3 === 0) {
      rows.push([button]);
    } else {
      rows[Math.floor(index / 3)].push(button);
    }
  });
  
  // Añadir botón para rechazar productos
  rows.push([{ text: "❌ No me interesa ninguno", callback_data: "reject_products" }]);
  
  return {
    reply_markup: {
      inline_keyboard: rows
    }
  };
}

/**
 * Genera botones para seleccionar cantidad
 * @param {string|number} productIndex - Índice o identificador del producto
 * @returns {object} - Objeto con configuración de botones
*/
function generateQuantityButtons(productIndex) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "1", callback_data: `qty_${productIndex}_1` },
          { text: "2", callback_data: `qty_${productIndex}_2` },
          { text: "3", callback_data: `qty_${productIndex}_3` }
        ],
        [
          { text: "4", callback_data: `qty_${productIndex}_4` },
          { text: "5", callback_data: `qty_${productIndex}_5` },
          { text: "Otra cantidad", callback_data: `qty_custom_${productIndex}` }
        ]
      ]
    }
  };
}

/**
 * Genera botones de confirmación
 * @returns {object} - Objeto con configuración de botones
*/
function generateConfirmButtons() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Sí, añadir al carrito", callback_data: "confirm_add" },
          { text: "❌ No, cancelar", callback_data: "cancel_add" }
        ]
      ]
    }
  };
}

/**
 * Genera botones para después de añadir al carrito
 * @returns {object} - Objeto con configuración de botones
*/
function generatePostAddButtons() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Sí, seguir comprando", callback_data: "continue_shopping" },
          { text: "🛒 Ver mi carrito", callback_data: "view_cart" }
        ],
        [
          { text: "💰 Tramitar pedido", callback_data: "checkout" }
        ]
      ]
    }
  };
}

/**
 * Genera botones para el carrito
 * @returns {object} - Objeto con configuración de botones
 * @returns {object} - Objeto con configuración de botones
*/
function generateCartButtons(itemCount = 0) {
  const buttons = [
    [
      { text: "🛍️ Seguir comprando", callback_data: "continue_shopping" }
    ]
  ];
  
  if (itemCount > 0) {
    buttons.unshift([
      { text: "🗑️ Vaciar carrito", callback_data: "clear_cart" },
      { text: "📤 Exportar carrito", callback_data: "export_cart" }
    ]);
    
    buttons.unshift([
      { text: "➖ Eliminar producto", callback_data: "start_remove_item" }
    ]);
  }
  else if (data === 'start_remove_item') {
    // Iniciar proceso de eliminación
    bot.sendMessage(
      chatId,
      "¿Qué producto deseas eliminar? Indica su número o nombre."
    );
  }

  return {
    reply_markup: {
      inline_keyboard: buttons
    }
  };
}

/**
 * Genera botones para después de completar un pedido
 * @returns {object} - Objeto con configuración de botones
*/
function generatePostCheckoutButtons() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "📦 Ver mis pedidos", callback_data: "view_orders" },
          { text: "🛍️ Nueva compra", callback_data: "new_purchase" }
        ]
      ]
    }
  };
}

/**
 * Genera botones para confirmar pago
 * @returns {object} - Objeto con configuración de botones
*/
function generateCheckoutButtons() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Confirmar pedido", callback_data: "confirm_checkout" },
          { text: "❌ Cancelar", callback_data: "cancel_checkout" }
        ]
      ]
    }
  };
}

/**
 * Genera botones para carrito vacío
 * @returns {object} - Objeto con configuración de botones
*/
function generateEmptyCartButtons() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔍 Buscar productos", callback_data: "search_products" }],
        [{ text: "🏠 Volver al inicio", callback_data: "go_home" }]
      ]
    }
  };
}

/**
 * Genera botones para el panel de administración
 * @returns {object} - Objeto con configuración de botones
*/
function generateAdminButtons() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📊 Gestión de Inventario", callback_data: "admin_inventory" }],
        [{ text: "👥 Gestión de Usuarios", callback_data: "admin_user_management" }],
        [{ text: "📈 Estadísticas", callback_data: "admin_stats" }],
      ]
    }
  };
}

/**
 * Genera botones para gestión de administradores
 * @returns {object} - Objeto con configuración de botones
*/
function generateAdminManagementButtons() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📋 Ver solicitudes pendientes", callback_data: "admin_pending_requests" }],
        [{ text: "👥 Ver administradores", callback_data: "admin_list" }],
        [{ text: "⬅️ Volver al panel principal", callback_data: "admin_back" }]
      ]
    }
  };
}

/**
 * Genera botones para gestión de inventario
 * @returns {object} - Objeto con configuración de botones
*/
function generateInventoryButtons() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📥 Subir Inventario (CSV/Excel)", callback_data: "admin_upload_inventory" }],
        [{ text: "🔍 Buscar Producto", callback_data: "admin_search_product" }],
        [{ text: "⬅️ Volver", callback_data: "admin_back" }]
      ]
    }
  };
}

/**
 * Genera botones para confirmar subida de inventario
 * @param {string} fileName - Nombre del archivo
 * @returns {object} - Objeto con configuración de botones
*/
function generateInventoryConfirmButtons(fileName) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Guardar en BD", callback_data: `save_inventory_${fileName}` },
          { text: "❌ Cancelar", callback_data: "cancel_inventory" }
        ]
      ]
    }
  };
}

/**
 * Genera botones para el panel de estadísticas
 * @returns {object} - Objeto con configuración de botones
*/
function generateStatsButtons() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📋 Resumen General", callback_data: "admin_stats_summary" }],
        [{ text: "🛒 Pedidos Pendientes", callback_data: "admin_stats_pending" }],
        [{ text: "✅ Pedidos Completados", callback_data: "admin_stats_completed" }],
        [{ text: "❌ Pedidos Cancelados", callback_data: "admin_stats_canceled" }],
        [{ text: "📦 Inventario", callback_data: "admin_stats_inventory" }],
        [{ text: "👥 Usuarios", callback_data: "admin_stats_users" }],
        [{ text: "📊 Exportar Datos", callback_data: "admin_stats_export" }],
        [{ text: "⬅️ Volver", callback_data: "admin_back" }]
      ]
    }
  };
}

/**
 * Genera botones para navegar entre vistas de estadísticas
 * @param {string} category - Categoría de estadísticas (summary, pending, etc.)
 * @returns {object} - Objeto con configuración de botones
*/
function generateStatsNavigationButtons(category) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔄 Actualizar", callback_data: `admin_stats_${category}` }],
        [{ text: "⬅️ Volver a Estadísticas", callback_data: "admin_stats" }]
      ]
    }
  };
}

module.exports = {
  generateProductButtons,
  generateQuantityButtons,
  generateConfirmButtons,
  generatePostAddButtons,
  generateCartButtons,
  generateEmptyCartButtons,
  generateCheckoutButtons,
  generatePostCheckoutButtons,

  // Funciones para administradores
  generateAdminButtons,
  generateAdminManagementButtons,
  generateInventoryButtons,
  generateInventoryConfirmButtons,
  
  // Nuevas funciones para estadísticas
  generateStatsButtons,
  generateStatsNavigationButtons
};