// Unifica todas las funcionalidades relacionadas con los productos
const selectModule = require('./selectModule');
const quantityModule = require('./quantityModule');
const searchModule = require('./searchModule');

module.exports = {
  // Selección de productos
  handleProductSelection: selectModule.handleProductSelection,
  
  // Selección de cantidad
  generateQuantityButtonsWithStock: quantityModule.generateQuantityButtonsWithStock,
  handleQuantitySelection: quantityModule.handleQuantitySelection,
  
  // Búsqueda de productos
  handleProductSearch: searchModule.handleProductSearch
};