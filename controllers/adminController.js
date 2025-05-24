const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const stateService = require('../services/botStateService');
const buttonService = require('../services/buttonGeneratorService');
const adminService = require('../services/adminService');
const requestsController = require('./admin/requestsController');
const managementController = require('./admin/managementController');
const statsController = require('./admin/statsController');
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
 * Maneja la opción de estadísticas
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
*/
async function handleStats(bot, chatId) {
  if (!await isAdmin(chatId.toString())) {
    return bot.sendMessage(chatId, "No tienes permisos para acceder a las funciones de administrador.");
  }
  
  statsController.showStatsPanel(bot, chatId);
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
    
    // Informar que se está procesando usamos sendMessage en lugar de editMessageText
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
  if (!await isAdmin(chatId.toString())) {
    return bot.sendMessage(chatId, "No tienes permisos para procesar esta solicitud");
  }
  
  if (!fs.existsSync(filePath)) {
    return bot.sendMessage(chatId, "El archivo ya no está disponible. Por favor, súbelo nuevamente.");
  }
  
  try {
    // Eliminar mensaje anterior
    bot.deleteMessage(chatId, messageId)
      .catch(err => console.error("Error al eliminar mensaje:", err));
      
    // Mensaje de diagnóstico inicial
    const diagnosticMsg = await bot.sendMessage(chatId, "🔍 Verificando conexión a la base de datos...");
    
    // PASO 1: Diagnóstico de la base de datos
    const dbDiagnosis = await fileProcessingService.diagnoseDatabase();
    
    // Actualizar mensaje con resultado del diagnóstico
    await bot.editMessageText(
      `🔍 Diagnóstico de BD: ${dbDiagnosis.message}\n📝 Procesando archivo...`,
      {
        chat_id: chatId,
        message_id: diagnosticMsg.message_id
      }
    ).catch(err => {
      // Si no se puede editar, enviar nuevo mensaje
      bot.sendMessage(chatId, `🔍 Diagnóstico: ${dbDiagnosis.message}\n📝 Procesando archivo...`);
    });
    
    if (!dbDiagnosis.success) {
      throw new Error(`Error de base de datos: ${dbDiagnosis.error}`);
    }
    
    // PASO 2: Procesar archivo
    console.log(`📂 Procesando archivo: ${filePath}`);
    const articulos = await fileProcessingService.processFile(filePath);
    console.log(`📦 ${articulos.length} artículos extraídos del archivo`);
    
    // Actualizar mensaje de progreso
    await bot.editMessageText(
      `✅ Archivo procesado: ${articulos.length} artículos\n💾 Guardando en base de datos...`,
      {
        chat_id: chatId,
        message_id: diagnosticMsg.message_id
      }
    ).catch(err => {
      bot.sendMessage(chatId, `✅ Archivo procesado: ${articulos.length} artículos\n💾 Guardando en BD...`);
    });
    
    // PASO 3: Guardar en BD con logs detallados
    console.log(`💾 Iniciando guardado de ${articulos.length} artículos...`);
    const result = await fileProcessingService.saveArticulos(articulos);
    console.log(`💾 Guardado completado:`, result);
    
    // PASO 4: Eliminar archivo temporal
    await fs.remove(filePath);
    console.log(`🧹 Archivo temporal eliminado: ${filePath}`);
    
    // PASO 5: Eliminar mensaje de procesamiento
    bot.deleteMessage(chatId, diagnosticMsg.message_id)
      .catch(err => console.error("Error al eliminar mensaje de procesamiento:", err));
      
    // PASO 6: Informar resultado detallado
    let resultMessage = '';
    
    if (result.success) {
      resultMessage = `✅ *Inventario actualizado exitosamente*\n\n` +
                     `📊 *Resumen:*\n` +
                     `• Total artículos procesados: ${result.total}\n` +
                     `• Nuevos artículos creados: ${result.created}\n` +
                     `• Artículos actualizados: ${result.updated}\n` +
                     `• Errores encontrados: ${result.errors}\n\n`;
      
      if (result.errorDetails && result.errorDetails.length > 0) {
        resultMessage += `⚠️ *Detalles de errores:*\n`;
        result.errorDetails.slice(0, 3).forEach(error => {
          resultMessage += `• ${error.articulo}: ${error.error}\n`;
        });
        
        if (result.errorDetails.length > 3) {
          resultMessage += `• ... y ${result.errorDetails.length - 3} errores más\n`;
        }
        resultMessage += '\n';
      }
      
      resultMessage += `✨ El inventario se ha actualizado correctamente.`;
    } else {
      resultMessage = `❌ *Error al actualizar inventario*\n\n` +
                     `Se produjeron errores durante el procesamiento:\n` +
                     `• Total artículos: ${result.total}\n` +
                     `• Procesados correctamente: ${result.created + result.updated}\n` +
                     `• Errores: ${result.errors}\n\n`;
      
      if (result.errorDetails && result.errorDetails.length > 0) {
        resultMessage += `🔍 *Primeros errores encontrados:*\n`;
        result.errorDetails.slice(0, 5).forEach(error => {
          resultMessage += `• ${error.articulo}: ${error.error}\n`;
        });
      }
      
      resultMessage += `\n⚠️ Por favor, revisa el formato del archivo y vuelve a intentarlo.`;
    }
    
    await bot.sendMessage(chatId, resultMessage, { parse_mode: 'Markdown' });
    
    // Restablecer estado
    stateService.setState(chatId, stateService.STATES.INITIAL);
    stateService.setContextValue(chatId, 'pendingFile', undefined);
    
  } catch (error) {
    console.error('💥 Error crítico guardando inventario:', error);
    
    // Eliminar archivo temporal en caso de error
    if (fs.existsSync(filePath)) {
      await fs.remove(filePath).catch(err => 
        console.error('Error eliminando archivo temporal:', err)
      );
    }
    
    // Enviar mensaje de error detallado
    const errorMessage = `❌ *Error crítico al procesar inventario*\n\n` +
                         `🔍 *Detalles técnicos:*\n` +
                         `• Error: ${error.message}\n` +
                         `• Archivo: ${fileName}\n` +
                         `• Tiempo: ${new Date().toLocaleString()}\n\n` +
                         `🛠️ *Pasos para solucionar:*\n` +
                         `1. Verifica que el archivo tenga el formato correcto\n` +
                         `2. Asegúrate de que las columnas sean: CodigoArticulo, DescripcionArticulo, PVP, unidades\n` +
                         `3. Verifica la conexión a la base de datos\n` +
                         `4. Intenta subir el archivo nuevamente\n\n` +
                         `Si el problema persiste, contacta al administrador del sistema.`;
    
    await bot.sendMessage(chatId, errorMessage, { parse_mode: 'Markdown' });
    
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
    // === Gestión de Inventario ===
    if (data === 'admin_inventory') {
      await handleInventoryManagement(bot, chatId);
      return true;
    }
    else if (data === 'admin_upload_inventory') {
      await handleUploadInventory(bot, chatId);
      return true;
    }
    else if (data.startsWith('save_inventory_')) {
      const fileName = data.replace('save_inventory_', '');
      const fileProcessingService = require('../services/fileProcessingService');
      await handleSaveInventory(bot, chatId, messageId, fileName, fileProcessingService);
      return true;
    }
    else if (data === 'cancel_inventory') {
      await handleCancelInventory(bot, chatId, messageId);
      return true;
    }
    
    // === User Management ===
    else if (data === 'admin_management') {
      await managementController.showAdminManagementPanel(bot, chatId);
      return true;
    }
    else if (data === 'admin_user_management') {
      await managementController.showAdminManagementPanel(bot, chatId);
      return true;
    }
    else if (data === 'admin_pending_requests') {
      await managementController.showPendingRequests(bot, chatId);
      return true;
    }
    else if (data === 'admin_list') {
      await managementController.showAdminList(bot, chatId);
      return true;
    }
    else if (data.startsWith('admin_request_')) {
      const requestId = data.replace('admin_request_', '');
      await managementController.showRequestDetails(bot, chatId, requestId);
      return true;
    }
    else if (data.startsWith('admin_approve_')) {
      const requestId = data.replace('admin_approve_', '');
      await managementController.processRequest(bot, chatId, requestId, 'APPROVE');
      return true;
    }
    else if (data.startsWith('admin_reject_')) {
      const requestId = data.replace('admin_reject_', '');
      await managementController.processRequest(bot, chatId, requestId, 'REJECT');
      return true;
    }
    else if (data.startsWith('admin_remove_')) {
      const adminId = data.replace('admin_remove_', '');
      await managementController.handleRemoveAdmin(bot, chatId, adminId);
      return true;
    }
    
    // === Statistics ===
    else if (data === 'admin_stats') {
      await statsController.showStatsPanel(bot, chatId);
      return true;
    }
    else if (data === 'admin_stats_summary') {
      await statsController.showStatsSummary(bot, chatId);
      return true;
    }
    else if (data === 'admin_stats_pending') {
      await statsController.showPendingOrdersStats(bot, chatId);
      return true;
    }
    else if (data === 'admin_stats_completed') {
      await statsController.showCompletedOrdersStats(bot, chatId);
      return true;
    }
    else if (data === 'admin_stats_canceled') {
      await statsController.showCanceledOrdersStats(bot, chatId);
      return true;
    }
    else if (data === 'admin_stats_inventory') {
      await statsController.showInventoryStats(bot, chatId);
      return true;
    }
    else if (data === 'admin_stats_users') {
      await statsController.showUserStats(bot, chatId);
      return true;
    }
    else if (data === 'admin_stats_export') {
      await statsController.exportStats(bot, chatId);
      return true;
    }
    
    // === Navigation ===
    else if (data === 'admin_back') {
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
  handleStats,
  handleInventoryManagement,
  handleUserManagement,
  handleUploadInventory,
  processAdminDocument,
  handleSaveInventory,
  handleCancelInventory,
  processAdminCallbacks,
  requestsController,
  statsController
};