require("dotenv").config();
const mongoose = require("./config/database");
const Articulo = require("./models/articulo");
const OpenAI = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function getEmbedding(text) {
  console.log("🧠 Solicitando embedding...");
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
}

async function generarEmbeddings() {
  try {
    const articulos = await Articulo.find({ embedding: { $exists: false } });
    if (!articulos.length) {
      console.log("✅ Todos los artículos ya tienen embedding.");
      return process.exit(0);
    }

    console.log(`🔍 Procesando ${articulos.length} artículos...\n`);

    for (const art of articulos) {
      const desc = art.DescripcionArticulo?.trim();
      if (!desc || desc.length < 3) continue;

      console.log(`➡️ Procesando: ${desc}`);

      try {
        const embedding = await getEmbedding(desc);

        // 👇 guardado directo sin usar art.save()
        await Articulo.updateOne(
          { _id: art._id },
          { $set: { embedding } }
        );

        console.log(`✅ Embedding guardado correctamente para: ${desc}`);
      } catch (err) {
        console.error(`❌ Error con "${desc}":`, err.message);
      }

      await new Promise(r => setTimeout(r, 150));
    }

    console.log("\n🏁 Embeddings generados.");
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error general:", err.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}

generarEmbeddings();
