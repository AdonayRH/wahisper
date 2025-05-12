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
    systemMessage += "VIEW_CART (ver o consultar el carrito de compras), ";
    systemMessage += "REMOVE_FROM_CART (eliminar productos del carrito), ";
    systemMessage += "CLEAR_CART (vaciar completamente el carrito), ";
    systemMessage += "OTHER (otro tipo de mensaje).";

    // Instrucciones específicas para remover elementos
    systemMessage += "\n\nCuando el usuario mencione que quiere eliminar, quitar, borrar o sacar algo del carrito, clasifica como REMOVE_FROM_CART. Si menciona eliminar todo, vaciar o limpiar el carrito completo, clasifica como CLEAR_CART.";

     // Ejemplos para eliminar del carrito
    systemMessage += "\n\nEjemplos para REMOVE_FROM_CART:";
    systemMessage += "\n- 'Quiero eliminar las tijeras del carrito'";
    systemMessage += "\n- 'Elimina el segundo producto'";
    systemMessage += "\n- 'Quita el bolígrafo de mi carrito'";
    systemMessage += "\n- 'Eliminar producto 3'";
    
    // Ejemplos para vaciar el carrito
    systemMessage += "\n\nEjemplos para CLEAR_CART:";
    systemMessage += "\n- 'Vacía mi carrito'";
    systemMessage += "\n- 'Quiero eliminar todo del carrito'";
    systemMessage += "\n- 'Limpia el carrito por completo'";
    systemMessage += "\n- 'Borra todos los productos'";

    // Agregar aclaración sobre expreciones que no deben ser clasificadas como CONFIRMATION
    systemMessage += "\n\nIMPORTANTE: La frase 'quiero X' o 'muestrame X' donde X es un producto que NO ha sido mencionado o mostrado previamente, debe clasificarse como QUERY (consulta nueva), no como CONFIRMATION.";
    systemMessage += "\n\nSolo clasifica como CONFIRMATION cuando el usuario está confirmando interés en un producto específico que YA HA SIDO MOSTRADO previamente, o cuando responde afirmativamente a una pregunta.";
    
    // Agregar ejemplos específicos
    systemMessage += "\n\nEjemplos:";
    systemMessage += "\n- 'Quiero tijeras' (cuando no se han mostrado tijeras) = QUERY";
    systemMessage += "\n- 'Me interesan las tijeras' (cuando no se han mostrado) = QUERY";
    systemMessage += "\n- 'Sí, quiero las tijeras' (después de mostrar tijeras) = CONFIRMATION";
    systemMessage += "\n- 'Me interesa el primer producto' = CONFIRMATION";
    
    // Añadir contexto si está disponible
    if (context.lastQuery) {
      systemMessage += `\n\nContexto de la conversación: El usuario previamente buscó "${context.lastQuery}".`;
    }
    // Añadir productos mencionados
    if (context.lastMentionedProducts && context.lastMentionedProducts.length > 0) {
      systemMessage += `\n\nÚltimos productos mencionados: ${context.lastMentionedProducts.join(", ")}.`;
    }
    // Añadir artículos mostrados
    if (context.currentState) {
      systemMessage += `\n\nEstado actual de la conversación: ${context.currentState}.`;
    }
    // Añadir estado de la conversación
    if (context.currentState === 'ASKING_QUANTITY') {
      systemMessage += "\n\nCuando el usuario mencione una cantidad, ya sea como número (2, 5, 10) o como texto (dos, cinco, diez), debes incluirla en el campo quantityMentioned. Presta especial atención a convertir correctamente palabras a números.";
      systemMessage += "\n\nEl usuario está en un estado donde se le está pidiendo una cantidad. Prioriza la detección de cualquier número en su respuesta, incluso si viene expresado como texto.";
    }

    if (context.currentState === 'CONFIRMING_CART') {
      systemMessage += "\n\nSi el usuario hace cualquier referencia a ver, mostrar, consultar o preguntar por su carrito, cesta de compra o productos seleccionados, clasifica esto como VIEW_CART con alta confianza.";
    }
    // Construcción de la intencionalidad del usuario
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
                enum: ["CONFIRMATION", "QUANTITY", "QUERY", "REJECTION", "GREETING", "FAREWELL", "VIEW_CART", "REMOVE_FROM_CART", "CLEAR_CART", "OTHER"],
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
               productIndex: {
                type: "integer",
                description: "Si el mensaje menciona un índice de producto (número de orden), indica cuál"
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