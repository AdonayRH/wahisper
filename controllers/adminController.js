const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const stateService = require('../services/botStateService');
const buttonService = require('../services/buttonGeneratorService');
const adminService = require('../services/adminService');
const requestsController = require('./admin/requestsController');
const managementController = require('./admin/managementController');
const logger = require('../utils/logger');

/**
 * Verifica si un usuario es administrador
 * @param {string} telegramId - ID de Telegram
 * @returns {Promise<boolean>} - Indica si es administrador
*/
async function isAdmin(telegramId) {
  return adminService.isAdmin(telegramId.toString());
}

/**
 * Maneja el comando de administrador
 * @param {object} bot - Instancia del bot
 * @param {object} msg - Mensaje de Telegram
*/
async function handleAdminCommand(bot, msg) {
  const chatId = msg.chat.id;
  
  // Verificar si es un administrador
  if (!await isAdmin(chatId.toString())) {
    return bot.sendMessage(chatId, "No tienes permisos para acceder a las funciones de administrador.");
  }
  
  // Mostrar menú de administrador
  bot.sendMessage(chatId, "Panel de Administración", buttonService.generateAdminButtons());
}

/**
 * Maneja la opción de gestión de inventario
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
*/
async function handleInventoryManagement(bot, chatId) {
  if (!await isAdmin(chatId.toString())) {
    return bot.sendMessage(chatId, "No tienes permisos para acceder a las funciones de administrador.");
  }
  
  bot.sendMessage(chatId, "Gestión de Inventario", buttonService.generateInventoryButtons());
}

/**
 * Maneja la opción de gestión de usuarios y administradores
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
*/
async function handleUserManagement(bot, chatId) {
  if (!await isAdmin(chatId.toString())) {
    return bot.sendMessage(chatId, "No tienes permisos para acceder a las funciones de administrador.");
  }
  
  managementController.showAdminManagementPanel(bot, chatId);
}

/**
 * Prepara para subir inventario
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
*/
async function handleUploadInventory(bot, chatId) {
  if (!await isAdmin(chatId.toString())) {
    return bot.sendMessage(chatId, "No tienes permisos para acceder a las funciones de administrador.");
  }
  
  // Guardar estado
  stateService.setState(chatId, 'waiting_for_file');
  
  bot.sendMessage(chatId, 
    "Por favor, sube un archivo CSV o Excel con el inventario.\n\n" +
    "El archivo debe contener las columnas: CodigoArticulo, DescripcionArticulo, PVP, y stock/unidades.\n\n" +
    "Para cancelar, escribe /cancel"
  );
}

/**
 * Procesa un documento subido por el administrador
 * @param {object} bot - Instancia del bot
 * @param {object} msg - Mensaje de Telegram
 * @param {object} fileProcessingService - Servicio de procesamiento de archivos
*/
async function processAdminDocument(bot, msg, fileProcessingService) {
  const chatId = msg.chat.id;
  const fileId = msg.document.file_id;
  const fileName = msg.document.file_name;
  
  // Verificar si estamos esperando un archivo y si es admin
  if (!await isAdmin(chatId.toString()) || 
      stateService.getContext(chatId).state !== 'waiting_for_file') {
    return;
  }

  // Verificar tipo de archivo
  const validExtensions = ['.csv', '.xlsx', '.xls'];
  const fileExt = path.extname(fileName).toLowerCase();
  
  if (!validExtensions.includes(fileExt)) {
    return bot.sendMessage(chatId, 
      "Formato de archivo no soportado. Por favor, sube un archivo CSV o Excel."
    );
  }
  
  // Informar que se está procesando
  const processingMsg = await bot.sendMessage(chatId, "⏳ Descargando archivo...");
  
  try {
    // Obtener url del archivo
    const fileInfo = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${fileInfo.file_path}`;
    
    // Crear directorio de uploads si no existe
    const uploadDir = path.join(__dirname, '../uploads');
    await fs.ensureDir(uploadDir);
    
    // Generar nombre único
    const uniqueFileName = `${Date.now()}-${fileName}`;
    const filePath = path.join(uploadDir, uniqueFileName);
    
    // Descargar archivo - Evitamos editar el mensaje aquí
    // Usar axios para descargar el archivo
    const response = await axios({
      method: 'GET',
      url: fileUrl,
      responseType: 'stream'
    });
    
    // Guardar archivo
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    
    // Informar que se está procesando - usamos sendMessage en lugar de editMessageText
    // para evitar el error si los mensajes son idénticos
    bot.deleteMessage(chatId, processingMsg.message_id)
      .catch(err => console.error("Error al eliminar mensaje:", err));
    
    const newMsg = await bot.sendMessage(chatId, "⏳ Procesando archivo...");
    
    // Procesar archivo
    const articulos = await fileProcessingService.processFile(filePath);
    
    // Preparar vista previa
    const previewText = `📋 Vista previa del archivo (${articulos.length} productos):\n\n` +
      articulos.slice(0, 5).map(a => 
        `• ${a.CodigoArticulo}: ${a.DescripcionArticulo.slice(0, 30)}${a.DescripcionArticulo.length > 30 ? '...' : ''} - PVP: ${a.PVP}€ - Unidades: ${a.unidades || 0}`
      ).join('\n') +
      (articulos.length > 5 ? `\n\n...y ${articulos.length - 5} productos más` : '');
    
    // Eliminar mensaje de procesamiento
    bot.deleteMessage(chatId, newMsg.message_id)
      .catch(err => console.error("Error al eliminar mensaje:", err));
      
    // Enviar vista previa con botones
    await bot.sendMessage(
      chatId,
      previewText,
      buttonService.generateInventoryConfirmButtons(uniqueFileName)
    );
    
    // Actualizar estado
    stateService.setState(chatId, 'confirming_inventory');
    stateService.setContextValue(chatId, 'pendingFile', uniqueFileName);
    
  } catch (error) {
    console.error('Error procesando archivo:', error);
    
    // En caso de error, enviamos un nuevo mensaje en lugar de editar
    bot.deleteMessage(chatId, processingMsg.message_id)
      .catch(err => console.error("Error al eliminar mensaje:", err));
      
    bot.sendMessage(chatId, `❌ Error al procesar el archivo: ${error.message}`);
    
    // Restablecer estado
    stateService.setState(chatId, stateService.STATES.INITIAL);
  }
}

/**
 * Procesa la confirmación para guardar el inventario
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
 * @param {string} messageId - ID del mensaje
 * @param {string} fileName - Nombre del archivo
 * @param {object} fileProcessingService - Servicio de procesamiento de archivos
*/
async function handleSaveInventory(bot, chatId, messageId, fileName, fileProcessingService) {
  const filePath = path.join(__dirname, '../uploads', fileName);
  
  // Verificar si es admin y si el archivo existe
  if (!await isAdmin(chatId.toString()) || !fs.existsSync(filePath)) {
    return bot.sendMessage(chatId, "No se puede procesar esta solicitud");
  }
  
  try {
    // Eliminar mensaje anterior y enviar nuevo
    bot.deleteMessage(chatId, messageId)
      .catch(err => console.error("Error al eliminar mensaje:", err));
      
    const processingMsg = await bot.sendMessage(chatId, "⏳ Guardando inventario en base de datos...");
    
    // Procesar y guardar en BD
    const articulos = await fileProcessingService.processFile(filePath);
    const result = await fileProcessingService.saveArticulos(articulos);
    
    // Eliminar archivo temporal
    await fs.remove(filePath);
    
    // Eliminar mensaje de procesamiento
    bot.deleteMessage(chatId, processingMsg.message_id)
      .catch(err => console.error("Error al eliminar mensaje:", err));
      
    // Informar resultado
    bot.sendMessage(
      chatId,
      `✅ Inventario actualizado correctamente:\n\n` +
      `• Total productos: ${result.total}\n` +
      `• Nuevos productos: ${result.created}\n` +
      `• Productos actualizados: ${result.updated}\n` +
      `• Errores: ${result.errors || 0}`
    );
    
    // Restablecer estado
    stateService.setState(chatId, stateService.STATES.INITIAL);
    stateService.setContextValue(chatId, 'pendingFile', undefined);
    
  } catch (error) {
    console.error('Error guardando inventario:', error);
    
    // En caso de error, enviar nuevo mensaje
    bot.sendMessage(chatId, `❌ Error al guardar el inventario: ${error.message}`);
    
    // Restablecer estado
    stateService.setState(chatId, stateService.STATES.INITIAL);
    stateService.setContextValue(chatId, 'pendingFile', undefined);
  }
}

/**
 * Cancela la subida de inventario
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
 * @param {number} messageId - ID del mensaje
*/
async function handleCancelInventory(bot, chatId, messageId) {
  const context = stateService.getContext(chatId);
  const fileName = context.pendingFile;
  
  if (fileName) {
    const filePath = path.join(__dirname, '../uploads', fileName);
    if (fs.existsSync(filePath)) {
      await fs.remove(filePath);
    }
  }
  
  // Eliminar mensaje anterior y enviar nuevo
  bot.deleteMessage(chatId, messageId)
    .catch(err => console.error("Error al eliminar mensaje:", err));
    
  // Informar cancelación
  bot.sendMessage(chatId, "❌ Subida de inventario cancelada");
  
  // Restablecer estado
  stateService.setState(chatId, stateService.STATES.INITIAL);
  stateService.setContextValue(chatId, 'pendingFile', undefined);
}

/**
 * Procesa los callbacks relacionados con la gestión de administradores
 * @param {object} bot - Instancia del bot
 * @param {object} callbackQuery - Objeto de callback de Telegram
 * @returns {Promise<boolean>} - Indica si el callback fue procesado
 */
async function processAdminCallbacks(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;
  
  // Verificar si es administrador
  if (!await isAdmin(chatId.toString())) {
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "No tienes permisos para usar esta función",
      show_alert: true
    });
    return false;
  }
  
  try {
    if (data === 'admin_user_management') {
      // Mostrar gestión de usuarios/admins
      await managementController.showAdminManagementPanel(bot, chatId);
      return true;
    }
    else if (data === 'admin_pending_requests') {
      // Mostrar solicitudes pendientes
      await managementController.showPendingRequests(bot, chatId);
      return true;
    }
    else if (data === 'admin_list') {
      // Mostrar lista de administradores
      await managementController.showAdminList(bot, chatId);
      return true;
    }
    else if (data.startsWith('admin_request_')) {
      // Mostrar detalles de solicitud
      const requestId = data.replace('admin_request_', '');
      await managementController.showRequestDetails(bot, chatId, requestId);
      return true;
    }
    else if (data.startsWith('admin_approve_')) {
      // Aprobar solicitud
      const requestId = data.replace('admin_approve_', '');
      await managementController.processRequest(bot, chatId, requestId, 'APPROVE');
      return true;
    }
    else if (data.startsWith('admin_reject_')) {
      // Rechazar solicitud
      const requestId = data.replace('admin_reject_', '');
      await managementController.processRequest(bot, chatId, requestId, 'REJECT');
      return true;
    }
    else if (data.startsWith('admin_remove_')) {
      // Eliminar administrador
      const adminId = data.replace('admin_remove_', '');
      await managementController.handleRemoveAdmin(bot, chatId, adminId);
      return true;
    }
    else if (data === 'admin_management') {
      // Volver al panel de gestión
      await managementController.showAdminManagementPanel(bot, chatId);
      return true;
    }
    else if (data === 'admin_back') {
      // Volver al panel principal
      await bot.sendMessage(chatId, "Panel de Administración", buttonService.generateAdminButtons());
      return true;
    }
    
    // No se procesó el callback
    return false;
  } catch (error) {
    logger.error(`Error al procesar callback de admin ${data}: ${error.message}`);
    
    await bot.sendMessage(
      chatId,
      "Ha ocurrido un error al procesar la operación. Por favor, intenta de nuevo."
    );
    
    return true;
  }
}

module.exports = {
  isAdmin,
  handleAdminCommand,
  handleInventoryManagement,
  handleUserManagement,
  handleUploadInventory,
  processAdminDocument,
  handleSaveInventory,
  handleCancelInventory,
  processAdminCallbacks,
  requestsController
};