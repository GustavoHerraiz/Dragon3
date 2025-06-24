/**
 * @file analizadorResolucion.js
 * @version 3.0.0
 * @author Gustavo Herraiz
 * @description
 * Analiza la resolución y proporción de píxeles de una imagen para detectar posibles signos de IA, edición o manipulación.
 * Cumple estándar Dragon3/FAANG: logging (Winston), robustez, performance, máxima documentación y seguridad.
 */

import fs from 'fs';
import exifr from 'exifr';
import path from 'path';
import { log } from "../../utilidades/logger.js";

// --- Configuración y constantes ---
const ANALYZER_VERSION = '3.0.0';
const ANALYZER_ID = 'RESOLUCION_IMAGE_FAANG';
const ANALYZER_NAME = 'ANÁLISIS_DE_RESOLUCIÓN';

/**
 * Analiza la resolución, metadatos y proporciones de una imagen.
 * Devuelve score heurístico y detalles relevantes para IA o revisión humana.
 *
 * @param {string} filePath - Ruta absoluta del archivo de imagen.
 * @param {object} [configAnalisis] - Configuración extra (opcional, no usado ahora).
 * @param {string} [correlationId] - ID de correlación para trazabilidad.
 * @param {string} [imagenId] - ID único de imagen para tracking.
 * @returns {Promise<object>} Resultado estructurado y homogeneizado.
 */
export const analizar = async (
    filePath,
    configAnalisis = {},
    correlationId = 'N/A',
    imagenId = 'N/A'
) => {
    // Contexto base para todos los logs y resultados
    const baseMeta = {
        analizador: ANALYZER_ID,
        version: ANALYZER_VERSION,
        correlationId,
        imagenId,
        filePath
    };

    // Estructura de respuesta Dragon3/FAANG
    const resultado = {
        idAnalizador: ANALYZER_ID,
        nombreAnalizador: ANALYZER_NAME,
        version: ANALYZER_VERSION,
        descripcion: "Analiza la resolución, proporción de píxeles y metadatos para detectar IA, edición o manipulación.",
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
        performance: { duracionMs: null },
        logs: [],
        correlationId,
        imagenId,
        timestamp: Date.now()
    };

    const t0 = process.hrtime.bigint();

    try {
        // --- Validación de entrada ---
        if (!filePath || typeof filePath !== 'string') throw new Error("Parámetro filePath inválido o ausente.");
        if (!fs.existsSync(filePath)) throw new Error("El archivo no existe.");
        resultado.logs.push("Archivo validado para análisis de resolución.");
        log.info(`[${ANALYZER_ID}] Archivo validado.`, baseMeta);

        // --- Extracción de metadatos EXIF ---
        const buffer = fs.readFileSync(filePath);
        const metadatosCompletos = await exifr.parse(buffer, true) || {};
        resultado.logs.push("Metadatos EXIF extraídos correctamente.");
        log.info(`[${ANALYZER_ID}] Metadatos EXIF extraídos.`, baseMeta);

        // --- Extracción de dimensiones y resolución ---
        const ancho = metadatosCompletos.ImageWidth || metadatosCompletos.ExifImageWidth || metadatosCompletos.PixelXDimension || null;
        const alto  = metadatosCompletos.ImageHeight || metadatosCompletos.ExifImageHeight || metadatosCompletos.PixelYDimension || null;
        const resolucionX = metadatosCompletos.XResolution || null;
        const resolucionY = metadatosCompletos.YResolution || null;
        const unidadesResolucion = metadatosCompletos.ResolutionUnit || "ppi";

        resultado.metadatos.Fabricante = metadatosCompletos.Make || "No disponible";
        resultado.metadatos.Modelo = metadatosCompletos.Model || "No disponible";

        // --- Cálculo de proporción de aspecto (ancho/alto) ---
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
            log.warn(`[${ANALYZER_ID}] Dimensiones no encontradas o inválidas.`, { ...baseMeta, ancho, alto });
        }

        if (resolucionX && typeof resolucionX === 'number') {
            resultado.metadatos.ResoluciónHorizontal = `${resolucionX} ${unidadesResolucion}`;
        }
        if (resolucionY && typeof resolucionY === 'number') {
            resultado.metadatos.ResoluciónVertical = `${resolucionY} ${unidadesResolucion}`;
        }

        // --- Clasificación de proporción ---
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

        log.info(
            `[${ANALYZER_ID}] Procesado: Dimensiones=${resultado.metadatos.Dimensiones}, ResX=${resultado.metadatos.ResoluciónHorizontal}, ResY=${resultado.metadatos.ResoluciónVertical}, Proporción=${resultado.metadatos.Proporción}, ClasifProporción=${clasificacionProporcion}, Fabricante=${resultado.metadatos.Fabricante}, Modelo=${resultado.metadatos.Modelo}`,
            baseMeta
        );
        resultado.logs.push("Datos de resolución y proporción procesados.");

        // --- Score heurístico en base a la calidad de metadatos y dimensiones ---
        let puntosPorCalidad = 0;
        if (ancho && alto && typeof ancho === 'number' && typeof alto === 'number') {
            puntosPorCalidad += 2; // dimensiones presentes
            if (ancho * alto >= 2000 * 1500) {
                puntosPorCalidad += 2; // resolución buena
            }
            if (ancho * alto >= 4000 * 3000) {
                puntosPorCalidad += 2; // resolución excelente
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

        // --- Mensaje interpretativo según score ---
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
        log.error(`[${ANALYZER_ID}] Error catastrófico: ${error.message}`, { ...baseMeta, stack: error.stack });
    } finally {
        const t1 = process.hrtime.bigint();
        resultado.performance.duracionMs = Number(t1 - t0) / 1e6;
    }

    return resultado;
};