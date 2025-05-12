const mongoose = require('mongoose');

/**
 * Esquema para registrar los pedidos de los usuarios
 */
const pedidoSchema = new mongoose.Schema({
  // Número de pedido único
  orderNumber: { 
    type: String, 
    required: true, 
    unique: true,
    index: true
  },
  
  // ID de Telegram del usuario
  telegramId: { 
    type: String, 
    required: true,
    index: true
  },
  
  // Artículos incluidos en el pedido
  items: [{
    codigoArticulo: String,
    descripcion: String,
    precio: Number,
    cantidad: Number,
    subtotal: Number
  }],
  
  // Total del pedido
  total: {
    type: Number,
    required: true
  },
  
  // Estado del pedido
  status: { 
    type: String, 
    enum: ['PENDIENTE', 'PAGADO', 'ENVIADO', 'ENTREGADO', 'CANCELADO'],
    default: 'PENDIENTE',
    index: true
  },
  
  // Datos del usuario
  userData: {
    telegramId: String,
    first_name: String,
    last_name: String,
    username: String
  },
  
  // Datos de envío (opcional)
  shippingInfo: {
    address: String,
    city: String,
    zipCode: String,
    country: String,
    phone: String
  },
  
  // Datos de pago (opcional)
  paymentInfo: {
    method: String,
    transactionId: String,
    paymentDate: Date
  },
  
  // Notas
  notes: String,
  
  // Fechas automáticas
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Middleware pre-save para actualizar la fecha de actualización
pedidoSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Middleware pre-update para actualizar la fecha de actualización
pedidoSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: Date.now() });
  next();
});

// Método para calcular el total del pedido
pedidoSchema.methods.calculateTotal = function() {
  this.total = this.items.reduce((sum, item) => {
    return sum + (item.precio * item.cantidad);
  }, 0);
};

// Crear modelo
const Pedido = mongoose.model('Pedido', pedidoSchema);

module.exports = Pedido;