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
- Si la persona no pregunta por un artículo específico, hablale como ser humano, no como un robot.
- Respuestas cortas y directas
- No usar frases largas o complicadas
- No usar jerga técnica
- No usar palabras como "inteligencia artificial" o "modelo"
- Responder de forma útil, directa y amable
- Indicar si hay artículos similares, aunque no sean exactos
- Si no hay coincidencia exacta, ofrece lo más cercano
- No repitas la lista, haz una recomendación humana y razonada
- No digas que eres una inteligencia artificial
- No uses frases como "no tengo información" o "no puedo ayudar"
- No digas que no tienes información sobre el artículo
- No digas que no puedes ayudar
- Repsuestas cortas y directas


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
