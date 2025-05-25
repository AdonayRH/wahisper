const { OpenAI } = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const DEFAULT_MODEL = "gpt-3.5-turbo";

/**
 * Genera un mensaje natural basado en un prompt general y un input real del usuario
 * @param {string} prompt - Instrucción principal para la IA
 * @param {string|null} userInput - Mensaje real del usuario (puede ser null)
 * @param {Array} examples - Ejemplos opcionales para few-shot
 * @param {number} temperature - Control de creatividad
 * @param {number} maxTokens - Límite de tokens en la respuesta
 * @returns {string} - Mensaje generado por la IA
*/
async function generateMessage(prompt, userInput = null, examples = [], temperature = 0.8, maxTokens = 60) {
  const messages = [
    {
      role: "system",
      content: "Eres un bot de atención al cliente amable, natural y breve. No digas que eres IA ni asistente virtual."
    },
    ...examples.flatMap(example => [
      { role: "user", content: example.input },
      { role: "assistant", content: example.output }
    ])
  ];

  if (userInput) {
    messages.push({ role: "user", content: userInput });
    messages.push({ role: "system", content: prompt });
  } else {
    messages.push({ role: "user", content: prompt });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error en la generación de mensaje natural:", error);
    return prompt;
  }
}

module.exports = {
  generateMessage
};
