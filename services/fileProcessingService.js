const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const Articulo = require('../models/articulo');

/**
 * Convierte un valor a entero si es posible
 * @param {any} val - Valor a convertir
 * @returns {number|string} - Valor convertido
*/
function parseInteger(val) {
  if (val === undefined || val === null || val === '') return 0;
  
  // Si ya es un número, devolverlo
  if (typeof val === 'number') return Math.floor(val);
  
  // Intentar convertir string a número
  const cleaned = String(val).replace(/[^\d]/g, '');
  if (cleaned === '') return 0;
  
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Convierte un valor a punto flotante si es posible
 * @param {any} val - Valor a convertir
 * @returns {number|string} - Valor convertido
*/
function parseFloat(val) {
  if (val === undefined || val === null || val === '') return 0;
  
  // Si ya es un número, devolverlo
  if (typeof val === 'number') return val;
  
  // Intentar convertir string a número
  // Reemplazar comas por puntos para manejar formatos europeos
  const cleaned = String(val).replace(',', '.').replace(/[^\d.]/g, '');
  if (cleaned === '') return 0;
  
  const parsed = Number(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Normaliza un objeto de artículo
 * @param {object} item - Item del archivo
 * @returns {object} - Objeto normalizado
 */
function normalizeArticulo(item) {
  // Obtener las claves del objeto de manera case-insensitive
  const keys = Object.keys(item);
  const getKey = (searchKey) => {
    return keys.find(k => k.toLowerCase() === searchKey.toLowerCase());
  };
  
  // Extraer campos con nombres variables
  const codigoKey = getKey('codigoarticulo') || getKey('codigo') || getKey('id');
  const descripcionKey = getKey('descripcionarticulo') || getKey('descripcion') || getKey('nombre');
  const pvpKey = getKey('pvp') || getKey('precio') || getKey('valor');
  const unidadesKey = getKey('unidades') || getKey('stock') || getKey('cantidad');
  
  // Normalizar
  return {
    CodigoArticulo: String(item[codigoKey] || '').trim(),
    DescripcionArticulo: String(item[descripcionKey] || '').trim(),
    PVP: parseFloat(item[pvpKey]),
    unidades: parseInteger(item[unidadesKey])
  };
}

/**
 * Procesa un archivo CSV
 * @param {string} filePath - Ruta al archivo
 * @returns {Promise<Array>} - Array de artículos procesados
*/
function processCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        try {
          // Normalizar cada artículo
          const articulos = results.map(normalizeArticulo)
            .filter(art => art.CodigoArticulo && art.DescripcionArticulo); // Filtrar entradas inválidas
          resolve(articulos);
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

/**
 * Procesa un archivo Excel
 * @param {string} filePath - Ruta al archivo
 * @returns {Promise<Array>} - Array de artículos procesados
*/
function processExcel(filePath) {
  return new Promise((resolve, reject) => {
    try {
      // Leer el archivo Excel
      const workbook = XLSX.readFile(filePath, { type: 'file' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convertir a JSON
      const results = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      // Extraer encabezados
      const headers = results[0].map(h => String(h).trim());
      
      // Convertir filas a objetos
      const data = results.slice(1).map(row => {
        const item = {};
        row.forEach((cell, index) => {
          if (index < headers.length) {
            item[headers[index]] = cell;
          }
        });
        return item;
      });
      
      // Normalizar cada artículo
      const articulos = data.map(normalizeArticulo)
        .filter(art => art.CodigoArticulo && art.DescripcionArticulo); // Filtrar entradas inválidas
      
      resolve(articulos);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Procesa un archivo subido y devuelve los artículos
 * @param {string} filePath - Ruta al archivo subido
 * @returns {Promise<Array>} - Array de artículos procesados
*/
async function processFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  
  if (extension === '.csv') {
    return processCSV(filePath);
  } else if (['.xlsx', '.xls'].includes(extension)) {
    return processExcel(filePath);
  } else {
    throw new Error('Formato de archivo no soportado');
  }
}

/**
 * Guarda los artículos en la base de datos con mejor manejo de actualizaciones
 * @param {Array} articulos - Array de artículos a guardar
 * @returns {Promise<object>} - Resultado de la operación
 */
async function saveArticulos(articulos) {
  let created = 0;
  let updated = 0;
  let errors = 0;
  const errorDetails = [];
  
  console.log(`🔄 Iniciando procesamiento de ${articulos.length} artículos...`);
  
  // Procesar cada artículo individualmente
  for (let i = 0; i < articulos.length; i++) {
    const articulo = articulos[i];
    try {
      console.log(`📝 Procesando artículo ${i + 1}/${articulos.length}: ${articulo.CodigoArticulo}`);
      
      // Verificar si el artículo ya existe
      const existingArticulo = await Articulo.findOne({ 
        CodigoArticulo: articulo.CodigoArticulo 
      });
      
      if (existingArticulo) {
        // ACTUALIZAR artículo existente
        console.log(`🔄 Actualizando artículo existente: ${articulo.CodigoArticulo}`);
        
        // Comparar valores para ver si realmente hay cambios
        const hasChanges = 
          existingArticulo.DescripcionArticulo !== articulo.DescripcionArticulo ||
          existingArticulo.PVP !== articulo.PVP ||
          existingArticulo.unidades !== articulo.unidades;
        
        if (hasChanges) {
          // Actualizar con los nuevos valores
          await Articulo.findByIdAndUpdate(
            existingArticulo._id,
            {
              DescripcionArticulo: articulo.DescripcionArticulo,
              PVP: articulo.PVP,
              unidades: articulo.unidades,
              updatedAt: new Date()
            },
            { new: true }
          );
          
          updated++;
          console.log(`✅ Artículo actualizado: ${articulo.CodigoArticulo}`);
        } else {
          console.log(`ℹ️ Sin cambios para: ${articulo.CodigoArticulo}`);
          // Aunque no haya cambios, contamos como actualizado para efectos del reporte
          updated++;
        }
      } else {
        // CREAR nuevo artículo
        console.log(`➕ Creando nuevo artículo: ${articulo.CodigoArticulo}`);
        
        const newArticulo = new Articulo({
          CodigoArticulo: articulo.CodigoArticulo,
          DescripcionArticulo: articulo.DescripcionArticulo,
          PVP: articulo.PVP,
          unidades: articulo.unidades
        });
        
        await newArticulo.save();
        created++;
        console.log(`✅ Nuevo artículo creado: ${articulo.CodigoArticulo}`);
      }
      
    } catch (error) {
      console.error(`❌ Error procesando artículo ${articulo.CodigoArticulo}:`, error.message);
      errors++;
      errorDetails.push({
        articulo: articulo.CodigoArticulo,
        error: error.message,
        data: articulo
      });
    }
  }
  
  console.log(`\n📊 Resumen del procesamiento:`);
  console.log(`   ✅ Creados: ${created}`);
  console.log(`   🔄 Actualizados: ${updated}`);
  console.log(`   ❌ Errores: ${errors}`);
  console.log(`   📦 Total procesados: ${articulos.length}`);
  
  return {
    success: errors === 0 || (created + updated) > 0, // Éxito si no hay errores O si se procesó algo
    total: articulos.length,
    created,
    updated,
    errors,
    errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
    message: `Procesamiento completado: ${created} creados, ${updated} actualizados, ${errors} errores`
  };
}

/**
 * Exporta artículos a formato JSON
 * @param {Array} articulos - Array de artículos
 * @returns {string} - JSON formateado
 */
function exportToJSON(articulos) {
  return JSON.stringify(articulos, null, 2);
}

/**
 * Función de diagnóstico para verificar la conexión a la base de datos
 * @returns {Promise<object>} - Estado de la conexión
 */
async function diagnoseDatabase() {
  try {
    // Intentar contar documentos
    const count = await Articulo.countDocuments();
    console.log(`🔍 Diagnóstico DB: ${count} artículos en la base de datos`);
    
    // Intentar crear un artículo de prueba
    const testArticulo = new Articulo({
      CodigoArticulo: `TEST_${Date.now()}`,
      DescripcionArticulo: 'Artículo de prueba',
      PVP: 1.0,
      unidades: 1
    });
    
    await testArticulo.save();
    console.log(`✅ Test de escritura exitoso`);
    
    // Eliminar el artículo de prueba
    await Articulo.findByIdAndDelete(testArticulo._id);
    console.log(`🧹 Artículo de prueba eliminado`);
    
    return {
      success: true,
      count,
      message: 'Base de datos funcionando correctamente'
    };
  } catch (error) {
    console.error(`❌ Error en diagnóstico de DB:`, error.message);
    return {
      success: false,
      error: error.message,
      message: 'Error en la conexión a la base de datos'
    };
  }
}

module.exports = {
  processFile,
  saveArticulos,
  exportToJSON,
  diagnoseDatabase
};