// Servicio para transcripción de audio usando OpenAI Whisper API
const fs = require('fs-extra');
const path = require('path');
const OpenAI = require('openai');
const axios = require('axios');
const logger = require('../utils/logger');

// Configuración de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Directorio temporal para almacenar archivos de audio
const TEMP_DIR = path.join(__dirname, '../temp');

// Asegurar que el directorio temporal exista
fs.ensureDirSync(TEMP_DIR);

/**
 * Descarga un archivo de audio de Telegram y lo guarda temporalmente
 * @param {object} bot - Instancia del bot de Telegram
 * @param {string} fileId - ID del archivo de audio en Telegram
 * @returns {Promise<string>} - Ruta al archivo temporal
*/
async function downloadAudioFile(bot, fileId) {
  try {
    logger.log(`Intentando descargar archivo con fileId: ${fileId}`);
    
    // Generar un nombre único para el archivo temporal
    const tempFilename = `audio_${Date.now()}_${Math.random().toString(36).substring(2, 10)}.ogg`;
    const tempFilePath = path.join(TEMP_DIR, tempFilename);
    
    // Usar el downloader alternativo
    const telegramDownloader = require('../utils/telegramDownloader');
    await telegramDownloader.downloadWithRetry(
      fileId, 
      process.env.TELEGRAM_BOT_TOKEN, 
      tempFilePath, 
      3
    );
    
    // Verificar que el archivo exista y tenga tamaño
    const stats = await fs.stat(tempFilePath);
    if (stats.size === 0) {
      throw new Error('El archivo descargado está vacío');
    }
    
    logger.log(`Audio descargado y guardado temporalmente en: ${tempFilePath} (${stats.size} bytes)`);
    return tempFilePath;
    
  } catch (error) {
    logger.error(`Error al descargar audio: ${error.message}`);
    throw new Error(`Error al descargar el archivo de audio: ${error.message}`);
  }
}

/**
 * Transcribe un archivo de audio usando OpenAI Whisper API
 * @param {string} audioFilePath - Ruta al archivo de audio
 * @param {string} language - Código de idioma (opcional, 'es' para español)
 * @returns {Promise<string>} - Texto transcrito
*/
async function transcribeAudio(audioFilePath, language = 'es') {
  try {
    // Verificar que el archivo existe
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`El archivo no existe: ${audioFilePath}`);
    }
    
    const fileStats = await fs.stat(audioFilePath);
    logger.log(`Tamaño del archivo a transcribir: ${fileStats.size} bytes`);
    
    if (fileStats.size === 0) {
      throw new Error('El archivo está vacío');
    }
    
    logger.log(`Iniciando transcripción del audio: ${audioFilePath}`);
    
    // Crear un stream de lectura para el archivo
    const audioFile = fs.createReadStream(audioFilePath);
    
    // Llamar a la API de Whisper para transcripción
    try {
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language: language,
        response_format: "text"
      });
      
      logger.log(`Transcripción completada con éxito`);
      return transcription;
    } catch (openaiError) {
      logger.error(`Error de OpenAI: ${openaiError.message}`);
      
      // Intentar con una aproximación alternativa si es necesario
      if (openaiError.message.includes('format')) {
        logger.log('Intentando con un enfoque alternativo...');
        
        // Crear un FormData manualmente
        const { FormData } = require('formdata-node');
        const form = new FormData();
        form.append('file', new Blob([await fs.readFile(audioFilePath)]), path.basename(audioFilePath));
        form.append('model', 'whisper-1');
        form.append('language', language);
        form.append('response_format', 'text');
        
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: form
        });
        
        if (!response.ok) {
          throw new Error(`Error en solicitud alternativa: ${await response.text()}`);
        }
        
        return await response.text();
      }
      
      throw openaiError;
    }
  } catch (error) {
    logger.error(`Error al transcribir audio: ${error.message}`);
    
    // Verificar si el error es de OpenAI
    if (error.response && error.response.status) {
      // Este es un error de la API de OpenAI
      throw new Error(`Error de OpenAI (${error.response.status}): ${error.response.data?.error?.message || 'Error desconocido'}`);
    }
    
    throw new Error(`Error al transcribir el audio: ${error.message}`);
  }
}

/**
 * Elimina un archivo temporal
 * @param {string} filePath - Ruta al archivo
 * @returns {Promise<boolean>} - Resultado de la operación
*/
async function removeTemporaryFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      await fs.unlink(filePath);
      logger.log(`Archivo temporal eliminado: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    logger.error(`Error al eliminar archivo temporal: ${error.message}`);
    return false;
  }
}

/**
 * Procesa un mensaje de voz de Telegram y devuelve la transcripción
 * @param {object} bot - Instancia del bot de Telegram
 * @param {object} message - Mensaje de Telegram
 * @returns {Promise<string>} - Texto transcrito
*/
async function processVoiceMessage(bot, message) {
  let tempFilePath = null;
  
  try {
    // Obtener el fileId del mensaje de voz
    const fileId = message.voice.file_id;
    logger.log(`Procesando mensaje de voz con fileId: ${fileId}`);
    
    // Descargar el archivo temporalmente
    tempFilePath = await downloadAudioFile(bot, fileId);
    
    // Transcribir el audio
    const transcription = await transcribeAudio(tempFilePath);
    
    return transcription;
  } catch (error) {
    logger.error(`Error al procesar mensaje de voz: ${error.message}`);
    throw error;
  } finally {
    // Eliminar el archivo temporal independientemente del resultado
    if (tempFilePath) {
      await removeTemporaryFile(tempFilePath);
    }
  }
}

/**
 * Procesa un mensaje de audio de Telegram y devuelve la transcripción
 * @param {object} bot - Instancia del bot de Telegram
 * @param {object} message - Mensaje de Telegram con audio
 * @returns {Promise<string>} - Texto transcrito
*/
async function processAudioMessage(bot, message) {
  let tempFilePath = null;
  
  try {
    // Obtener el fileId del mensaje de audio
    const fileId = message.audio.file_id;
    logger.log(`Procesando mensaje de audio con fileId: ${fileId}`);
    
    // Descargar el archivo temporalmente
    tempFilePath = await downloadAudioFile(bot, fileId);
    
    // Transcribir el audio
    const transcription = await transcribeAudio(tempFilePath);
    
    return transcription;
  } catch (error) {
    logger.error(`Error al procesar mensaje de audio: ${error.message}`);
    throw error;
  } finally {
    // Eliminar el archivo temporal independientemente del resultado
    if (tempFilePath) {
      await removeTemporaryFile(tempFilePath);
    }
  }
}

/**
 * Limpia archivos temporales antiguos
 * @param {number} maxAgeMinutes - Edad máxima en minutos para los archivos
 * @returns {Promise<number>} - Número de archivos eliminados
*/
async function cleanupTempFiles(maxAgeMinutes = 60) {
  try {
    const files = await fs.readdir(TEMP_DIR);
    const now = Date.now();
    let removedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      const stats = await fs.stat(filePath);
      
      // Calcular la edad del archivo en minutos
      const fileAgeMinutes = (now - stats.mtimeMs) / (1000 * 60);
      
      // Si el archivo es más antiguo que el límite, eliminarlo
      if (fileAgeMinutes > maxAgeMinutes) {
        await fs.unlink(filePath);
        removedCount++;
        logger.log(`Archivo temporal antiguo eliminado: ${filePath}`);
      }
    }
    
    return removedCount;
  } catch (error) {
    logger.error(`Error al limpiar archivos temporales: ${error.message}`);
    return 0;
  }
}

// Programar limpieza periódica (cada hora)
setInterval(() => {
  cleanupTempFiles(60)
    .then(count => {
      if (count > 0) {
        logger.log(`Limpieza programada: ${count} archivos temporales eliminados`);
      }
    })
    .catch(error => {
      logger.error(`Error en limpieza programada: ${error.message}`);
    });
}, 60 * 60 * 1000); // 1 hora

module.exports = {
  processVoiceMessage,
  processAudioMessage,
  transcribeAudio,
  downloadAudioFile,
  removeTemporaryFile,
  cleanupTempFiles
};