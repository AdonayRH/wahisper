// Controlador para manejar el proceso de tramitación del pedido
const carritoService = require('../services/carritoService');
const buttonGeneratorService = require('../services/buttonGeneratorService');
const stateService = require('../services/botStateService');
const orderService = require('../services/orderService');
const inventoryService = require('../services/inventoryService');

/**
 * Actualizar la función handleCheckout para mejorar la experiencia del usuario
*/
async function handleCheckout(bot, chatId) {
  try {
    console.log(`Procesando solicitud de checkout para usuario ${chatId}`);
    const carrito = carritoService.getCart(chatId.toString());
    
    if (!carrito || carrito.items.length === 0) {
      return bot.sendMessage(
        chatId, 
        "Tu carrito está vacío. Agrega productos antes de tramitar tu pedido.",
        buttonGeneratorService.generateEmptyCartButtons()
      );
    }
    
    // Mostrar mensaje de procesamiento
    const processingMsg = await bot.sendMessage(
      chatId,
      "⏳ Preparando tu pedido, un momento por favor..."
    );
    
    // Verificar stock antes de proceder
    const stockVerification = await inventoryService.verifyStock(carrito.items);
    
    // Borrar mensaje de procesamiento
    await bot.deleteMessage(chatId, processingMsg.message_id)
      .catch(err => console.error("Error al borrar mensaje de procesamiento:", err));
    
    if (!stockVerification.success) {
      // Si hay productos sin stock suficiente, informar al usuario
      let mensaje = "❌ *No hay suficiente stock para algunos productos:*\n\n";
      
      stockVerification.insufficientItems.forEach(item => {
        mensaje += `• ${item.descripcion}\n`;
        mensaje += `  Solicitaste: ${item.cantidadSolicitada}, Disponible: ${item.cantidadDisponible}\n`;
      });
      
      mensaje += "\nPor favor, ajusta las cantidades en tu carrito antes de continuar.";
      
      return bot.sendMessage(
        chatId,
        mensaje,
        { 
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🛒 Volver al carrito", callback_data: "view_cart" }]
            ]
          }
        }
      );
    }
    
    // Calcular el total con formato de moneda
    let total = 0;
    carrito.items.forEach(item => {
      const precio = parseFloat(item.precio) || 0;
      const cantidad = parseInt(item.cantidad) || 0;
      total += precio * cantidad;
    });
    
    // Crear resumen detallado del pedido con emojis para mejor visualización
    let mensaje = `🛍️ *Resumen de tu pedido:*\n\n`;
    
    carrito.items.forEach((item, index) => {
      const precio = parseFloat(item.precio) || 0;
      const cantidad = parseInt(item.cantidad) || 0;
      const subtotal = precio * cantidad;
      
      mensaje += `${index + 1}. ${item.DescripcionArticulo}\n` +
                `   ${cantidad} x ${precio.toFixed(2)}€ = ${subtotal.toFixed(2)}€\n`;
    });
    
    mensaje += `\n💰 *Total a pagar: ${total.toFixed(2)}€*\n\n` +
              `¿Deseas confirmar este pedido?`;
    
    // Enviar mensaje con botones de confirmación
    await bot.sendMessage(
      chatId, 
      mensaje,
      { 
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Confirmar pedido", callback_data: "confirm_checkout" },
              { text: "❌ Cancelar", callback_data: "cancel_checkout" }
            ],
            [
              { text: "🛒 Modificar carrito", callback_data: "view_cart" }
            ]
          ]
        }
      }
    );
    
    // Establecer estado
    stateService.setState(chatId, stateService.STATES.CONFIRMING_CHECKOUT);
    console.log(`Usuario ${chatId} en estado CONFIRMING_CHECKOUT`);
  } catch (error) {
    console.error("Error al tramitar pedido:", error);
    bot.sendMessage(chatId, "Hubo un error al tramitar tu pedido. Por favor, inténtalo de nuevo.");
  }
}

/**
 * Maneja la confirmación del pedido
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
*/
async function handleConfirmCheckout(bot, chatId) {
  try {
    const carrito = carritoService.getCart(chatId.toString());
    
    if (!carrito || carrito.items.length === 0) {
      return bot.sendMessage(chatId, "Tu carrito está vacío. No hay nada que confirmar.");
    }
    
    // Mensaje de procesamiento
    const processingMsg = await bot.sendMessage(
      chatId,
      "⏳ Procesando tu pedido. Por favor, espera un momento..."
    );
    
    // Intentar crear el pedido
    try {
      const orderResult = await orderService.createOrder(
        chatId.toString(),
        carrito.items,
        carrito.userData || { id: chatId.toString() }
      );
      
      // Borrar mensaje de procesamiento
      await bot.deleteMessage(chatId, processingMsg.message_id)
        .catch(err => console.error("Error al borrar mensaje de procesamiento:", err));
      
      if (!orderResult.success) {
        // Si hay error en la creación del pedido
        let errorMsg = "❌ *No se pudo completar tu pedido*\n\n";
        
        if (orderResult.insufficientItems && orderResult.insufficientItems.length > 0) {
          errorMsg += "No hay suficiente stock para los siguientes productos:\n\n";
          
          orderResult.insufficientItems.forEach(item => {
            errorMsg += `• ${item.descripcion}\n`;
            errorMsg += `  Solicitaste: ${item.cantidadSolicitada}, Disponible: ${item.cantidadDisponible}\n`;
          });
          
          errorMsg += "\nPor favor, ajusta las cantidades en tu carrito e intenta nuevamente.";
        } else {
          errorMsg += orderResult.message || "Ocurrió un error al procesar el pedido.";
        }
        
        await bot.sendMessage(
          chatId,
          errorMsg,
          { 
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🛒 Volver al carrito", callback_data: "view_cart" }]
              ]
            }
          }
        );
        
        return;
      }
      
      // Pedido creado exitosamente
      const mensaje = `🎉 *¡Pedido #${orderResult.orderNumber} confirmado!*\n\n` +
                     `Gracias por tu compra. Tu pedido ha sido registrado con éxito.\n\n` +
                     `*Total:* ${orderResult.total.toFixed(2)}€\n\n` +
                     `Recibirás un correo electrónico con los detalles de tu pedido y las instrucciones para realizar el pago.\n\n` +
                     `¿Hay algo más en lo que pueda ayudarte?`;
      
      // Enviar mensaje con botones post-checkout
      await bot.sendMessage(
        chatId,
        mensaje,
        { 
          parse_mode: "Markdown",
          ...buttonGeneratorService.generatePostCheckoutButtons()
        }
      );
      
      // Vaciar carrito después de confirmar
      carritoService.clearCart(chatId.toString());
      
      // Establecer estado
      stateService.setState(chatId, stateService.STATES.CHECKOUT_COMPLETED);
      
    } catch (orderError) {
      // Borrar mensaje de procesamiento
      await bot.deleteMessage(chatId, processingMsg.message_id)
        .catch(err => console.error("Error al borrar mensaje de procesamiento:", err));
      
      console.error("Error al crear pedido:", orderError);
      
      await bot.sendMessage(
        chatId,
        "❌ Ha ocurrido un error técnico al procesar tu pedido. Por favor, inténtalo más tarde o contacta con soporte."
      );
    }
  } catch (error) {
    console.error("Error al confirmar pedido:", error);
    bot.sendMessage(chatId, "Hubo un error al confirmar tu pedido. Por favor, inténtalo de nuevo.");
  }
}

/**
 * Maneja la cancelación del proceso de checkout
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
*/
async function handleCancelCheckout(bot, chatId) {
  try {
    const carrito = carritoService.getCart(chatId.toString());
    const itemCount = carrito && carrito.items ? carrito.items.length : 0;
    
    // Enviar mensaje de cancelación
    await bot.sendMessage(
      chatId,
      "Proceso de compra cancelado. ¿Deseas hacer algún cambio en tu carrito?",
      buttonGeneratorService.generateCartButtons(itemCount)
    );
    
    // Restablecer estado
    stateService.setState(chatId, stateService.STATES.INITIAL);
  } catch (error) {
    console.error("Error al cancelar checkout:", error);
    bot.sendMessage(chatId, "Hubo un error al procesar tu solicitud. Por favor, inténtalo de nuevo.");
  }
}

/**
 * Maneja la visualización de pedidos del usuario
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
*/
async function handleViewOrders(bot, chatId) {
  try {
    // Obtener pedidos recientes del usuario
    const orders = await orderService.getUserOrders(chatId.toString(), 5);
    
    if (!orders || orders.length === 0) {
      return bot.sendMessage(
        chatId,
        "No tienes pedidos recientes. ¿Te gustaría realizar una compra?",
        { 
          reply_markup: {
            inline_keyboard: [
              [{ text: "🛍️ Nueva compra", callback_data: "new_purchase" }]
            ]
          }
        }
      );
    }
    
    // Crear mensaje con lista de pedidos
    let mensaje = "📋 *Tus pedidos recientes:*\n\n";
    
    orders.forEach(order => {
      const date = new Date(order.createdAt);
      const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
      
      mensaje += `*Pedido #${order.orderNumber}*\n`;
      mensaje += `Fecha: ${formattedDate}\n`;
      mensaje += `Estado: ${getStatusText(order.status)}\n`;
      mensaje += `Total: ${order.total.toFixed(2)}€\n`;
      mensaje += `Productos: ${order.items.length}\n\n`;
    });
    
    mensaje += "¿Deseas realizar una nueva compra?";
    
    // Enviar mensaje con botones
    await bot.sendMessage(
      chatId,
      mensaje,
      { 
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🛍️ Nueva compra", callback_data: "new_purchase" }]
          ]
        }
      }
    );
  } catch (error) {
    console.error("Error al mostrar pedidos:", error);
    bot.sendMessage(chatId, "Hubo un error al obtener tus pedidos. Por favor, inténtalo de nuevo más tarde.");
  }
}

/**
 * Inicia un nuevo proceso de compra
 * @param {object} bot - Instancia del bot
 * @param {number} chatId - ID del chat
*/
async function handleNewPurchase(bot, chatId) {
  try {
    // Restablecer estado
    stateService.setState(chatId, stateService.STATES.INITIAL);
    
    // Mensaje de bienvenida para nueva compra
    await bot.sendMessage(
      chatId,
      "¡Perfecto! ¿Qué te gustaría comprar? Puedes indicarme el tipo de producto que buscas."
    );
  } catch (error) {
    console.error("Error al iniciar nueva compra:", error);
    bot.sendMessage(chatId, "Hubo un error al procesar tu solicitud. Por favor, inténtalo de nuevo.");
  }
}

/**
 * Obtiene el texto descriptivo del estado de un pedido
 * @param {string} status - Estado del pedido
 * @returns {string} - Texto descriptivo
*/
function getStatusText(status) {
  const statusMap = {
    'PENDIENTE': '⏳ Pendiente',
    'PAGADO': '💰 Pagado',
    'ENVIADO': '🚚 Enviado',
    'ENTREGADO': '✅ Entregado',
    'CANCELADO': '❌ Cancelado'
  };
  
  return statusMap[status] || status;
}

module.exports = {
  handleCheckout,
  handleConfirmCheckout,
  handleCancelCheckout,
  handleNewPurchase,
  handleViewOrders
};