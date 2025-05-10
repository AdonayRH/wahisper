require("dotenv").config();
const mongoose = require("mongoose");

async function conectarMongo() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // 10 segundos
    });

    console.log("✅ Conexión a MongoDB Atlas exitosa.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error de conexión:", error.message);
    process.exit(1);
  }
}

conectarMongo();
