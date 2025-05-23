// auth.js - Sistema de autenticación para API y panel administrativo

require('dotenv').config();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// Podrías necesitar crear este modelo de usuario administrador
// const AdminUser = require('../models/adminUser');

// Constantes de configuración
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '24h';
const ADMIN_IDS = process.env.ADMIN_TELEGRAM_IDS ? process.env.ADMIN_TELEGRAM_IDS.split(',') : ['2030605308'];

/**
 * Middleware para verificar token JWT en cabeceras
 * @param {object} req - Request de Express
 * @param {object} res - Response de Express
 * @param {function} next - Función next de Express
 */
const verifyToken = (req, res, next) => {
  // Obtener el token del header Authorization
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Acceso denegado. Token no proporcionado.' 
    });
  }
  
  try {
    // Verificar token
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Error de autenticación:", error);
    return res.status(403).json({ 
      success: false, 
      message: 'Token inválido o expirado.' 
    });
  }
};

/**
 * Middleware para verificar permisos de administrador
 * @param {object} req - Request de Express
 * @param {object} res - Response de Express
 * @param {function} next - Función next de Express
 */
const verifyAdmin = (req, res, next) => {
  if (!req.user || !req.user.role || req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Acceso denegado. Se requieren permisos de administrador.' 
    });
  }
  next();
};

/**
 * Middleware para verificar administrador por Telegram ID
 * @param {object} req - Request de Express
 * @param {object} res - Response de Express
 * @param {function} next - Función next de Express
 */
const verifyTelegramAdmin = (req, res, next) => {
  const telegramId = req.body.telegramId || req.query.telegramId;
  
  if (!telegramId || !ADMIN_IDS.includes(telegramId.toString())) {
    return res.status(403).json({ 
      success: false, 
      message: 'Acceso denegado. ID de Telegram no autorizado.' 
    });
  }
  next();
};

/**
 * Genera un token JWT para un usuario
 * @param {object} userData - Datos del usuario para incluir en el token
 * @returns {string} - Token JWT generado
 */
const generateToken = (userData) => {
  return jwt.sign(
    userData,
    JWT_SECRET,
    { expiresIn: JWT_EXPIRATION }
  );
};

/**
 * Maneja el inicio de sesión de administrador
 * @param {object} req - Request de Express
 * @param {object} res - Response de Express
 */
const loginAdmin = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Se requiere nombre de usuario y contraseña.' 
      });
    }
    
    // Implementación de ejemplo - Reemplazar con tu lógica de base de datos
    // const adminUser = await AdminUser.findOne({ username });
    
    // Simulación de datos para desarrollo
    const adminUsers = [
      { 
        id: 1, 
        username: 'admin', 
        passwordHash: bcrypt.hashSync('admin123', 10),
        role: 'admin'
      }
    ];
    
    const adminUser = adminUsers.find(u => u.username === username);
    
    if (!adminUser) {
      return res.status(401).json({ 
        success: false, 
        message: 'Credenciales inválidas.' 
      });
    }
    
    // Verificar contraseña
    const validPassword = await bcrypt.compare(password, adminUser.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Credenciales inválidas.' 
      });
    }
    
    // Generar token
    const token = generateToken({
      id: adminUser.id,
      username: adminUser.username,
      role: adminUser.role
    });
    
    res.status(200).json({
      success: true,
      message: 'Inicio de sesión exitoso',
      token,
      user: {
        username: adminUser.username,
        role: adminUser.role
      }
    });
  } catch (error) {
    console.error("Error en inicio de sesión:", error);
    res.status(500).json({ 
      success: false, 
      message: 'Error en el servidor al procesar el inicio de sesión.', 
      error: error.message 
    });
  }
};

/**
 * Valida un token y devuelve los datos del usuario
 * @param {object} req - Request de Express
 * @param {object} res - Response de Express
 */
const validateToken = (req, res) => {
  // req.user ya está disponible gracias al middleware verifyToken
  res.status(200).json({
    success: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role
    }
  });
};

/**
 * Genera un hash para contraseña
 * @param {string} password - Contraseña en texto plano
 * @returns {string} - Hash de la contraseña
 */
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

module.exports = {
  verifyToken,
  verifyAdmin,
  verifyTelegramAdmin,
  generateToken,
  loginAdmin,
  validateToken,
  hashPassword
};