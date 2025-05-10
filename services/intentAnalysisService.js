const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Analiza la intención del usuario utilizando OpenAI
 * @param {string} message - Mensaje del usuario
 * @param {object} context - Contexto de la conversación (opcional)
 * @returns {Promise<object>} - Objeto con la intención y confianza
 */
async function analyzeIntent(message, context = {}) {
  try {
    // Construir el mensaje del sistema con contexto
    let systemMessage = "Clasifica la intención del usuario en una de estas categorías: ";
    systemMessage += "CONFIRMATION (confirmar interés en comprar un producto), ";
    systemMessage += "QUANTITY (especificar cantidad de un producto), ";
    systemMessage += "QUERY (consulta sobre productos o servicios), ";
    systemMessage += "REJECTION (rechazo o negativa), ";
    systemMessage += "GREETING (saludo), ";
    systemMessage += "FAREWELL (despedida), ";
    systemMessage += "OTHER (otro tipo de mensaje).";
    
    // Añadir contexto si está disponible
    if (context.lastQuery) {
      systemMessage += `\n\nContexto de la conversación: El usuario previamente buscó "${context.lastQuery}".`;
    }
    
    if (context.lastMentionedProducts && context.lastMentionedProducts.length > 0) {
      systemMessage += `\n\nÚltimos productos mencionados: ${context.lastMentionedProducts.join(", ")}.`;
    }
    
    if (context.currentState) {
      systemMessage += `\n\nEstado actual de la conversación: ${context.currentState}.`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemMessage
        },
        {
          role: "user",
          content: message
        }
      ],
      functions: [
        {
          name: "classifyIntent",
          description: "Clasifica la intención del usuario",
          parameters: {
            type: "object",
            properties: {
              intent: {
                type: "string",
                enum: ["CONFIRMATION", "QUANTITY", "QUERY", "REJECTION", "GREETING", "FAREWELL", "OTHER"],
                description: "La intención detectada en el mensaje del usuario"
              },
              confidence: {
                type: "number",
                description: "Nivel de confianza de 0 a 1, donde 1 es máxima confianza"
              },
              productReference: {
                type: "string",
                description: "Si el mensaje menciona un producto específico, indica cuál"
              },
              quantityMentioned: {
                type: "integer",
                description: "Si el mensaje menciona una cantidad específica, indica cuál"
              }
            },
            required: ["intent", "confidence"]
          }
        }
      ],
      function_call: { name: "classifyIntent" }
    });

    // Extraer y parsear la respuesta
    const functionCall = response.choices[0].message.function_call;
    return JSON.parse(functionCall.arguments);
  } catch (error) {
    console.error("Error al analizar la intención:", error);
    // Devolver un valor por defecto en caso de error
    return {
      intent: "OTHER",
      confidence: 0.5,
      error: error.message
    };
  }
}

module.exports = { analyzeIntent };