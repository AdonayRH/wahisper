/**
 * Envía un mensaje con reintentos
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
 * @param {string} text - Texto del mensaje
 * @param {object} options - Opciones adicionales
 * @param {number} maxRetries - Número máximo de reintentos
 * @returns {Promise<object>} - Respuesta del envío
 */
async function sendMessageWithRetry(bot, chatId, text, options = {}, maxRetries = 3) {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await bot.sendMessage(chatId, text, options);
    } catch (error) {
      lastError = error;
      console.warn(`Error enviando mensaje (intento ${attempt + 1}/${maxRetries}):`, error.message);
      
      // Esperar antes de reintentar (incrementando el tiempo con cada intento)
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  
  // Si llegamos aquí, todos los intentos fallaron
  console.error(`Error enviando mensaje después de ${maxRetries} intentos:`, lastError);
  throw lastError;
}

/**
 * Edita un mensaje con reintentos
 * @param {object} bot - Instancia del bot
 * @param {string} text - Nuevo texto
 * @param {object} options - Opciones para editar
 * @param {number} maxRetries - Número máximo de reintentos
 * @returns {Promise<object>} - Respuesta de la edición
 */
async function editMessageWithRetry(bot, text, options, maxRetries = 3) {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await bot.editMessageText(text, options);
    } catch (error) {
      lastError = error;
      console.warn(`Error editando mensaje (intento ${attempt + 1}/${maxRetries}):`, error.message);
      
      // Esperar antes de reintentar
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  
  // Si llegamos aquí, todos los intentos fallaron
  console.error(`Error editando mensaje después de ${maxRetries} intentos:`, lastError);
  throw lastError;
}

/**
 * Envía un documento con reintentos
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
 * @param {string} filePath - Ruta al archivo
 * @param {object} options - Opciones adicionales
 * @param {number} maxRetries - Número máximo de reintentos
 * @returns {Promise<object>} - Respuesta del envío
 */
async function sendDocumentWithRetry(bot, chatId, filePath, options = {}, maxRetries = 3) {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await bot.sendDocument(chatId, filePath, options);
    } catch (error) {
      lastError = error;
      console.warn(`Error enviando documento (intento ${attempt + 1}/${maxRetries}):`, error.message);
      
      // Esperar antes de reintentar
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  
  // Si llegamos aquí, todos los intentos fallaron
  console.error(`Error enviando documento después de ${maxRetries} intentos:`, lastError);
  throw lastError;
}

module.exports = {
  sendMessageWithRetry,
  editMessageWithRetry,
  sendDocumentWithRetry
};