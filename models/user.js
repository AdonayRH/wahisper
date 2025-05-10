const mongoose = require('mongoose');
const { USER_ROLES } = require('../config/constants');

const userSchema = new mongoose.Schema({
  telegramId: {
    type: Number,
    required: true,
    unique: true
  },
  username: {
    type: String,
    required: false
  },
  firstName: {
    type: String,
    required: false
  },
  lastName: {
    type: String,
    required: false
  },
  role: {
    type: String,
    enum: Object.values(USER_ROLES),
    default: USER_ROLES.USER
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastInteraction: {
    type: Date,
    default: Date.now
  },
  conversationHistory: [{
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);