const mongoose = require("mongoose");

/**
 * Esquema para almacenar solicitudes de permisos de administrador
 */
const adminRequestSchema = new mongoose.Schema({
  // ID de Telegram del usuario solicitante
  telegramId: { 
    type: String, 
    required: true,
    unique: true,
    index: true
  },
  
  // Información del usuario
  userData: {
    first_name: { 
      type: String, 
      required: true 
    },
    last_name: String,
    username: String
  },
  
  // Estado de la solicitud
  status: { 
    type: String, 
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING',
    index: true
  },
  
  // ID del administrador que procesó la solicitud (si aplica)
  processedBy: {
    telegramId: String,
    first_name: String,
    timestamp: Date
  },
  
  // Notas o comentarios
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

// Middleware pre-save para actualizar la fecha
adminRequestSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Middleware pre-update para actualizar la fecha
adminRequestSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: Date.now() });
  next();
});

// Crear modelo
const AdminRequest = mongoose.model('AdminRequest', adminRequestSchema);

module.exports = AdminRequest;