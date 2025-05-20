// Controlador para manejar solicitudes de permisos de administrador
const adminService = require('../../services/adminService');
const logger = require('../../utils/logger');

/**
 * Maneja la solicitud de un usuario para ser administrador
 * @param {object} bot - Instancia del bot de Telegram
 * @param {object} msg - Mensaje de Telegram
 * @returns {Promise<boolean>} - Promesa con resultado (true si fue manejado como solicitud de admin)
 */
async function handleAdminRequest(bot, msg) {
  const chatId = msg.chat.id;
  const userData = {
    id: msg.from.id,
    first_name: msg.from.first_name || "Usuario",
    last_name: msg.from.last_name,
    username: msg.from.username
  };
  
  try {
    logger.log(`Solicitud de admin recibida de ${chatId} (${userData.first_name})`);
    
    // Verificar primero si ya es administrador
    const alreadyAdmin = await adminService.isAdmin(chatId.toString());
    
    if (alreadyAdmin) {
      await bot.sendMessage(
        chatId,
        "Ya tienes permisos de administrador. No es necesario solicitar acceso."
      );
      return true;
    }
    
    // Registrar la solicitud
    const result = await adminService.requestAdminAccess(userData);
    
    if (result.success) {
      await bot.sendMessage(
        chatId,
        "✅ Tu solicitud de permisos de administrador ha sido registrada correctamente. Un administrador revisará tu solicitud pronto."
      );
    } else {
      // Si ya tiene una solicitud pendiente
      if (result.message.includes('pendiente')) {
        await bot.sendMessage(
          chatId,
          "Ya tienes una solicitud pendiente de aprobación. Por favor, espera a que un administrador la procese."
        );
      } else {
        await bot.sendMessage(
          chatId,
          `No se pudo procesar tu solicitud: ${result.message}`
        );
      }
    }
    
    return true;
  } catch (error) {
    logger.error(`Error al procesar solicitud de admin para ${chatId}: ${error.message}`);
    
    await bot.sendMessage(
      chatId,
      "Ha ocurrido un error al procesar tu solicitud. Por favor, intenta de nuevo más tarde."
    );
    
    return true;
  }
}

module.exports = {
  handleAdminRequest
};