// Constantes para los estados de la conversación
const STATES = require('../config/constants').STATES;

// Variable para almacenar el contexto de la conversación
const conversationContext = {};

// Inicializar el contexto para un usuario
function initContext(chatId) {
  if (!conversationContext[chatId]) {
    conversationContext[chatId] = {
      lastMentionedArticles: [],
      lastQuery: null,
      state: STATES.INITIAL,
      selectedArticleIndex: -1,
      pendingAddToCart: false,
      lastActivity: Date.now(),
      lastProductsShown: [],
      selectedAddIndex: null,
      selectedAddProduct: null,
      selectedRemoveIndex: null,
      selectedRemoveProduct: null,
      removeQuantity: null
    };
  }
  return conversationContext[chatId];
}

// Actualizar tiempo de actividad
function updateActivity(chatId) {
  if (conversationContext[chatId]) {
    conversationContext[chatId].lastActivity = Date.now();
  }
}

// Obtener el contexto de un usuario
function getContext(chatId) {
  return conversationContext[chatId] || initContext(chatId);
}

// Establecer un valor en el contexto
function setContextValue(chatId, key, value) {
  if (!conversationContext[chatId]) {
    initContext(chatId);
  }
  conversationContext[chatId][key] = value;
}

// Establecer el estado de la conversación
function setState(chatId, state) {
  if (!conversationContext[chatId]) {
    initContext(chatId);
  }
  conversationContext[chatId].state = state;
}

// Limpiar contextos inactivos
function cleanupInactiveContexts(inactivityLimitMinutes = 30) {
  const now = Date.now();
  const inactivityLimit = inactivityLimitMinutes * 60 * 1000;
  
  Object.keys(conversationContext).forEach(chatId => {
    if (now - conversationContext[chatId].lastActivity > inactivityLimit) {
      delete conversationContext[chatId];
      console.log(`Eliminado contexto inactivo para chatId: ${chatId}`);
    }
  });
}

module.exports = {
  STATES,
  initContext,
  updateActivity,
  getContext,
  setContextValue,
  setState,
  cleanupInactiveContexts
};