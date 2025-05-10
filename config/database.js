const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    logger.info(`MongoDB conectada: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    logger.error(`Error al conectar a MongoDB: ${err.message}`);
    process.exit(1);
  }
};