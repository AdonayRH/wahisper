// Este módulo gestiona el carrito de compras en memoria para un bot de Telegram.
const fs = require('fs');
const carritoService = require('../services/carritoService');
const buttonService = require('../services/buttonGeneratorService');
const stateService = require('../services/botStateService');

/**
 * Maneja el comando /carrito
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
 */
async function handleCartCommand(bot, chatId) {
  try {
    const carrito = carritoService.getCart(chatId.toString());
    
    if (!carrito || carrito.items.length === 0) {
      return bot.sendMessage(chatId, "Tu carrito está vacío. ¿En qué puedo ayudarte hoy?");
      // return bot.sendMessage(
      //   chatId, 
      //   "Tu carrito está vacío. ¿En qué puedo ayudarte hoy?", 
      //   buttonGeneratorService.generateEmptyCartButtons()
      // );
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
    
    // Enviar mensaje con botones adecuados según número de items
    bot.sendMessage(chatId, mensaje, { 
      parse_mode: "Markdown",
      // ...buttonGeneratorService.generateCartButtons(carrito.items.length)
    });
  } catch (error) {
    console.error("Error al mostrar el carrito:", error);
    bot.sendMessage(chatId, "Hubo un error al mostrar tu carrito. Inténtalo de nuevo.");
  }
}

/**
 * Maneja el comando para exportar el carrito
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
 */
async function handleExportCartCommand(bot, chatId) {
  try {
    const jsonData = carritoService.exportCartToJSON(chatId.toString());
    const carrito = carritoService.getCart(chatId.toString());
    
    if (!carrito || carrito.items.length === 0) {
      return bot.sendMessage(chatId, "Tu carrito está vacío. No hay nada que exportar.");
    }
    
    // Enviar el JSON como un mensaje
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

/**
 * Maneja el comando para eliminar un artículo del carrito
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
 * @param {number} index - Índice del artículo a eliminar
 */
async function handleRemoveFromCartCommand(bot, chatId, index) {
  try {
    carritoService.removeFromCart(chatId.toString(), index);
    bot.sendMessage(chatId, "Artículo eliminado del carrito correctamente.");
    // Mostrar el carrito actualizado
    handleCartCommand(bot, chatId);
  } catch (error) {
    console.error("Error al eliminar del carrito:", error);
    bot.sendMessage(chatId, "Hubo un error al eliminar el artículo. Inténtalo de nuevo.");
  }
}

/**
 * Maneja el comando para limpiar el carrito
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
 */
async function handleClearCartCommand(bot, chatId) {
  try {
    carritoService.clearCart(chatId.toString());
    bot.sendMessage(chatId, "Tu carrito ha sido vaciado correctamente.");
  } catch (error) {
    console.error("Error al vaciar el carrito:", error);
    bot.sendMessage(chatId, "Hubo un error al vaciar tu carrito. Inténtalo de nuevo.");
  }
}

/**
 * Añade un producto al carrito verificando el stock disponible
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
 * @param {object} product - Producto a añadir
 * @param {number} quantity - Cantidad
 * @returns {boolean} - Indica si se añadió correctamente
 */
async function addToCart(bot, chatId, product, quantity) {
  try {
    // Verificar stock disponible
    const Articulo = require('../models/articulo');
    const articuloEnBD = await Articulo.findOne({ CodigoArticulo: product.CodigoArticulo });
    
    if (!articuloEnBD) {
      bot.sendMessage(
        chatId,
        `Lo siento, no pude encontrar el producto "${product.DescripcionArticulo}" en el inventario actual.`
      );
      return false;
    }
    
    const stockDisponible = articuloEnBD.unidades || 0;
    
    // Verificar si ya existe en el carrito
    const carrito = carritoService.getCart(chatId.toString());
    let cantidadActual = 0;
    
    if (carrito && carrito.items) {
      const itemExistente = carrito.items.find(item => item.CodigoArticulo === product.CodigoArticulo);
      if (itemExistente) {
        cantidadActual = itemExistente.cantidad || 0;
      }
    }
    
    const totalDeseado = cantidadActual + quantity;
    
    if (totalDeseado > stockDisponible) {
      bot.sendMessage(
        chatId,
        `Lo siento, solo hay ${stockDisponible} unidad(es) disponibles de este producto.\n` +
        (cantidadActual > 0 ? 
          `Ya tienes ${cantidadActual} en tu carrito, por lo que solo puedes añadir ${Math.max(0, stockDisponible - cantidadActual)} más.` :
          `Por favor, selecciona una cantidad igual o menor a ${stockDisponible}.`)
      );
      return false;
    }
    
    // Si hay suficiente stock, añadir al carrito
    carritoService.addToCart(chatId.toString(), product, quantity);
    
    // Notificar al usuario
    bot.sendMessage(
      chatId,
      `✅ He añadido ${quantity} unidad(es) de "${product.DescripcionArticulo}" a tu carrito.\n\n¿Deseas algo más?`,
      buttonService.generatePostAddButtons()
    );
    
    return true;
  } catch (error) {
    console.error("Error al añadir al carrito:", error);
    bot.sendMessage(chatId, "Hubo un error al añadir el producto al carrito. Inténtalo de nuevo.");
    return false;
  }
}

/**
 * Inicia el proceso de eliminación de un producto específico
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
 * @param {number|string} productIdentifier - Índice o identificador del producto
 */
async function handleStartRemoveItem(bot, chatId, productIdentifier) {
  try {
    const carrito = carritoService.getCart(chatId.toString());
    
    if (!carrito || carrito.items.length === 0) {
      return bot.sendMessage(chatId, "Tu carrito está vacío. No hay nada que eliminar.");
    }
    
    // Determinar el índice del producto
    let productIndex = -1;
    
    // Si es un número, asumimos que es el índice (1-based)
    if (!isNaN(productIdentifier)) {
      productIndex = parseInt(productIdentifier) - 1;
    } 
    // Si es texto, buscamos por descripción
    else if (typeof productIdentifier === 'string') {
      productIndex = carrito.items.findIndex(item => 
        item.DescripcionArticulo.toLowerCase().includes(productIdentifier.toLowerCase())
      );
    }
    
    // Verificar que el índice sea válido
    if (productIndex < 0 || productIndex >= carrito.items.length) {
      return bot.sendMessage(
        chatId, 
        "No he encontrado ese producto en tu carrito. Por favor, revisa tu carrito con el comando /carrito y especifica qué producto quieres eliminar."
      );
    }
    
    const product = carrito.items[productIndex];
    
    // Guardar el índice y el producto en el contexto
    stateService.setContextValue(chatId, 'selectedRemoveIndex', productIndex);
    stateService.setContextValue(chatId, 'selectedRemoveProduct', product);
    
    // Si hay más de una unidad, preguntar cuántas eliminar
    if (product.cantidad > 1) {
      stateService.setState(chatId, stateService.STATES.ASKING_REMOVE_QUANTITY);
      
      return bot.sendMessage(
        chatId,
        `El producto "${product.DescripcionArticulo}" tiene ${product.cantidad} unidades en tu carrito. ¿Cuántas unidades quieres eliminar?`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "1", callback_data: `remove_qty_1` },
                { text: "2", callback_data: `remove_qty_2` },
                { text: "Todas", callback_data: `remove_qty_all` }
              ]
            ]
          }
        }
      );
    } 
    // Si solo hay una unidad, preguntar confirmación directamente
    else {
      stateService.setState(chatId, stateService.STATES.CONFIRMING_REMOVE_ITEM);
      stateService.setContextValue(chatId, 'removeQuantity', 1);
      
      return bot.sendMessage(
        chatId,
        `¿Estás seguro de que quieres eliminar "${product.DescripcionArticulo}" de tu carrito?`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Sí, eliminar", callback_data: "confirm_remove" },
                { text: "❌ No, cancelar", callback_data: "cancel_remove" }
              ]
            ]
          }
        }
      );
    }
  } catch (error) {
    console.error("Error al iniciar eliminación de producto:", error);
    bot.sendMessage(chatId, "Hubo un error al procesar tu solicitud. Por favor, inténtalo de nuevo.");
  }
}

/**
 * Maneja la especificación de cantidad a eliminar
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
 * @param {number|string} quantity - Cantidad a eliminar
 */
async function handleRemoveQuantity(bot, chatId, quantity) {
  try {
    const context = stateService.getContext(chatId);
    const product = context.selectedRemoveProduct;
    
    if (!product) {
      return bot.sendMessage(chatId, "Ha ocurrido un error. Por favor, inicia de nuevo el proceso de eliminación.");
    }
    
    // Convertir 'all' a la cantidad total
    let removeQuantity = quantity === 'all' ? product.cantidad : parseInt(quantity);
    
    // Validar la cantidad
    if (isNaN(removeQuantity) || removeQuantity <= 0) {
      return bot.sendMessage(chatId, "Por favor, especifica una cantidad válida.");
    }
    
    if (removeQuantity > product.cantidad) {
      removeQuantity = product.cantidad;
    }
    
    // Guardar la cantidad en el contexto
    stateService.setContextValue(chatId, 'removeQuantity', removeQuantity);
    stateService.setState(chatId, stateService.STATES.CONFIRMING_REMOVE_ITEM);
    
    // Mensaje de confirmación
    const message = removeQuantity === product.cantidad 
      ? `¿Estás seguro de que quieres eliminar todas las unidades de "${product.DescripcionArticulo}" de tu carrito?`
      : `¿Estás seguro de que quieres eliminar ${removeQuantity} unidad(es) de "${product.DescripcionArticulo}" de tu carrito?`;
    
    return bot.sendMessage(
      chatId,
      message,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Sí, eliminar", callback_data: "confirm_remove" },
              { text: "❌ No, cancelar", callback_data: "cancel_remove" }
            ]
          ]
        }
      }
    );
  } catch (error) {
    console.error("Error al procesar cantidad a eliminar:", error);
    bot.sendMessage(chatId, "Hubo un error al procesar tu solicitud. Por favor, inténtalo de nuevo.");
  }
}

/**
 * Confirma y ejecuta la eliminación de elementos del carrito
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
 */
async function handleConfirmRemove(bot, chatId) {
  try {
    const context = stateService.getContext(chatId);
    const productIndex = context.selectedRemoveIndex;
    const product = context.selectedRemoveProduct;
    const removeQuantity = context.removeQuantity;
    
    if (productIndex === undefined || !product || !removeQuantity) {
      return bot.sendMessage(chatId, "Ha ocurrido un error. Por favor, inicia de nuevo el proceso de eliminación.");
    }
    
    const carrito = carritoService.getCart(chatId.toString());
    
    // Si se van a eliminar todas las unidades
    if (removeQuantity >= product.cantidad) {
      carritoService.removeFromCart(chatId.toString(), productIndex);
      bot.sendMessage(chatId, `✅ He eliminado "${product.DescripcionArticulo}" de tu carrito.`);
    } 
    // Si solo se elimina una parte
    else {
      // Actualizar la cantidad en el carrito
      carritoService.updateItemQuantity(chatId.toString(), productIndex, product.cantidad - removeQuantity);
      bot.sendMessage(
        chatId, 
        `✅ He eliminado ${removeQuantity} unidad(es) de "${product.DescripcionArticulo}" de tu carrito.`
      );
    }
    
    // Restablecer estado
    stateService.setState(chatId, stateService.STATES.INITIAL);
    
    // Mostrar el carrito actualizado
    setTimeout(() => {
      handleCartCommand(bot, chatId);
    }, 500);
  } catch (error) {
    console.error("Error al confirmar eliminación:", error);
    bot.sendMessage(chatId, "Hubo un error al eliminar el producto. Por favor, inténtalo de nuevo.");
    stateService.setState(chatId, stateService.STATES.INITIAL);
  }
}



// Modificar en cartController.js

/**
 * Inicia el proceso para añadir unidades a un producto en el carrito
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
 * @param {string|number} productReference - Referencia al producto (nombre o índice)
 */
async function handleStartAddUnits(bot, chatId, productReference) {
  try {
    const carrito = carritoService.getCart(chatId.toString());
    
    if (!carrito || carrito.items.length === 0) {
      return bot.sendMessage(chatId, "Tu carrito está vacío. No hay productos para modificar.");
    }
    
    let productIndex = -1;
    
    // Si es un número, tomarlo como índice (ajustando base-0)
    if (typeof productReference === 'number' || !isNaN(parseInt(productReference))) {
      const index = typeof productReference === 'number' ? productReference : parseInt(productReference);
      if (index > 0 && index <= carrito.items.length) {
        productIndex = index - 1;
      }
    }
    // Si es texto, buscar por nombre
    else if (typeof productReference === 'string') {
      const query = productReference.toLowerCase().trim();
      productIndex = carrito.items.findIndex(item => 
        item.DescripcionArticulo.toLowerCase().includes(query)
      );
    }
    
    // Si no se encontró el producto
    if (productIndex === -1) {
      await handleCartCommand(bot, chatId); // Mostrar carrito
      return bot.sendMessage(
        chatId,
        "No pude identificar el producto. Por favor, indica el número exacto o nombre del producto al que quieres añadir unidades."
      );
    }
    
    // Guardar contexto para el siguiente paso
    console.log(`Guardando en contexto: selectedAddIndex=${productIndex}, producto=${carrito.items[productIndex].DescripcionArticulo}`);
    
    // Primero guardamos los valores específicos
    stateService.setContextValue(chatId, 'selectedAddIndex', productIndex);
    stateService.setContextValue(chatId, 'selectedAddProduct', carrito.items[productIndex]);
    
    // Luego cambiamos el estado - esto debe ir después para no borrar los valores
    stateService.setState(chatId, stateService.STATES.ADDING_UNITS);
    
    // Solicitar la cantidad a añadir
    const producto = carrito.items[productIndex];
    
    bot.sendMessage(
      chatId,
      `Actualmente tienes ${producto.cantidad} unidad(es) de "${producto.DescripcionArticulo}" en tu carrito.\n` +
      `¿Cuántas unidades adicionales quieres añadir?`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "1", callback_data: "add_qty_1" },
              { text: "2", callback_data: "add_qty_2" },
              { text: "5", callback_data: "add_qty_5" }
            ],
            [
              { text: "Otra cantidad", callback_data: "add_qty_custom" }
            ]
          ]
        }
      }
    );
    
  } catch (error) {
    console.error("Error al iniciar proceso de añadir unidades:", error);
    bot.sendMessage(chatId, "Hubo un error al procesar tu solicitud. Por favor, intenta de nuevo.");
    stateService.setState(chatId, stateService.STATES.INITIAL);
  }
}

/**
 * Procesa la cantidad a añadir a un producto
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
 * @param {number|string} quantity - Cantidad a añadir
 */
async function handleAddQuantity(bot, chatId, quantity) {
  try {
    const context = stateService.getContext(chatId);
    console.log("Estado actual del contexto en handleAddQuantity:", JSON.stringify(context, null, 2));
    
    if (context.selectedAddIndex === undefined || context.selectedAddIndex === null) {
      console.log("Error: No se encontró selectedAddIndex en el contexto");
      return bot.sendMessage(chatId, "Ha ocurrido un error al procesar la solicitud. Por favor, inicia de nuevo el proceso de añadir unidades.");
    }
    
    const carrito = carritoService.getCart(chatId.toString());
    if (!carrito || carrito.items.length === 0) {
      return bot.sendMessage(chatId, "Tu carrito está vacío. No hay productos para modificar.");
    }
    
    if (context.selectedAddIndex >= carrito.items.length) {
      return bot.sendMessage(chatId, "El producto seleccionado ya no está en tu carrito.");
    }
    
    const producto = carrito.items[context.selectedAddIndex];
    const cantidadActual = producto.cantidad;
    let cantidadAdicional = 0;
    
    // Procesar la cantidad (desde botón o texto)
    if (quantity === 'custom') {
      // Si eligió "Otra cantidad", cambiar estado y solicitar
      stateService.setState(chatId, stateService.STATES.ASKING_ADD_QUANTITY);
      return bot.sendMessage(
        chatId,
        "Por favor, indica cuántas unidades adicionales quieres añadir:"
      );
    } else {
      // Convertir a número
      cantidadAdicional = parseInt(quantity);
      if (isNaN(cantidadAdicional) || cantidadAdicional <= 0) {
        return bot.sendMessage(
          chatId,
          "Por favor, indica un número válido mayor que cero."
        );
      }
    }
    
    // Verificar stock disponible en la base de datos
    // Importar el modelo de Artículo (asegúrate de tener la ruta correcta)
    const Articulo = require('../models/articulo');
    
    try {
      // Buscar el artículo en la base de datos por su código
      const articuloEnBD = await Articulo.findOne({ CodigoArticulo: producto.CodigoArticulo });
      
      if (!articuloEnBD) {
        return bot.sendMessage(
          chatId,
          `Lo siento, no pude encontrar el producto "${producto.DescripcionArticulo}" en el inventario actual.`
        );
      }
      
      // Verificar si hay suficiente stock
      const stockDisponible = articuloEnBD.unidades || 0;
      const totalDeseado = cantidadActual + cantidadAdicional;
      
      if (totalDeseado > stockDisponible) {
        return bot.sendMessage(
          chatId,
          `Lo siento, solo hay ${stockDisponible} unidad(es) disponibles de este producto.\n` +
          `Ya tienes ${cantidadActual} en tu carrito, por lo que solo puedes añadir ${Math.max(0, stockDisponible - cantidadActual)} más.`
        );
      }
      
      // Si hay suficiente stock, actualizar la cantidad del producto
      producto.cantidad = totalDeseado;
      
      // Guardar cambios en el carrito
      carritoService.updateCartItem(chatId.toString(), context.selectedAddIndex, producto);
      
      // Notificar al usuario
      bot.sendMessage(
        chatId,
        `✅ He añadido ${cantidadAdicional} unidad(es) adicionales de "${producto.DescripcionArticulo}" a tu carrito.\n` +
        `Ahora tienes un total de ${producto.cantidad} unidad(es) de ${stockDisponible} disponibles.`
      );
      
      // Mostrar carrito actualizado
      await handleCartCommand(bot, chatId);
      
      // Resetear estado
      stateService.setState(chatId, stateService.STATES.INITIAL);
      
    } catch (dbError) {
      console.error("Error al verificar stock en base de datos:", dbError);
      return bot.sendMessage(
        chatId,
        "Hubo un problema al verificar la disponibilidad del producto. Por favor, intenta de nuevo más tarde."
      );
    }
    
  } catch (error) {
    console.error("Error al añadir unidades:", error);
    bot.sendMessage(chatId, "Hubo un error al añadir unidades. Por favor, intenta de nuevo.");
    stateService.setState(chatId, stateService.STATES.INITIAL);
  }
}

/**
 * Inicia el proceso de vaciado del carrito
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
 */
async function handleStartClearCart(bot, chatId) {
  try {
    const carrito = carritoService.getCart(chatId.toString());
    
    if (!carrito || carrito.items.length === 0) {
      return bot.sendMessage(chatId, "Tu carrito ya está vacío.");
    }
    
    stateService.setState(chatId, stateService.STATES.CONFIRMING_REMOVE_ALL);
    
    return bot.sendMessage(
      chatId,
      "⚠️ ¿Estás seguro de que quieres vaciar completamente tu carrito? Esta acción no se puede deshacer.",
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Sí, vaciar carrito", callback_data: "confirm_clear_cart" },
              { text: "❌ No, cancelar", callback_data: "cancel_clear_cart" }
            ]
          ]
        }
      }
    );
  } catch (error) {
    console.error("Error al iniciar vaciado del carrito:", error);
    bot.sendMessage(chatId, "Hubo un error al procesar tu solicitud. Por favor, inténtalo de nuevo.");
  }
}

/**
 * Actualiza la cantidad de un elemento en el carrito
 * @param {string} telegramId - ID de Telegram del usuario
 * @param {number} itemIndex - Índice del ítem
 * @param {number} newQuantity - Nueva cantidad
 * @returns {object} - Carrito actualizado
 */
function updateItemQuantity(telegramId, itemIndex, newQuantity) {
  try {
    const carrito = carritoService.getCart(telegramId);
    if (!carrito || !carrito.items[itemIndex]) {
      throw new Error("Ítem no encontrado");
    }
    
    // Actualizar la cantidad
    if (newQuantity <= 0) {
      // Si es 0 o menos, eliminar el ítem
      carritoService.removeFromCart(telegramId, itemIndex);
    } else {
      // Si es mayor a 0, actualizar cantidad
      carrito.items[itemIndex].cantidad = newQuantity;
      carrito.updatedAt = new Date().toISOString();
    }
    
    return carrito;
  } catch (error) {
    console.error("Error al actualizar cantidad:", error);
    throw error;
  }
}

module.exports = {
  handleCartCommand,
  handleExportCartCommand,
  handleRemoveFromCartCommand,
  handleClearCartCommand,
  addToCart,
  handleStartRemoveItem,
  handleRemoveQuantity,
  handleConfirmRemove,
  handleStartClearCart,
  handleAddQuantity,
  handleStartAddUnits,
  updateItemQuantity,
};