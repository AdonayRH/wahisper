/**
 * Trunca un texto si excede la longitud máxima
 * @param {String} text - Texto a truncar
 * @param {Number} maxLength - Longitud máxima permitida
 * @returns {String} - Texto truncado si es necesario
 */
const truncateText = (text, maxLength = 4096) => {
    if (text.length <= maxLength) {
      return text;
    }
    
    return text.substring(0, maxLength - 3) + '...';
  };
  
  /**
   * Escapa caracteres especiales de Markdown
   * @param {String} text - Texto a escapar
   * @returns {String} - Texto con caracteres escapados
   */
  const escapeMarkdown = (text) => {
    return text
      .replace(/\_/g, '\\_')
      .replace(/\*/g, '\\*')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/\~/g, '\\~')
      .replace(/\`/g, '\\`')
      .replace(/\>/g, '\\>')
      .replace(/\#/g, '\\#')
      .replace(/\+/g, '\\+')
      .replace(/\-/g, '\\-')
      .replace(/\=/g, '\\=')
      .replace(/\|/g, '\\|')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\./g, '\\.')
      .replace(/\!/g, '\\!');
  };
  
  /**
   * Sanitiza un texto de entrada para prevenir inyecciones
   * @param {String} input - Texto a sanitizar
   * @returns {String} - Texto sanitizado
   */
  const sanitizeInput = (input) => {
    if (!input || typeof input !== 'string') {
      return '';
    }
    
    // Eliminar caracteres potencialmente peligrosos
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .trim();
  };
  
  module.exports = {
    truncateText,
    escapeMarkdown,
    sanitizeInput
  };