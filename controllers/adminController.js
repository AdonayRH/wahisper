const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const stateService = require('../services/botStateService');
const buttonService = require('../services/buttonGeneratorService');

// Lista de IDs de usuarios administradores
const ADMIN_IDS = process.env.ADMIN_TELEGRAM_ID ? process.env.ADMIN_TELEGRAM_ID.split(',') : ['123456789'];

/**
 * Verifica si un usuario es administrador
 * @param {string} telegramId - ID de Telegram
 * @returns {boolean} - Indica si es administrador
 */
function isAdmin(telegramId) {
  return ADMIN_IDS.includes(telegramId.toString());
}

/**
 * Maneja el comando de administrador
 * @param {object} bot - Instancia del bot
 * @param {object} msg - Mensaje de Telegram
 */
function handleAdminCommand(bot, msg) {
  const chatId = msg.chat.id;
  
  // Verificar si es un administrador
  if (!isAdmin(chatId.toString())) {
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
function handleInventoryManagement(bot, chatId) {
  if (!isAdmin(chatId.toString())) {
    return bot.sendMessage(chatId, "No tienes permisos para acceder a las funciones de administrador.");
  }
  
  bot.sendMessage(chatId, "Gestión de Inventario", buttonService.generateInventoryButtons());
}

/**
 * Prepara para subir inventario
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
 */
function handleUploadInventory(bot, chatId) {
  if (!isAdmin(chatId.toString())) {
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
  if (!isAdmin(chatId.toString()) || 
      stateService.getContext(chatId).state !== 'waiting_for_file') {
    return;
  }
  // controllers/adminController.js (continuación)

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
    
    // Descargar archivo
    await bot.editMessageText("⏳ Descargando archivo...", {
      chat_id: chatId,
      message_id: processingMsg.message_id
    });
    
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
    
    // Informar que se está procesando
    await bot.editMessageText("⏳ Procesando archivo...", {
      chat_id: chatId,
      message_id: processingMsg.message_id
    });
    
    // Procesar archivo
    const articulos = await fileProcessingService.processFile(filePath);
    
    // Mostrar vista previa
    await bot.editMessageText(
      `📋 Vista previa del archivo (${articulos.length} productos):\n\n` +
      articulos.slice(0, 5).map(a => 
        `• ${a.CodigoArticulo}: ${a.DescripcionArticulo} - PVP: ${a.PVP}€ - Stock: ${a.stock}`
      ).join('\n') +
      (articulos.length > 5 ? `\n\n...y ${articulos.length - 5} productos más` : ''),
      {
        chat_id: chatId,
        message_id: processingMsg.message_id,
        ...buttonService.generateInventoryConfirmButtons(uniqueFileName)
      }
    );
    
    // Actualizar estado
    stateService.setState(chatId, 'confirming_inventory');
    stateService.setContextValue(chatId, 'pendingFile', uniqueFileName);
    
  } catch (error) {
    console.error('Error procesando archivo:', error);
    bot.editMessageText(`❌ Error al procesar el archivo: ${error.message}`, {
      chat_id: chatId,
      message_id: processingMsg.message_id
    });
    
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
  if (!isAdmin(chatId.toString()) || !fs.existsSync(filePath)) {
    return bot.sendMessage(chatId, "No se puede procesar esta solicitud");
  }
  
  // Informar que se está procesando
  const processingMsg = await bot.editMessageText("⏳ Guardando inventario en base de datos...", {
    chat_id: chatId,
    message_id: messageId
  });
  
  try {
    // Procesar y guardar en BD
    const articulos = await fileProcessingService.processFile(filePath);
    const result = await fileProcessingService.saveArticulos(articulos);
    
    // Eliminar archivo temporal
    await fs.remove(filePath);
    
    // Informar resultado
    bot.editMessageText(
      `✅ Inventario actualizado correctamente:\n\n` +
      `• Total productos: ${result.total}\n` +
      `• Nuevos productos: ${result.created}\n` +
      `• Productos actualizados: ${result.updated}\n` +
      `• Errores: ${result.errors}`,
      {
        chat_id: chatId,
        message_id: processingMsg.message_id
      }
    );
    
    // Restablecer estado
    stateService.setState(chatId, stateService.STATES.INITIAL);
    stateService.setContextValue(chatId, 'pendingFile', undefined);
    
  } catch (error) {
    console.error('Error guardando inventario:', error);
    bot.editMessageText(`❌ Error al guardar el inventario: ${error.message}`, {
      chat_id: chatId,
      message_id: processingMsg.message_id
    });
    
    // Restablecer estado
    stateService.setState(chatId, stateService.STATES.INITIAL);
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
  
  // Informar cancelación
  bot.editMessageText("❌ Subida de inventario cancelada", {
    chat_id: chatId,
    message_id: messageId
  });
  
  // Restablecer estado
  stateService.setState(chatId, stateService.STATES.INITIAL);
  stateService.setContextValue(chatId, 'pendingFile', undefined);
}

module.exports = {
  isAdmin,
  handleAdminCommand,
  handleInventoryManagement,
  handleUploadInventory,
  processAdminDocument,
  handleSaveInventory,
  handleCancelInventory
};