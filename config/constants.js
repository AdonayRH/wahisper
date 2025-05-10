module.exports = {
    // Configuraciones de OpenAI
    OPENAI_MODEL: 'gpt-4',
    
    // Mensajes predeterminados
    DEFAULT_WELCOME_MESSAGE: '¡Hola! Soy tu asistente de compras. ¿En qué puedo ayudarte hoy?',
    DEFAULT_ERROR_MESSAGE: 'Lo siento, ocurrió un error al procesar tu solicitud.',
    
    // Configuraciones del bot
    REPLY_TIMEOUT: 30000, // 30 segundos
    MAX_MESSAGE_LENGTH: 4096,
    
    // Roles de usuario
    USER_ROLES: {
      ADMIN: 'admin',
      USER: 'user',
      GUEST: 'guest'
    }
  };