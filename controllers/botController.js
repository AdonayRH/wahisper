const bot = require("../services/telegramService");
const { buscarArticulosSimilares } = require("./aiController");
const { generarRespuestaComoVendedor } = require("../services/generarRespuestaComoVendedor");
const carritoService = require("../services/carritoService");
const { analyzeIntent } = require("../services/intentAnalysisService");
const fs = require('fs');

// Variable para almacenar el contexto de la conversación
const conversationContext = {};

// Estados posibles de la conversación
const STATES = {
  INITIAL: 'initial',                         // Estado inicial
  SHOWING_PRODUCTS: 'showing_products',       // Mostrando productos
  ASKING_CONFIRMATION: 'asking_confirmation', // Preguntando confirmación
  ASKING_QUANTITY: 'asking_quantity',         // Preguntando cantidad
  ASKING_FOR_MORE: 'asking_for_more',         // Preguntando si quiere algo más
  ENDING: 'ending'                            // Finalizando conversación
};

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
      lastProductsShown: []
    };
  }
}

// Procesar y guardar datos del usuario
function processUserData(msg) {
  const chatId = msg.chat.id;
  const from = msg.from;
  
  if (!from) return null;
  
  // Extraer información del usuario
  const userData = {
    id: from.id,
    is_bot: from.is_bot || false,
    first_name: from.first_name || "",
    last_name: from.last_name || "",
    username: from.username || "",
    language_code: from.language_code || "",
    is_premium: from.is_premium || false
  };
  
  // Guardar en el carrito
  carritoService.saveUserData(chatId.toString(), userData);
  
  return userData;
}

// Actualizar tiempo de actividad
function updateActivity(chatId) {
  if (conversationContext[chatId]) {
    conversationContext[chatId].lastActivity = Date.now();
  }
}

// Generar botones de Telegram para productos
function generateProductButtons(products, action = 'select') {
  const buttons = [];
  const rows = [];
  
  // Crear botones para cada producto (máximo 3 por fila)
  products.forEach((product, index) => {
    const button = {
      text: `${index + 1}. ${product.DescripcionArticulo.substring(0, 20)}...`,
      callback_data: `${action}_${index}`
    };
    
    if (index % 3 === 0) {
      rows.push([button]);
    } else {
      rows[Math.floor(index / 3)].push(button);
    }
  });
  
  // Añadir botón para ver más detalles
  rows.push([{ text: "❌ No me interesa ninguno", callback_data: "reject_products" }]);
  
  return {
    reply_markup: {
      inline_keyboard: rows
    }
  };
}

// Generar botones de cantidad
function generateQuantityButtons(productIndex) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "1", callback_data: `qty_${productIndex}_1` },
          { text: "2", callback_data: `qty_${productIndex}_2` },
          { text: "3", callback_data: `qty_${productIndex}_3` }
        ],
        [
          { text: "4", callback_data: `qty_${productIndex}_4` },
          { text: "5", callback_data: `qty_${productIndex}_5` },
          { text: "Otra cantidad", callback_data: `qty_custom_${productIndex}` }
        ]
      ]
    }
  };
}

// Generar botones de confirmación
function generateConfirmButtons() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Sí, añadir al carrito", callback_data: "confirm_add" },
          { text: "❌ No, cancelar", callback_data: "cancel_add" }
        ]
      ]
    }
  };
}

// Manejar selección de producto
async function handleProductSelection(chatId, productIndex) {
  try {
    const context = conversationContext[chatId];
    
    if (!context || !context.lastMentionedArticles || productIndex >= context.lastMentionedArticles.length) {
      return bot.sendMessage(chatId, "Lo siento, ha ocurrido un error al seleccionar el producto.");
    }
    
    // Guardar el producto seleccionado
    context.selectedArticleIndex = productIndex;
    const product = context.lastMentionedArticles[productIndex];
    
    // Actualizar estado
    context.state = STATES.ASKING_QUANTITY;
    
    // Preguntar cantidad con botones
    bot.sendMessage(
      chatId,
      `Has seleccionado "${product.DescripcionArticulo}" (${product.PVP}€). ¿Cuántas unidades deseas?`,
      generateQuantityButtons(productIndex)
    );
  } catch (error) {
    console.error("Error al manejar selección de producto:", error);
    bot.sendMessage(chatId, "Hubo un error al procesar tu selección. Por favor, inténtalo de nuevo.");
  }
}

// Manejar selección de cantidad
async function handleQuantitySelection(chatId, productIndex, quantity) {
  try {
    const context = conversationContext[chatId];
    
    if (!context || !context.lastMentionedArticles) {
      return bot.sendMessage(chatId, "Lo siento, ha ocurrido un error al procesar la cantidad.");
    }
    
    // Guardar la cantidad seleccionada
    context.selectedQuantity = quantity;
    const product = context.lastMentionedArticles[productIndex];
    
    // Actualizar estado
    context.state = STATES.ASKING_CONFIRMATION;
    
    // Pedir confirmación final
    bot.sendMessage(
      chatId,
      `¿Quieres añadir ${quantity} unidad(es) de "${product.DescripcionArticulo}" a tu carrito?`,
      generateConfirmButtons()
    );
  } catch (error) {
    console.error("Error al manejar selección de cantidad:", error);
    bot.sendMessage(chatId, "Hubo un error al procesar la cantidad. Por favor, inténtalo de nuevo.");
  }
}

// Manejar confirmación final
async function handleFinalConfirmation(chatId, confirmed) {
  try {
    const context = conversationContext[chatId];
    
    if (!context || !context.lastMentionedArticles) {
      return bot.sendMessage(chatId, "Lo siento, ha ocurrido un error al procesar tu confirmación.");
    }
    
    if (confirmed) {
      // Obtener el producto y cantidad
      const product = context.lastMentionedArticles[context.selectedArticleIndex];
      const quantity = context.selectedQuantity;
      
      // Añadir al carrito
      carritoService.addToCart(chatId.toString(), product, quantity);
      
      // Actualizar estado
      context.state = STATES.ASKING_FOR_MORE;
      
      // Notificar al usuario
      bot.sendMessage(
        chatId,
        `✅ He añadido ${quantity} unidad(es) de "${product.DescripcionArticulo}" a tu carrito.\n\n¿Deseas algo más?`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Sí, seguir comprando", callback_data: "continue_shopping" },
                { text: "🛒 Ver mi carrito", callback_data: "view_cart" },
                { text: "❌ No, gracias", callback_data: "end_shopping" }
              ]
            ]
          }
        }
      );
    } else {
      // Actualizar estado
      context.state = STATES.INITIAL;
      
      // Notificar al usuario
      bot.sendMessage(
        chatId,
        "De acuerdo, he cancelado la adición al carrito. ¿En qué más puedo ayudarte?"
      );
    }
  } catch (error) {
    console.error("Error al manejar confirmación final:", error);
    bot.sendMessage(chatId, "Hubo un error al procesar tu confirmación. Por favor, inténtalo de nuevo.");
  }
}

// Manejar comando /carrito
async function handleCartCommand(chatId) {
  try {
    const carrito = carritoService.getCart(chatId.toString());
    
    if (!carrito || carrito.items.length === 0) {
      return bot.sendMessage(chatId, "Tu carrito está vacío. ¿En qué puedo ayudarte hoy?");
    }
    
    let total = 0;
    let mensaje = "🛒 *Tu carrito de compra:*\n\n";
    
    carrito.items.forEach((item, index) => {
      // Asegurarse de que precio y cantidad sean números
      const precio = parseFloat(item.precio) || 0;
      const cantidad = parseInt(item.cantidad) || 0;
      
      const subtotal = precio * cantidad;
      total += subtotal;
      
      mensaje += `${index + 1}. ${item.DescripcionArticulo} - ${cantidad} unidad(es) x ${precio.toFixed(2)}€ = ${subtotal.toFixed(2)}€\n`;
    });
    
    mensaje += `\n*Total: ${total.toFixed(2)}€*\n\n`;
    carrito
    
    // Enviar mensaje con botones
    bot.sendMessage(chatId, mensaje, { 
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🗑️ Vaciar carrito", callback_data: "clear_cart" },
            { text: "📤 Exportar carrito", callback_data: "export_cart" }
          ],
          [
            { text: "🛍️ Seguir comprando", callback_data: "continue_shopping" }
          ]
        ]
      }
    });
  } catch (error) {
    console.error("Error al mostrar el carrito:", error);
    bot.sendMessage(chatId, "Hubo un error al mostrar tu carrito. Inténtalo de nuevo.");
  }
}

// Manejar comando para exportar el carrito
async function handleExportCartCommand(chatId) {
  try {
    const jsonData = carritoService.exportCartToJSON(chatId.toString());
    const carrito = carritoService.getCart(chatId.toString());
    
    if (!carrito || carrito.items.length === 0) {
      return bot.sendMessage(chatId, "Tu carrito está vacío. No hay nada que exportar.");
    }
    
    // Enviar el JSON como un mensaje y también como documento
    bot.sendMessage(chatId, "Aquí está el JSON de tu carrito para el frontend:");
    
    // Crear un archivo temporal con el JSON
    const tempFilePath = `./carrito_${chatId}.json`;
    
    fs.writeFileSync(tempFilePath, jsonData);
    
    // Enviar el archivo
    bot.sendDocument(chatId, tempFilePath, { 
      caption: "Datos del carrito en formato JSON (incluye información del usuario)"
    }).then(() => {
      // Eliminar el archivo temporal después de enviarlo
      fs.unlinkSync(tempFilePath);
    });
    
  } catch (error) {
    console.error("Error al exportar el carrito:", error);
    bot.sendMessage(chatId, "Hubo un error al exportar tu carrito. Inténtalo de nuevo.");
  }
}

// Manejar comando para eliminar del carrito
async function handleRemoveFromCartCommand(chatId, index) {
  try {
    carritoService.removeFromCart(chatId.toString(), index);
    bot.sendMessage(chatId, "Artículo eliminado del carrito correctamente.");
    // Mostrar el carrito actualizado
    handleCartCommand(chatId);
  } catch (error) {
    console.error("Error al eliminar del carrito:", error);
    bot.sendMessage(chatId, "Hubo un error al eliminar el artículo. Inténtalo de nuevo.");
  }
}

// Manejar comando para limpiar el carrito
async function handleClearCartCommand(chatId) {
  try {
    carritoService.clearCart(chatId.toString());
    bot.sendMessage(chatId, "Tu carrito ha sido vaciado correctamente.");
  } catch (error) {
    console.error("Error al vaciar el carrito:", error);
    bot.sendMessage(chatId, "Hubo un error al vaciar tu carrito. Inténtalo de nuevo.");
  }
}

// Manejar fin de la conversación
function handleEndConversation(chatId) {
  const context = conversationContext[chatId];
  
  if (context) {
    context.state = STATES.ENDING;
  }
  
  bot.sendMessage(
    chatId, 
    "¡Perfecto! Ha sido un placer atenderte. Si necesitas cualquier otra cosa en el futuro, estaré aquí para ayudarte. ¡Que tengas un excelente día!"
  );
}

// Manejar búsqueda de productos
async function handleProductSearch(chatId, query) {
  try {
    const context = conversationContext[chatId];
    
    // Buscar artículos similares
    const resultados = await buscarArticulosSimilares(query);
    
    if (resultados.length === 0) {
      return bot.sendMessage(
        chatId, 
        "No encontré ningún artículo relacionado con tu búsqueda. ¿Puedes ser más específico o buscar algo diferente?"
      );
    }

    // Guardar artículos mencionados en el contexto
    context.lastMentionedArticles = resultados.map(r => r.articulo);
    context.lastQuery = query;
    context.lastProductsShown = resultados.map(r => r.articulo.DescripcionArticulo);
    context.state = STATES.SHOWING_PRODUCTS;

    // Formatear los artículos para mostrárselos al usuario
    const articulos = resultados.map(({ articulo }, i) =>
      `${i + 1}. ${articulo.DescripcionArticulo} (PVP: ${articulo.PVP} €)`
    ).join("\n\n");

    // Generar respuesta usando OpenAI
    const respuesta = await generarRespuestaComoVendedor(articulos, query);

    // Enviar respuesta con botones para seleccionar productos
    await bot.sendMessage(chatId, respuesta);
    
    // Después de la respuesta, enviar botones para facilitar la selección
    bot.sendMessage(
      chatId, 
      "¿Cuál de estos productos te interesa?",
      generateProductButtons(context.lastMentionedArticles)
    );
  } catch (error) {
    console.error("Error al buscar productos:", error);
    bot.sendMessage(chatId, "⚠️ Hubo un error al buscar artículos. Por favor, inténtalo de nuevo.");
  }
}

// Manejador principal de mensajes
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  if (!text) return;
  
  // Inicializar contexto si no existe
  initContext(chatId);
  
  // Procesar datos del usuario
  processUserData(msg);
  
  // Actualizar actividad
  updateActivity(chatId);
  
  // Manejar comandos específicos primero
  if (text === "/carrito") {
    return handleCartCommand(chatId);
  }
  
  if (text === "/limpiarcarrito") {
    return handleClearCartCommand(chatId);
  }

  if (text === "/exportarcarrito") {
    return handleExportCartCommand(chatId);
  }
  
  if (text && text.startsWith("/eliminar")) {
    const index = parseInt(text.split(" ")[1]) - 1;
    return handleRemoveFromCartCommand(chatId, index);
  }
  
  // Obtener el contexto de la conversación
  const context = conversationContext[chatId];
  
  // Preparar contexto para el análisis de intención
  const intentContext = {
    lastQuery: context.lastQuery,
    lastMentionedProducts: context.lastProductsShown,
    currentState: context.state
  };
  
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
      handleEndConversation(chatId);
      break;
      
    case "REJECTION":
      // Manejar rechazo según el estado actual
      if (context.state === STATES.ASKING_FOR_MORE) {
        handleEndConversation(chatId);
      } else {
        bot.sendMessage(
          chatId,
          "Entendido. ¿Hay algo más en lo que pueda ayudarte?"
        );
        context.state = STATES.INITIAL;
      }
      break;
      
    case "CONFIRMATION":
      // Manejar confirmación según el estado actual
      if (context.state === STATES.SHOWING_PRODUCTS) {
        // Si hay un producto específico mencionado en la intención
        if (intentAnalysis.productReference) {
          // Buscar el producto por nombre o descripción similar
          const productIndex = context.lastMentionedArticles.findIndex(
            product => product.DescripcionArticulo.toLowerCase().includes(intentAnalysis.productReference.toLowerCase())
          );
          
          if (productIndex >= 0) {
            return handleProductSelection(chatId, productIndex);
          }
        }
        
        // Si no se pudo identificar un producto específico, preguntar claramente
        return bot.sendMessage(
          chatId,
          "¿Cuál de los productos mostrados te interesa? Por favor, indica el número.",
          generateProductButtons(context.lastMentionedArticles)
        );
      }
      else if (context.state === STATES.ASKING_CONFIRMATION) {
        return handleFinalConfirmation(chatId, true);
      }
      break;
      
    case "QUANTITY":
      // Manejar especificación de cantidad
      if (context.state === STATES.ASKING_QUANTITY) {
        // Si hay una cantidad mencionada
        if (intentAnalysis.quantityMentioned && intentAnalysis.quantityMentioned > 0) {
          return handleQuantitySelection(
            chatId, 
            context.selectedArticleIndex, 
            intentAnalysis.quantityMentioned
          );
        }
        
        // Si no se pudo identificar la cantidad, preguntar de nuevo
        return bot.sendMessage(
          chatId,
          "¿Cuántas unidades deseas? Por favor, indica solo el número.",
          generateQuantityButtons(context.selectedArticleIndex)
        );
      }
      break;
      
    case "QUERY":
    default:
      // Para consultas o mensajes no clasificados claramente, buscar productos
      return handleProductSearch(chatId, text);
  }
});

// Manejar callbacks de botones
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  
  // Inicializar contexto si no existe
  initContext(chatId);
  
  // Actualizar actividad
  updateActivity(chatId);
  
  // Responder al callback para quitar el "reloj" del botón
  bot.answerCallbackQuery(callbackQuery.id);
  
  // Manejar diferentes tipos de callbacks
  if (data.startsWith('select_')) {
    // Selección de producto
    const productIndex = parseInt(data.split('_')[1]);
    handleProductSelection(chatId, productIndex);
  }
  else if (data.startsWith('qty_')) {
    // Selección de cantidad
    if (data.startsWith('qty_custom_')) {
      // Cantidad personalizada
      const productIndex = parseInt(data.split('_')[2]);
      
      // Actualizar estado
      conversationContext[chatId].state = STATES.ASKING_QUANTITY;
      conversationContext[chatId].selectedArticleIndex = productIndex;
      
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
      
      handleQuantitySelection(chatId, productIndex, quantity);
    }
  }
  else if (data === 'confirm_add') {
    // Confirmar añadir al carrito
    handleFinalConfirmation(chatId, true);
  }
  else if (data === 'cancel_add') {
    // Cancelar añadir al carrito
    handleFinalConfirmation(chatId, false);
  }
  else if (data === 'continue_shopping') {
    // Continuar comprando
    conversationContext[chatId].state = STATES.INITIAL;
    bot.sendMessage(
      chatId,
      "¡Perfecto! ¿Qué más estás buscando?"
    );
  }
  else if (data === 'view_cart') {
    // Ver carrito
    handleCartCommand(chatId);
  }
  else if (data === 'end_shopping') {
    // Finalizar compra
    handleEndConversation(chatId);
  }
  else if (data === 'clear_cart') {
    // Vaciar carrito
    carritoService.clearCart(chatId.toString());
    bot.sendMessage(chatId, "Tu carrito ha sido vaciado correctamente.");
  }
  else if (data === 'export_cart') {
    // Exportar carrito
    handleExportCartCommand(chatId);
  }
  else if (data === 'reject_products') {
    // Rechazar productos mostrados
    bot.sendMessage(
      chatId,
      "Entendido. ¿Qué tipo de producto estás buscando? Puedo ayudarte a encontrar algo más adecuado."
    );
    conversationContext[chatId].state = STATES.INITIAL;
  }
});

// Limpiar contextos inactivos periódicamente (cada 30 minutos)
setInterval(() => {
  const now = Date.now();
  const inactivityLimit = 30 * 60 * 1000; // 30 minutos
  
  Object.keys(conversationContext).forEach(chatId => {
    if (now - conversationContext[chatId].lastActivity > inactivityLimit) {
      delete conversationContext[chatId];
      console.log(`Eliminado contexto inactivo para chatId: ${chatId}`);
    }
  });
}, 30 * 60 * 1000);

module.exports = bot;