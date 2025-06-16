/**
 * @file analizadorDefinicion.js
 * @description Analizador de la definición y complejidad (nitidez, uniformidad, entropía) de una imagen.
 *              Devuelve un score [0-10], detalles interpretables y metadatos técnicos. Cumple estándar Dragon3/FAANG:
 *              logging centralizado, robustez, métricas de performance y documentación exhaustiva.
 * @module analizadores/analizadorDefinicion
 */

import fs from 'fs';
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import { log } from '../../utilidades/logger.js'; // Logger central Dragon3

const MODULE_NAME = path.basename(fileURLToPath(import.meta.url));

// --- Configuración de umbrales y pesos para el score ---
const UMBRAL_BAJA_NITIDEZ = 8;
const UMBRAL_ALTA_NITIDEZ = 15;
const W_NITIDEZ = 0.50;
const W_VARIABILIDAD = 0.30;
const W_COMPLEJIDAD_MODERADA = 0.20;

log.info("Definición: Config (umbrales y pesos) cargada.", {
    module: MODULE_NAME,
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
 * @param {object} configAnalisis No usado (reserva).
 * @param {string} correlationId ID de correlación para logs/trazabilidad.
 * @param {string} [imagenId='N/A'] ID único de imagen.
 * @returns {Promise<object>} Resultado con score, detalles, metadatos y performance.
 */
export const analizar = async (filePath, configAnalisis, correlationId, imagenId = 'N/A') => {
    const baseMeta = { module: MODULE_NAME, correlationId, imagenId, filePath, component: 'MainProcess' };
    const t0 = process.hrtime.bigint();

    const resultadoMetadatos = {
        formato: null, ancho: null, alto: null, densidad: null,
        resolucionHorizontal: null, resolucionVertical: null,
        complejidad: null, uniformidad: null
    };
    const resultadoDetalles = {
        gradientePromedioBruto: null, nitidezEvaluada: "Indeterminable",
        evaluacionScore: "Indeterminado",
        mensajeScore: "Análisis de definición no iniciado completamente."
    };
    let scoreAnalizador = 0;

    log.info("Definición: Análisis iniciado.", { ...baseMeta, subComponent: 'Start' });

    try {
        if (!fs.existsSync(filePath)) throw new Error(`Archivo no encontrado: ${filePath}`);

        const imagen = sharp(filePath);
        const metadata = await imagen.metadata();

        resultadoMetadatos.formato = metadata.format || null;
        resultadoMetadatos.ancho = metadata.width || null;
        resultadoMetadatos.alto = metadata.height || null;
        resultadoMetadatos.densidad = metadata.density || null;
        resultadoMetadatos.resolucionHorizontal = metadata.density || null;
        resultadoMetadatos.resolucionVertical = metadata.density || null;

        log.debug("Definición: Metadatos extraídos.", { ...baseMeta, subComponent: 'MetadataExtraction', metadata });

        if (!metadata.width || !metadata.height || metadata.width <= 1 || metadata.height <= 1) {
            resultadoDetalles.mensajeScore = "Dimensiones insuficientes para análisis.";
            resultadoDetalles.evaluacionScore = "Indeterminado (Dimensiones)";
            log.warn("Definición: Dimensiones insuficientes.", { ...baseMeta, subComponent: 'PreconditionCheck', width: metadata.width, height: metadata.height });
            const t1 = process.hrtime.bigint();
            const duracionMs = Number(t1 - t0) / 1e6;
            return {
                nombreAnalizador: MODULE_NAME.replace(/\.js$/i, "").toUpperCase(),
                descripcion: "Analiza nitidez, dimensiones, etc. Genera score 0 (IA) a 10 (Humano).",
                score: scoreAnalizador,
                detalles: resultadoDetalles,
                metadatos: { ...resultadoMetadatos, duracionMs: parseFloat(duracionMs.toFixed(2)) },
                performance: { duracionMs: parseFloat(duracionMs.toFixed(2)) }
            };
        }

        // --- Procesamiento en Escala de Grises y extracción de buffer RAW ---
        const pipelineGris = imagen.clone().greyscale();
        const { data: bufferGrises, info: infoGris } = await pipelineGris.raw().toBuffer({ resolveWithObject: true });
        log.debug("Definición: Imagen a gris y buffer RAW.", { ...baseMeta, subComponent: 'GreyscaleConversion', infoGris });

        // --- 1. Nitidez ---
        let S_nitidez_humano = 0.5;
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
            const gradientePromedio = numPixelesParaGradiente > 0 ? sumaGradiente / numPixelesParaGradiente : 0;
            resultadoDetalles.gradientePromedioBruto = parseFloat(gradientePromedio.toFixed(2));

            if (gradientePromedio >= UMBRAL_ALTA_NITIDEZ) {
                S_nitidez_humano = 0.1;
                resultadoDetalles.nitidezEvaluada = "Alta";
            } else if (gradientePromedio < UMBRAL_BAJA_NITIDEZ) {
                S_nitidez_humano = 0.9;
                resultadoDetalles.nitidezEvaluada = "Baja";
            } else {
                const fraccionRango = (gradientePromedio - UMBRAL_BAJA_NITIDEZ) / (UMBRAL_ALTA_NITIDEZ - UMBRAL_BAJA_NITIDEZ);
                S_nitidez_humano = 0.9 - (fraccionRango * 0.8);
                resultadoDetalles.nitidezEvaluada = "Moderada";
            }
            log.debug("Definición: Nitidez calculada.", { ...baseMeta, subComponent: 'ScoreNitidez', gradiente: resultadoDetalles.gradientePromedioBruto, S_nitidez_humano: S_nitidez_humano.toFixed(2) });
        } else {
            resultadoDetalles.nitidezEvaluada = "Indeterminable (Dims. Grises)";
            log.warn("Definición: Cálculo nitidez omitido, dims insuficientes.", { ...baseMeta, subComponent: 'ScoreNitidez', h: infoGris.height, w: infoGris.width });
        }

        // --- 2. Variabilidad (inverso de uniformidad tonal) ---
        let S_variabilidad_humano = 0.5;
        try {
            const stats = await pipelineGris.stats();
            if (stats.channels?.[0]?.stdev !== undefined) {
                const sigma = stats.channels[0].stdev;
                const uniformidadNormalizada = Math.max(0, Math.min(1, 1 - (sigma / 128)));
                resultadoMetadatos.uniformidad = parseFloat(uniformidadNormalizada.toFixed(4));
                S_variabilidad_humano = 1 - uniformidadNormalizada;
                log.debug("Definición: Variabilidad calculada.", { ...baseMeta, subComponent: 'ScoreVariabilidad', uniformidad: resultadoMetadatos.uniformidad, S_variabilidad_humano: S_variabilidad_humano.toFixed(2) });
            } else {
                log.warn("Definición: Desviación estándar no disponible.", { ...baseMeta, subComponent: 'ScoreVariabilidad', stats });
            }
        } catch (error) {
            log.error("Definición: Error stats variabilidad.", error, { ...baseMeta, subComponent: 'ScoreVariabilidadException' });
        }

        // --- 3. Complejidad (entropía normalizada, premiando valores medios) ---
        resultadoMetadatos.complejidad = calcularEntropiaNormalizada(bufferGrises);
        let S_complejidad_moderada_humano = 0.5;
        if (resultadoMetadatos.complejidad !== null) {
            S_complejidad_moderada_humano = Math.exp(-15 * Math.pow(resultadoMetadatos.complejidad - 0.6, 2));
            log.debug("Definición: Complejidad calculada.", { ...baseMeta, subComponent: 'ScoreComplejidad', entropia: resultadoMetadatos.complejidad, S_complejidad_moderada_humano: S_complejidad_moderada_humano.toFixed(2) });
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
        scoreAnalizador = parseFloat((scorePonderado_0_1 * 10).toFixed(1));

        if (scoreAnalizador >= 8.0) resultadoDetalles.evaluacionScore = "Muy Alta Probabilidad Humano";
        else if (scoreAnalizador >= 6.0) resultadoDetalles.evaluacionScore = "Alta Probabilidad Humano";
        else if (scoreAnalizador >= 4.0) resultadoDetalles.evaluacionScore = "Indeterminado / Mixto";
        else if (scoreAnalizador >= 2.0) resultadoDetalles.evaluacionScore = "Alta Probabilidad IA";
        else resultadoDetalles.evaluacionScore = "Muy Alta Probabilidad IA";

        resultadoDetalles.mensajeScore = `Análisis completado. Nitidez: ${resultadoDetalles.nitidezEvaluada}. Score: ${scoreAnalizador}/10 (${resultadoDetalles.evaluacionScore}).`;
        log.info("Definición: Score final.", { ...baseMeta, subComponent: 'FinalScoreCalculation', scoreFinal: scoreAnalizador, evaluacionScore: resultadoDetalles.evaluacionScore });

    } catch (error) {
        log.error("Definición: Error crítico durante el análisis.", error, { ...baseMeta, subComponent: 'MainException' });
        Object.keys(resultadoMetadatos).forEach(key => { resultadoMetadatos[key] = null; });
        resultadoDetalles.mensajeScore = `Error crítico en análisis de definición: ${error.message}`;
        resultadoDetalles.evaluacionScore = "Error Crítico";
        resultadoDetalles.nitidezEvaluada = "Error";
        scoreAnalizador = 0;
    }

    // --- Performance: duración total en ms ---
    const t1 = process.hrtime.bigint();
    const duracionMs = Number(t1 - t0) / 1e6;

    log.info("Definición: Análisis finalizado.", { ...baseMeta, subComponent: 'End', scoreEmitido: scoreAnalizador, duracionMs: parseFloat(duracionMs.toFixed(2)) });

    return {
        nombreAnalizador: MODULE_NAME.replace(/\.js$/i, "").toUpperCase(),
        descripcion: "Analiza nitidez, dimensiones, densidad, complejidad y uniformidad. Genera score 0 (IA) a 10 (Humano).",
        score: scoreAnalizador,
        detalles: resultadoDetalles,
        metadatos: { ...resultadoMetadatos, duracionMs: parseFloat(duracionMs.toFixed(2)) },
        performance: { duracionMs: parseFloat(duracionMs.toFixed(2)) }
    };
};