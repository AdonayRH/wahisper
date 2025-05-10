const bot = require("../services/telegramService");
const { buscarArticulosSimilares } = require("./aiController");
const { generarRespuestaComoVendedor } = require("../services/generarRespuestaComoVendedor");

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const texto = msg.text;

  if (!texto || texto.length < 2) {
    return bot.sendMessage(chatId, "Escribe algo más específico.");
  }

  try {
    const resultados = await buscarArticulosSimilares(texto);
  
    if (resultados.length === 0) {
      return bot.sendMessage(chatId, "No encontré ningún artículo relacionado.");
    }

    const articulos = resultados.map(({ articulo }, i) =>
      `${i + 1}. ${articulo.DescripcionArticulo} (PVP: ${articulo.PVP} €)`
    ).join("\n\n");

    const respuesta = await generarRespuestaComoVendedor(articulos, texto);

    bot.sendMessage(chatId, respuesta);
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, "⚠️ Hubo un error al buscar el artículo.");
  }
});
