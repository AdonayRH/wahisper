require("dotenv").config();
const mongoose = require("mongoose");
const logger = require("../utils/logger");

// Opciones de conexión actualizadas (sin opciones deprecated)
const mongoOptions = {
  serverSelectionTimeoutMS: 15000, // Timeout de selección del servidor: 15 segundos
  socketTimeoutMS: 45000, // Timeout del socket: 45 segundos
  heartbeatFrequencyMS: 30000, // Frecuencia de latido: 30 segundos
  retryWrites: true,
  maxPoolSize: 10, // Tamaño máximo del pool de conexiones
  minPoolSize: 1, // Tamaño mínimo del pool de conexiones
};

/**
 * Conectar a MongoDB con reintentos
 * @param {number} retryAttempt - Número de intento actual
 * @param {number} maxRetries - Número máximo de reintentos
*/
async function connectWithRetry(retryAttempt = 0, maxRetries = 5) {
  const retryDelay = Math.min(Math.pow(2, retryAttempt) * 1000, 30000); // Exponential backoff, max 30 segundos
  
  try {
    logger.log(`Intentando conectar a MongoDB (intento ${retryAttempt + 1}/${maxRetries + 1})...`);
    
    await mongoose.connect(process.env.MONGODB_URI, mongoOptions);
    
    logger.log("✅ MongoDB conectado correctamente");
    
    // Configurar manejadores de eventos para la conexión
    mongoose.connection.on("error", (err) => {
      logger.error(`❌ Error de MongoDB: ${err.message}`);
      
      // Si la conexión se pierde, intentar reconectar
      if (err.name === 'MongoNetworkError' || err.message.includes('topology was destroyed')) {
        logger.log("🔄 Intentando reconectar a MongoDB...");
        setTimeout(() => {
          connectWithRetry(0, maxRetries);
        }, 5000);
      }
    });
    
    mongoose.connection.on("disconnected", () => {
      logger.log("🔌 Desconectado de MongoDB");
      
      // Intentar reconectar automáticamente
      setTimeout(() => {
        connectWithRetry(0, maxRetries);
      }, 5000);
    });
    
    mongoose.connection.on("reconnected", () => {
      logger.log("🔄 Reconectado a MongoDB");
    });
    
    return mongoose.connection;
    
  } catch (error) {
    logger.error(`❌ Error al conectar a MongoDB: ${error.message}`);
    
    // Verificar si es un error de IP no permitida
    if (error.message.includes('whitelist')) {
      logger.error(`🔒 Tu IP no está en la lista blanca de MongoDB Atlas. Por favor, añádela en la configuración de Network Access.`);
    }
    
    // Si hemos alcanzado el máximo de reintentos, lanzar error
    if (retryAttempt >= maxRetries) {
      logger.error(`❌ Máximo de reintentos alcanzado (${maxRetries + 1}). No se pudo conectar a MongoDB.`);
      throw new Error(`Máximo de reintentos alcanzado. No se pudo conectar a MongoDB: ${error.message}`);
    }
    
    // Esperar y reintentar
    logger.log(`⏳ Reintentando en ${retryDelay / 1000} segundos...`);
    
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(connectWithRetry(retryAttempt + 1, maxRetries));
      }, retryDelay);
    });
  }
}

// Conectar con reintentos al iniciar la aplicación
connectWithRetry().catch(err => {
  logger.error(`❌ Error fatal al conectar a MongoDB: ${err.message}`);
  process.exit(1); // Salir en caso de error crítico
});

// Manejar señales de cierre para cerrar conexión limpiamente
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    logger.log('Conexión a MongoDB cerrada por finalización de la aplicación');
    process.exit(0);
  } catch (err) {
    logger.error(`Error al cerrar conexión MongoDB: ${err.message}`);
    process.exit(1);
  }
});

module.exports = mongoose;