require("dotenv").config();
const connectDB = require("./config/database");
const Articulo = require("./models/articulo");
const OpenAI = require("openai");
const logger = require("./utils/logger");

// Inicializar OpenAI con la API key
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Función para obtener el embedding de un texto
async function getEmbedding(text) {
  console.log("🧠 Solicitando embedding...");
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text
    });

    const vector = response.data[0]?.embedding;

    if (!vector || !Array.isArray(vector)) {
      throw new Error("❌ Embedding inválido");
    }

    console.log("✅ Embedding generado:", vector.slice(0, 5)); // verificación
    return vector;
  } catch (error) {
    console.error(`❌ Error al generar embedding: ${error.message}`);
    throw error;
  }
}

// Función principal para generar embeddings
async function generarEmbeddings() {
  let mongoose;
  try {
    // Conectar a la base de datos - ahora guardamos la instancia
    mongoose = await connectDB();

    // Verificar si el modelo Articulo existe
    if (!mongoose.models.Articulo && !Articulo) {
      console.error("❌ El modelo Articulo no está definido correctamente");
      await mongoose.connection.close();
      return process.exit(1);
    }

    // Buscar artículos sin embedding
    const articulos = await Articulo.find({ embedding: { $exists: false } });
    
    if (!articulos || articulos.length === 0) {
      console.log("✅ Todos los artículos ya tienen embedding o no hay artículos.");
      await mongoose.connection.close();
      return process.exit(0);
    }

    console.log(`🔍 Procesando ${articulos.length} artículos...\n`);

    for (const art of articulos) {
      const desc = art.DescripcionArticulo?.trim();
      if (!desc || desc.length < 3) {
        console.log(`⚠️ Saltando artículo con descripción inválida: ${art._id}`);
        continue;
      }

      console.log(`➡️ Procesando: ${desc}`);

      try {
        const embedding = await getEmbedding(desc);

        // Guardado directo sin usar art.save()
        await Articulo.updateOne(
          { _id: art._id },
          { $set: { embedding } }
        );

        console.log(`✅ Embedding guardado correctamente para: ${desc}`);
      } catch (err) {
        console.error(`❌ Error con "${desc}":`, err.message);
      }

      // Pequeña pausa entre solicitudes para evitar limites de rate
      await new Promise(r => setTimeout(r, 150));
    }

    console.log("\n🏁 Embeddings generados.");
    
    // Cerrar conexión con la base de datos
    if (mongoose && mongoose.connection) {
      await mongoose.connection.close();
    }
    process.exit(0);
  } catch (err) {
    console.error("❌ Error general:", err.message);
    // Asegurarse de cerrar la conexión incluso con error
    if (mongoose && mongoose.connection) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

// Iniciar el proceso
generarEmbeddings();