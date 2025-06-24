/**
 * @file analizadorDefinicion.js
 * @version 3.0.0
 * @author Gustavo Herraiz
 * @description
 * Analizador de definición y complejidad (nitidez, uniformidad, entropía) de una imagen.
 * Devuelve score [0-10], detalles interpretables y metadatos técnicos.
 * Cumple estándar Dragon3/FAANG: logging centralizado, robustez, métricas de performance y documentación exhaustiva.
 */

import fs from 'fs';
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import { log } from '../../utilidades/logger.js';

const ANALYZER_VERSION = '3.0.0';
const ANALYZER_ID = 'DEFINICION_IMAGE_FAANG';
const ANALYZER_NAME = 'ANALIZADOR_DEFINICION';

// --- Configuración de umbrales y pesos para el score ---
const UMBRAL_BAJA_NITIDEZ = 8;
const UMBRAL_ALTA_NITIDEZ = 15;
const W_NITIDEZ = 0.50;
const W_VARIABILIDAD = 0.30;
const W_COMPLEJIDAD_MODERADA = 0.20;

log.info("Definición: Config (umbrales y pesos) cargada.", {
    module: ANALYZER_NAME,
    component: 'Inicializacion',
    config: { UMBRAL_BAJA_NITIDEZ, UMBRAL_ALTA_NITIDEZ, W_NITIDEZ, W_VARIABILIDAD, W_COMPLEJIDAD_MODERADA }
});

/**
 * Calcula la entropía de Shannon normalizada [0,1] para un buffer de escala de grises.
 * @param {Buffer|Uint8Array|null} bufferGrises Buffer de píxeles en escala de grises.
 * @returns {number|null} Entropía normalizada (0-1) o null si no se puede calcular.
 */
function calcularEntropiaNormalizada(bufferGrises) {
    if (!bufferGrises?.length) return null;
    const F = new Array(256).fill(0);
    for (let i = 0; i < bufferGrises.length; i++) F[bufferGrises[i]]++;
    let H = 0;
    const totalPixels = bufferGrises.length;
    for (let i = 0; i < 256; i++) {
        if (F[i] > 0) {
            const p = F[i] / totalPixels;
            H -= p * Math.log2(p);
        }
    }
    return H / 8;
}

/**
 * Analiza la definición de una imagen: nitidez, complejidad y uniformidad tonal.
 * Calcula un score 0 (probable IA) a 10 (probable humano).
 * Devuelve detalles interpretativos y metadatos técnicos, e incluye métricas de performance.
 *
 * @async
 * @param {string} filePath Ruta al archivo de imagen.
 * @param {object} [configAnalisis] Configuración extra (opcional, no usada).
 * @param {string} [correlationId] ID de correlación para logs/trazabilidad.
 * @param {string} [imagenId] ID único de imagen.
 * @returns {Promise<object>} Resultado con score, detalles, metadatos y performance.
 */
export const analizar = async (
    filePath,
    configAnalisis = {},
    correlationId = 'N/A',
    imagenId = 'N/A'
) => {
    const baseMeta = {
        analizador: ANALYZER_ID,
        version: ANALYZER_VERSION,
        correlationId,
        imagenId,
        filePath,
        component: 'MainProcess'
    };

    const t0 = process.hrtime.bigint();

    // Estructura de respuesta homogénea Dragon3
    const resultado = {
        idAnalizador: ANALYZER_ID,
        nombreAnalizador: ANALYZER_NAME,
        version: ANALYZER_VERSION,
        descripcion: "Analiza nitidez, dimensiones, densidad, complejidad y uniformidad. Score 0 (IA) a 10 (Humano).",
        score: null,
        detalles: {},
        metadatos: {},
        performance: { duracionMs: null },
        logs: [],
        correlationId,
        imagenId,
        timestamp: Date.now()
    };

    log.info("Definición: Análisis iniciado.", { ...baseMeta, subComponent: 'Start' });

    try {
        if (!filePath || typeof filePath !== 'string') throw new Error("Parámetro filePath inválido o ausente.");
        if (!fs.existsSync(filePath)) throw new Error(`Archivo no encontrado: ${filePath}`);

        const imagen = sharp(filePath);
        const metadata = await imagen.metadata();

        resultado.metadatos.formato = metadata.format || null;
        resultado.metadatos.ancho = metadata.width || null;
        resultado.metadatos.alto = metadata.height || null;
        resultado.metadatos.densidad = metadata.density || null;
        resultado.metadatos.resolucionHorizontal = metadata.density || null;
        resultado.metadatos.resolucionVertical = metadata.density || null;

        log.debug("Definición: Metadatos extraídos.", { ...baseMeta, subComponent: 'MetadataExtraction', metadata });

        if (!metadata.width || !metadata.height || metadata.width <= 1 || metadata.height <= 1) {
            resultado.score = 0;
            resultado.detalles = {
                gradientePromedioBruto: null,
                nitidezEvaluada: "Indeterminable",
                evaluacionScore: "Indeterminado (Dimensiones)",
                mensajeScore: "Dimensiones insuficientes para análisis."
            };
            resultado.logs.push("Dimensiones insuficientes para análisis.");
            const t1 = process.hrtime.bigint();
            resultado.performance.duracionMs = parseFloat((Number(t1 - t0) / 1e6).toFixed(2));
            return resultado;
        }

        // --- Procesamiento en Escala de Grises y extracción de buffer RAW ---
        const pipelineGris = imagen.clone().greyscale();
        const { data: bufferGrises, info: infoGris } = await pipelineGris.raw().toBuffer({ resolveWithObject: true });
        log.debug("Definición: Imagen a gris y buffer RAW.", { ...baseMeta, subComponent: 'GreyscaleConversion', infoGris });

        // --- 1. Nitidez ---
        let S_nitidez_humano = 0.5;
        let gradientePromedio = null;
        let nitidezEvaluada = "Indeterminable";
        if (infoGris.height > 1 && infoGris.width > 0) {
            let sumaGradiente = 0;
            const numPixelesParaGradiente = infoGris.width * (infoGris.height - 1);
            for (let y = 0; y < infoGris.height - 1; y++) {
                const offsetFilaActual = y * infoGris.width;
                const offsetFilaSiguiente = (y + 1) * infoGris.width;
                for (let x = 0; x < infoGris.width; x++) {
                    sumaGradiente += Math.abs(bufferGrises[offsetFilaActual + x] - bufferGrises[offsetFilaSiguiente + x]);
                }
            }
            gradientePromedio = numPixelesParaGradiente > 0 ? sumaGradiente / numPixelesParaGradiente : 0;

            if (gradientePromedio >= UMBRAL_ALTA_NITIDEZ) {
                S_nitidez_humano = 0.1;
                nitidezEvaluada = "Alta";
            } else if (gradientePromedio < UMBRAL_BAJA_NITIDEZ) {
                S_nitidez_humano = 0.9;
                nitidezEvaluada = "Baja";
            } else {
                const fraccionRango = (gradientePromedio - UMBRAL_BAJA_NITIDEZ) / (UMBRAL_ALTA_NITIDEZ - UMBRAL_BAJA_NITIDEZ);
                S_nitidez_humano = 0.9 - (fraccionRango * 0.8);
                nitidezEvaluada = "Moderada";
            }
            log.debug("Definición: Nitidez calculada.", { ...baseMeta, subComponent: 'ScoreNitidez', gradiente: gradientePromedio, S_nitidez_humano: S_nitidez_humano.toFixed(2) });
        } else {
            nitidezEvaluada = "Indeterminable (Dims. Grises)";
            log.warn("Definición: Cálculo nitidez omitido, dims insuficientes.", { ...baseMeta, subComponent: 'ScoreNitidez', h: infoGris.height, w: infoGris.width });
        }

        // --- 2. Variabilidad (inverso de uniformidad tonal) ---
        let S_variabilidad_humano = 0.5;
        let uniformidadNormalizada = null;
        try {
            const stats = await pipelineGris.stats();
            if (stats.channels?.[0]?.stdev !== undefined) {
                const sigma = stats.channels[0].stdev;
                uniformidadNormalizada = Math.max(0, Math.min(1, 1 - (sigma / 128)));
                S_variabilidad_humano = 1 - uniformidadNormalizada;
                log.debug("Definición: Variabilidad calculada.", { ...baseMeta, subComponent: 'ScoreVariabilidad', uniformidad: uniformidadNormalizada, S_variabilidad_humano: S_variabilidad_humano.toFixed(2) });
            } else {
                log.warn("Definición: Desviación estándar no disponible.", { ...baseMeta, subComponent: 'ScoreVariabilidad', stats });
            }
        } catch (error) {
            log.error("Definición: Error stats variabilidad.", error, { ...baseMeta, subComponent: 'ScoreVariabilidadException' });
        }

        // --- 3. Complejidad (entropía normalizada, premiando valores medios) ---
        const complejidad = calcularEntropiaNormalizada(bufferGrises);
        let S_complejidad_moderada_humano = 0.5;
        if (complejidad !== null) {
            S_complejidad_moderada_humano = Math.exp(-15 * Math.pow(complejidad - 0.6, 2));
            log.debug("Definición: Complejidad calculada.", { ...baseMeta, subComponent: 'ScoreComplejidad', entropia: complejidad, S_complejidad_moderada_humano: S_complejidad_moderada_humano.toFixed(2) });
        } else {
            log.warn("Definición: Entropía no calculada.", { ...baseMeta, subComponent: 'ScoreComplejidad' });
        }

        // --- Score final ponderado y evaluación cualitativa ---
        let scorePonderado_0_1 = (
            S_nitidez_humano * W_NITIDEZ +
            S_variabilidad_humano * W_VARIABILIDAD +
            S_complejidad_moderada_humano * W_COMPLEJIDAD_MODERADA
        );
        scorePonderado_0_1 = Math.max(0, Math.min(1, scorePonderado_0_1));
        const scoreAnalizador = parseFloat((scorePonderado_0_1 * 10).toFixed(1));

        let evaluacionScore = "Indeterminado";
        if (scoreAnalizador >= 8.0) evaluacionScore = "Muy Alta Probabilidad Humano";
        else if (scoreAnalizador >= 6.0) evaluacionScore = "Alta Probabilidad Humano";
        else if (scoreAnalizador >= 4.0) evaluacionScore = "Indeterminado / Mixto";
        else if (scoreAnalizador >= 2.0) evaluacionScore = "Alta Probabilidad IA";
        else evaluacionScore = "Muy Alta Probabilidad IA";

        resultado.score = scoreAnalizador;
        resultado.detalles = {
            gradientePromedioBruto: gradientePromedio !== null ? parseFloat(gradientePromedio.toFixed(2)) : null,
            nitidezEvaluada,
            evaluacionScore,
            mensajeScore: `Análisis completado. Nitidez: ${nitidezEvaluada}. Score: ${scoreAnalizador}/10 (${evaluacionScore}).`
        };
        resultado.metadatos = {
            formato: metadata.format || null,
            ancho: metadata.width || null,
            alto: metadata.height || null,
            densidad: metadata.density || null,
            resolucionHorizontal: metadata.density || null,
            resolucionVertical: metadata.density || null,
            complejidad: complejidad !== null ? parseFloat(complejidad.toFixed(4)) : null,
            uniformidad: uniformidadNormalizada !== null ? parseFloat(uniformidadNormalizada.toFixed(4)) : null
        };

        resultado.logs.push(`Score final: ${scoreAnalizador}. Evaluación: ${evaluacionScore}.`);

        log.info("Definición: Score final.", { ...baseMeta, subComponent: 'FinalScoreCalculation', scoreFinal: scoreAnalizador, evaluacionScore });

    } catch (error) {
        resultado.score = 0;
        resultado.detalles = {
            gradientePromedioBruto: null,
            nitidezEvaluada: "Error",
            evaluacionScore: "Error Crítico",
            mensajeScore: `Error crítico en análisis de definición: ${error.message}`
        };
        Object.keys(resultado.metadatos).forEach(key => resultado.metadatos[key] = null);
        resultado.logs.push(`Error crítico: ${error.message}`);
        log.error("Definición: Error crítico durante el análisis.", error, { ...baseMeta, subComponent: 'MainException' });
    }

    // --- Performance: duración total en ms ---
    const t1 = process.hrtime.bigint();
    resultado.performance.duracionMs = parseFloat((Number(t1 - t0) / 1e6).toFixed(2));
    resultado.logs.push(`Duración análisis: ${resultado.performance.duracionMs} ms`);

    log.info("Definición: Análisis finalizado.", { ...baseMeta, subComponent: 'End', scoreEmitido: resultado.score, duracionMs: resultado.performance.duracionMs });

    return resultado;
};