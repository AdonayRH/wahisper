const fileProcessingService = require('../services/fileProcessingService');
const fs = require('fs-extra');
const path = require('path');

/**
 * Maneja la subida y procesamiento de archivos
*/
async function uploadFile(req, res) {
  try {
    // Verificar que hay un archivo
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No se ha subido ningún archivo' 
      });
    }
    
    const filePath = req.file.path;
    console.log(`Procesando archivo: ${filePath}`);
    
    // Procesar el archivo
    const articulos = await fileProcessingService.processFile(filePath);
    
    // Si se solicitó solo vista previa, no guardar en BD
    const previewOnly = req.body.preview === 'true';
    
    let result;
    if (previewOnly) {
      // Solo devolver vista previa
      result = {
        success: true,
        preview: true,
        total: articulos.length,
        articulos: articulos.slice(0, 10) // Mostrar solo los primeros 10 para vista previa
      };
    } else {
      // Guardar en la base de datos
      result = await fileProcessingService.saveArticulos(articulos);
      
      // Exportar a JSON por si se necesita
      const jsonPath = path.join(path.dirname(filePath), `articulos_${Date.now()}.json`);
      await fs.writeFile(jsonPath, fileProcessingService.exportToJSON(articulos));
      
      result.jsonPath = jsonPath;
    }
    
    // Eliminar el archivo original después de procesarlo
    await fs.remove(filePath);
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error procesando archivo:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al procesar el archivo', 
      error: error.message 
    });
  }
}

module.exports = {
  uploadFile
};