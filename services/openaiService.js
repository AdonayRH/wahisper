const OpenAI = require('openai');
const { OPENAI_MODEL } = require('../config/constants');
const logger = require('../utils/logger');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Genera una respuesta utilizando la API de OpenAI
 * @param {Array} messages - Historial de conversación en formato [{role: 'user', content: 'mensaje'}, ...]
 * @returns {Promise<string>} - Respuesta generada
 */
const generateResponse = async (messages) => {
  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000
    });

    return completion.choices[0].message.content;
  } catch (error) {
    logger.error(`Error al generar respuesta con OpenAI: ${error.message}`);
    throw new Error(`Error con OpenAI: ${error.message}`);
  }
};

/**
 * Prepara el contexto para la IA incluyendo instrucciones específicas
 * @param {Array} conversationHistory - Historial de conversación del usuario
 * @returns {Array} - Mensajes formateados para OpenAI
 */
const prepareContext = (conversationHistory) => {
  // Añadir instrucciones del sistema al inicio
  const systemPrompt = {
    role: 'system',
    content: `Eres un asistente útil y amigable. Responde de manera concisa y útil a las preguntas del usuario. 
    Intenta proporcionar información relevante y precisa. Si no conoces la respuesta, admítelo en lugar de inventar información.`
  };
  
  // Limitar la historia de conversación a los últimos 10 mensajes para evitar tokens excesivos
  const recentHistory = conversationHistory.slice(-10);
  
  return [systemPrompt, ...recentHistory];
};

module.exports = {
  generateResponse,
  prepareContext
};