// Servicio centralizado para gestión de administradores
const User = require('../models/user');
const AdminRequest = require('../models/adminRequest');
const logger = require('../utils/logger');

/**
 * Verifica si un usuario es administrador
 * @param {string} telegramId - ID de Telegram del usuario
 * @returns {Promise<boolean>} - Indica si es administrador
 */
async function isAdmin(telegramId) {
  try {
    // Primero verificar la lista de admins establecida en las variables de entorno
    const envAdmins = process.env.ADMIN_TELEGRAM_IDS 
      ? process.env.ADMIN_TELEGRAM_IDS.split(',') 
      : ['2030605308']; // ID por defecto
    
    if (envAdmins.includes(telegramId.toString())) {
      return true;
    }
    
    // Si no está en la lista de entorno, verificar en la base de datos
    const user = await User.findOne({ telegramId: telegramId.toString() });
    return user && (user.role === 'admin' || user.role === 'superadmin');
  } catch (error) {
    logger.error(`Error al verificar si el usuario ${telegramId} es admin: ${error.message}`);
    return false;
  }
}

/**
 * Registra una solicitud de permisos de administrador
 * @param {object} userData - Datos del usuario
 * @returns {Promise<object>} - Solicitud creada
 */
async function requestAdminAccess(userData) {
  try {
    if (!userData || !userData.id || !userData.first_name) {
      throw new Error('Datos de usuario incompletos');
    }
    
    const telegramId = userData.id.toString();
    
    // Verificar si ya es administrador
    const alreadyAdmin = await isAdmin(telegramId);
    if (alreadyAdmin) {
      return {
        success: false,
        message: 'Ya tienes permisos de administrador',
        isAdmin: true
      };
    }
    
    // Verificar si ya existe una solicitud pendiente
    const existingRequest = await AdminRequest.findOne({
      telegramId,
      status: 'PENDING'
    });
    
    if (existingRequest) {
      return {
        success: false,
        message: 'Ya tienes una solicitud pendiente',
        request: existingRequest
      };
    }
    
    // Crear nueva solicitud
    const adminRequest = new AdminRequest({
      telegramId,
      userData: {
        first_name: userData.first_name,
        last_name: userData.last_name || null,
        username: userData.username || null
      }
    });
    
    await adminRequest.save();
    logger.log(`Nueva solicitud de admin registrada: ${telegramId} (${userData.first_name})`);
    
    return {
      success: true,
      message: 'Solicitud registrada correctamente',
      request: adminRequest
    };
  } catch (error) {
    logger.error(`Error al registrar solicitud de admin: ${error.message}`);
    throw error;
  }
}

/**
 * Revoca permisos de administrador y elimina solicitudes asociadas
 * @param {string} telegramId - ID de Telegram del usuario
 * @param {object} adminData - Datos del administrador que revoca
 * @param {string} reason - Motivo de la revocación
 * @returns {Promise<object>} - Resultado de la operación
 */
async function revokeAdminAccess(telegramId, adminData, reason = "") {
  try {
    // Verificar si el usuario existe y es admin
    const user = await User.findOne({ telegramId: telegramId.toString() });
    
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
    
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      throw new Error('El usuario no tiene permisos de administrador');
    }
    
    // Revocar permisos
    user.role = 'user';
    await user.save();
    
    // Eliminar solicitudes de admin aprobadas anteriormente
    try {
      await AdminRequest.deleteMany({ telegramId: telegramId.toString() });
      logger.log(`Solicitudes de admin para ${telegramId} eliminadas`);
    } catch (deleteError) {
      logger.error(`Error al eliminar solicitudes de admin: ${deleteError.message}`);
      // Continuamos aunque haya error al eliminar solicitudes
    }
    
    // Registrar la acción
    logger.log(`Admin ${adminData.telegramId} (${adminData.first_name}) revocó permisos de admin a ${telegramId} (${user.first_name}). Motivo: ${reason || 'No especificado'}`);
    
    return {
      success: true,
      message: 'Permisos de administrador revocados correctamente',
      user
    };
  } catch (error) {
    logger.error(`Error al revocar permisos de admin: ${error.message}`);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Obtiene todas las solicitudes de administrador
 * @param {string} status - Filtro por estado (opcional)
 * @returns {Promise<Array>} - Lista de solicitudes
 */
async function getAdminRequests(status = null) {
  try {
    let query = {};
    
    if (status) {
      query.status = status;
    }
    
    const requests = await AdminRequest.find(query)
      .sort({ createdAt: -1 });
    
    return requests;
  } catch (error) {
    logger.error(`Error al obtener solicitudes de admin: ${error.message}`);
    throw error;
  }
}

/**
 * Procesa una solicitud de administrador (aprobar/rechazar)
 * @param {string} requestId - ID de la solicitud
 * @param {string} action - Acción a realizar (APPROVE/REJECT)
 * @param {object} adminData - Datos del administrador que procesa
 * @param {string} notes - Notas opcionales
 * @returns {Promise<object>} - Resultado del procesamiento
 */
async function processAdminRequest(requestId, action, adminData, notes = "") {
  try {
    const validActions = ['APPROVE', 'REJECT'];
    
    if (!validActions.includes(action)) {
      throw new Error('Acción no válida');
    }
    
    const request = await AdminRequest.findById(requestId);
    
    if (!request) {
      throw new Error('Solicitud no encontrada');
    }
    
    if (request.status !== 'PENDING') {
      throw new Error('Esta solicitud ya ha sido procesada');
    }
    
    // Actualizar solicitud
    request.status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    request.processedBy = {
      telegramId: adminData.telegramId,
      first_name: adminData.first_name,
      timestamp: new Date()
    };
    
    if (notes) {
      request.notes = notes;
    }
    
    await request.save();
    
    // Si fue aprobada, actualizar o crear usuario con rol de admin
    if (action === 'APPROVE') {
      let user = await User.findOne({ telegramId: request.telegramId });
      
      if (user) {
        // Actualizar usuario existente
        user.role = 'admin';
        await user.save();
      } else {
        // Crear nuevo usuario
        user = new User({
          telegramId: request.telegramId,
          first_name: request.userData.first_name,
          last_name: request.userData.last_name,
          username: request.userData.username,
          role: 'admin'
        });
        
        await user.save();
      }
      
      logger.log(`Usuario ${request.telegramId} (${request.userData.first_name}) promovido a admin`);
    }
    
    return {
      success: true,
      message: `Solicitud ${action === 'APPROVE' ? 'aprobada' : 'rechazada'} correctamente`,
      request
    };
  } catch (error) {
    logger.error(`Error al procesar solicitud de admin: ${error.message}`);
    throw error;
  }
}

/**
 * Revoca permisos de administrador
 * @param {string} telegramId - ID de Telegram del usuario
 * @param {object} adminData - Datos del administrador que revoca
 * @param {string} reason - Motivo de la revocación
 * @returns {Promise<object>} - Resultado de la operación
 */
async function revokeAdminAccess(telegramId, adminData, reason = "") {
  try {
    // Verificar si el usuario existe y es admin
    const user = await User.findOne({ telegramId: telegramId.toString() });
    
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
    
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      throw new Error('El usuario no tiene permisos de administrador');
    }
    
    // Revocar permisos
    user.role = 'user';
    await user.save();
    
    // Registrar la acción
    logger.log(`Admin ${adminData.telegramId} (${adminData.first_name}) revocó permisos de admin a ${telegramId} (${user.first_name}). Motivo: ${reason || 'No especificado'}`);
    
    return {
      success: true,
      message: 'Permisos de administrador revocados correctamente',
      user
    };
  } catch (error) {
    logger.error(`Error al revocar permisos de admin: ${error.message}`);
    throw error;
  }
}

/**
 * Obtiene una lista de todos los administradores
 * @returns {Promise<Array>} - Lista de administradores
 */
async function getAllAdmins() {
  try {
    // Obtener admins desde la base de datos
    const dbAdmins = await User.find({
      role: { $in: ['admin', 'superadmin'] }
    });
    
    // Obtener admins desde variables de entorno
    const envAdmins = process.env.ADMIN_TELEGRAM_IDS 
      ? process.env.ADMIN_TELEGRAM_IDS.split(',') 
      : ['2030605308']; // ID por defecto
    
    // Combinar resultados (eliminando duplicados)
    const dbAdminIds = dbAdmins.map(admin => admin.telegramId);
    const missingEnvAdmins = envAdmins.filter(id => !dbAdminIds.includes(id));
    
    // Para los IDs que solo están en el entorno, crear objetos básicos
    const envAdminObjects = missingEnvAdmins.map(id => ({
      telegramId: id,
      source: 'env',
      role: 'admin'
    }));
    
    // Combinar ambas listas
    const allAdmins = [
      ...dbAdmins.map(admin => ({
        ...admin.toObject(),
        source: 'database'
      })),
      ...envAdminObjects
    ];
    
    return allAdmins;
  } catch (error) {
    logger.error(`Error al obtener lista de administradores: ${error.message}`);
    throw error;
  }
}

module.exports = {
  isAdmin,
  requestAdminAccess,
  getAdminRequests,
  processAdminRequest,
  revokeAdminAccess,
  getAllAdmins
};