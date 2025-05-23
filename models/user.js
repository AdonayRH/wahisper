const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  first_name: { type: String, required: true },
  last_name: String,
  username: String,
  // Añadimos campo de rol para gestión de administradores
  role: { 
    type: String, 
    enum: ['user', 'admin', 'superadmin'],
    default: 'user'
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  lastActivity: { 
    type: Date, 
    default: Date.now 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Middleware para actualizar la fecha de actualización
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Middleware para actualizar la fecha en los updates
userSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: Date.now() });
  next();
});

// Método para verificar si es administrador
userSchema.methods.isAdmin = function() {
  return this.role === 'admin' || this.role === 'superadmin';
};

// Método para actualizar la actividad
userSchema.methods.updateActivity = function() {
  this.lastActivity = Date.now();
  return this.save();
};

module.exports = mongoose.model("User", userSchema);