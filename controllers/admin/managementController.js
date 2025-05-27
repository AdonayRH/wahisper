// Controlador para gestionar administradores
const adminService = require('../../services/adminService');
const buttonService = require('../../services/buttonGeneratorService');
const logger = require('../../utils/logger');

/**
 * Muestra el panel de gestión de administradores
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @returns {Promise} - Promesa de la operación
*/
async function showAdminManagementPanel(bot, chatId) {
  try {
    // Verificar si es administrador
    const isAdmin = await adminService.isAdmin(chatId.toString());
    
    if (!isAdmin) {
      return bot.sendMessage(
        chatId,
        "No tienes permisos para acceder a esta función."
      );
    }
    
    // Mostrar panel de administración de usuarios
    return bot.sendMessage(
      chatId,
      "🔧 Panel de Gestión de Administradores",
      generateAdminManagementButtons()
    );
  } catch (error) {
    logger.error(`Error al mostrar panel de gestión de admin para ${chatId}: ${error.message}`);
    
    return bot.sendMessage(
      chatId,
      "Ha ocurrido un error al cargar el panel de administración. Por favor, intenta de nuevo."
    );
  }
}

/**
 * Muestra las solicitudes pendientes de administrador
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @returns {Promise} - Promesa de la operación
*/
async function showPendingRequests(bot, chatId) {
  try {
    // Verificar si es administrador
    const isAdmin = await adminService.isAdmin(chatId.toString());
    
    if (!isAdmin) {
      return bot.sendMessage(
        chatId,
        "No tienes permisos para acceder a esta función."
      );
    }
    
    // Obtener solicitudes pendientes
    const pendingRequests = await adminService.getAdminRequests('PENDING');
    
    if (pendingRequests.length === 0) {
      return bot.sendMessage(
        chatId,
        "📭 No hay solicitudes pendientes de aprobación.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "◀️ Volver", callback_data: "admin_management" }]
            ]
          }
        }
      );
    }
    
    // Mostrar solicitudes pendientes
    let message = "📝 *Solicitudes pendientes de aprobación:*\n\n";
    
    pendingRequests.forEach((req, index) => {
      const date = new Date(req.createdAt);
      const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
      
      message += `${index + 1}. ${req.userData.first_name} ${req.userData.last_name || ''}` +
                 `${req.userData.username ? ` (@${req.userData.username})` : ''}\n` +
                 `   📱 ID: ${req.telegramId}\n` +
                 `   📅 Fecha: ${formattedDate}\n\n`;
    });
    
    // Generar botones para cada solicitud
    const buttons = pendingRequests.map((req, index) => {
      return [
        { 
          text: `${index + 1}. ${req.userData.first_name} ${req.userData.last_name || ''}`, 
          callback_data: `admin_request_${req._id}` 
        }
      ];
    });
    
    // Añadir botón para volver
    buttons.push([{ text: "◀️ Volver", callback_data: "admin_management" }]);
    
    return bot.sendMessage(
      chatId,
      message,
      {
        reply_markup: {
          inline_keyboard: buttons
        }
      }
    );
  } catch (error) {
    logger.error(`Error al mostrar solicitudes pendientes para ${chatId}: ${error.message}`);
    
    return bot.sendMessage(
      chatId,
      "Ha ocurrido un error al cargar las solicitudes. Por favor, intenta de nuevo."
    );
  }
}

/**
 * Muestra los detalles de una solicitud específica
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {string} requestId - ID de la solicitud
 * @returns {Promise} - Promesa de la operación
*/
async function showRequestDetails(bot, chatId, requestId) {
  try {
    // Verificar si es administrador
    const isAdmin = await adminService.isAdmin(chatId.toString());
    
    if (!isAdmin) {
      return bot.sendMessage(
        chatId,
        "No tienes permisos para acceder a esta función."
      );
    }
    
    // Obtener detalles de la solicitud - aquí simulamos buscarla por ID
    // En la implementación real, usaríamos AdminRequest.findById(requestId)
    const pendingRequests = await adminService.getAdminRequests('PENDING');
    const request = pendingRequests.find(req => req._id.toString() === requestId);
    
    if (!request) {
      return bot.sendMessage(
        chatId,
        "Solicitud no encontrada o ya procesada.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "◀️ Volver a solicitudes", callback_data: "admin_pending_requests" }]
            ]
          }
        }
      );
    }
    
    // Mostrar detalles de la solicitud
    const date = new Date(request.createdAt);
    const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    
    let message = "📋 *Detalles de la solicitud:*\n\n" +
                  `👤 *Usuario:* ${request.userData.first_name} ${request.userData.last_name || ''}\n` +
                  `🔢 *ID de Telegram:* ${request.telegramId}\n` +
                  `📝 *Username:* ${request.userData.username ? `@${request.userData.username}` : 'No proporcionado'}\n` +
                  `📅 *Fecha de solicitud:* ${formattedDate}\n` +
                  `📊 *Estado:* ${request.status}\n\n` +
                  "¿Deseas aprobar o rechazar esta solicitud?";
    
    return bot.sendMessage(
      chatId,
      message,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Aprobar", callback_data: `admin_approve_${request._id}` },
              { text: "❌ Rechazar", callback_data: `admin_reject_${request._id}` }
            ],
            [{ text: "◀️ Volver", callback_data: "admin_pending_requests" }]
          ]
        }
      }
    );
  } catch (error) {
    logger.error(`Error al mostrar detalles de solicitud para ${chatId}: ${error.message}`);
    
    return bot.sendMessage(
      chatId,
      "Ha ocurrido un error al cargar los detalles. Por favor, intenta de nuevo."
    );
  }
}

/**
 * Procesa una solicitud de administrador (aprobar/rechazar)
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {string} requestId - ID de la solicitud
 * @param {string} action - Acción a realizar (APPROVE/REJECT)
 * @returns {Promise} - Promesa de la operación
*/
async function processRequest(bot, chatId, requestId, action) {
  try {
    // Verificar si es administrador
    const isAdmin = await adminService.isAdmin(chatId.toString());
    
    if (!isAdmin) {
      return bot.sendMessage(
        chatId,
        "No tienes permisos para acceder a esta función."
      );
    }
    
    // Obtener información del administrador
    const adminData = {
      telegramId: chatId.toString(),
      first_name: "Administrador" // En la implementación real, obtendríamos esto de la base de datos
    };
    
    // Procesar la solicitud
    const result = await adminService.processAdminRequest(requestId, action, adminData);
    
    if (result.success) {
      // Si se aprobó, enviar notificación al usuario
      if (action === 'APPROVE') {
        try {
          await bot.sendMessage(
            parseInt(result.request.telegramId),
            "✅ Tu solicitud de permisos de administrador ha sido aprobada. Ahora tienes acceso a las funciones de administración."
          );
        } catch (notifyError) {
          logger.error(`Error al notificar al usuario ${result.request.telegramId}: ${notifyError.message}`);
        }
      }
      
      return bot.sendMessage(
        chatId,
        `✅ Solicitud ${action === 'APPROVE' ? 'aprobada' : 'rechazada'} correctamente.`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "📝 Ver otras solicitudes", callback_data: "admin_pending_requests" }],
              [{ text: "🔙 Volver al panel", callback_data: "admin_management" }]
            ]
          }
        }
      );
    } else {
      return bot.sendMessage(
        chatId,
        `❌ No se pudo procesar la solicitud: ${result.message}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 Volver", callback_data: "admin_pending_requests" }]
            ]
          }
        }
      );
    }
  } catch (error) {
    logger.error(`Error al procesar solicitud ${requestId} para ${chatId}: ${error.message}`);
    
    return bot.sendMessage(
      chatId,
      "Ha ocurrido un error al procesar la solicitud. Por favor, intenta de nuevo."
    );
  }
}

/**
 * Muestra la lista de administradores actuales
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @returns {Promise} - Promesa de la operación
*/
async function showAdminList(bot, chatId) {
  try {
    // Verificar si es administrador
    const isAdmin = await adminService.isAdmin(chatId.toString());
    
    if (!isAdmin) {
      return bot.sendMessage(
        chatId,
        "No tienes permisos para acceder a esta función."
      );
    }
    
    // Obtener lista de administradores
    const admins = await adminService.getAllAdmins();
    
    if (admins.length === 0) {
      return bot.sendMessage(
        chatId,
        "No hay administradores registrados.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "◀️ Volver", callback_data: "admin_management" }]
            ]
          }
        }
      );
    }
    
    // Mostrar lista de administradores
    let message = "👥 *Lista de Administradores:*\n\n";
    
    admins.forEach((admin, index) => {
      message += `${index + 1}. ${admin.first_name || ''} ${admin.last_name || ''}` +
                 `${admin.username ? ` (@${admin.username})` : ''}\n` +
                 `   📱 ID: ${admin.telegramId}\n` +
                 `   🔑 Rol: ${admin.role || 'admin'}\n` +
                 `   📎 Fuente: ${admin.source || 'database'}\n\n`;
    });
    
    // Generar botones para eliminar cada administrador
    // Solo permitir eliminar administradores que no sean del entorno (.env)
    const buttons = admins
      .filter(admin => admin.source !== 'env') // No permitir eliminar admins definidos en .env
      .map((admin, index) => {
        const displayName = admin.username 
          ? `@${admin.username}` 
          : (admin.first_name || `ID: ${admin.telegramId}`);
        
        return [{ 
          text: `❌ Eliminar ${displayName}`, 
          callback_data: `admin_remove_${admin.telegramId}` 
        }];
      });
    
    // Añadir botón para volver
    buttons.push([{ text: "◀️ Volver", callback_data: "admin_management" }]);
    
    return bot.sendMessage(
      chatId,
      message,
      {
        reply_markup: {
          inline_keyboard: buttons
        }
      }
    );
  } catch (error) {
    logger.error(`Error al mostrar lista de admins para ${chatId}: ${error.message}`);
    
    return bot.sendMessage(
      chatId,
      "Ha ocurrido un error al cargar la lista de administradores. Por favor, intenta de nuevo."
    );
  }
}

/**
 * Maneja la eliminación de un administrador
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {string} targetAdminId - ID del administrador a eliminar
 * @returns {Promise} - Promesa de la operación
*/
async function handleRemoveAdmin(bot, chatId, targetAdminId) {
  try {
    // Verificar si es administrador quien solicita la operación
    const isAdmin = await adminService.isAdmin(chatId.toString());
    
    if (!isAdmin) {
      return bot.sendMessage(
        chatId,
        "No tienes permisos para acceder a esta función."
      );
    }
    
    // Verificar que el admin no se esté eliminando a sí mismo
    if (chatId.toString() === targetAdminId.toString()) {
      return bot.sendMessage(
        chatId,
        "⛔ No puedes eliminarte a ti mismo como administrador.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "👥 Volver a la lista", callback_data: "admin_list" }]
            ]
          }
        }
      );
    }
    
    // Obtener información del admin que realiza la operación
    const adminData = {
      telegramId: chatId.toString(),
      first_name: "Administrador" // En la implementación real, obtendríamos esto de la base de datos
    };
    
    // Revocar permisos
    const result = await adminService.revokeAdminAccess(
      targetAdminId, 
      adminData, 
      "Removido por administrador"
    );
    
    if (result.success) {
      // Notificar al usuario que perdió sus permisos
      try {
        await bot.sendMessage(
          parseInt(targetAdminId),
          "⚠️ Tus permisos de administrador han sido revocados."
        );
      } catch (notifyError) {
        logger.error(`Error al notificar al usuario ${targetAdminId}: ${notifyError.message}`);
      }
      
      return bot.sendMessage(
        chatId,
        `✅ Administrador eliminado correctamente.`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "👥 Ver lista actualizada", callback_data: "admin_list" }],
              [{ text: "🔙 Volver al panel", callback_data: "admin_management" }]
            ]
          }
        }
      );
    } else {
      return bot.sendMessage(
        chatId,
        `❌ No se pudo eliminar al administrador: ${result.message}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 Volver", callback_data: "admin_list" }]
            ]
          }
        }
      );
    }
  } catch (error) {
    logger.error(`Error al eliminar admin ${targetAdminId} por ${chatId}: ${error.message}`);
    
    return bot.sendMessage(
      chatId,
      "Ha ocurrido un error al eliminar al administrador. Por favor, intenta de nuevo."
    );
  }
}

/**
 * Genera botones para el panel de gestión de administradores
 * @returns {object} - Configuración de botones
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

module.exports = {
  showAdminManagementPanel,
  showPendingRequests,
  showRequestDetails,
  processRequest,
  showAdminList,
  handleRemoveAdmin,
  generateAdminManagementButtons
};