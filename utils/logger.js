const winston = require('winston');
const path = require('path');

// Crear formato personalizado
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
  })
);

// Configurar logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: customFormat,
  transports: [
    // Consola
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customFormat
      )
    }),
    // Archivo para todos los logs
    new winston.transports.File({ 
      filename: path.join('logs', 'combined.log') 
    }),
    // Archivo para errores
    new winston.transports.File({ 
      filename: path.join('logs', 'error.log'), 
      level: 'error' 
    })
  ]
});

module.exports = logger;