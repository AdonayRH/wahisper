require("dotenv").config();
require("./config/database");
require("./controllers/botController");

const express = require("express");
const app = express();
const routes = require("./routes/api");

// Middleware para parsear el cuerpo de las solicitudes JSON
app.use(express.json());

// Rutas de la API
app.use("/api", routes);

// Conexion a la base de datos
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor web en http://localhost:${PORT}`);
});

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
  console.error('Error no capturado:', error);
  // Mantener la aplicación en ejecución
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesa rechazada no manejada:', reason);
  // Mantener la aplicación en ejecución
});
