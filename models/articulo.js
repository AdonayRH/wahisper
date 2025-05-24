const mongoose = require("mongoose");

const articuloSchema = new mongoose.Schema({
  CodigoArticulo: {
    type: String,
    required: true,
    unique: true,
    trim: true
    // Removido: index: true (para evitar índice duplicado)
  },
  DescripcionArticulo: {
    type: String,
    required: true,
    trim: true
  },
  PVP: {
    type: Number,
    required: true,
    default: 0
  },
  unidades: {
    type: Number,
    default: 0,
    min: 0
  },
  embedding: {
    type: [Number],
    select: false, // No incluir en consultas
    required: false
  },
}, { 
  timestamps: true,
  strict: false
});

// Índice único para CodigoArticulo (solo uno)
articuloSchema.index({ CodigoArticulo: 1 }, { unique: true });

// Índice para búsqueda por texto
articuloSchema.index({ DescripcionArticulo: 'text' });

module.exports = mongoose.model("Articulo", articuloSchema, "articulo");