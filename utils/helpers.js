// LIBRERIA QUE SE ENCARGA DE CALCULAR LA SIMILITUD ENTRE EL COSENO DE DOS VECTORES
//V1 es EMBEDDING DEL USUARIO V2 es EMBEDDING DEL ARTICULO
const cosineSimilarity = require("compute-cosine-similarity");

function calcularSimilitud(v1, v2) {
  return cosineSimilarity(v1, v2);
}

module.exports = { calcularSimilitud };
