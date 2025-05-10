const Articulo = require("../models/articulo");
const { getEmbedding } = require("../services/openaiService");
const { calcularSimilitud } = require("../utils/helpers");
const { TOP_K_RESULTS } = require("../config/constants");
// commentario
async function buscarArticulosSimilares(texto) {
  const inputEmbedding = await getEmbedding(texto);
  const articulos = await Articulo.find({ embedding: { $exists: true } });

  const comparaciones = articulos.map((art) => ({
    articulo: art,
    similitud: calcularSimilitud(inputEmbedding, art.embedding)
  }));

  comparaciones.sort((a, b) => b.similitud - a.similitud);
  return comparaciones.slice(0, TOP_K_RESULTS);
}

module.exports = { buscarArticulosSimilares };
