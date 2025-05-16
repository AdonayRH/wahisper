// Maneja las funciones relacionadas con añadir productos al carrito

const carritoService = require('../../services/carritoService');
const stateService = require('../../services/botStateService');
const buttonGeneratorService = require('../../services/buttonGeneratorService');
const displayModule = require('./displayModule');
const logger = require('../../utils/logger');

const STATES = stateService.STATES;

/**
 * Añade un producto al carrito verificando el stock disponible
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {object} product - Producto a añadir
 * @param {number} quantity - Cantidad
 * @returns {boolean} - Indica si se añadió correctamente
 */
async function addToCart(bot, chatId, product, quantity) {
  try {
    // Verificar stock disponible
    const Articulo = require('../../models/articulo');
    const articuloEnBD = await Articulo.findOne({ CodigoArticulo: product.CodigoArticulo });
    
    if (!articuloEnBD) {
      logger.log(`Usuario ${chatId}: Producto no encontrado - ${product.DescripcionArticulo}`);
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
      logger.log(`Usuario ${chatId}: Stock insuficiente para ${product.DescripcionArticulo}`);
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
    logger.log(`Usuario ${chatId}: Añadidos ${quantity} de ${product.DescripcionArticulo} al carrito`);
    
    // Notificar al usuario
    bot.sendMessage(
      chatId,
      `✅ He añadido ${quantity} unidad(es) de "${product.DescripcionArticulo}" a tu carrito.\n\n¿Deseas algo más?`,
      buttonGeneratorService.generatePostAddButtons()
    );
    
    return true;
  } catch (error) {
    logger.error(`Error al añadir al carrito para usuario ${chatId}: ${error.message}`);
    bot.sendMessage(chatId, "Hubo un error al añadir el producto al carrito. Inténtalo de nuevo.");
    return false;
  }
}

/**
 * Inicia el proceso para añadir unidades a un producto en el carrito
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {string|number} productReference - Referencia al producto (nombre o índice)
 * @returns {Promise} - Promesa de la operación
 */
async function handleStartAddUnits(bot, chatId, productReference) {
  try {
    const carrito = carritoService.getCart(chatId.toString());
    
    if (!carrito || carrito.items.length === 0) {
      logger.log(`Usuario ${chatId}: Intento de añadir unidades a carrito vacío`);
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
      logger.log(`Usuario ${chatId}: Producto no encontrado para añadir unidades - ${productReference}`);
      await displayModule.handleCartCommand(bot, chatId); // Mostrar carrito
      return bot.sendMessage(
        chatId,
        "No pude identificar el producto. Por favor, indica el número exacto o nombre del producto al que quieres añadir unidades."
      );
    }
    
    // Guardar contexto para el siguiente paso
    logger.log(`Usuario ${chatId}: Iniciando adición de unidades para producto ${productIndex}`);
    
    // Primero guardamos los valores específicos
    stateService.setContextValue(chatId, 'selectedAddIndex', productIndex);
    stateService.setContextValue(chatId, 'selectedAddProduct', carrito.items[productIndex]);
    
    // Luego cambiamos el estado - esto debe ir después para no borrar los valores
    stateService.setState(chatId, STATES.ADDING_UNITS);
    
    // Solicitar la cantidad a añadir
    const producto = carrito.items[productIndex];
    
    return bot.sendMessage(
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
    logger.error(`Error al iniciar proceso de añadir unidades para usuario ${chatId}: ${error.message}`);
    bot.sendMessage(chatId, "Hubo un error al procesar tu solicitud. Por favor, intenta de nuevo.");
    stateService.setState(chatId, STATES.INITIAL);
    return null;
  }
}

/**
 * Procesa la cantidad a añadir a un producto
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {number|string} quantity - Cantidad a añadir
 * @returns {Promise} - Promesa de la operación
 */
async function handleAddQuantity(bot, chatId, quantity) {
  try {
    const context = stateService.getContext(chatId);
    logger.log(`Estado actual del contexto en handleAddQuantity para ${chatId}: ${JSON.stringify(context.state)}`);
    
    if (context.selectedAddIndex === undefined || context.selectedAddIndex === null) {
      logger.error(`Error: No se encontró selectedAddIndex en el contexto para usuario ${chatId}`);
      return bot.sendMessage(chatId, "Ha ocurrido un error al procesar tu solicitud. Por favor, inicia de nuevo el proceso de añadir unidades.");
    }
    
    const carrito = carritoService.getCart(chatId.toString());
    if (!carrito || carrito.items.length === 0) {
      logger.log(`Usuario ${chatId}: Carrito vacío al intentar añadir cantidad`);
      return bot.sendMessage(chatId, "Tu carrito está vacío. No hay productos para modificar.");
    }
    
    if (context.selectedAddIndex >= carrito.items.length) {
      logger.log(`Usuario ${chatId}: Índice de producto inválido al añadir unidades`);
      return bot.sendMessage(chatId, "El producto seleccionado ya no está en tu carrito.");
    }
    
    const producto = carrito.items[context.selectedAddIndex];
    const cantidadActual = producto.cantidad;
    let cantidadAdicional = 0;
    
    // Procesar la cantidad (desde botón o texto)
    if (quantity === 'custom') {
      // Si eligió "Otra cantidad", cambiar estado y solicitar
      stateService.setState(chatId, STATES.ASKING_ADD_QUANTITY);
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
    const Articulo = require('../../models/articulo');
    
    try {
      // Buscar el artículo en la base de datos por su código
      const articuloEnBD = await Articulo.findOne({ CodigoArticulo: producto.CodigoArticulo });
      
      if (!articuloEnBD) {
        logger.log(`Usuario ${chatId}: Producto no encontrado en BD al añadir unidades - ${producto.DescripcionArticulo}`);
        return bot.sendMessage(
          chatId,
          `Lo siento, no pude encontrar el producto "${producto.DescripcionArticulo}" en el inventario actual.`
        );
      }
      
      // Verificar si hay suficiente stock
      const stockDisponible = articuloEnBD.unidades || 0;
      const totalDeseado = cantidadActual + cantidadAdicional;
      
      if (totalDeseado > stockDisponible) {
        logger.log(`Usuario ${chatId}: Stock insuficiente al añadir unidades - ${producto.DescripcionArticulo}`);
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
      logger.log(`Usuario ${chatId}: Añadidas ${cantidadAdicional} unidades de ${producto.DescripcionArticulo}`);
      
      // Notificar al usuario
      await bot.sendMessage(
        chatId,
        `✅ He añadido ${cantidadAdicional} unidad(es) adicionales de "${producto.DescripcionArticulo}" a tu carrito.\n` +
        `Ahora tienes un total de ${producto.cantidad} unidad(es) de ${stockDisponible} disponibles.`
      );
      
      // Mostrar carrito actualizado
      await displayModule.handleCartCommand(bot, chatId);
      
      // Resetear estado
      stateService.setState(chatId, STATES.INITIAL);
      
      return true;
      
    } catch (dbError) {
      logger.error(`Error al verificar stock en base de datos para usuario ${chatId}: ${dbError.message}`);
      return bot.sendMessage(
        chatId,
        "Hubo un problema al verificar la disponibilidad del producto. Por favor, intenta de nuevo más tarde."
      );
    }
    
  } catch (error) {
    logger.error(`Error al añadir unidades para usuario ${chatId}: ${error.message}`);
    bot.sendMessage(chatId, "Hubo un error al añadir unidades. Por favor, intenta de nuevo.");
    stateService.setState(chatId, STATES.INITIAL);
    return false;
  }
}

module.exports = {
  addToCart,
  handleStartAddUnits,
  handleAddQuantity
};