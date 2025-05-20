const adminController = require('../controllers/adminController');
const cartController = require('../controllers/cartController');
const productController = require('../controllers/productController');
const conversationController = require('../controllers/conversationController');
const checkoutController = require('../controllers/checkoutController');
const stateService = require('../services/botStateService');
const adminService = require('../services/adminService');
const errorHandlers = require('./errorHandlers');
const logger = require('../utils/logger');

const STATES = stateService.STATES;

/**
 * Procesa los callbacks de los botones que presiona el usuario
 * @param {object} bot - Instancia del bot de Telegram
 * @param {object} callbackQuery - Información del callback de Telegram
 */
async function processCallbackQuery(bot, callbackQuery) {
  try {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;
    
    // Inicializar contexto si no existe
    stateService.initContext(chatId);
    
    // Actualizar actividad
    stateService.updateActivity(chatId);
    
    // Responder al callback para quitar el "reloj" del botón
    await bot.answerCallbackQuery(callbackQuery.id);
    
    logger.log(`Callback recibido: ${data} de usuario ${chatId}`);

    // ===================================================
    // PUNTO CRÍTICO: VERIFICACIÓN Y MANEJO DE ADMIN
    // ===================================================
    
    // 1. PRIMERO verificamos si es un callback relacionado con administración
    if (data.startsWith('admin_')) {
      // 2. VERIFICAR si el usuario es administrador
      const isUserAdmin = await adminService.isAdmin(chatId.toString());
      
      // 3a. Si NO es admin y está intentando usar funciones de admin, bloqueamos
      if (!isUserAdmin) {
        await bot.sendMessage(
          chatId,
          "⛔ No tienes permisos para acceder a las funciones de administrador."
        );
        return; // Terminamos el procesamiento aquí
      }
      
      // 3b. Si ES admin, procesamos el callback de administración
      const wasProcessed = await adminController.processAdminCallbacks(bot, callbackQuery);
      
      // Si el callback ya fue procesado por el controlador de admin, terminamos
      if (wasProcessed) {
        return;
      }
    }
    
    // ===================================================
    // PROCESAMIENTO NORMAL PARA TODOS LOS USUARIOS
    // ===================================================
    
    // A partir de aquí, procesamos callbacks disponibles para todos los usuarios
    // Agrupar callbacks por categorías para mejor manejo
    if (data.startsWith('remove_qty_') || data === 'confirm_remove' || data === 'cancel_remove') {
      await handleRemoveCallbacks(bot, chatId, data);
    }
    else if (data === 'confirm_clear_cart' || data === 'cancel_clear_cart') {
      await handleClearCartCallbacks(bot, chatId, data);
    }
    else if (data === 'checkout' || data === 'confirm_checkout' || data === 'cancel_checkout' || 
             data === 'new_purchase' || data === 'view_orders') {
      await handleCheckoutCallbacks(bot, chatId, data);
    }
    else if (data === 'start_remove_item' || data === 'search_products' || data === 'go_home') {
      await handleNavigationCallbacks(bot, chatId, data);
    }
    else if (data.startsWith('select_')) {
      await handleSelectCallbacks(bot, chatId, data);
    }
    else if (data.startsWith('qty_')) {
      await handleQuantityCallbacks(bot, chatId, data);
    }
    else if (data === 'confirm_add' || data === 'cancel_add') {
      await handleConfirmAddCallbacks(bot, chatId, data);
    }
    else if (data === 'continue_shopping' || data === 'view_cart' || data === 'end_shopping' || 
             data === 'clear_cart' || data === 'export_cart' || data === 'reject_products') {
      await handleCartActionCallbacks(bot, chatId, data);
    }
    else {
      logger.log(`Callback no manejado: ${data}`);
      bot.sendMessage(chatId, "Lo siento, no pude procesar esa acción. Por favor, intenta nuevamente.");
    }
  } catch (error) {
    errorHandlers.handleCallbackError(bot, callbackQuery, error);
  }
}

/**
 * Maneja callbacks relacionados con la administración
 * Este método solo debe llamarse después de verificar que el usuario es admin
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {string} data - Datos del callback
 */
async function handleAdminCallbacks(bot, chatId, data) {
  // Como ya verificamos los permisos en processCallbackQuery, podemos proceder
  if (data === 'admin_inventory') {
    adminController.handleInventoryManagement(bot, chatId);
  }
  else if (data === 'admin_upload_inventory') {
    adminController.handleUploadInventory(bot, chatId);
  }
  else if (data === 'admin_user_management') {
    adminController.handleUserManagement(bot, chatId);
  }
  // Otros callbacks específicos de admin...
}

/**
 * Maneja callbacks relacionados con el inventario
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {number} messageId - ID del mensaje
 * @param {string} data - Datos del callback
 */
async function handleInventoryCallbacks(bot, chatId, messageId, data) {
  // Verificar nuevamente si es administrador por seguridad
  if (!await adminService.isAdmin(chatId.toString())) {
    return bot.sendMessage(chatId, "No tienes permisos para acceder a esta función.");
  }
  
  if (data.startsWith('save_inventory_')) {
    const fileName = data.replace('save_inventory_', '');
    const fileProcessingService = require('../services/fileProcessingService');
    
    adminController.handleSaveInventory(bot, chatId, messageId, fileName, fileProcessingService);
  }
  else if (data === 'cancel_inventory') {
    adminController.handleCancelInventory(bot, chatId, messageId);
  }
}

/**
 * Maneja callbacks relacionados con la eliminación de productos
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {string} data - Datos del callback
 */
async function handleRemoveCallbacks(bot, chatId, data) {
  if (data.startsWith('remove_qty_')) {
    // Procesar cantidad a eliminar desde botón
    const quantity = data.replace('remove_qty_', '');
    cartController.handleRemoveQuantity(bot, chatId, quantity);
  }
  else if (data === 'confirm_remove') {
    // Confirmar eliminación de producto
    await cartController.handleConfirmRemove(bot, chatId);
  }
  else if (data === 'cancel_remove') {
    // Cancelar eliminación
    stateService.setState(chatId, STATES.INITIAL);
    bot.sendMessage(chatId, "Operación cancelada. No se ha eliminado nada de tu carrito.");
  }
}

/**
 * Maneja callbacks relacionados con el vaciado del carrito
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {string} data - Datos del callback
 */
async function handleClearCartCallbacks(bot, chatId, data) {
  if (data === 'confirm_clear_cart') {
    // Confirmar vaciado del carrito
    await cartController.handleClearCartCommand(bot, chatId);
    stateService.setState(chatId, STATES.INITIAL);
    bot.sendMessage(chatId, "✅ Tu carrito ha sido vaciado completamente.");
  }
  else if (data === 'cancel_clear_cart') {
    // Cancelar vaciado del carrito
    stateService.setState(chatId, STATES.INITIAL);
    bot.sendMessage(chatId, "Operación cancelada. Tu carrito no ha sido modificado.");
  }
}

/**
 * Maneja callbacks relacionados con el proceso de checkout
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {string} data - Datos del callback
 */
async function handleCheckoutCallbacks(bot, chatId, data) {
  if (data === 'checkout') {
    // Iniciar proceso de tramitación de pedido
    checkoutController.handleCheckout(bot, chatId);
  }
  else if (data === 'confirm_checkout') {
    // Confirmar pedido
    checkoutController.handleConfirmCheckout(bot, chatId);
  }
  else if (data === 'cancel_checkout') {
    // Cancelar tramitación
    checkoutController.handleCancelCheckout(bot, chatId);
  }
  else if (data === 'new_purchase') {
    // Iniciar nueva compra
    checkoutController.handleNewPurchase(bot, chatId);
  }
  else if (data === 'view_orders') {
    // Ver pedidos
    checkoutController.handleViewOrders(bot, chatId);
  }
}

/**
 * Maneja callbacks relacionados con la navegación
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {string} data - Datos del callback
 */
async function handleNavigationCallbacks(bot, chatId, data) {
  if (data === 'start_remove_item') {
    // Iniciar proceso de eliminación de producto individual
    bot.sendMessage(
      chatId,
      "¿Qué producto deseas eliminar? Indica su número (1, 2, 3...) o escribe su nombre."
    );
    stateService.setState(chatId, STATES.REMOVING_ITEM);
  }
  else if (data === 'search_products') {
    // Iniciar búsqueda de productos
    bot.sendMessage(
      chatId,
      "¿Qué tipo de producto estás buscando? Descríbelo y te mostraré las opciones disponibles."
    );
    stateService.setState(chatId, STATES.INITIAL);
  }
  else if (data === 'go_home') {
    // Volver al inicio
    bot.sendMessage(
      chatId,
      "¡Bienvenido nuevamente! ¿En qué puedo ayudarte hoy? Puedo mostrarte nuestros productos o responder a tus consultas."
    );
    stateService.setState(chatId, STATES.INITIAL);
  }
}

/**
 * Maneja callbacks relacionados con la selección de productos
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {string} data - Datos del callback
 */
async function handleSelectCallbacks(bot, chatId, data) {
  // Selección de producto
  const productIndex = parseInt(data.split('_')[1]);
  productController.handleProductSelection(bot, chatId, productIndex);
}

/**
 * Maneja callbacks relacionados con la cantidad
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {string} data - Datos del callback
 */
async function handleQuantityCallbacks(bot, chatId, data) {
  // Selección de cantidad
  if (data.startsWith('qty_custom_')) {
    // Cantidad personalizada
    const productIndex = parseInt(data.split('_')[2]);
    
    // Actualizar estado
    stateService.setState(chatId, STATES.ASKING_QUANTITY);
    stateService.setContextValue(chatId, 'selectedArticleIndex', productIndex);
    
    // Solicitar cantidad
    bot.sendMessage(
      chatId,
      "Por favor, introduce la cantidad deseada (solo el número):"
    );
  } else {
    // Cantidad específica
    const parts = data.split('_');
    const productIndex = parseInt(parts[1]);
    const quantity = parseInt(parts[2]);
    
    productController.handleQuantitySelection(bot, chatId, productIndex, quantity);
  }
}

/**
 * Maneja callbacks relacionados con la confirmación de añadir al carrito
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {string} data - Datos del callback
 */
async function handleConfirmAddCallbacks(bot, chatId, data) {
  if (data === 'confirm_add') {
    // Confirmar añadir al carrito
    conversationController.handleFinalConfirmation(bot, chatId, true);
  }
  else if (data === 'cancel_add') {
    // Cancelar añadir al carrito
    conversationController.handleFinalConfirmation(bot, chatId, false);
  }
}

/**
 * Maneja callbacks relacionados con acciones del carrito
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {string} data - Datos del callback
 */
async function handleCartActionCallbacks(bot, chatId, data) {
  if (data === 'continue_shopping') {
    // Continuar comprando
    stateService.setState(chatId, STATES.INITIAL);
    bot.sendMessage(
      chatId,
      "¡Perfecto! ¿Qué más estás buscando?"
    );
  }
  else if (data === 'view_cart') {
    // Ver carrito
    cartController.handleCartCommand(bot, chatId);
  }
  else if (data === 'end_shopping') {
    // Finalizar compra
    conversationController.handleEndConversation(bot, chatId);
  }
  else if (data === 'clear_cart') {
    // Vaciar carrito
    cartController.handleClearCartCommand(bot, chatId);
  }
  else if (data === 'export_cart') {
    // Exportar carrito
    cartController.handleExportCartCommand(bot, chatId);
  }
  else if (data === 'reject_products') {
    // Rechazar productos mostrados
    bot.sendMessage(
      chatId,
      "Entendido. ¿Qué tipo de producto estás buscando? Puedo ayudarte a encontrar algo más adecuado."
    );
    stateService.setState(chatId, STATES.INITIAL);
  }
}

module.exports = {
  processCallbackQuery,
  handleAdminCallbacks,
  handleInventoryCallbacks,
  handleRemoveCallbacks,
  handleClearCartCallbacks,
  handleCheckoutCallbacks,
  handleNavigationCallbacks,
  handleSelectCallbacks,
  handleQuantityCallbacks,
  handleConfirmAddCallbacks,
  handleCartActionCallbacks
};