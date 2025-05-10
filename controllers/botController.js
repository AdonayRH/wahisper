// controllers/botController.js (archivo principal)
const bot = require("../services/telegramService");
const carritoService = require("../services/carritoService");
const { analyzeIntent } = require("../services/intentAnalysisService");
const stateService = require("../services/botStateService");
const cartController = require("./cartController");
const productController = require("./productController");
const conversationController = require("./conversationController");
const adminController = require("./adminController");
const fs = require('fs-extra');
const path = require('path');

// Configurar intervalos de limpieza de contextos
setInterval(() => {
  stateService.cleanupInactiveContexts(30); // 30 minutos
}, 30 * 60 * 1000);

// Manejar comando /admin
bot.onText(/\/admin/, (msg) => {
  adminController.handleAdminCommand(bot, msg);
});

// Manejar comando /cancel
bot.onText(/\/cancel/, (msg) => {
  const chatId = msg.chat.id;
  conversationController.handleCancelCommand(bot, chatId, fs, path);
});

// Manejar comando /carrito
bot.onText(/\/carrito/, (msg) => {
  const chatId = msg.chat.id;
  cartController.handleCartCommand(bot, chatId);
});

// Manejar comando /limpiarcarrito
bot.onText(/\/limpiarcarrito/, (msg) => {
  const chatId = msg.chat.id;
  cartController.handleClearCartCommand(bot, chatId);
});

// Manejar comando /exportarcarrito
bot.onText(/\/exportarcarrito/, (msg) => {
  const chatId = msg.chat.id;
  cartController.handleExportCartCommand(bot, chatId);
});

// Manejar comando /eliminar
bot.onText(/\/eliminar (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const index = parseInt(match[1]) - 1;
  cartController.handleRemoveFromCartCommand(bot, chatId, index);
});

// Manejar documentos (subida de archivos)
bot.on('document', async (msg) => {
  // Para administradores que suben archivos
  const fileProcessingService = require('../services/fileProcessingService');
  await adminController.processAdminDocument(bot, msg, fileProcessingService);
});

// Manejador principal de mensajes
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  // Ignorar mensajes que no son texto o comandos ya procesados
  if (!text || text.startsWith('/')) return;
  
  // Inicializar contexto si no existe
  stateService.initContext(chatId);
  
  // Procesar datos del usuario
  conversationController.processUserData(msg, carritoService);
  
  // Actualizar actividad
  stateService.updateActivity(chatId);
  
  // Obtener el contexto de la conversación
  const context = stateService.getContext(chatId);
  
  // Preparar contexto para el análisis de intención
  const intentContext = {
    lastQuery: context.lastQuery,
    lastMentionedProducts: context.lastProductsShown,
    currentState: context.state
  };
  
  // Si el usuario está finalizando la conversación
  if (conversationController.isEndingConversation(text)) {
    return conversationController.handleEndConversation(bot, chatId);
  }
  
  // Manejar según el estado actual
  switch (context.state) {
    case stateService.STATES.ASKING_QUANTITY:
      // Manejar la respuesta de cantidad
      try {
        const quantity = parseInt(text.match(/\d+/)[0]);
        return productController.handleQuantitySelection(
          bot, 
          chatId, 
          context.selectedArticleIndex, 
          quantity
        );
      } catch (error) {
        // Si no se puede extraer un número, pedir de nuevo
        return bot.sendMessage(
          chatId,
          "Por favor, introduce un número válido para la cantidad:"
        );
      }
      
    case stateService.STATES.ASKING_FOR_MORE:
      // Si el usuario quiere seguir comprando, resetear al estado inicial
      stateService.setState(chatId, stateService.STATES.INITIAL);
      break;
      
    default:
      // Para otros estados, analizar la intención
      break;
  }
  
  // Analizar la intención del mensaje
  const intentAnalysis = await analyzeIntent(text, intentContext);
  console.log(`Intención detectada: ${intentAnalysis.intent} (${intentAnalysis.confidence})`);
  
  // Si la confianza es baja, solicitar clarificación
  if (intentAnalysis.confidence < 0.6) {
    return bot.sendMessage(
      chatId,
      "No estoy seguro de entender lo que quieres. ¿Podrías ser más específico?"
    );
  }
  
  // Manejar según la intención detectada
  switch (intentAnalysis.intent) {
    case "GREETING":
      // Responder al saludo y ofrecer ayuda
      bot.sendMessage(
        chatId,
        "¡Hola! ¿En qué puedo ayudarte hoy? Puedo mostrarte nuestros productos o responder a tus consultas."
      );
      break;
      
    case "FAREWELL":
      // Despedirse
      conversationController.handleEndConversation(bot, chatId);
      break;
      
    case "REJECTION":
      // Manejar rechazo según el estado actual
      if (context.state === stateService.STATES.ASKING_FOR_MORE) {
        conversationController.handleEndConversation(bot, chatId);
      } else {
        bot.sendMessage(
          chatId,
          "Entendido. ¿Hay algo más en lo que pueda ayudarte?"
        );
        stateService.setState(chatId, stateService.STATES.INITIAL);
      }
      break;
      
    case "CONFIRMATION":
      // Manejar confirmación según el estado actual
      if (context.state === stateService.STATES.SHOWING_PRODUCTS) {
        // Si hay un producto específico mencionado en la intención
        if (intentAnalysis.productReference) {
          // Buscar el producto por nombre o descripción similar
          const productIndex = context.lastMentionedArticles.findIndex(
            product => product.DescripcionArticulo.toLowerCase().includes(intentAnalysis.productReference.toLowerCase())
          );
          
          if (productIndex >= 0) {
            return productController.handleProductSelection(bot, chatId, productIndex);
          }
        }
        
        // Si no se pudo identificar un producto específico, preguntar claramente
        return bot.sendMessage(
          chatId,
          "¿Cuál de los productos mostrados te interesa? Por favor, indica el número."
        );
      }
      else if (context.state === stateService.STATES.ASKING_CONFIRMATION) {
        return conversationController.handleFinalConfirmation(bot, chatId, true);
      }
      break;
      
    case "QUANTITY":
      // Manejar especificación de cantidad
      if (context.state === stateService.STATES.ASKING_QUANTITY) {
        // Si hay una cantidad mencionada
        if (intentAnalysis.quantityMentioned && intentAnalysis.quantityMentioned > 0) {
          return productController.handleQuantitySelection(
            bot, 
            chatId, 
            context.selectedArticleIndex, 
            intentAnalysis.quantityMentioned
          );
        }
        
        // Si no se pudo identificar la cantidad, preguntar de nuevo
        return bot.sendMessage(
          chatId,
          "¿Cuántas unidades deseas? Por favor, indica solo el número."
        );
      }
      break;
      
    case "QUERY":
    default:
      // Para consultas o mensajes no clasificados claramente, buscar productos
      return productController.handleProductSearch(bot, chatId, text);
  }
});

// Manejar callbacks de botones
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;
  
  // Inicializar contexto si no existe
  stateService.initContext(chatId);
  
  // Actualizar actividad
  stateService.updateActivity(chatId);
  
  // Responder al callback para quitar el "reloj" del botón
  bot.answerCallbackQuery(callbackQuery.id);
  
  // Callbacks de administración
  if (data.startsWith('admin_')) {
    if (data === 'admin_inventory') {
      adminController.handleInventoryManagement(bot, chatId);
    }
    else if (data === 'admin_upload_inventory') {
      adminController.handleUploadInventory(bot, chatId);
    }
    // Otros callbacks de administración...
    return;
  }
  
  // Callbacks de inventario
  if (data.startsWith('save_inventory_')) {
    const fileName = data.replace('save_inventory_', '');
    const fileProcessingService = require('../services/fileProcessingService');
    
    adminController.handleSaveInventory(bot, chatId, messageId, fileName, fileProcessingService);
    return;
  }
  else if (data === 'cancel_inventory') {
    adminController.handleCancelInventory(bot, chatId, messageId);
    return;
  }
  
  // Callbacks generales
  if (data.startsWith('select_')) {
    // Selección de producto
    const productIndex = parseInt(data.split('_')[1]);
    productController.handleProductSelection(bot, chatId, productIndex);
  }
  else if (data.startsWith('qty_')) {
    // Selección de cantidad
    if (data.startsWith('qty_custom_')) {
      // Cantidad personalizada
      const productIndex = parseInt(data.split('_')[2]);
      
      // Actualizar estado
      stateService.setState(chatId, stateService.STATES.ASKING_QUANTITY);
      stateService.setContextValue(chatId, 'selectedArticleIndex', productIndex);
      
      // Solicitar cantidad
      bot.sendMessage(
        chatId,
        "Por favor, introduce la cantidad deseada (solo el número):"
      );
    } else {
      // Cantidad específica
      const parts = data.split('_');
      const productIndex = parseInt(parts[1]);
      const quantity = parseInt(parts[2]);
      
      productController.handleQuantitySelection(bot, chatId, productIndex, quantity);
    }
  }
  else if (data === 'confirm_add') {
    // Confirmar añadir al carrito
    conversationController.handleFinalConfirmation(bot, chatId, true);
  }
  else if (data === 'cancel_add') {
    // Cancelar añadir al carrito
    conversationController.handleFinalConfirmation(bot, chatId, false);
  }
  else if (data === 'continue_shopping') {
    // Continuar comprando
    stateService.setState(chatId, stateService.STATES.INITIAL);
    bot.sendMessage(
      chatId,
      "¡Perfecto! ¿Qué más estás buscando?"
    );
  }
  else if (data === 'view_cart') {
    // Ver carrito
    cartController.handleCartCommand(bot, chatId);
  }
  else if (data === 'end_shopping') {
    // Finalizar compra
    conversationController.handleEndConversation(bot, chatId);
  }
  else if (data === 'clear_cart') {
    // Vaciar carrito
    cartController.handleClearCartCommand(bot, chatId);
  }
  else if (data === 'export_cart') {
    // Exportar carrito
    cartController.handleExportCartCommand(bot, chatId);
  }
  else if (data === 'reject_products') {
    // Rechazar productos mostrados
    bot.sendMessage(
      chatId,
      "Entendido. ¿Qué tipo de producto estás buscando? Puedo ayudarte a encontrar algo más adecuado."
    );
    stateService.setState(chatId, stateService.STATES.INITIAL);
  }
});

module.exports = bot;