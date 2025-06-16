/**
 * @file analizadorResolucion.js
 * @description Analiza la resolución de la imagen y la proporción de píxeles para detectar posibles signos de generación sintética, edición o manipulación.
 *              Cumple el estándar Dragon3/FAANG: logging (Winston), robustez, performance y documentación profesional.
 */

import fs from 'fs';
import exifr from 'exifr';
import { log } from "../../utilidades/logger.js";

/**
 * Analiza la resolución, metadatos y proporciones de una imagen.
 * Calcula score heurístico y devuelve detalles relevantes para IA o revisión humana.
 * @param {string} rutaArchivo - Ruta absoluta del archivo de imagen.
 * @returns {Promise<object>} Resultado estructurado del análisis.
 */
export const analizar = async (rutaArchivo) => {
    const resultado = {
        nombreAnalizador: "ANÁLISIS_DE_RESOLUCIÓN",
        descripcion: "Analiza la resolución de la imagen, evaluando la calidad y la proporción de píxeles para identificar características que puedan indicar generación sintética o edición.",
        score: null,
        detalles: {
            resolucion: "No disponible",
            proporcion: "No disponible",
            mensaje: "Análisis no procesado correctamente."
        },
        metadatos: {
            Dimensiones: "No disponible",
            ResoluciónHorizontal: "No disponible",
            ResoluciónVertical: "No disponible",
            Proporción: "No disponible",
            ClasificaciónProporción: "No disponible",
            Fabricante: "No disponible",
            Modelo: "No disponible"
        },
        logs: [] // Historial interno para trazabilidad en pipeline Dragon
    };

    try {
        // Validación de existencia de archivo
        if (!fs.existsSync(rutaArchivo)) {
            resultado.logs.push("Error: El archivo no existe.");
            log.error(`[analizadorResolucion] El archivo no existe: ${rutaArchivo}`);
            throw new Error("El archivo no existe.");
        }
        resultado.logs.push("Archivo validado para análisis de resolución.");
        log.info(`[analizadorResolucion] Archivo validado: ${rutaArchivo}`);

        // Leer archivo como buffer (preferido por exifr)
        const buffer = fs.readFileSync(rutaArchivo);
        // Leer todos los tags relevantes
        const metadatosCompletos = await exifr.parse(buffer, true) || {};

        // Log detallado de metadatos extraídos
        log.debug(`[analizadorResolucion] Metadatos crudos extraídos por exifr para ${rutaArchivo}: ${JSON.stringify(metadatosCompletos, null, 2)}`);
        resultado.logs.push(`Metadatos extraídos. Contenido: ${JSON.stringify(metadatosCompletos).substring(0, 200)}...`);

        // Extracción de dimensiones y resolución de distintas fuentes EXIF
        const ancho = metadatosCompletos.ImageWidth || metadatosCompletos.ExifImageWidth || metadatosCompletos.PixelXDimension || null;
        const alto = metadatosCompletos.ImageHeight || metadatosCompletos.ExifImageHeight || metadatosCompletos.PixelYDimension || null;

        const resolucionX = metadatosCompletos.XResolution || null;
        const resolucionY = metadatosCompletos.YResolution || null;
        const unidadesResolucion = metadatosCompletos.ResolutionUnit || "ppi";

        resultado.metadatos.Fabricante = metadatosCompletos.Make || "No disponible";
        resultado.metadatos.Modelo = metadatosCompletos.Model || "No disponible";

        // Cálculo de proporción de aspecto (ancho/alto)
        let proporcionNumerica = null;
        if (ancho && alto && typeof ancho === 'number' && typeof alto === 'number' && alto !== 0) {
            proporcionNumerica = ancho / alto;
            resultado.detalles.proporcion = proporcionNumerica.toFixed(2);
            resultado.metadatos.Proporción = resultado.detalles.proporcion;
            resultado.detalles.resolucion = `${ancho}x${alto}`;
            resultado.metadatos.Dimensiones = `${ancho}x${alto}`;
        } else {
            resultado.detalles.proporcion = "No disponible";
            resultado.metadatos.Proporción = "No disponible";
            resultado.detalles.resolucion = "Dimensiones no disponibles";
            resultado.metadatos.Dimensiones = "No disponible";
            log.warn(`[analizadorResolucion] Dimensiones no encontradas o inválidas en metadatos para ${rutaArchivo}. Ancho: ${ancho}, Alto: ${alto}`);
        }

        if (resolucionX && typeof resolucionX === 'number') {
            resultado.metadatos.ResoluciónHorizontal = `${resolucionX} ${unidadesResolucion}`;
        }
        if (resolucionY && typeof resolucionY === 'number') {
            resultado.metadatos.ResoluciónVertical = `${resolucionY} ${unidadesResolucion}`;
        }

        // Clasificación de proporción
        let clasificacionProporcion = "Proporción no calculable o atípica";
        if (proporcionNumerica !== null) {
            if (proporcionNumerica >= 0.98 && proporcionNumerica <= 1.02) {
                clasificacionProporcion = "Cuadrada (aprox. 1:1)";
            } else if (proporcionNumerica >= (16 / 9 - 0.05) && proporcionNumerica <= (16 / 9 + 0.05)) {
                clasificacionProporcion = "Panorámica (aprox. 16:9)";
            } else if (proporcionNumerica >= (4 / 3 - 0.03) && proporcionNumerica <= (4 / 3 + 0.03)) {
                clasificacionProporcion = "Clásica (aprox. 4:3)";
            } else if (proporcionNumerica >= (3 / 2 - 0.03) && proporcionNumerica <= (3 / 2 + 0.03)) {
                clasificacionProporcion = "Fotográfica (aprox. 3:2)";
            } else {
                clasificacionProporcion = "Proporción atípica";
            }
        }
        resultado.metadatos.ClasificaciónProporción = clasificacionProporcion;

        log.info(`[analizadorResolucion] Procesado para ${rutaArchivo}: Dimensiones=${resultado.metadatos.Dimensiones}, ResX=${resultado.metadatos.ResoluciónHorizontal}, ResY=${resultado.metadatos.ResoluciónVertical}, Proporción=${resultado.metadatos.Proporción}, Clasif.Proporción=${clasificacionProporcion}, Fab=${resultado.metadatos.Fabricante}, Mod=${resultado.metadatos.Modelo}`);
        resultado.logs.push("Datos de resolución y proporción procesados.");

        // Score heurístico en base a la calidad de metadatos y dimensiones
        let puntosPorCalidad = 0;
        if (ancho && alto && typeof ancho === 'number' && typeof alto === 'number') {
            puntosPorCalidad += 2; // Dimensiones presentes
            if (ancho * alto >= 2000 * 1500) {
                puntosPorCalidad += 2; // Resolución buena
            }
            if (ancho * alto >= 4000 * 3000) {
                puntosPorCalidad += 2; // Resolución excelente
            }
        } else {
            puntosPorCalidad = 0;
        }

        if (resultado.metadatos.Fabricante !== "No disponible" && resultado.metadatos.Modelo !== "No disponible") {
            puntosPorCalidad += 2;
        }

        if (ancho && alto) {
            resultado.score = Math.min(4 + puntosPorCalidad, 10);
        } else {
            resultado.score = 2;
        }

        // Actualizar mensaje en función del score y los datos
        if (!ancho || !alto) {
            resultado.detalles.mensaje = "No se pudieron determinar las dimensiones de la imagen a partir de los metadatos. La calidad de la resolución es desconocida.";
        } else if (resultado.score >= 8) {
            resultado.detalles.mensaje = "La imagen presenta una alta resolución y metadatos consistentes, sugiriendo buena calidad y posible creación humana detallada.";
        } else if (resultado.score >= 5) {
            resultado.detalles.mensaje = "La imagen tiene una resolución aceptable. Algunos parámetros de metadatos están presentes, lo que podría indicar creación humana.";
        } else {
            resultado.detalles.mensaje = "La imagen parece tener una resolución baja o metadatos limitados/ausentes, lo que podría ser indicativo de generación sintética, manipulación o edición extensiva.";
        }
        resultado.logs.push(`Score asignado: ${resultado.score}. Mensaje: ${resultado.detalles.mensaje}`);

    } catch (error) {
        resultado.score = 1;
        resultado.detalles.mensaje = `Error crítico durante el análisis de resolución: ${error.message}`;
        resultado.logs.push(`Error catastrófico: ${error.message}`);
        log.error(`[analizadorResolucion] Error catastrófico para ${rutaArchivo}: ${error.message}`, { stack: error.stack, error: error });
    }

    return resultado;
};