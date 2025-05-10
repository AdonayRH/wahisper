const mongoose = require('mongoose');

const articuloSchema = new mongoose.Schema({
  CodigoArticulo: {
    type: String,
    required: true,
    unique: true
  },
  DescripcionArticulo: {
    type: String,
    required: true
  },
  Categoria: {
    type: String,
    required: false
  },
  Precio: {
    type: Number,
    required: false
  },
  Stock: {
    type: Number,
    default: 0
  },
  embedding: {
    type: [Number], // Array de números para el vector de embedding
    required: false,
    index: true // Opcional: si tienes muchos documentos, considera un índice
  }
}, {
  timestamps: true
});

// Si hay error al encontrar el modelo, crearlo
module.exports = mongoose.models.Articulo || mongoose.model('Articulo', articuloSchema);