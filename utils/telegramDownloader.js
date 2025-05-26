// Método alternativo para descargar archivos de Telegram
// Coloca este archivo en /utils/telegramDownloader.js

const axios = require('axios');
const fs = require('fs-extra');
const logger = require('./logger');

/**
 * Descarga un archivo de Telegram usando HTTP directo
 * @param {string} fileId - ID del archivo en Telegram
 * @param {string} botToken - Token del bot de Telegram
 * @param {string} outputPath - Ruta donde guardar el archivo
 * @returns {Promise<string>} - Ruta al archivo descargado
*/
async function downloadTelegramFile(fileId, botToken, outputPath) {
  try {
    logger.log(`Obteniendo información del archivo: ${fileId}`);
    
    // Paso 1: Obtener información del archivo
    const fileInfoResponse = await axios({
      method: 'GET',
      url: `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`,
      responseType: 'json'
    });
    
    if (!fileInfoResponse.data.ok || !fileInfoResponse.data.result || !fileInfoResponse.data.result.file_path) {
      throw new Error(`No se pudo obtener la información del archivo: ${JSON.stringify(fileInfoResponse.data)}`);
    }
    
    const filePath = fileInfoResponse.data.result.file_path;
    logger.log(`Ruta del archivo: ${filePath}`);
    
    // Paso 2: Descargar el archivo
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
    logger.log(`URL de descarga: ${fileUrl}`);
    
    const fileResponse = await axios({
      method: 'GET',
      url: fileUrl,
      responseType: 'stream'
    });
    
    // Paso 3: Guardar el archivo localmente
    const writer = fs.createWriteStream(outputPath);
    fileResponse.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        logger.log(`Archivo descargado exitosamente a: ${outputPath}`);
        resolve(outputPath);
      });
      writer.on('error', (err) => {
        logger.error(`Error al escribir archivo: ${err.message}`);
        reject(err);
      });
    });
    
  } catch (error) {
    logger.error(`Error en downloadTelegramFile: ${error.message}`);
    throw new Error(`Error al descargar archivo de Telegram: ${error.message}`);
  }
}

/**
 * Realiza múltiples intentos para descargar un archivo de Telegram
 * @param {string} fileId - ID del archivo en Telegram 
 * @param {string} botToken - Token del bot de Telegram
 * @param {string} outputPath - Ruta donde guardar el archivo
 * @param {number} maxRetries - Número máximo de reintentos
 * @returns {Promise<string>} - Ruta al archivo descargado
*/
async function downloadWithRetry(fileId, botToken, outputPath, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      logger.log(`Intento de descarga ${attempt + 1}/${maxRetries}`);
      return await downloadTelegramFile(fileId, botToken, outputPath);
    } catch (error) {
      lastError = error;
      
      // Si no es un error temporal, no reintentamos
      if (!error.message.includes('temporarily unavailable')) {
        break;
      }
      
      logger.log(`Reintentando en ${(attempt + 1) * 2} segundos...`);
      await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 2000));
    }
  }
  
  throw lastError || new Error('Error desconocido durante la descarga');
}

module.exports = {
  downloadTelegramFile,
  downloadWithRetry
};