// Este módulo gestiona el carrito de compras en memoria para un bot de Telegram.
const bot = require("../services/telegramService");
const carritoService = require("../services/carritoService");
const { analyzeIntent } = require("../services/intentAnalysisService");
const stateService = require("../services/botStateService");
const cartController = require("./cartController");
const productController = require("./productController");
const conversationController = require("./conversationController");
const adminController = require("./adminController");
const checkoutController = require("./checkoutController");
const whisperService = require('../services/whisperService');
const fs = require('fs-extra');
const path = require('path');


// Función auxiliar para reconocer comandos de checkout
/**
 * Verifica si el mensaje del usuario indica una intención de checkout
 * @param {string} text - Texto del mensaje
 * @returns {boolean} - Indica si es un comando de checkout
 */
function isCheckoutCommand(text) {
  if (!text) return false;
  
  const checkoutPatterns = [
    /\b(tramitar|finalizar|procesar|pagar|completar)\s+(pedido|compra|carrito)\b/i,
    /\b(checkout|pago|pagar|comprar)\b/i,
    /\bquiero\s+(pagar|comprar|finalizar)\b/i,
    /\brealizar\s+pedido\b/i,
    /\bproceder\s+(al|con el)\s+pago\b/i
  ];
  
  return checkoutPatterns.some(pattern => pattern.test(text));
}

/**
 * Analiza el texto del usuario para detectar acciones secundarias
 * @param {string} text - Texto del mensaje
 * @returns {object} - Objeto con acciones detectadas
*/
function extractSecondaryActions(text) {
  if (!text) return { hasCheckout: false };
  
  const normalizedText = text.toLowerCase().trim();
  
  // Patrones para detectar intención de checkout
  const checkoutKeywords = [
    'tramitar', 'pagar', 'comprar', 'finalizar compra', 'realizar pedido',
    'procesar pedido', 'checkout', 'completar compra', 'pago'
  ];
  
  // Verificar si hay una intención de checkout
  const hasCheckout = checkoutKeywords.some(keyword => 
    normalizedText.includes(keyword)
  );
  
  // Se pueden añadir más detecciones secundarias aquí
  
  return {
    hasCheckout
  };
}

// Handler for voice messages
bot.on('voice', async (msg) => {
  try {
    const chatId = msg.chat.id;
    const voiceFileId = msg.voice.file_id;
    
    // Initialize context if it doesn't exist
    stateService.initContext(chatId);
    
    // Process user data
    conversationController.processUserData(msg, carritoService);
    
    // Update activity timestamp
    stateService.updateActivity(chatId);
    
    // Send "typing..." indicator
    bot.sendChatAction(chatId, 'typing');
    
    // Send a message to let the user know we're processing their audio
    const processingMsg = await bot.sendMessage(
      chatId, 
      "🎤 Procesando tu mensaje de voz..."
    );
    
    // Process the voice message using Whisper
    const transcription = await whisperService.processVoiceMessage(bot, voiceFileId);
    
    // Delete processing message
    await bot.deleteMessage(chatId, processingMsg.message_id)
      .catch(err => console.error("Error al eliminar mensaje de procesamiento:", err));
    
    if (!transcription || transcription.trim() === '') {
      return bot.sendMessage(
        chatId,
        "❌ Lo siento, no pude entender tu mensaje de voz. ¿Podrías intentarlo de nuevo o enviar un mensaje de texto?"
      );
    }
    
    // Show transcription to user
    await bot.sendMessage(
      chatId,
      `🔊 Mensaje de voz: "${transcription}"`,
      { parse_mode: 'Markdown' }
    );
    
    // Process the transcribed text like a regular message
    // Get current context
    const context = stateService.getContext(chatId);
    const intentContext = {
      lastQuery: context.lastQuery,
      lastMentionedProducts: context.lastProductsShown,
      currentState: context.state
    };
    
    // Analyze intent
    const intentAnalysis = await analyzeIntent(transcription, intentContext);
    console.log(`Intención detectada en audio: ${intentAnalysis.intent} (${intentAnalysis.confidence})`);
    
    // Handle the message based on the current state and intent
    // This is basically the same logic as in the regular message handler
    
    // If ending conversation
    if (conversationController.isEndingConversation(transcription)) {
      return conversationController.handleEndConversation(bot, chatId);
    }
    
    // If confidence is low, ask for clarification
    if (intentAnalysis.confidence < 0.6) {
      return bot.sendMessage(
        chatId,
        "No estoy seguro de entender lo que quieres. ¿Podrías ser más específico?"
      );
    }
    
    // Process based on current state
    // This is simplified - in a full implementation, you'd include all the state handling logic
    // from the regular message handler
    switch (context.state) {
      case stateService.STATES.ASKING_QUANTITY:
        // If we can extract a number from the transcription
        const numberMatch = transcription.match(/\d+/);
        if (numberMatch) {
          return productController.handleQuantitySelection(
            bot, 
            chatId, 
            context.selectedArticleIndex, 
            parseInt(numberMatch[0])
          );
        }
        
        // Or if intent analysis found a quantity
        if (intentAnalysis.intent === "QUANTITY" && 
            intentAnalysis.quantityMentioned && 
            intentAnalysis.quantityMentioned > 0) {
          
          return productController.handleQuantitySelection(
            bot, 
            chatId, 
            context.selectedArticleIndex, 
            intentAnalysis.quantityMentioned
          );
        }
        
        // If no quantity found, ask again
        return bot.sendMessage(
          chatId,
          "Por favor, indica un número para la cantidad:"
        );
        
      // Add additional state handling as needed
      default:
        // Process based on intent
        switch (intentAnalysis.intent) {
          case "VIEW_CART":
            return cartController.handleCartCommand(bot, chatId);
          
          case "CHECKOUT":
            return checkoutController.handleCheckout(bot, chatId);
            
          case "REMOVE_FROM_CART":
            if (intentAnalysis.productReference) {
              return cartController.handleStartRemoveItem(bot, chatId, intentAnalysis.productReference);
            } else {
              await cartController.handleCartCommand(bot, chatId);
              return bot.sendMessage(
                chatId,
                "¿Qué producto deseas eliminar? Puedes indicar su número o nombre."
              );
            }
          
          case "GREETING":
            bot.sendMessage(
              chatId,
              "¡Hola! ¿En qué puedo ayudarte hoy? Puedo mostrarte nuestros productos o responder a tus consultas."
            );
            break;
            
          case "FAREWELL":
            conversationController.handleEndConversation(bot, chatId);
            break;
            
          case "QUERY":
          default:
            // For product queries or unclassified messages
            return productController.handleProductSearch(bot, chatId, transcription);
        }
    }
    
  } catch (error) {
    console.error("Error processing voice message:", error);
    
    try {
      const chatId = msg.chat.id;
      bot.sendMessage(
        chatId,
        "Ha ocurrido un error al procesar tu mensaje de voz. Por favor, intenta de nuevo o escribe un mensaje de texto."
      );
      
      // Reset state to initial
      stateService.setState(chatId, stateService.STATES.INITIAL);
    } catch (sendError) {
      console.error("Error sending error message:", sendError);
    }
  }
});


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
  try { // Añado try-catch global
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
    
    // Añadir logs para diagnóstico
    console.log(`[${new Date().toISOString()}] Usuario ${chatId}: "${text}"`);
    console.log(`Estado actual: ${context.state}`);
    console.log(`Contexto:`, {
      lastQuery: context.lastQuery,
      selectedRemoveIndex: context.selectedRemoveIndex,
      selectedRemoveProduct: context.selectedRemoveProduct ? context.selectedRemoveProduct.DescripcionArticulo : null,
      removeQuantity: context.removeQuantity
    });
    
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
    
    // Verificar si estamos en estados de confirmación que pueden procesarse sin análisis de intención
    if (context.state === stateService.STATES.CONFIRMING_REMOVE_ITEM) {
      // Para el caso de confirmación simple, verificar patrones afirmativos/negativos directamente
      const affirmativePatterns = /^(s[iíì]|yes|confirmar|confirmo|claro|adelante|ok|aceptar|acepto)$/i;
      const negativePatterns = /^(no|nop|cancel|cancelar|cancelo)$/i;
      
      if (affirmativePatterns.test(text)) {
        return cartController.handleConfirmRemove(bot, chatId);
      } 
      else if (negativePatterns.test(text)) {
        stateService.setState(chatId, stateService.STATES.INITIAL);
        return bot.sendMessage(
          chatId,
          "Operación cancelada. No se ha eliminado nada de tu carrito."
        );
      }
      // Si no coincide con patrones claros, continuar con análisis de intención
    }
    
    // CAMBIO IMPORTANTE: Analizar la intención aquí, antes de cualquier switch que la use
    const intentAnalysis = await analyzeIntent(text, intentContext);
    console.log(`Intención detectada: ${intentAnalysis.intent} (${intentAnalysis.confidence})`);
    
    // Si la confianza es baja, solicitar clarificación
    if (intentAnalysis.confidence < 0.6) {
      return bot.sendMessage(
        chatId,
        "No estoy seguro de entender lo que quieres. ¿Podrías ser más específico?"
      );
    }
    
    // Manejar según el estado actual
    switch (context.state) {
      case stateService.STATES.ASKING_QUANTITY:
        // Manejar la respuesta de cantidad
        try {
          // Primero intentar extraer un número directamente
          const numberMatch = text.match(/\d+/);
          if (numberMatch) {
            return productController.handleQuantitySelection(
              bot, 
              chatId, 
              context.selectedArticleIndex, 
              parseInt(numberMatch[0])
            );
          }
          
          // Verificar si se detectó una cantidad en el análisis de intención
          if (intentAnalysis.intent === "QUANTITY" && 
              intentAnalysis.quantityMentioned && 
              intentAnalysis.quantityMentioned > 0) {
            
            console.log(`Cantidad detectada en texto: ${intentAnalysis.quantityMentioned}`);
            
            return productController.handleQuantitySelection(
              bot, 
              chatId, 
              context.selectedArticleIndex, 
              intentAnalysis.quantityMentioned
            );
          }
          
          // Si no se puede extraer un número, pedir de nuevo
          return bot.sendMessage(
            chatId,
            "Por favor, introduce un número válido para la cantidad (puedes escribir el número o el nombre, como '2' o 'dos'):"
          );
        } catch (error) {
          console.error("Error al procesar cantidad:", error);
          // Si hay un error, pedir de nuevo
          return bot.sendMessage(
            chatId,
            "Por favor, introduce un número válido para la cantidad:"
          );
        }
      
      case stateService.STATES.ADDING_UNITS:
      case stateService.STATES.ASKING_ADD_QUANTITY:
        // Manejar la respuesta de cantidad a añadir
        try {
          // Intentar extraer un número del texto
          const numberMatch = text.match(/\d+/);
          if (numberMatch) {
            const cantidad = parseInt(numberMatch[0]);
            return cartController.handleAddQuantity(bot, chatId, cantidad);
          }
          
          // Si no hay coincidencia numérica clara, informar al usuario
          return bot.sendMessage(
            chatId,
            "Por favor, indica un número válido para la cantidad adicional que deseas añadir."
          );
        } catch (error) {
          console.error("Error al procesar cantidad a añadir:", error);
          return bot.sendMessage(
            chatId,
            "Hubo un error al procesar la cantidad. Por favor, intenta de nuevo."
          );
        }

      case stateService.STATES.REMOVING_ITEM:
        // Intentar identificar qué producto quiere eliminar el usuario
        const items = carritoService.getCart(chatId.toString())?.items || [];
        
        if (items.length === 0) {
          bot.sendMessage(chatId, "Tu carrito está vacío. No hay productos para eliminar.");
          stateService.setState(chatId, stateService.STATES.INITIAL);
          return;
        }
        
        // Primero intentar por número
        let productIndex = -1;
        
        // Si el texto contiene números, intentar extraer el índice
        const matches = text.match(/\d+/);
        if (matches) {
          const num = parseInt(matches[0]);
          if (num > 0 && num <= items.length) {
            productIndex = num - 1; // Ajustar al índice base-0
          }
        }
        
        // Si no se encontró por número, buscar por nombre
        if (productIndex === -1) {
          const query = text.toLowerCase().trim();
          productIndex = items.findIndex(item => 
            item.DescripcionArticulo.toLowerCase().includes(query)
          );
        }
        
        if (productIndex >= 0) {
          // Eliminar el producto
          const removedItem = items[productIndex].DescripcionArticulo;
          carritoService.removeFromCart(chatId.toString(), productIndex);
          
          bot.sendMessage(
            chatId, 
            `✅ Producto "${removedItem}" eliminado del carrito.`
          );
          
          // Mostrar carrito actualizado
          cartController.handleCartCommand(bot, chatId);
        } else {
          bot.sendMessage(
            chatId,
            "No pude identificar el producto que deseas eliminar. Por favor, indica el número exacto del producto (1, 2, 3...) o su nombre preciso."
          );
        }
      
      // Restablecer estado
      stateService.setState(chatId, stateService.STATES.INITIAL);
      break;

      case stateService.STATES.ASKING_FOR_MORE:
        // Si el usuario quiere seguir comprando, resetear al estado inicial
        stateService.setState(chatId, stateService.STATES.INITIAL);
        break;
        
      case stateService.STATES.ASKING_REMOVE_QUANTITY:
        // Manejar la respuesta de cantidad a eliminar
        try {
          // Primero intentar extraer un número directamente
          const numberMatch = text.match(/\d+/);
          if (numberMatch) {
            return cartController.handleRemoveQuantity(
              bot, 
              chatId, 
              parseInt(numberMatch[0])
            );
          }
          
          // Si no hay número directo, usar análisis de intención
          if (intentAnalysis.intent === "QUANTITY" && 
              intentAnalysis.quantityMentioned && 
              intentAnalysis.quantityMentioned > 0) {
            
            return cartController.handleRemoveQuantity(
              bot, 
              chatId, 
              intentAnalysis.quantityMentioned
            );
          }
          
          // Palabras clave para eliminar todo
          if (/tod[oa]s|completo|enter[oa]/i.test(text)) {
            return cartController.handleRemoveQuantity(bot, chatId, 'all');
          }
          
          // Si no se pudo extraer una cantidad, pedir de nuevo
          return bot.sendMessage(
            chatId,
            "Por favor, especifica cuántas unidades quieres eliminar, o escribe 'todas' para eliminar el producto completo."
          );
        } catch (error) {
          console.error("Error al procesar cantidad a eliminar:", error);
          return bot.sendMessage(
            chatId,
            "Hubo un error al procesar la cantidad. Por favor, intenta de nuevo."
          );
        }
        
      case stateService.STATES.CONFIRMING_REMOVE_ITEM:
        // Manejar confirmación de eliminación
        if (intentAnalysis.intent === "CONFIRMATION") {
          return cartController.handleConfirmRemove(bot, chatId);
        } 
        else if (intentAnalysis.intent === "REJECTION") {
          stateService.setState(chatId, stateService.STATES.INITIAL);
          return bot.sendMessage(
            chatId,
            "Operación cancelada. No se ha eliminado nada de tu carrito."
          );
        }
        else {
          return bot.sendMessage(
            chatId,
            "Por favor, confirma si quieres eliminar el producto o no."
          );
        }
        break;
        
      case stateService.STATES.CONFIRMING_REMOVE_ALL:
        // Manejar confirmación de vaciado del carrito
        if (intentAnalysis.intent === "CONFIRMATION") {
          await cartController.handleClearCartCommand(bot, chatId);
          stateService.setState(chatId, stateService.STATES.INITIAL);
          return bot.sendMessage(
            chatId,
            "✅ Tu carrito ha sido vaciado completamente."
          );
        } 
        else if (intentAnalysis.intent === "REJECTION") {
          stateService.setState(chatId, stateService.STATES.INITIAL);
          return bot.sendMessage(
            chatId,
            "Operación cancelada. Tu carrito no ha sido modificado."
          );
        }
        else {
          return bot.sendMessage(
            chatId,
            "Por favor, confirma si quieres vaciar completamente tu carrito o no."
          );
        }
        break;
        
      default:
        // Para otros estados, continuar con el análisis de intención
        break;
    }
    
    // Manejar según la intención detectada
    switch (intentAnalysis.intent) {
      case "VIEW_CART":
        // Manejar la intención de ver el carrito
        return cartController.handleCartCommand(bot, chatId);
      
      case "ADD_UNITS":
      case "ADD_MORE":
        // Verificar si se ha mencionado un producto específico o un índice
        if (intentAnalysis.productReference) {
          return cartController.handleStartAddUnits(bot, chatId, intentAnalysis.productReference);
        } 
        else {
          // Mostrar el carrito y pedir especificar a qué producto añadir
          await cartController.handleCartCommand(bot, chatId);
          return bot.sendMessage(
            chatId,
            "¿A qué producto deseas añadir unidades? Puedes indicar su número o nombre."
          );
        }

      case "REMOVE_FROM_CART":
        // Verificar si se ha mencionado un producto específico o un índice
        if (intentAnalysis.productReference) {
          return cartController.handleStartRemoveItem(bot, chatId, intentAnalysis.productReference);
        } 
        else if (intentAnalysis.productIndex) {
          return cartController.handleStartRemoveItem(bot, chatId, intentAnalysis.productIndex);
        }
        else {
          // Mostrar el carrito y pedir especificar qué eliminar
          await cartController.handleCartCommand(bot, chatId);
          return bot.sendMessage(
            chatId,
            "¿Qué producto deseas eliminar? Puedes indicar su número o nombre."
          );
        }
        break;

      case "CHECKOUT":
        // Verificar si el carrito está vacío
        const carritoCheckout = carritoService.getCart(chatId.toString());
        
        if (!carritoCheckout || carritoCheckout.items.length === 0) {
          return bot.sendMessage(
            chatId,
            "Tu carrito está vacío. Añade productos antes de tramitar tu pedido.",
            buttonService.generateEmptyCartButtons()
          );
        }
        
        // Iniciar proceso de tramitación
        console.log(`Iniciando proceso de checkout para usuario ${chatId}`);
        if (isCheckoutCommand(text)) {
          console.log("Comando de checkout detectado por patrón textual");
          
          const carritoCheckout = carritoService.getCart(chatId.toString());
          
          if (!carritoCheckout || carritoCheckout.items.length === 0) {
            return bot.sendMessage(
              chatId,
              "Tu carrito está vacío. Añade productos antes de tramitar tu pedido.",
              buttonService.generateEmptyCartButtons()
            );
          }
          return checkoutController.handleCheckout(bot, chatId);
        }
        // Extraer acciones secundarias del texto
        const secondaryActions = extractSecondaryActions(text);

        // Si hay una intención secundaria de checkout
        if (secondaryActions.hasCheckout) {
          console.log("Intención secundaria de checkout detectada");
          
          const carritoCheckout = carritoService.getCart(chatId.toString());
          
          if (!carritoCheckout || carritoCheckout.items.length === 0) {
            return bot.sendMessage(
              chatId,
              "Tu carrito está vacío. Añade productos antes de tramitar tu pedido.",
              buttonGeneratorService.generateEmptyCartButtons()
            );
          }
          
          return checkoutController.handleCheckout(bot, chatId);
        }
        return checkoutController.handleCheckout(bot, chatId);

      case "CLEAR_CART":
        return cartController.handleStartClearCart(bot, chatId);
        
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
          stateService.setState(chatId, stateService.STATES.ASKING_FOR_MORE);
        }
        break;
        
      case "CONFIRMATION":
        // Manejar confirmación según el estado actual
        if (context.state === stateService.STATES.SHOWING_PRODUCTS) {
          // Verificar si hay productos que confirmar
          if (!context.lastMentionedArticles || context.lastMentionedArticles.length === 0) {
            console.log("CONFIRMATION recibida pero no hay productos previos mostrados - tratando como QUERY");
            // Si no hay productos mostrados previamente, tratar como una nueva consulta
            return productController.handleProductSearch(bot, chatId, text);
          }
          
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
        else {
          // Si no estamos en un estado donde la confirmación es esperada,
          // tratar como una nueva consulta
          console.log("CONFIRMATION recibida en estado incorrecto - tratando como QUERY");
          return productController.handleProductSearch(bot, chatId, text);
        }
        
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
          else if (context.state === stateService.STATES.ADDING_UNITS || 
            context.state === stateService.STATES.ASKING_ADD_QUANTITY) {
            console.log("Procesando cantidad para añadir unidades");
            console.log("Contexto actual:", JSON.stringify(context, null, 2));
            
            // Verificar que tenemos toda la información necesaria
            if (context.selectedAddIndex === undefined || context.selectedAddIndex === null) {
              console.error("Error: No se encontró selectedAddIndex en el contexto");
              return bot.sendMessage(
                chatId,
                "Ha ocurrido un error al procesar tu solicitud. Por favor, intenta añadir unidades nuevamente."
              );
            }
            
            // Si hay una cantidad mencionada, procesarla
            if (intentAnalysis.quantityMentioned && intentAnalysis.quantityMentioned > 0) {
              console.log(`Cantidad detectada: ${intentAnalysis.quantityMentioned}`);
              return cartController.handleAddQuantity(
                bot,
                chatId,
                intentAnalysis.quantityMentioned
              );
            }
            
            // Si el mensaje contiene un número, usarlo
            const matches = text.match(/\d+/);
            if (matches && matches.length > 0) {
              const cantidad = parseInt(matches[0]);
              console.log(`Número extraído del texto: ${cantidad}`);
              return cartController.handleAddQuantity(bot, chatId, cantidad);
            }
            
            // Si no se pudo determinar la cantidad
            return bot.sendMessage(
              chatId,
              "Por favor, indica cuántas unidades adicionales quieres añadir (solo el número)."
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
  } catch (error) {
    // Manejo global de errores
    console.error("Error global en el manejador de mensajes:", error);
    
    try {
      const chatId = msg.chat.id;
      bot.sendMessage(
        chatId,
        "Ha ocurrido un error inesperado. Por favor, intenta de nuevo o escribe /cancel para reiniciar."
      );
      
      // Restablecer estado a INITIAL para evitar que se quede en un estado inconsistente
      stateService.setState(chatId, stateService.STATES.INITIAL);
    } catch (sendError) {
      console.error("Error al enviar mensaje de error:", sendError);
    }
  }
});

// Manejar callbacks de botones
bot.on('callback_query', async (callbackQuery) => {
  try { // Añado try-catch global
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;
    
    // Inicializar contexto si no existe
    stateService.initContext(chatId);
    
    // Actualizar actividad
    stateService.updateActivity(chatId);
    
    // Responder al callback para quitar el "reloj" del botón
    bot.answerCallbackQuery(callbackQuery.id);
    
    console.log(`Callback recibido: ${data} de usuario ${chatId}`);
    
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
    
    // Callbacks de eliminación y carrito
    if (data.startsWith('remove_qty_')) {
      // Procesar cantidad a eliminar desde botón
      const quantity = data.replace('remove_qty_', '');
      cartController.handleRemoveQuantity(bot, chatId, quantity);
      return; // Añado return para evitar procesamiento adicional
    }
    else if (data === 'confirm_remove') {
      // Confirmar eliminación de producto
      await cartController.handleConfirmRemove(bot, chatId);
      return; // Añado return para evitar procesamiento adicional
    }
    else if (data === 'cancel_remove') {
      // Cancelar eliminación
      stateService.setState(chatId, stateService.STATES.INITIAL);
      bot.sendMessage(chatId, "Operación cancelada. No se ha eliminado nada de tu carrito.");
      return; // Añado return para evitar procesamiento adicional
    }
    else if (data === 'confirm_clear_cart') {
      // Confirmar vaciado del carrito
      await cartController.handleClearCartCommand(bot, chatId);
      stateService.setState(chatId, stateService.STATES.INITIAL);
      bot.sendMessage(chatId, "✅ Tu carrito ha sido vaciado completamente.");
      return; // Añado return para evitar procesamiento adicional
    }
    else if (data === 'cancel_clear_cart') {
      // Cancelar vaciado del carrito
      stateService.setState(chatId, stateService.STATES.INITIAL);
      bot.sendMessage(chatId, "Operación cancelada. Tu carrito no ha sido modificado.");
      return; // Añado return para evitar procesamiento adicional
    }
    else if (data === 'checkout') {
      // Iniciar proceso de tramitación de pedido
      checkoutController.handleCheckout(bot, chatId);
    }
    else if (data === 'confirm_checkout') {
      // Confirmar pedido
      checkoutController.handleConfirmCheckout(bot, chatId);
    }
    else if (data === 'cancel_checkout') {
      // Cancelar tramitación
      checkoutController.handleCancelCheckout(bot, chatId);
    }
    else if (data === 'new_purchase') {
      // Iniciar nueva compra
      checkoutController.handleNewPurchase(bot, chatId);
    }
    else if (data === 'view_orders') {
      // Ver pedidos
      checkoutController.handleViewOrders(bot, chatId);
    }
    else if (data === 'start_remove_item') {
      // Iniciar proceso de eliminación de producto individual
      bot.sendMessage(
        chatId,
        "¿Qué producto deseas eliminar? Indica su número (1, 2, 3...) o escribe su nombre."
      );
      stateService.setState(chatId, stateService.STATES.REMOVING_ITEM);
    }
    else if (data === 'search_products') {
      // Iniciar búsqueda de productos
      bot.sendMessage(
        chatId,
        "¿Qué tipo de producto estás buscando? Descríbelo y te mostraré las opciones disponibles."
      );
      stateService.setState(chatId, stateService.STATES.INITIAL);
    }
    else if (data === 'go_home') {
      // Volver al inicio
      bot.sendMessage(
        chatId,
        "¡Bienvenido nuevamente! ¿En qué puedo ayudarte hoy? Puedo mostrarte nuestros productos o responder a tus consultas."
      );
      stateService.setState(chatId, stateService.STATES.INITIAL);
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
  } catch (error) {
    console.error("Error en el manejo de callback_query:", error);
    try {
      const chatId = callbackQuery.message.chat.id;
      bot.sendMessage(
        chatId,
        "Ha ocurrido un error al procesar tu selección. Por favor, intenta de nuevo o escribe /cancel para reiniciar."
      );
      // Restablecer estado a INITIAL para evitar que se quede en un estado inconsistente
      stateService.setState(chatId, stateService.STATES.INITIAL);
    } catch (sendError) {
      console.error("Error al enviar mensaje de error:", sendError);
    }
  }
});

// Manejar errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesa rechazada no manejada:', reason);
  // Aquí puedes añadir lógica para recuperarte del error si es posible
});

module.exports = bot;