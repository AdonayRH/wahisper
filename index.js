require("dotenv").config();
require("./config/database");
require("./controllers/botController");

const express = require("express");
const app = express();
const routes = require("./routes/api");

app.use("/api", routes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor web en http://localhost:${PORT}`);
});
