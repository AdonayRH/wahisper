const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  telegramId: {
    type: Number,
    required: true
  },
  messageId: {
    type: Number,
    required: true
  },
  text: {
    type: String,
    required: false
  },
  isFromBot: {
    type: Boolean,
    default: false
  },
  // Para mensajes que no son texto (fotos, documentos, etc.)
  mediaType: {
    type: String,
    enum: ['text', 'photo', 'document', 'voice', 'video', 'other'],
    default: 'text'
  },
  mediaUrl: {
    type: String,
    required: false
  },
  processed: {
    type: Boolean,
    default: false
  },
  aiProcessed: {
    type: Boolean,
    default: false
  },
  aiResponse: {
    type: String,
    required: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Message', messageSchema);