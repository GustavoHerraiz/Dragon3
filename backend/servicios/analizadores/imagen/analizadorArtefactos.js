/**
 * @file analizadorArtefactos.js
 * @version 3.0.0
 * @author Gustavo Herraiz
 * @description
 * Analizador de artefactos visuales en imágenes (canal de luminancia Y).
 * Detección avanzada de blockiness, patrones GAN/diffusion, artefactos IA genuinos.
 * Calcula un score de autenticidad, datos para red neuronal, y estructura la información explicable.
 * Cumple con los estándares Dragon3/FAANG: logging (Winston), robustez, performance, KISS y documentación profesional.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { log } from '../../utilidades/logger.js';

// --- Identificadores y versión ---
const ANALYZER_VERSION = '3.0.0';
const ANALYZER_ID = 'ARTEFACTOS_IMAGE_FAANG';
const ANALYZER_NAME = 'ANALIZADOR_ARTEFACTOS';

// --- Constantes de referencia ---
const MAX_DIMENSION = 8000;
const MAX_RESOLUCION_DPI = 1200;
const MAX_GRADIENTE_ESTIMADO_LUMA = 80;
const MIN_GRADIENTE_ESTIMADO_LUMA_NATURAL = 10;
const MAX_ENTROPIA_LUMA = 8;
const MAX_DESVIACION_ESTANDAR_LUMA = 75;
const MAX_BLOCKINESS_CONSIDERED_LOW_FOR_IA = 12;

// Normaliza valor a [0, 1], fallback 0.5.
function scaleToUnity(value, max) {
    if (typeof value === 'number' && !isNaN(value) && typeof max === 'number' && !isNaN(max) && max > 0) {
        return Math.max(0, Math.min(1, value / max));
    }
    return 0.5;
}

// Convierte buffer RGB a luminancia (Y) usando BT.709.
function rgbToLuminance(rgbBuffer, width, height, channels) {
    const numPixels = width * height;
    const luminance = new Uint8Array(numPixels);
    if (channels < 3 || rgbBuffer.length < numPixels * channels) {
        log.warn("Datos RGB insuficientes o canales incorrectos para conversión a luminancia.", { mod: ANALYZER_NAME, w:width, h:height, c:channels, bufLen:rgbBuffer.length });
        return new Uint8Array(0);
    }
    for (let i = 0, j = 0; i < numPixels * channels; i += channels, j++) {
        const r = rgbBuffer[i];
        const g = rgbBuffer[i + 1];
        const b = rgbBuffer[i + 2];
        luminance[j] = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    }
    return luminance;
}

// Calcula entropía de Shannon para un histograma de luminancia.
function calcularEntropia(histogramaY, totalPixeles) {
    if (!histogramaY || totalPixeles <= 0) return 0;
    let entropia = 0;
    for (let i = 0; i < histogramaY.length; i++) {
        if (histogramaY[i] > 0) {
            const probabilidad = histogramaY[i] / totalPixeles;
            entropia -= probabilidad * Math.log2(probabilidad);
        }
    }
    return entropia;
}

// Calcula desviación estándar de un histograma de luminancia.
function calcularDesviacionEstandarHist(histogramaY, totalPixeles, mediaY) {
    if (!histogramaY || totalPixeles <= 0) return 0;
    let sumaCuadradosDiferencias = 0;
    for (let valorPixel = 0; valorPixel < histogramaY.length; valorPixel++) {
        if (histogramaY[valorPixel] > 0) {
            sumaCuadradosDiferencias += histogramaY[valorPixel] * Math.pow(valorPixel - mediaY, 2);
        }
    }
    return Math.sqrt(sumaCuadradosDiferencias / totalPixeles);
}

// Detecta artefactos de compresión (blockiness) en el canal de luminancia.
function calcularBlockiness(luminanceData, width, height, blockSize = 8) {
    if (width < blockSize * 2 || height < blockSize * 2) return 0;
    let totalHorizontalDiff = 0;
    let horizontalEdges = 0;
    for (let y = 0; y < height; y++) {
        for (let x = blockSize - 1; x < width - 1; x += blockSize) {
            totalHorizontalDiff += Math.abs(luminanceData[y * width + x] - luminanceData[y * width + x + 1]);
            horizontalEdges++;
        }
    }
    let totalVerticalDiff = 0;
    let verticalEdges = 0;
    for (let x = 0; x < width; x++) {
        for (let y = blockSize - 1; y < height - 1; y += blockSize) {
            totalVerticalDiff += Math.abs(luminanceData[y * width + x] - luminanceData[(y + 1) * width + x]);
            verticalEdges++;
        }
    }
    if (horizontalEdges === 0 && verticalEdges === 0) return 0;
    return (totalHorizontalDiff + totalVerticalDiff) / (horizontalEdges + verticalEdges);
}

// Calcula estadísticas clave sobre el canal de luminancia (Y).
function calcularEstadisticasLuminancia(luminanceData, width, height) {
    const histogramaY = new Array(256).fill(0);
    let sumaValoresY = 0;
    let sumaGradientes = 0;
    let conteoGradientes = 0;
    const totalPixeles = width * height;

    if (totalPixeles === 0 || luminanceData.length !== totalPixeles) {
        log.warn("Datos de luminancia insuficientes o inconsistentes.", { mod: ANALYZER_NAME, w:width, h:height, len:luminanceData.length });
        return { histogramaY, mediaY: 0, desviacionEstandarY: 0, gradientePromedioY: 0, totalPixeles: 0, picosAltosY:0 };
    }

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const valorY = luminanceData[idx];
            histogramaY[valorY]++;
            sumaValoresY += valorY;
            if (x < width - 1 && y < height - 1) {
                const gradH = Math.abs(valorY - luminanceData[idx + 1]);
                const gradV = Math.abs(valorY - luminanceData[idx + width]);
                sumaGradientes += gradH + gradV;
                conteoGradientes += 2;
            }
        }
    }
    const picosAltosY = histogramaY.filter(v => v > totalPixeles * 0.06).length;
    const mediaY = totalPixeles > 0 ? sumaValoresY / totalPixeles : 0;
    const desviacionEstandarY = totalPixeles > 0 ? calcularDesviacionEstandarHist(histogramaY, totalPixeles, mediaY) : 0;
    const gradientePromedioY = conteoGradientes > 0 ? sumaGradientes / conteoGradientes : 0;

    return { histogramaY, mediaY, desviacionEstandarY, gradientePromedioY, totalPixeles, picosAltosY };
}

/**
 * Analiza imagen para artefactos, blockiness y patrones IA/GAN/diffusion.
 * Devuelve resultado estructurado con score, versión, identificadores y métricas.
 * @param {string} filePath - Ruta absoluta al archivo de imagen.
 * @param {object} [configAnalisis] - Configuración específica del análisis (opcional).
 * @param {string} [correlationId] - ID de correlación para trazabilidad/logs.
 * @param {string} [imagenId] - ID de imagen para seguimiento.
 * @returns {Promise<object>} Objeto resultado.
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
        filePath
    };

    const t0 = process.hrtime.bigint();

    // Respuesta estructurada, contrato Dragon3
    const resultado = {
        idAnalizador: ANALYZER_ID,
        nombreAnalizador: ANALYZER_NAME,
        version: ANALYZER_VERSION,
        descripcion: "Analiza artefactos visuales (luminancia, blockiness, IA/GAN/diffusion) y prepara datos para red neuronal.",
        score: null,
        detalles: {},
        metadatos: { datosParaRedEspejoArtefactos: new Array(10).fill(0.5) },
        performance: { duracionMs: null },
        logs: [],
        correlationId,
        imagenId,
        timestamp: Date.now()
    };

    try {
        // --- Validación inicial ---
        if (!filePath || typeof filePath !== 'string') throw new Error("Parámetro filePath inválido o ausente.");
        if (!fs.existsSync(filePath)) throw new Error(`Archivo no encontrado: ${filePath}`);
        resultado.logs.push("Archivo validado para análisis de artefactos.");
        log.info(`[${ANALYZER_ID}] Archivo validado.`, baseMeta);

        // --- Procesado de imagen ---
        const imagenSharp = sharp(filePath);
        const metadata = await imagenSharp.metadata();
        const { width, height, channels, density: sharpDensity, format } = metadata;
        if (!width || !height || !channels) throw new Error("Metadatos imagen (dim/canales) incompletos.");

        log.debug(`[${ANALYZER_ID}] Metadatos OK.`, { ...baseMeta, w: width, h: height, c: channels, dpi: sharpDensity || 'N/A', format: format || 'N/A' });

        const pixelDataRGB = await imagenSharp.raw().toBuffer();
        const luminanceData = rgbToLuminance(pixelDataRGB, width, height, channels);
        if (luminanceData.length !== width * height) {
            throw new Error("Error en conversión a luminancia o datos inconsistentes.");
        }

        const statsLuma = calcularEstadisticasLuminancia(luminanceData, width, height);
        if (statsLuma.totalPixeles === 0) throw new Error("Procesamiento de luminancia fallido.");
        const blockiness = calcularBlockiness(luminanceData, width, height);
        const entropiaY = calcularEntropia(statsLuma.histogramaY, statsLuma.totalPixeles);

        // --- Lógica de detección de artefactos (IA/GAN/diffusion) ---
        let suavidadExcesivaIA = statsLuma.gradientePromedioY < MIN_GRADIENTE_ESTIMADO_LUMA_NATURAL &&
                                 (entropiaY > 7.0 || statsLuma.desviacionEstandarY > 50);
        let checkerboardGAN = (statsLuma.picosAltosY < 8 && blockiness < 10 && entropiaY > 6.85);
        let patronesGAN = statsLuma.gradientePromedioY < 11 && statsLuma.picosAltosY > 10 && statsLuma.picosAltosY < 60 && entropiaY > 7.1;
        let patronesRepetitivosIA = patronesGAN || checkerboardGAN || ((blockiness < MAX_BLOCKINESS_CONSIDERED_LOW_FOR_IA) && suavidadExcesivaIA);
        let compresionExcesivaJPEG = blockiness > 10 && blockiness < MAX_BLOCKINESS_CONSIDERED_LOW_FOR_IA;
        let compresionMuyExcesivaJPEG = blockiness >= MAX_BLOCKINESS_CONSIDERED_LOW_FOR_IA;
        let bordesInconsistentes = (statsLuma.gradientePromedioY > 20 || statsLuma.desviacionEstandarY > 65) && !suavidadExcesivaIA;
        let contrasteExtremoLuma = statsLuma.desviacionEstandarY > 70;
        let texturasInconsistentes = false;
        const numPixelesPorMitad = Math.floor(statsLuma.totalPixeles / 2);
        if (numPixelesPorMitad > 0 && (statsLuma.totalPixeles - numPixelesPorMitad) > 0) {
            let sumaY1 = 0; for(let i=0; i<numPixelesPorMitad; i++) sumaY1 += luminanceData[i];
            let sumaY2 = 0; for(let i=numPixelesPorMitad; i<statsLuma.totalPixeles; i++) sumaY2 += luminanceData[i];
            const mediaY1 = sumaY1 / numPixelesPorMitad;
            const mediaY2 = sumaY2 / (statsLuma.totalPixeles - numPixelesPorMitad);
            if (Math.abs(mediaY1 - mediaY2) > 28) texturasInconsistentes = true;
        }

        // --- Score ponderado (KISS) ---
        const pesos = {
            suavidadIA: 0.28,
            patronesGAN: 0.20,
            checkerboardGAN: 0.12,
            bordes: 0.10,
            texturas: 0.10,
            contraste: 0.08,
            blockinessMod: 0.07,
            blockinessHigh: 0.05
        };
        let scoreCalculado = pesos.suavidadIA * (suavidadExcesivaIA ? 0 : 1) +
                             pesos.patronesGAN * (patronesGAN ? 0 : 1) +
                             pesos.checkerboardGAN * (checkerboardGAN ? 0 : 1) +
                             pesos.bordes * (bordesInconsistentes ? 0 : 1) +
                             pesos.texturas * (texturasInconsistentes ? 0 : 1) +
                             pesos.contraste * (contrasteExtremoLuma ? 0 : 1) +
                             pesos.blockinessMod * (compresionExcesivaJPEG ? 0 : 1) +
                             pesos.blockinessHigh * (compresionMuyExcesivaJPEG ? 0 : 1);

        resultado.score = parseFloat((scoreCalculado * 10).toFixed(1));
        resultado.logs.push(`Score artefactos (Luma/IA/GAN): ${resultado.score}/10.`);

        // --- Datos para red espejo (vector normalizado) ---
        resultado.metadatos.datosParaRedEspejoArtefactos = [
            scaleToUnity(width, MAX_DIMENSION),
            scaleToUnity(height, MAX_DIMENSION),
            sharpDensity ? scaleToUnity(sharpDensity, MAX_RESOLUCION_DPI) : 0.5,
            sharpDensity ? scaleToUnity(sharpDensity, MAX_RESOLUCION_DPI) : 0.5,
            sharpDensity ? scaleToUnity(sharpDensity, MAX_RESOLUCION_DPI) : 0.5,
            (width > 0 && height > 0) ? Math.min(width, height) / Math.max(width, height) : 0.5,
            scaleToUnity(entropiaY, MAX_ENTROPIA_LUMA),
            Math.max(0, Math.min(1, 1 - scaleToUnity(entropiaY, MAX_ENTROPIA_LUMA))),
            scaleToUnity(statsLuma.gradientePromedioY, MAX_GRADIENTE_ESTIMADO_LUMA),
            Math.max(0, Math.min(1, 1 - (resultado.score / 10)))
        ];

        // --- Detalles interpretables ---
        resultado.detalles = {
            puntuacionArtefactos: `${resultado.score}/10`,
            propiedadesBasicasImagen: {
                dimensiones: `${width}x${height} px`,
                resolucion: sharpDensity ? `${sharpDensity} DPI` : "No disponible",
                formato: format || "No disponible"
            },
            blockinessDetectada: compresionExcesivaJPEG ? `Moderada (${blockiness.toFixed(1)})` : (compresionMuyExcesivaJPEG ? `Alta (${blockiness.toFixed(1)})` : `No significativa (${blockiness.toFixed(1)})`),
            hallazgosClave: [],
            evaluacionGeneral: "",
            mensajePrincipal: "",
            indiciosFotomontaje: (texturasInconsistentes || (bordesInconsistentes && !suavidadExcesivaIA)) ? "Posible" : "Bajo",
            indiciosGeneracionIA: (patronesRepetitivosIA || suavidadExcesivaIA || patronesGAN || checkerboardGAN) ? "Alto" : "Medio"
        };

        // Hallazgos explicables
        const hallazgos = [];
        if (suavidadExcesivaIA) hallazgos.push("Detectada suavidad excesiva y complejidad anómala, característica común en imágenes generadas por IA.");
        if (patronesGAN) hallazgos.push("Patrones espectrales de luminancia anómalos coincidentes con GAN/diffusion.");
        if (checkerboardGAN) hallazgos.push("Checkerboard/falsos contornos detectados, típico de IA (GAN/diffusion).");
        if (bordesInconsistentes) hallazgos.push("Se observan bordes con contraste o variaciones abruptas en la luminancia.");
        if (texturasInconsistentes) hallazgos.push("Detectada posible inconsistencia en la luminosidad promedio entre grandes regiones.");
        if (contrasteExtremoLuma) hallazgos.push("El contraste general de la luminancia es extremadamente alto.");
        if (compresionExcesivaJPEG) hallazgos.push(`Detectados artefactos de compresión tipo bloque moderados (blockiness: ${blockiness.toFixed(1)}).`);
        if (compresionMuyExcesivaJPEG) hallazgos.push(`Detectados artefactos de compresión tipo bloque altos (blockiness: ${blockiness.toFixed(1)}).`);

        resultado.detalles.hallazgosClave = hallazgos.length > 0 ? hallazgos : ["No se identificaron artefactos relevantes ni características de IA/GAN."];
        if (resultado.score >= 8) {
            resultado.detalles.evaluacionGeneral = "Sin alertas de artefactos ni patrones IA/GAN.";
            resultado.detalles.mensajePrincipal = `Imagen con patrones naturales o sin indicios fuertes de IA/GAN.`;
        } else if (resultado.score >= 5) {
            resultado.detalles.evaluacionGeneral = "Algunos artefactos o características IA/GAN detectados; se recomienda cautela.";
            resultado.detalles.mensajePrincipal = `Se detectan indicios compatibles con IA/GAN o compresión fuerte.`;
        } else {
            resultado.detalles.evaluacionGeneral = "Indicios notables de artefactos o fuerte sospecha de IA/GAN; revisión detallada sugerida.";
            resultado.detalles.mensajePrincipal = `Patrones o artefactos típicos de IA/GAN/diffusion presentes.`;
        }

        // Metadatos clave para trazabilidad y auditoría
        resultado.metadatos.AnalisisLuminanciaIA_v3 = true;
        resultado.metadatos.EntropiaLuminancia_raw = parseFloat(entropiaY.toFixed(3));
        resultado.metadatos.GradientePromedioLuminancia_raw = parseFloat(statsLuma.gradientePromedioY.toFixed(2));
        resultado.metadatos.MediaLuminancia_raw = parseFloat(statsLuma.mediaY.toFixed(2));
        resultado.metadatos.DesviacionEstandarLuminancia_raw = parseFloat(statsLuma.desviacionEstandarY.toFixed(2));
        resultado.metadatos.Blockiness_raw = parseFloat(blockiness.toFixed(2));
        resultado.metadatos.PicosAltosY_raw = statsLuma.picosAltosY;

    } catch (error) {
        resultado.score = null;
        resultado.detalles = {
            puntuacionArtefactos: "Error",
            evaluacionGeneral: "Error en análisis de artefactos.",
            mensajePrincipal: `Error: ${error.message}`,
            hallazgosClave: ["El análisis no pudo completarse."],
            propiedadesBasicasImagen: {},
            indiciosFotomontaje: "Indeterminado",
            indiciosGeneracionIA: "Indeterminado",
            blockinessDetectada: "Indeterminado"
        };
        resultado.logs.push(`Error: ${error.message}`);
        log.error(`[${ANALYZER_ID}] Error durante el análisis: ${error.message}`, { ...baseMeta, error_stack: error.stack });
    } finally {
        const t1 = process.hrtime.bigint();
        resultado.performance.duracionMs = Number(t1 - t0) / 1e6;
        resultado.logs.push(`Duración análisis: ${resultado.performance.duracionMs.toFixed(2)} ms`);
    }

    return resultado;
};