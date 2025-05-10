const mongoose = require("mongoose");

const articuloSchema = new mongoose.Schema({}, { strict: false });

module.exports = mongoose.model("Articulo", articuloSchema, "articulo");
