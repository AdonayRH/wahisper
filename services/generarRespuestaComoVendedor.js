const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generarRespuestaComoVendedor(listaDeArticulos, consultaDelUsuario) {
  const prompt = `
Actúa como un vendedor amable y profesional tus respuestas deben ser resumidas.

Un cliente preguntó: "${consultaDelUsuario}"

Y estos son los artículos disponibles actualmente:

${listaDeArticulos}

Tu tarea es:
- Responder de forma útil, directa y amable
- Indicar si hay artículos similares, aunque no sean exactos
- Si no hay coincidencia exacta, ofrece lo más cercano
- No repitas la lista, haz una recomendación humana y razonada
- No digas que eres una inteligencia artificial

Escribe como si hablaras con un cliente de verdad. 
`;

  try {
    const respuesta = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    return respuesta.choices[0].message.content;
  } catch (error) {
    console.error("❌ Error al generar respuesta GPT:", error.message);
    return "Lo siento, hubo un error al generar la recomendación. Intenta de nuevo.";
  }
}

module.exports = { generarRespuestaComoVendedor };
