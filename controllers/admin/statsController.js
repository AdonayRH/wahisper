// Controlador para gestionar estadísticas del bot
const Pedido = require('../../models/pedido');
const User = require('../../models/user');
const Articulo = require('../../models/articulo');
const buttonService = require('../../services/buttonGeneratorService');
const logger = require('../../utils/logger');

/**
 * Muestra el panel principal de estadísticas
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @returns {Promise} - Promesa de la operación
*/
async function showStatsPanel(bot, chatId) {
  try {
    // Mostrar panel principal de estadísticas
    const message = "📊 *Panel de Estadísticas*\n\n" +
                   "Selecciona el tipo de estadísticas que deseas visualizar:";
    
    return bot.sendMessage(
      chatId,
      message,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📋 Resumen General", callback_data: "admin_stats_summary" }],
            [{ text: "🛒 Pedidos Pendientes", callback_data: "admin_stats_pending" }],
            [{ text: "✅ Pedidos Completados", callback_data: "admin_stats_completed" }],
            [{ text: "❌ Pedidos Cancelados", callback_data: "admin_stats_canceled" }],
            [{ text: "📦 Inventario", callback_data: "admin_stats_inventory" }],
            [{ text: "👥 Usuarios", callback_data: "admin_stats_users" }],
            [{ text: "📊 Exportar Datos", callback_data: "admin_stats_export" }],
            [{ text: "⬅️ Volver", callback_data: "admin_back" }]
          ]
        }
      }
    );
  } catch (error) {
    logger.error(`Error al mostrar panel de estadísticas: ${error.message}`);
    return bot.sendMessage(
      chatId,
      "❌ Ha ocurrido un error al cargar las estadísticas. Por favor, intenta de nuevo."
    );
  }
}

/**
 * Muestra el resumen general de estadísticas
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @returns {Promise} - Promesa de la operación
*/
async function showStatsSummary(bot, chatId) {
  try {
    // Indicar que estamos procesando
    const processingMsg = await bot.sendMessage(
      chatId,
      "⏳ Procesando estadísticas generales... Esto puede tomar unos momentos."
    );

    // Obtener estadísticas generales
    const [
      totalPedidos,
      pedidosPendientes,
      pedidosPagados,
      pedidosEnviados,
      pedidosEntregados,
      pedidosCancelados,
      totalUsuarios,
      totalProductos,
      productosAgotados,
      ingresosTotales
    ] = await Promise.all([
      Pedido.countDocuments({}),
      Pedido.countDocuments({ status: 'PENDIENTE' }),
      Pedido.countDocuments({ status: 'PAGADO' }),
      Pedido.countDocuments({ status: 'ENVIADO' }),
      Pedido.countDocuments({ status: 'ENTREGADO' }),
      Pedido.countDocuments({ status: 'CANCELADO' }),
      User.countDocuments({}),
      Articulo.countDocuments({}),
      Articulo.countDocuments({ unidades: 0 }),
      Pedido.aggregate([
        { $match: { status: { $in: ['PAGADO', 'ENVIADO', 'ENTREGADO'] } } },
        { $group: { _id: null, total: { $sum: "$total" } } }
      ]).then(result => result.length > 0 ? result[0].total : 0)
    ]);

    // Calcular porcentajes
    const pctPendientes = totalPedidos > 0 ? ((pedidosPendientes / totalPedidos) * 100).toFixed(1) : 0;
    const pctCompletados = totalPedidos > 0 ? (((pedidosPagados + pedidosEnviados + pedidosEntregados) / totalPedidos) * 100).toFixed(1) : 0;
    const pctCancelados = totalPedidos > 0 ? ((pedidosCancelados / totalPedidos) * 100).toFixed(1) : 0;
    const pctAgotados = totalProductos > 0 ? ((productosAgotados / totalProductos) * 100).toFixed(1) : 0;

    // Eliminar mensaje de procesamiento
    await bot.deleteMessage(chatId, processingMsg.message_id).catch(err => {
      logger.error(`Error al eliminar mensaje de procesamiento: ${err.message}`);
    });

    // Formación del mensaje de estadísticas
    const message = "📊 *Resumen General*\n\n" +
                   "*Pedidos*\n" +
                   `Total: ${totalPedidos}\n` +
                   `⏳ Pendientes: ${pedidosPendientes} (${pctPendientes}%)\n` +
                   `✅ Completados: ${pedidosPagados + pedidosEnviados + pedidosEntregados} (${pctCompletados}%)\n` +
                   `❌ Cancelados: ${pedidosCancelados} (${pctCancelados}%)\n\n` +
                   "*Usuarios*\n" +
                   `👥 Total: ${totalUsuarios}\n\n` +
                   "*Inventario*\n" +
                   `📦 Total productos: ${totalProductos}\n` +
                   `⚠️ Productos agotados: ${productosAgotados} (${pctAgotados}%)\n\n` +
                   "*Ingresos*\n" +
                   `💰 Total ingresos: ${ingresosTotales.toFixed(2)}€\n`;

    return bot.sendMessage(
      chatId,
      message,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔄 Actualizar", callback_data: "admin_stats_summary" }],
            [{ text: "⬅️ Volver a Estadísticas", callback_data: "admin_stats" }]
          ]
        }
      }
    );
  } catch (error) {
    logger.error(`Error al mostrar resumen de estadísticas: ${error.message}`);
    return bot.sendMessage(
      chatId,
      "❌ Ha ocurrido un error al cargar las estadísticas. Por favor, intenta de nuevo."
    );
  }
}

/**
 * Muestra estadísticas de pedidos pendientes
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @returns {Promise} - Promesa de la operación
*/
async function showPendingOrdersStats(bot, chatId) {
  try {
    // Indicar que estamos procesando
    const processingMsg = await bot.sendMessage(
      chatId,
      "⏳ Procesando estadísticas de pedidos pendientes..."
    );

    // Obtener pedidos pendientes más recientes
    const pendingOrders = await Pedido.find({ status: 'PENDIENTE' })
      .sort({ createdAt: -1 })
      .limit(10);
    
    const totalPending = await Pedido.countDocuments({ status: 'PENDIENTE' });
    
    // Calcular total de pedidos pendientes
    const pendingTotalAmount = await Pedido.aggregate([
      { $match: { status: 'PENDIENTE' } },
      { $group: { _id: null, total: { $sum: "$total" } } }
    ]).then(result => result.length > 0 ? result[0].total : 0);

    // Eliminar mensaje de procesamiento
    await bot.deleteMessage(chatId, processingMsg.message_id).catch(err => {
      logger.error(`Error al eliminar mensaje de procesamiento: ${err.message}`);
    });

    if (pendingOrders.length === 0) {
      return bot.sendMessage(
        chatId,
        "📋 *Pedidos Pendientes*\n\n" +
        "No hay pedidos pendientes actualmente.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "⬅️ Volver a Estadísticas", callback_data: "admin_stats" }]
            ]
          }
        }
      );
    }

    // Crear mensaje con los pedidos pendientes
    let message = "📋 *Pedidos Pendientes*\n\n" +
                 `Total: ${totalPending} pedidos\n` +
                 `Valor total: ${pendingTotalAmount.toFixed(2)}€\n\n` +
                 "*Últimos 10 pedidos pendientes:*\n\n";

    pendingOrders.forEach((order, index) => {
      const orderDate = new Date(order.createdAt);
      const formattedDate = `${orderDate.getDate()}/${orderDate.getMonth() + 1}/${orderDate.getFullYear()}`;
      
      message += `${index + 1}. *Pedido #${order.orderNumber}*\n` +
                `📅 Fecha: ${formattedDate}\n` +
                `👤 Usuario: ${order.userData?.first_name || 'N/A'}` +
                `${order.userData?.username ? ` (@${order.userData.username})` : ''}\n` +
                `🛒 Productos: ${order.items.length}\n` +
                `💰 Total: ${order.total.toFixed(2)}€\n\n`;
    });

    return bot.sendMessage(
      chatId,
      message,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔄 Actualizar", callback_data: "admin_stats_pending" }],
            [{ text: "📊 Ver Todos", callback_data: "admin_stats_pending_all" }],
            [{ text: "⬅️ Volver a Estadísticas", callback_data: "admin_stats" }]
          ]
        }
      }
    );
  } catch (error) {
    logger.error(`Error al mostrar estadísticas de pedidos pendientes: ${error.message}`);
    return bot.sendMessage(
      chatId,
      "❌ Ha ocurrido un error al cargar las estadísticas. Por favor, intenta de nuevo."
    );
  }
}

/**
 * Muestra estadísticas de pedidos completados
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @returns {Promise} - Promesa de la operación
*/
async function showCompletedOrdersStats(bot, chatId) {
  try {
    // Indicar que estamos procesando
    const processingMsg = await bot.sendMessage(
      chatId,
      "⏳ Procesando estadísticas de pedidos completados..."
    );

    // Obtener pedidos completados (pagados, enviados, entregados)
    const completedOrders = await Pedido.find({ 
      status: { $in: ['PAGADO', 'ENVIADO', 'ENTREGADO'] } 
    })
      .sort({ createdAt: -1 })
      .limit(10);
    
    const totalPagados = await Pedido.countDocuments({ status: 'PAGADO' });
    const totalEnviados = await Pedido.countDocuments({ status: 'ENVIADO' });
    const totalEntregados = await Pedido.countDocuments({ status: 'ENTREGADO' });
    const totalCompletados = totalPagados + totalEnviados + totalEntregados;
    
    // Calcular total de ingresos
    const totalAmount = await Pedido.aggregate([
      { $match: { status: { $in: ['PAGADO', 'ENVIADO', 'ENTREGADO'] } } },
      { $group: { _id: null, total: { $sum: "$total" } } }
    ]).then(result => result.length > 0 ? result[0].total : 0);

    // Eliminar mensaje de procesamiento
    await bot.deleteMessage(chatId, processingMsg.message_id).catch(err => {
      logger.error(`Error al eliminar mensaje de procesamiento: ${err.message}`);
    });

    if (completedOrders.length === 0) {
      return bot.sendMessage(
        chatId,
        "✅ *Pedidos Completados*\n\n" +
        "No hay pedidos completados actualmente.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "⬅️ Volver a Estadísticas", callback_data: "admin_stats" }]
            ]
          }
        }
      );
    }

    // Crear mensaje con los pedidos completados
    let message = "✅ *Pedidos Completados*\n\n" +
                 `Total: ${totalCompletados} pedidos\n` +
                 `💰 Pagados: ${totalPagados}\n` +
                 `🚚 Enviados: ${totalEnviados}\n` +
                 `📦 Entregados: ${totalEntregados}\n` +
                 `💵 Ingresos totales: ${totalAmount.toFixed(2)}€\n\n` +
                 "*Últimos 10 pedidos completados:*\n\n";

    completedOrders.forEach((order, index) => {
      const orderDate = new Date(order.createdAt);
      const formattedDate = `${orderDate.getDate()}/${orderDate.getMonth() + 1}/${orderDate.getFullYear()}`;
      
      const statusMap = {
        'PAGADO': '💰 Pagado',
        'ENVIADO': '🚚 Enviado',
        'ENTREGADO': '📦 Entregado'
      };
      
      message += `${index + 1}. *Pedido #${order.orderNumber}*\n` +
                `📅 Fecha: ${formattedDate}\n` +
                `📊 Estado: ${statusMap[order.status]}\n` +
                `👤 Usuario: ${order.userData?.first_name || 'N/A'}` +
                `${order.userData?.username ? ` (@${order.userData.username})` : ''}\n` +
                `🛒 Productos: ${order.items.length}\n` +
                `💰 Total: ${order.total.toFixed(2)}€\n\n`;
    });

    return bot.sendMessage(
      chatId,
      message,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔄 Actualizar", callback_data: "admin_stats_completed" }],
            [{ text: "📊 Ver Todos", callback_data: "admin_stats_completed_all" }],
            [{ text: "⬅️ Volver a Estadísticas", callback_data: "admin_stats" }]
          ]
        }
      }
    );
  } catch (error) {
    logger.error(`Error al mostrar estadísticas de pedidos completados: ${error.message}`);
    return bot.sendMessage(
      chatId,
      "❌ Ha ocurrido un error al cargar las estadísticas. Por favor, intenta de nuevo."
    );
  }
}

/**
 * Muestra estadísticas de pedidos cancelados
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @returns {Promise} - Promesa de la operación
*/
async function showCanceledOrdersStats(bot, chatId) {
  try {
    // Indicar que estamos procesando
    const processingMsg = await bot.sendMessage(
      chatId,
      "⏳ Procesando estadísticas de pedidos cancelados..."
    );

    // Obtener pedidos cancelados
    const canceledOrders = await Pedido.find({ status: 'CANCELADO' })
      .sort({ createdAt: -1 })
      .limit(10);
    
    const totalCanceled = await Pedido.countDocuments({ status: 'CANCELADO' });
    
    // Calcular total perdido en pedidos cancelados
    const canceledTotalAmount = await Pedido.aggregate([
      { $match: { status: 'CANCELADO' } },
      { $group: { _id: null, total: { $sum: "$total" } } }
    ]).then(result => result.length > 0 ? result[0].total : 0);

    // Eliminar mensaje de procesamiento
    await bot.deleteMessage(chatId, processingMsg.message_id).catch(err => {
      logger.error(`Error al eliminar mensaje de procesamiento: ${err.message}`);
    });

    if (canceledOrders.length === 0) {
      return bot.sendMessage(
        chatId,
        "❌ *Pedidos Cancelados*\n\n" +
        "No hay pedidos cancelados actualmente.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "⬅️ Volver a Estadísticas", callback_data: "admin_stats" }]
            ]
          }
        }
      );
    }

    // Crear mensaje con los pedidos cancelados
    let message = "❌ *Pedidos Cancelados*\n\n" +
                 `Total: ${totalCanceled} pedidos\n` +
                 `Valor total perdido: ${canceledTotalAmount.toFixed(2)}€\n\n` +
                 "*Últimos 10 pedidos cancelados:*\n\n";

    canceledOrders.forEach((order, index) => {
      const orderDate = new Date(order.createdAt);
      const formattedDate = `${orderDate.getDate()}/${orderDate.getMonth() + 1}/${orderDate.getFullYear()}`;
      
      message += `${index + 1}. *Pedido #${order.orderNumber}*\n` +
                `📅 Fecha: ${formattedDate}\n` +
                `👤 Usuario: ${order.userData?.first_name || 'N/A'}` +
                `${order.userData?.username ? ` (@${order.userData.username})` : ''}\n` +
                `🛒 Productos: ${order.items.length}\n` +
                `💰 Total: ${order.total.toFixed(2)}€\n\n`;
    });

    return bot.sendMessage(
      chatId,
      message,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔄 Actualizar", callback_data: "admin_stats_canceled" }],
            [{ text: "📊 Ver Todos", callback_data: "admin_stats_canceled_all" }],
            [{ text: "⬅️ Volver a Estadísticas", callback_data: "admin_stats" }]
          ]
        }
      }
    );
  } catch (error) {
    logger.error(`Error al mostrar estadísticas de pedidos cancelados: ${error.message}`);
    return bot.sendMessage(
      chatId,
      "❌ Ha ocurrido un error al cargar las estadísticas. Por favor, intenta de nuevo."
    );
  }
}

/**
 * Muestra estadísticas de inventario
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @returns {Promise} - Promesa de la operación
*/
async function showInventoryStats(bot, chatId) {
  try {
    // Indicar que estamos procesando
    const processingMsg = await bot.sendMessage(
      chatId,
      "⏳ Procesando estadísticas de inventario..."
    );

    // Obtener estadísticas de inventario
    const totalProducts = await Articulo.countDocuments({});
    const outOfStockProducts = await Articulo.countDocuments({ unidades: 0 });
    const lowStockProducts = await Articulo.countDocuments({ 
      unidades: { $gt: 0, $lte: 5 } 
    });
    
    // Productos más vendidos (pendiente implementar campo de ventas en Articulo)
    
    // Productos con mayor valor en inventario
    const highValueProducts = await Articulo.find({})
      .sort({ PVP: -1 })
      .limit(5);
    
    // Valor total del inventario
    const inventoryValue = await Articulo.aggregate([
      { $project: { 
        totalValue: { $multiply: ["$PVP", "$unidades"] } 
      }},
      { $group: { 
        _id: null, 
        total: { $sum: "$totalValue" } 
      }}
    ]).then(result => result.length > 0 ? result[0].total : 0);

    // Eliminar mensaje de procesamiento
    await bot.deleteMessage(chatId, processingMsg.message_id).catch(err => {
      logger.error(`Error al eliminar mensaje de procesamiento: ${err.message}`);
    });

    // Crear mensaje con las estadísticas de inventario
    let message = "📦 *Estadísticas de Inventario*\n\n" +
                 `Total de productos: ${totalProducts}\n` +
                 `Productos agotados: ${outOfStockProducts} (${((outOfStockProducts / totalProducts) * 100).toFixed(1)}%)\n` +
                 `Productos con stock bajo (≤5): ${lowStockProducts} (${((lowStockProducts / totalProducts) * 100).toFixed(1)}%)\n` +
                 `Valor total del inventario: ${inventoryValue.toFixed(2)}€\n\n` +
                 "*Productos con mayor precio:*\n\n";

    highValueProducts.forEach((product, index) => {
      message += `${index + 1}. ${product.DescripcionArticulo}\n` +
                `   Precio: ${product.PVP.toFixed(2)}€ | Stock: ${product.unidades}\n`;
    });

    return bot.sendMessage(
      chatId,
      message,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔄 Actualizar", callback_data: "admin_stats_inventory" }],
            [{ text: "📉 Ver Agotados", callback_data: "admin_stats_inventory_out" }],
            [{ text: "⬅️ Volver a Estadísticas", callback_data: "admin_stats" }]
          ]
        }
      }
    );
  } catch (error) {
    logger.error(`Error al mostrar estadísticas de inventario: ${error.message}`);
    return bot.sendMessage(
      chatId,
      "❌ Ha ocurrido un error al cargar las estadísticas. Por favor, intenta de nuevo."
    );
  }
}

/**
 * Muestra estadísticas de usuarios
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @returns {Promise} - Promesa de la operación
*/
async function showUserStats(bot, chatId) {
  try {
    // Indicar que estamos procesando
    const processingMsg = await bot.sendMessage(
      chatId,
      "⏳ Procesando estadísticas de usuarios..."
    );

    // Obtener estadísticas de usuarios
    const totalUsers = await User.countDocuments({});
    const activeUsers = await User.countDocuments({ isActive: true });
    const adminUsers = await User.countDocuments({ 
      role: { $in: ['admin', 'superadmin'] } 
    });
    
    // Usuarios más recientes
    const recentUsers = await User.find({})
      .sort({ createdAt: -1 })
      .limit(5);
    
    // Usuarios con más pedidos
    const topUsersByOrders = await Pedido.aggregate([
      { $group: { 
        _id: "$telegramId", 
        orderCount: { $sum: 1 },
        totalSpent: { $sum: "$total" },
        firstName: { $first: "$userData.first_name" },
        lastName: { $first: "$userData.last_name" },
        username: { $first: "$userData.username" }
      }},
      { $sort: { orderCount: -1 } },
      { $limit: 5 }
    ]);

    // Eliminar mensaje de procesamiento
    await bot.deleteMessage(chatId, processingMsg.message_id).catch(err => {
      logger.error(`Error al eliminar mensaje de procesamiento: ${err.message}`);
    });

    // Crear mensaje con las estadísticas de usuarios
    let message = "👥 *Estadísticas de Usuarios*\n\n" +
                 `Total de usuarios: ${totalUsers}\n` +
                 `Usuarios activos: ${activeUsers} (${((activeUsers / totalUsers) * 100).toFixed(1)}%)\n` +
                 `Administradores: ${adminUsers}\n\n` +
                 "*Usuarios más recientes:*\n\n";

    recentUsers.forEach((user, index) => {
      const joinDate = new Date(user.createdAt);
      const formattedDate = `${joinDate.getDate()}/${joinDate.getMonth() + 1}/${joinDate.getFullYear()}`;
      
      message += `${index + 1}. ${user.first_name} ${user.last_name || ''}` +
                `${user.username ? ` (@${user.username})` : ''}\n` +
                `   Registro: ${formattedDate}\n`;
    });

    message += "\n*Usuarios con más pedidos:*\n\n";

    topUsersByOrders.forEach((user, index) => {
      message += `${index + 1}. ${user.firstName || 'Usuario'} ${user.lastName || ''}` +
                `${user.username ? ` (@${user.username})` : ''}\n` +
                `   Pedidos: ${user.orderCount} | Gastado: ${user.totalSpent.toFixed(2)}€\n`;
    });

    return bot.sendMessage(
      chatId,
      message,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔄 Actualizar", callback_data: "admin_stats_users" }],
            [{ text: "👥 Ver Todos", callback_data: "admin_stats_users_all" }],
            [{ text: "⬅️ Volver a Estadísticas", callback_data: "admin_stats" }]
          ]
        }
      }
    );
  } catch (error) {
    logger.error(`Error al mostrar estadísticas de usuarios: ${error.message}`);
    return bot.sendMessage(
      chatId,
      "❌ Ha ocurrido un error al cargar las estadísticas. Por favor, intenta de nuevo."
    );
  }
}

/**
 * Genera y envía un informe exportable de estadísticas
 * @param {object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @returns {Promise} - Promesa de la operación
*/
async function exportStats(bot, chatId) {
  try {
    // Indicar que estamos procesando
    const processingMsg = await bot.sendMessage(
      chatId,
      "⏳ Generando informe de estadísticas completo..."
    );

    // Obtener todas las estadísticas relevantes
    const [
      // Estadísticas de pedidos
      totalPedidos,
      pedidosPendientes,
      pedidosPagados,
      pedidosEnviados,
      pedidosEntregados,
      pedidosCancelados,
      ingresosTotales,
      
      // Estadísticas de inventario
      totalProductos,
      productosAgotados,
      productosStockBajo,
      valorInventario,
      
      // Estadísticas de usuarios
      totalUsuarios,
      usuariosActivos,
      administradores
    ] = await Promise.all([
      Pedido.countDocuments({}),
      Pedido.countDocuments({ status: 'PENDIENTE' }),
      Pedido.countDocuments({ status: 'PAGADO' }),
      Pedido.countDocuments({ status: 'ENVIADO' }),
      Pedido.countDocuments({ status: 'ENTREGADO' }),
      Pedido.countDocuments({ status: 'CANCELADO' }),
      Pedido.aggregate([
        { $match: { status: { $in: ['PAGADO', 'ENVIADO', 'ENTREGADO'] } } },
        { $group: { _id: null, total: { $sum: "$total" } } }
      ]).then(result => result.length > 0 ? result[0].total : 0),
      
      Articulo.countDocuments({}),
      Articulo.countDocuments({ unidades: 0 }),
      Articulo.countDocuments({ unidades: { $gt: 0, $lte: 5 } }),
      Articulo.aggregate([
        { $project: { totalValue: { $multiply: ["$PVP", "$unidades"] } }},
        { $group: { _id: null, total: { $sum: "$totalValue" } }}
      ]).then(result => result.length > 0 ? result[0].total : 0),
      
      User.countDocuments({}),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ role: { $in: ['admin', 'superadmin'] } })
    ]);

    // Crear el informe en formato CSV
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    const csvContent = 
`# Informe de Estadísticas - ${formattedDate}

## Estadísticas de Pedidos
Total de pedidos,${totalPedidos}
Pedidos pendientes,${pedidosPendientes}
Pedidos pagados,${pedidosPagados}
Pedidos enviados,${pedidosEnviados}
Pedidos entregados,${pedidosEntregados}
Pedidos cancelados,${pedidosCancelados}
Ingresos totales,${ingresosTotales.toFixed(2)}€

## Estadísticas de Inventario
Total de productos,${totalProductos}
Productos agotados,${productosAgotados}
Productos con stock bajo,${productosStockBajo}
Valor total del inventario,${valorInventario.toFixed(2)}€

## Estadísticas de Usuarios
Total de usuarios,${totalUsuarios}
Usuarios activos,${usuariosActivos}
Administradores,${administradores}
`;

    // Crear y guardar el archivo CSV temporalmente
    const fs = require('fs');
    const path = require('path');
    const tempDir = path.join(__dirname, '../../temp');
    
    // Asegurarse de que el directorio exista
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const filePath = path.join(tempDir, `estadisticas_${formattedDate}.csv`);
    fs.writeFileSync(filePath, csvContent);

    // Eliminar mensaje de procesamiento
    await bot.deleteMessage(chatId, processingMsg.message_id).catch(err => {
      logger.error(`Error al eliminar mensaje de procesamiento: ${err.message}`);
    });

    // Enviar el archivo
    await bot.sendDocument(
      chatId,
      filePath,
      {
        caption: "📊 Informe de estadísticas completo",
        reply_markup: {
          inline_keyboard: [
            [{ text: "⬅️ Volver a Estadísticas", callback_data: "admin_stats" }]
          ]
        }
      }
    );

    // Eliminar el archivo temporal después de enviarlo
    setTimeout(() => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          logger.log(`Archivo temporal de estadísticas eliminado: ${filePath}`);
        }
      } catch (cleanupError) {
        logger.error(`Error al eliminar archivo temporal: ${cleanupError.message}`);
      }
    }, 5000);

    return true;
  } catch (error) {
    logger.error(`Error al exportar estadísticas: ${error.message}`);
    return bot.sendMessage(
      chatId,
      "❌ Ha ocurrido un error al generar el informe. Por favor, intenta de nuevo."
    );
  }
}

module.exports = {
  showStatsPanel,
  showStatsSummary,
  showPendingOrdersStats,
  showCompletedOrdersStats,
  showCanceledOrdersStats,
  showInventoryStats,
  showUserStats,
  exportStats
};