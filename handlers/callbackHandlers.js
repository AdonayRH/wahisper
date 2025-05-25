const adminController = require('../controllers/adminController');
const cartController = require('../controllers/cartController');
const productController = require('../controllers/productController');
const conversationController = require('../controllers/conversationController');
const checkoutController = require('../controllers/checkoutController');
const stateService = require('../services/botStateService');
const adminService = require('../services/adminService');
const buttonService = require('../services/buttonGeneratorService');
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
    // MANEJO DIRECTO DE CALLBACKS DE INVENTARIO
    // ===================================================
    
    // PRIORIDAD MÁXIMA: Manejar callbacks de inventario PRIMERO
    if (data.startsWith('save_inventory_') || data === 'cancel_inventory') {
      logger.log(`🔧 PROCESANDO CALLBACK DE INVENTARIO: ${data}`);
      
      // Verificar si es administrador
      const isUserAdmin = await adminService.isAdmin(chatId.toString());
      if (!isUserAdmin) {
        await bot.sendMessage(chatId, "⛔ No tienes permisos para esta operación.");
        return;
      }
      
      // Procesar callback de inventario
      try {
        if (data.startsWith('save_inventory_')) {
          const fileName = data.replace('save_inventory_', '');
          logger.log(`💾 Guardando inventario del archivo: ${fileName}`);
          
          const fileProcessingService = require('../services/fileProcessingService');
          await adminController.handleSaveInventory(bot, chatId, messageId, fileName, fileProcessingService);
        }
        else if (data === 'cancel_inventory') {
          logger.log(`❌ Cancelando subida de inventario`);
          await adminController.handleCancelInventory(bot, chatId, messageId);
        }
        
        logger.log(`✅ Callback de inventario procesado exitosamente`);
        return;
      } catch (inventoryError) {
        logger.error(`💥 Error procesando callback de inventario: ${inventoryError.message}`);
        await bot.sendMessage(chatId, `❌ Error al procesar inventario: ${inventoryError.message}`);
        return;
      }
    }

    // ===================================================
    // MANEJO DE OTROS CALLBACKS DE ADMIN
    // ===================================================
    
    if (data.startsWith('admin_')) {
      const isUserAdmin = await adminService.isAdmin(chatId.toString());
      
      if (!isUserAdmin) {
        await bot.sendMessage(chatId, "⛔ No tienes permisos para acceder a las funciones de administrador.");
        return;
      }
      
      // Intentar procesar con el controlador de admin
      const wasProcessed = await adminController.processAdminCallbacks(bot, callbackQuery);
      if (wasProcessed) {
        return;
      }
      
      // Si no se procesó, manejar casos específicos
      switch (data) {
        case 'admin_inventory':
          await adminController.handleInventoryManagement(bot, chatId);
          return;
        case 'admin_upload_inventory':
          await adminController.handleUploadInventory(bot, chatId);
          return;
        case 'admin_user_management':
          await adminController.handleUserManagement(bot, chatId);
          return;
        case 'admin_stats':
          await adminController.handleStats(bot, chatId);
          return;
        case 'admin_back':
          await bot.sendMessage(chatId, "Panel de Administración", buttonService.generateAdminButtons());
          return;
        default:
          logger.log(`Callback admin no manejado: ${data}`);
          await bot.sendMessage(chatId, "Función de administración no disponible.");
          return;
      }
    }
    
    // ===================================================
    // CALLBACKS DE USUARIOS NORMALES
    // ===================================================
    
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
    else if (data.startsWith('add_qty_')) {
      await handleAddQuantityCallbacks(bot, chatId, data);
    }
    else {
      logger.log(`❌ Callback NO MANEJADO: ${data}`);
      bot.sendMessage(chatId, "Lo siento, no pude procesar esa acción. Por favor, intenta nuevamente.");
    }
    
  } catch (error) {
    logger.error(`💥 Error crítico en processCallbackQuery: ${error.message}`);
    errorHandlers.handleCallbackError(bot, callbackQuery, error);
  }
}

/**
 * Maneja callbacks relacionados con añadir cantidad
*/
async function handleAddQuantityCallbacks(bot, chatId, data) {
  try {
    if (data === 'add_qty_custom') {
      stateService.setState(chatId, STATES.ASKING_ADD_QUANTITY);
      await bot.sendMessage(chatId, "Por favor, indica cuántas unidades adicionales quieres añadir:");
    } else {
      const quantity = data.replace('add_qty_', '');
      await cartController.handleAddQuantity(bot, chatId, parseInt(quantity));
    }
  } catch (error) {
    logger.error(`Error al manejar callback de añadir cantidad: ${error.message}`);
    await bot.sendMessage(chatId, "Error al procesar la cantidad. Por favor, intenta de nuevo.");
  }
}

/**
 * Maneja callbacks relacionados con la eliminación de productos
*/
async function handleRemoveCallbacks(bot, chatId, data) {
  if (data.startsWith('remove_qty_')) {
    const quantity = data.replace('remove_qty_', '');
    cartController.handleRemoveQuantity(bot, chatId, quantity);
  }
  else if (data === 'confirm_remove') {
    await cartController.handleConfirmRemove(bot, chatId);
  }
  else if (data === 'cancel_remove') {
    stateService.setState(chatId, STATES.INITIAL);
    bot.sendMessage(chatId, "Operación cancelada. No se ha eliminado nada de tu carrito.");
  }
}

/**
 * Maneja callbacks relacionados con el vaciado del carrito
*/
async function handleClearCartCallbacks(bot, chatId, data) {
  if (data === 'confirm_clear_cart') {
    await cartController.handleClearCartCommand(bot, chatId);
    stateService.setState(chatId, STATES.INITIAL);
    bot.sendMessage(chatId, "✅ Tu carrito ha sido vaciado completamente.");
  }
  else if (data === 'cancel_clear_cart') {
    stateService.setState(chatId, STATES.INITIAL);
    bot.sendMessage(chatId, "Operación cancelada. Tu carrito no ha sido modificado.");
  }
}

/**
 * Maneja callbacks relacionados con el proceso de checkout
*/
async function handleCheckoutCallbacks(bot, chatId, data) {
  if (data === 'checkout') {
    checkoutController.handleCheckout(bot, chatId);
  }
  else if (data === 'confirm_checkout') {
    checkoutController.handleConfirmCheckout(bot, chatId);
  }
  else if (data === 'cancel_checkout') {
    checkoutController.handleCancelCheckout(bot, chatId);
  }
  else if (data === 'new_purchase') {
    checkoutController.handleNewPurchase(bot, chatId);
  }
  else if (data === 'view_orders') {
    checkoutController.handleViewOrders(bot, chatId);
  }
}

/**
 * Maneja callbacks relacionados con la navegación
*/
async function handleNavigationCallbacks(bot, chatId, data) {
  if (data === 'start_remove_item') {
    bot.sendMessage(chatId, "¿Qué producto deseas eliminar? Indica su número (1, 2, 3...) o escribe su nombre.");
    stateService.setState(chatId, STATES.REMOVING_ITEM);
  }
  else if (data === 'search_products') {
    bot.sendMessage(chatId, "¿Qué tipo de producto estás buscando? Descríbelo y te mostraré las opciones disponibles.");
    stateService.setState(chatId, STATES.INITIAL);
  }
  else if (data === 'go_home') {
    bot.sendMessage(chatId, "¡Bienvenido nuevamente! ¿En qué puedo ayudarte hoy?");
    stateService.setState(chatId, STATES.INITIAL);
  }
}

/**
 * Maneja callbacks relacionados con la selección de productos
*/
async function handleSelectCallbacks(bot, chatId, data) {
  const productIndex = parseInt(data.split('_')[1]);
  productController.handleProductSelection(bot, chatId, productIndex);
}

/**
 * Maneja callbacks relacionados con la cantidad
*/
async function handleQuantityCallbacks(bot, chatId, data) {
  if (data.startsWith('qty_custom_')) {
    const productIndex = parseInt(data.split('_')[2]);
    stateService.setState(chatId, STATES.ASKING_QUANTITY);
    stateService.setContextValue(chatId, 'selectedArticleIndex', productIndex);
    bot.sendMessage(chatId, "Por favor, introduce la cantidad deseada (solo el número):");
  } else {
    const parts = data.split('_');
    const productIndex = parseInt(parts[1]);
    const quantity = parseInt(parts[2]);
    productController.handleQuantitySelection(bot, chatId, productIndex, quantity);
  }
}

/**
 * Maneja callbacks relacionados con la confirmación de añadir al carrito
*/
async function handleConfirmAddCallbacks(bot, chatId, data) {
  if (data === 'confirm_add') {
    conversationController.handleFinalConfirmation(bot, chatId, true);
  }
  else if (data === 'cancel_add') {
    conversationController.handleFinalConfirmation(bot, chatId, false);
  }
}

/**
 * Maneja callbacks relacionados con acciones del carrito
*/
async function handleCartActionCallbacks(bot, chatId, data) {
  if (data === 'continue_shopping') {
    stateService.setState(chatId, STATES.INITIAL);
    bot.sendMessage(chatId, "¡Perfecto! ¿Qué más estás buscando?");
  }
  else if (data === 'view_cart') {
    cartController.handleCartCommand(bot, chatId);
  }
  else if (data === 'end_shopping') {
    conversationController.handleEndConversation(bot, chatId);
  }
  else if (data === 'clear_cart') {
    cartController.handleStartClearCart(bot, chatId);
  }
  else if (data === 'export_cart') {
    cartController.handleExportCartCommand(bot, chatId);
  }
  else if (data === 'reject_products') {
    bot.sendMessage(chatId, "Entendido. ¿Qué tipo de producto estás buscando?");
    stateService.setState(chatId, STATES.INITIAL);
  }
}

module.exports = {
  processCallbackQuery,
  handleAddQuantityCallbacks,
  handleRemoveCallbacks,
  handleClearCartCallbacks,
  handleCheckoutCallbacks,
  handleNavigationCallbacks,
  handleSelectCallbacks,
  handleQuantityCallbacks,
  handleConfirmAddCallbacks,
  handleCartActionCallbacks
};