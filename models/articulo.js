const mongoose = require("mongoose");

const articuloSchema = new mongoose.Schema({
  CodigoArticulo: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
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
  stock: {
    type: Number,
    default: 0,
    min: 0
  },
  embedding: {
    type: [Number],
    select: false, // No incluir en consultas
    required: false
  },
  categoria: {
    type: String,
    trim: true
  },
  disponible: {
    type: Boolean,
    default: true
  }
}, { 
  timestamps: true,
  strict: false
});

// Índice para CodigoArticulo
articuloSchema.index({ CodigoArticulo: 1 }, { unique: true });

// Índice para búsqueda por texto
articuloSchema.index({ DescripcionArticulo: 'text' });

module.exports = mongoose.model("Articulo", articuloSchema, "articulo");