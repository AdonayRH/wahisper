// Unifica todas las funcionalidades relacionadas con el carrito

const displayModule = require('./displayModule');
const addModule = require('./addModule');
const removeModule = require('./removeModule');
const updateModule = require('./updateModule');
const exportModule = require('./exportModule');

module.exports = {
  // Mostrar carrito
  handleCartCommand: displayModule.handleCartCommand,
  
  // Añadir al carrito
  addToCart: addModule.addToCart,
  handleStartAddUnits: addModule.handleStartAddUnits,
  handleAddQuantity: addModule.handleAddQuantity,
  
  // Remover del carrito
  handleRemoveFromCartCommand: removeModule.handleRemoveFromCartCommand,
  handleStartRemoveItem: removeModule.handleStartRemoveItem,
  handleRemoveQuantity: removeModule.handleRemoveQuantity, 
  handleConfirmRemove: removeModule.handleConfirmRemove,
  handleStartClearCart: removeModule.handleStartClearCart,
  handleClearCartCommand: removeModule.handleClearCartCommand,
  
  // Actualizar carrito
  updateItemQuantity: updateModule.updateItemQuantity,
  
  // Exportar carrito
  handleExportCartCommand: exportModule.handleExportCartCommand
};