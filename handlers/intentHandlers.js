const productController = require('../controllers/productController');
const cartController = require('../controllers/cartController');
const conversationController = require('../controllers/conversationController');
const checkoutController = require('../controllers/checkoutController');
const carritoService = require('../services/carritoService');
const stateService = require('../services/botStateService');
const buttonGeneratorService = require('../services/buttonGeneratorService');
const logger = require('../utils/logger');
const { OpenAI } = require("openai");

const STATES = stateService.STATES;
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // asegúrate de tener esta clave en tu .env
});
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
  
  return {
    hasCheckout
  };
}

/**
 * Maneja la intención VIEW_CART
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @returns {Promise} - Promesa con la respuesta
 */
async function handleViewCartIntent(bot, chatId) {
  return cartController.handleCartCommand(bot, chatId);
}

/**
 * Maneja la intención ADD_UNITS/ADD_MORE
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {object} intentAnalysis - Resultado del análisis de intención
 * @returns {Promise} - Promesa con la respuesta
 */
async function handleAddUnitsIntent(bot, chatId, intentAnalysis) {
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
}

/**
 * Maneja la intención REMOVE_FROM_CART
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {object} intentAnalysis - Resultado del análisis de intención
 * @returns {Promise} - Promesa con la respuesta
 */
async function handleRemoveFromCartIntent(bot, chatId, intentAnalysis) {
  // Verificar si se ha mencionado un producto específico o un índice
  if (intentAnalysis.productReference) {
    return cartController.handleStartRemoveItem(bot, chatId, intentAnalysis.productReference);
  } 
  else if (intentAnalysis.productIndex !== undefined) {
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
}

/**
 * Maneja la intención CHECKOUT
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {string} text - Texto del mensaje
 * @returns {Promise} - Promesa con la respuesta
 */
async function handleCheckoutIntent(bot, chatId, text) {
  // Verificar si el carrito está vacío
  const carritoCheckout = carritoService.getCart(chatId.toString());
  
  if (!carritoCheckout || carritoCheckout.items.length === 0) {
    return bot.sendMessage(
      chatId,
      "Tu carrito está vacío. Añade productos antes de tramitar tu pedido.",
      buttonGeneratorService.generateEmptyCartButtons()
    );
  }
  
  // Iniciar proceso de tramitación
  logger.log(`Iniciando proceso de checkout para usuario ${chatId}`);
  
  // Verificar si es un comando explícito de checkout
  if (isCheckoutCommand(text)) {
    logger.log("Comando de checkout detectado por patrón textual");
    return checkoutController.handleCheckout(bot, chatId);
  }
  
  // Extraer acciones secundarias del texto
  const secondaryActions = extractSecondaryActions(text);

  // Si hay una intención secundaria de checkout
  if (secondaryActions.hasCheckout) {
    logger.log("Intención secundaria de checkout detectada");
    return checkoutController.handleCheckout(bot, chatId);
  }
  
  // Si llegamos aquí, proceder con el checkout normal
  return checkoutController.handleCheckout(bot, chatId);
}

/**
 * Maneja la intención CLEAR_CART
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @returns {Promise} - Promesa con la respuesta
 */
async function handleClearCartIntent(bot, chatId) {
  return cartController.handleStartClearCart(bot, chatId);
}

/**
 * Maneja la intención GREETING
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @returns {Promise} - Promesa con la respuesta
 */
async function handleGreetingIntent(bot, chatId) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4", // o "gpt-3.5-turbo" si prefieres menor coste
      messages: [
        {
          role: "system",
          content: "Hablas como una persona real que trabaja en una tienda online. Saluda de forma natural, cercana y humana, sin mencionar que eres un asistente o inteligencia artificial."
        },
        {
          role: "user",
          content: "Acaba de iniciar el chat un nuevo cliente. ¿Cómo lo saludarías?"
        }
      ],
      temperature: 1 // más alto = más creativo
    });

    const respuesta = completion.choices[0].message.content;
    return bot.sendMessage(chatId, respuesta);
  } catch (error) {
    console.error("❌ Error al generar saludo con OpenAI:", error);
    return bot.sendMessage(
      chatId,
      "¡Hola! ¿En qué puedo ayudarte hoy? 😊"
    );
  }
}
/**
 * Maneja la intención FAREWELL
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @returns {Promise} - Promesa con la respuesta
 */
async function handleFarewellIntent(bot, chatId) {
  return conversationController.handleEndConversation(bot, chatId);
}

/**
 * Maneja la intención REJECTION
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {object} context - Contexto de la conversación
 * @returns {Promise} - Promesa con la respuesta
 */
async function handleRejectionIntent(bot, chatId, context) {
  // Manejar rechazo según el estado actual
  if (context.state === STATES.ASKING_FOR_MORE) {
    return conversationController.handleEndConversation(bot, chatId);
  } else {
    bot.sendMessage(
      chatId,
      "Entendido. ¿Hay algo más en lo que pueda ayudarte?"
    );
    return stateService.setState(chatId, STATES.ASKING_FOR_MORE);
  }
}

/**
 * Maneja la confirmación de selección de producto
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {object} context - Contexto de la conversación
 * @param {object} intentAnalysis - Resultado del análisis de intención
 * @returns {Promise} - Promesa con la respuesta
 */
async function handleProductConfirmation(bot, chatId, context, intentAnalysis) {
  // Verificar si hay productos que confirmar
  if (!context.lastMentionedArticles || context.lastMentionedArticles.length === 0) {
    logger.log("CONFIRMATION recibida pero no hay productos previos mostrados - tratando como QUERY");
    // Si no hay productos mostrados previamente, tratar como una nueva consulta
    return productController.handleProductSearch(bot, chatId, intentAnalysis.input || "");
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

/**
 * Maneja la intención CONFIRMATION
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {object} context - Contexto de la conversación
 * @param {object} intentAnalysis - Resultado del análisis de intención
 * @returns {Promise} - Promesa con la respuesta
 */
async function handleConfirmationIntent(bot, chatId, context, intentAnalysis) {
  // Manejar confirmación según el estado actual
  if (context.state === STATES.SHOWING_PRODUCTS) {
    return handleProductConfirmation(bot, chatId, context, intentAnalysis);
  }
  else if (context.state === STATES.ASKING_CONFIRMATION) {
    return conversationController.handleFinalConfirmation(bot, chatId, true);
  }
  else {
    // Si no estamos en un estado donde la confirmación es esperada,
    // tratar como una nueva consulta
    logger.log("CONFIRMATION recibida en estado incorrecto - tratando como QUERY");
    return productController.handleProductSearch(bot, chatId, intentAnalysis.input || "");
  }
}

/**
 * Maneja la intención QUANTITY cuando no estamos en un estado específico de cantidad
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {object} context - Contexto de la conversación
 * @param {object} intentAnalysis - Resultado del análisis de intención
 * @param {string} text - Texto del mensaje
 * @returns {Promise} - Promesa con la respuesta
 */
async function handleQuantityIntent(bot, chatId, context, intentAnalysis, text) {
  if (context.state === STATES.ASKING_QUANTITY) {
    // Si hay una cantidad mencionada
    if (intentAnalysis.quantityMentioned && intentAnalysis.quantityMentioned > 0) {
      return productController.handleQuantitySelection(
        bot, 
        chatId, 
        context.selectedArticleIndex, 
        intentAnalysis.quantityMentioned
      );
    }
    
    // Si el mensaje contiene un número, usarlo
    const matches = text.match(/\d+/);
    if (matches && matches.length > 0) {
      const cantidad = parseInt(matches[0]);
      return productController.handleQuantitySelection(
        bot,
        chatId,
        context.selectedArticleIndex,
        cantidad
      );
    }
    
    // Si no se pudo identificar la cantidad, preguntar de nuevo
    return bot.sendMessage(
      chatId,
      "¿Cuántas unidades deseas? Por favor, indica solo el número."
    );
  } else if (context.state === STATES.ADDING_UNITS || 
             context.state === STATES.ASKING_ADD_QUANTITY) {
    
    logger.log("Procesando cantidad para añadir unidades");
    
    // Verificar que tenemos toda la información necesaria
    if (context.selectedAddIndex === undefined || context.selectedAddIndex === null) {
      logger.error("Error: No se encontró selectedAddIndex en el contexto");
      return bot.sendMessage(
        chatId,
        "Ha ocurrido un error al procesar tu solicitud. Por favor, intenta añadir unidades nuevamente."
      );
    }
    
    // Si hay una cantidad mencionada, procesarla
    if (intentAnalysis.quantityMentioned && intentAnalysis.quantityMentioned > 0) {
      logger.log(`Cantidad detectada: ${intentAnalysis.quantityMentioned}`);
      return cartController.handleAddQuantity(
        bot,
        chatId,
        intentAnalysis.quantityMentioned
      );
    }
    
    // Si no se pudo determinar la cantidad
    return bot.sendMessage(
      chatId,
      "Por favor, indica cuántas unidades adicionales quieres añadir (solo el número)."
    );
  }
  
  // Si estamos en otro estado, tratar como una consulta general
  return productController.handleProductSearch(bot, chatId, text);
}

/**
 * Maneja la intención QUERY o cualquier otra intención por defecto
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {string} text - Texto del mensaje
 * @returns {Promise} - Promesa con la respuesta
 */
async function handleQueryIntent(bot, chatId, text) {
  return productController.handleProductSearch(bot, chatId, text);
}

/**
 * Maneja acciones basadas en la intención detectada
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {string} text - Texto del mensaje
 * @param {object} context - Contexto de la conversación
 * @param {object} intentAnalysis - Resultado del análisis de intención
 * @returns {Promise} - Promesa con la respuesta
 */
async function handleIntentBasedAction(bot, chatId, text, context, intentAnalysis) {
  switch (intentAnalysis.intent) {

    case "ADMIN_REQUEST":
    // Esta intención ya se maneja en messageHandlers.js antes de llegar aquí
    // Pero por si acaso, redirigimos
    const adminController = require('../controllers/adminController');
    return adminController.requestsController.handleAdminRequest(bot, { chat: { id: chatId }, from: context.userData, text });
    
    case "VIEW_CART":
      return handleViewCartIntent(bot, chatId);
    
    case "ADD_UNITS":
    case "ADD_MORE":
      return handleAddUnitsIntent(bot, chatId, intentAnalysis);

    case "REMOVE_FROM_CART":
      return handleRemoveFromCartIntent(bot, chatId, intentAnalysis);

    case "CHECKOUT":
      return handleCheckoutIntent(bot, chatId, text);

    case "CLEAR_CART":
      return handleClearCartIntent(bot, chatId);
      
    case "GREETING":
      return handleGreetingIntent(bot, chatId);
      
    case "FAREWELL":
      return handleFarewellIntent(bot, chatId);
      
    case "REJECTION":
      return handleRejectionIntent(bot, chatId, context);
      
    case "CONFIRMATION":
      return handleConfirmationIntent(bot, chatId, context, intentAnalysis);
      
    case "QUANTITY":
      return handleQuantityIntent(bot, chatId, context, intentAnalysis, text);
      
    case "QUERY":
    default:
      return handleQueryIntent(bot, chatId, text);
  }
}


/**
 * Maneja la selección de productos por número o texto
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {string} text - Texto del mensaje
 * @param {object} context - Contexto de la conversación
 * @returns {Promise} - Promesa con la respuesta
 */
async function handleProductSelection(bot, chatId, text, context) {
  if (!context.lastMentionedArticles || context.lastMentionedArticles.length === 0) {
    return bot.sendMessage(chatId, "No hay productos disponibles para seleccionar.");
  }

  let selectedIndex = -1;
  const totalProducts = context.lastMentionedArticles.length;

  // Intentar detectar números directos (1, 2, 3, etc.)
  const numberMatch = text.match(/\b(\d+)\b/);
  if (numberMatch) {
    const number = parseInt(numberMatch[1]);
    if (number >= 1 && number <= totalProducts) {
      selectedIndex = number - 1; // Convertir a índice base-0
    }
  }

  // Si no se encontró número, buscar palabras ordinales
  if (selectedIndex === -1) {
    const ordinalPatterns = {
      'primer': 0, 'primero': 0, 'primera': 0, '1er': 0, '1°': 0,
      'segundo': 1, 'segunda': 1, '2do': 1, '2°': 1,
      'tercer': 2, 'tercero': 2, 'tercera': 2, '3er': 2, '3°': 2,
      'cuarto': 3, 'cuarta': 3, '4to': 3, '4°': 3,
      'quinto': 4, 'quinta': 4, '5to': 4, '5°': 4,
      'último': totalProducts - 1, 'ultima': totalProducts - 1
    };

    const lowerText = text.toLowerCase();
    for (const [word, index] of Object.entries(ordinalPatterns)) {
      if (lowerText.includes(word) && index < totalProducts) {
        selectedIndex = index;
        break;
      }
    }
  }

  // Si encontramos una selección válida
  if (selectedIndex >= 0 && selectedIndex < totalProducts) {
    const productController = require('../controllers/productController');
    return productController.handleProductSelection(bot, chatId, selectedIndex);
  }

  // Si no se pudo determinar la selección
  return bot.sendMessage(
    chatId,
    `Disculpa no te he entendido, podrías indica el número (1-${totalProducts}).`
  );
}


module.exports = {
  handleViewCartIntent,
  handleAddUnitsIntent,
  handleRemoveFromCartIntent,
  handleCheckoutIntent,
  handleClearCartIntent,
  handleGreetingIntent,
  handleFarewellIntent,
  handleRejectionIntent,
  handleConfirmationIntent,
  handleProductConfirmation,
  handleQuantityIntent,
  handleQueryIntent,
  handleIntentBasedAction,
  isCheckoutCommand,
  extractSecondaryActions,

  // Función para manejar la selección de productos por número o texto
  handleProductSelection
};