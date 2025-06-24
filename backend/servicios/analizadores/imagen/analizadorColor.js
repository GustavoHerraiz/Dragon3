/**
 * @file analizadorColor.js
 * @description Analizador de la composición cromática de una imagen.
 *              Extrae métricas relevantes de color, calcula un score de variación cromática
 *              y devuelve detalles legibles para el cliente. Incorpora logging profesional
 *              (Winston), manejo robusto de errores, y métricas de performance.
 * @module analizadores/analizadorColor
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { log } from '../../utilidades/logger.js'; // Logger centralizado Dragon3

// Nombre del módulo para logging y trazabilidad
const MODULE_NAME = path.basename(fileURLToPath(import.meta.url));

// --- Configuración de límites y parámetros globales ---
const TIMEOUT_MS = parseInt(process.env.ANALIZADOR_COLOR_TIMEOUT_MS || process.env.ANALIZADOR_TIMEOUT_MS || 3000, 10);
const MAX_IMAGE_SIZE_BYTES = parseInt(process.env.ANALIZADOR_COLOR_MAX_SIZE_BYTES || process.env.MAX_IMAGE_SIZE_BYTES || 15 * 1024 * 1024, 10);

// Log inicial de parámetros de configuración
log.info(`Config cargada: Timeout ${TIMEOUT_MS}ms, Tamaño máximo ${MAX_IMAGE_SIZE_BYTES} bytes.`, { modulo: MODULE_NAME, componente: 'Inicializacion' });

/**
 * Analiza la composición cromática de una imagen.
 * Devuelve métricas de color, score, detalles y performance.
 *
 * @param {string} filePath - Ruta absoluta al archivo de imagen.
 * @param {object} configAnalisis - Configuración específica del análisis (puede no usarse).
 * @param {string} correlationId - ID de correlación para trazabilidad.
 * @param {string} imagenId - ID de la imagen (opcional).
 * @returns {Promise<object>} Objeto resultado con score, detalles, metadatos, performance.
 */
export const analizar = async (filePath, configAnalisis, correlationId, imagenId = 'N/A') => {
    // Estructura base para trazabilidad/logs
    const baseMeta = { modulo: MODULE_NAME, correlationId, imagenId, funcion: 'analizar', filePath };

    // Inicia medición de performance
    const t0 = process.hrtime.bigint();

    // Objeto resultado inicializado y estructurado
    const resultado = {
        nombreAnalizador: MODULE_NAME.replace(/\.js$/i, "").toUpperCase(),
        descripcion: "Analiza la composición cromática de la imagen",
        score: null,
        detalles: {
            coloresDominantes: "No disponible",
            balanceColor: "No disponible",
            variacionColor: null,
            mensaje: "Análisis no procesado correctamente."
        },
        metadatos: {},
        performance: { duracionMs: null }
    };

    log.info(`Color: Inicio de análisis.`, baseMeta);

    try {
        // --- Validación de archivo (existencia y tamaño) ---
        if (!fs.existsSync(filePath)) {
            throw new Error(`Archivo no encontrado en la ruta: ${filePath}`);
        }
        const fileStats = fs.statSync(filePath);
        if (fileStats.size > MAX_IMAGE_SIZE_BYTES) {
            log.warn(`El archivo sobrepasa el tamaño recomendado. Puede afectar la performance.`, { ...baseMeta, fileSize: fileStats.size, maxSize: MAX_IMAGE_SIZE_BYTES });
        }
        log.debug(`Validación de archivo completada.`, baseMeta);

        // --- Procesado con Sharp: Metadatos y stats por canal ---
        const imagen = sharp(filePath).toColorspace('srgb'); // Forzar sRGB para consistencia
        const [metadata, statsSharp] = await Promise.all([
            imagen.metadata(),
            imagen.stats()
        ]);
        log.debug(`Metadatos y stats obtenidos.`, { ...baseMeta, imgWidth: metadata.width, imgHeight: metadata.height });

        // --- Validación de canales RGB ---
        if (!statsSharp.channels || statsSharp.channels.length < 3) {
            throw new Error(`Canales insuficientes para análisis RGB: ${statsSharp.channels?.length || 0} encontrados.`);
        }

        // --- Cálculo de variación cromática (stddev euclídea RGB) ---
        const stdDevs = statsSharp.channels.slice(0, 3).map(channel => channel.stdev);
        const variacionColor = Math.sqrt(stdDevs.reduce((sum, std) => sum + (std * std), 0)); // Euclídea

        log.debug(`Variación cromática calculada.`, { ...baseMeta, variacionColor: variacionColor.toFixed(2), stdDevs });

        // --- Score de color (0-10, calibrado sobre 128) ---
        resultado.score = Math.min(10, Math.max(0, Math.round((variacionColor / 128) * 10)));

        // --- Detalles: colores dominantes, balance y mensaje descriptivo ---
        const meanR = statsSharp.channels[0].mean.toFixed(0);
        const meanG = statsSharp.channels[1].mean.toFixed(0);
        const meanB = statsSharp.channels[2].mean.toFixed(0);

        resultado.detalles = {
            coloresDominantes: `RGB(${meanR}, ${meanG}, ${meanB}) (Promedio)`,
            balanceColor: variacionColor > 60 ? "Colores variados" : "Colores uniformes",
            variacionColor: variacionColor.toFixed(2),
            mensaje: resultado.score >= 8
                ? "Alta variación cromática, imagen rica en contraste."
                : resultado.score >= 6
                    ? "Variación cromática moderada, imagen balanceada."
                    : "Baja variación cromática, imagen uniforme."
        };

        // --- Metadatos técnicos para integraciones posteriores ---
        resultado.metadatos = {
            meanRed: parseFloat(meanR),
            meanGreen: parseFloat(meanG),
            meanBlue: parseFloat(meanB),
            stdDevRed: parseFloat(stdDevs[0].toFixed(2)),
            stdDevGreen: parseFloat(stdDevs[1].toFixed(2)),
            stdDevBlue: parseFloat(stdDevs[2].toFixed(2)),
            calculatedColorVariation: parseFloat(variacionColor.toFixed(2))
        };

        // --- Final de análisis: performance ---
        const t1 = process.hrtime.bigint();
        const duracionMs = Number(t1 - t0) / 1e6;
        resultado.performance.duracionMs = parseFloat(duracionMs.toFixed(2));
        resultado.metadatos.tiempoAnalisisMs = resultado.performance.duracionMs;

        // --- Pulso Redis (mantener solo si imprescindible, idealmente fuera de este módulo) ---
        try {
            const { redis: redisFromServer } = await import('../../server.js');
            if (redisFromServer && typeof redisFromServer.publish === 'function') {
                redisFromServer.publish('dragon:pulse', JSON.stringify({
                    ts: new Date().toISOString().slice(0,19).replace('T',' '),
                    comp: 'color',
                    t: resultado.performance.duracionMs,
                    cid: correlationId
                }));
                log.info(`Pulso Redis enviado (vía server.js, revisar arquitectura).`, {
                    ...baseMeta,
                    componente: 'RedisPulse',
                    canal: 'dragon:pulse',
                    moduloReportado: 'color',
                    tiempoMs: resultado.performance.duracionMs
                });
            } else {
                log.warn(`Redis no disponible o publish no es función. Pulso omitido.`, { ...baseMeta, componente: 'RedisPulse' });
            }
        } catch (redisError) {
            log.error(`Pulso Redis FALLIDO.`, redisError, { ...baseMeta, componente: 'RedisPulse' });
        }

        log.info(`Color: Fin del análisis. Score: ${resultado.score}. Duración: ${resultado.performance.duracionMs} ms.`, {
            ...baseMeta,
            scoreFinal: resultado.score,
            tiempoMs: resultado.performance.duracionMs,
            variacionColor: parseFloat(variacionColor.toFixed(2))
        });

    } catch (error) {
        resultado.score = null;
        resultado.detalles.mensaje = `Error durante el análisis de color: ${error.message}`;
        const tError = process.hrtime.bigint();
        const duracionMsError = Number(tError - t0) / 1e6;
        resultado.performance.duracionMs = parseFloat(duracionMsError.toFixed(2));
        log.error(`Color: EXCEPCIÓN en análisis. Duración: ${resultado.performance.duracionMs} ms.`, error, baseMeta);
    }

    return resultado;
};