/**
 * @file analizadorArtefactos.js
 * @description Analizador de artefactos visuales en imágenes, operando sobre el canal de luminancia (Y)
 *              e incorporando detección de blockiness. Mejorado v3 para detectar características de IA.
 *              Calcula un score de calidad/autenticidad, prepara datos para red neuronal,
 *              y estructura la información en `resultado.detalles` de forma legible para el cliente.
 *              Cumple con los estándares del Proyecto Dragón: logging Winston, manejo de errores,
 *              y métricas de performance (tiempo de ejecución/P95).
 * @module analizadores/analizadorArtefactos
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { log } from '../../utilidades/logger.js'; // CORRECTO: Logger centralizado Dragon3

const MODULE_NAME = path.basename(fileURLToPath(import.meta.url));

// --- Constantes de Normalización y Referencia ---
const MAX_DIMENSION = 8000;
const MAX_RESOLUCION_DPI = 1200;
const MAX_GRADIENTE_ESTIMADO_LUMA = 80;
const MIN_GRADIENTE_ESTIMADO_LUMA_NATURAL = 10;
const MAX_ENTROPIA_LUMA = 8;
const MAX_DESVIACION_ESTANDAR_LUMA = 75;
const MAX_BLOCKINESS_CONSIDERED_LOW_FOR_IA = 12;
const MIN_PICOS_ALTOS_NATURAL = 3;

/** Normaliza valor a [0, 1], fallback 0.5. */
function scaleToUnity(value, max) {
    if (typeof value === 'number' && !isNaN(value) && typeof max === 'number' && !isNaN(max) && max > 0) {
        return Math.max(0, Math.min(1, value / max));
    }
    return 0.5;
}

/** Convierte buffer RGB a luminancia (Y) usando BT.709. */
function rgbToLuminance(rgbBuffer, width, height, channels) {
    const numPixels = width * height;
    const luminance = new Uint8Array(numPixels);
    if (channels < 3 || rgbBuffer.length < numPixels * channels) {
        log.warn("Datos RGB insuficientes o canales incorrectos para conversión a luminancia.", { mod: MODULE_NAME, func: "rgbToLuminance", w:width, h:height, c:channels, bufLen:rgbBuffer.length });
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

/** Calcula entropía de Shannon para un histograma de luminancia. */
function calcularEntropia(histogramaY, totalPixeles) {
    if (!histogramaY || totalPixeles <= 0) return 0;
    let entropia = 0;
    for (let i = 0; i < histogramaY.length; i++) {
        if (histogramaY[i] > 0) {
            const probabilidad = histogramaY[i] / totalPixeles;
            entropia -= probabilidad * (Math.log2(probabilidad));
        }
    }
    return entropia;
}

/** Calcula desviación estándar de un histograma de luminancia. */
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

/** Detecta artefactos de compresión (blockiness) en el canal de luminancia. */
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

/** Calcula estadísticas clave sobre el canal de luminancia (Y). */
function calcularEstadisticasLuminancia(luminanceData, width, height) {
    const histogramaY = new Array(256).fill(0);
    let sumaValoresY = 0;
    let sumaGradientes = 0;
    let conteoGradientes = 0;
    const totalPixeles = width * height;

    if (totalPixeles === 0 || luminanceData.length !== totalPixeles) {
        log.warn("Datos de luminancia insuficientes o inconsistentes.", { mod: MODULE_NAME, func: "calcStatsLuma", w:width, h:height, len:luminanceData.length });
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
 * Analiza imagen para artefactos, operando sobre luminancia y mejorando detección IA (v3).
 * Mide y loguea el tiempo de ejecución para métricas de performance.
 * @param {string} filePath - Ruta del archivo de imagen.
 * @param {object} configAnalisis - Configuración del análisis.
 * @param {string} correlationId - ID de correlación para trazabilidad.
 * @param {string} imagenId - ID de la imagen (opcional).
 * @returns {Promise<object>} Resultado del análisis.
 */
export const analizar = async (filePath, configAnalisis, correlationId, imagenId = 'N/A') => {
    const baseMeta = { cid: correlationId, img: imagenId, mod: MODULE_NAME, func: 'analizar' };
    const logfilePath = path.basename(filePath);

    // Start performance timer
    const t0 = process.hrtime.bigint();

    const resultado = {
        nombreAnalizador: MODULE_NAME.replace(/\.js$/i, "").toUpperCase(),
        descripcion: "Análisis de artefactos visuales (luminancia, blockiness, IA v3).",
        score: null,
        detalles: {},
        metadatos: { datosParaRedEspejoArtefactos: new Array(10).fill(0.5) },
        performance: { duracionMs: null }
    };
    resultado.detalles = {
        evaluacionGeneral: "Análisis pendiente.",
        puntuacionArtefactos: "N/A",
        hallazgosClave: ["El análisis no ha concluido."],
        mensajePrincipal: "El análisis no se completó o encontró errores.",
        propiedadesBasicasImagen: { dimensiones: "N/A", resolucion: "N/A", formato: "N/A" },
        indiciosFotomontaje: "Indeterminado",
        indiciosGeneracionIA: "Indeterminado",
        blockinessDetectada: "Indeterminado"
    };

    log.info(`Artefactos (Luma/IA v3): Inicio.`, { ...baseMeta, file: logfilePath });

    try {
        if (!fs.existsSync(filePath)) throw new Error(`Archivo no hallado: ${logfilePath}`);

        const imagenSharp = sharp(filePath);
        const metadata = await imagenSharp.metadata();
        const { width, height, channels, density: sharpDensity, format } = metadata;

        if (!width || !height || !channels) throw new Error("Metadatos imagen (dim/canales) incompletos.");
        log.debug(`Metadatos OK.`, { ...baseMeta, w: width, h: height, c: channels, dpi: sharpDensity || 'N/A', format: format || 'N/A' });

        const pixelDataRGB = await imagenSharp.raw().toBuffer();
        const luminanceData = rgbToLuminance(pixelDataRGB, width, height, channels);
        if (luminanceData.length !== width * height) {
            throw new Error("Fallo en conversión a luminancia o datos inconsistentes.");
        }

        const statsLuma = calcularEstadisticasLuminancia(luminanceData, width, height);
        if (statsLuma.totalPixeles === 0) throw new Error("Procesamiento de luminancia fallido.");

        const blockiness = calcularBlockiness(luminanceData, width, height);
        const entropiaY = calcularEntropia(statsLuma.histogramaY, statsLuma.totalPixeles);
        log.debug("Estadísticas Luminancia, Blockiness, Entropía OK.", { ...baseMeta, gradAvgY: statsLuma.gradientePromedioY.toFixed(2), devStdY: statsLuma.desviacionEstandarY.toFixed(2), blockiness: blockiness.toFixed(2), entropiaY: entropiaY.toFixed(3), picosY: statsLuma.picosAltosY });

        // --- Lógica de Detección de Artefactos Mejorada v3 ---
        let suavidadExcesivaIA = statsLuma.gradientePromedioY < MIN_GRADIENTE_ESTIMADO_LUMA_NATURAL &&
                                (entropiaY > 7.0 || statsLuma.desviacionEstandarY > 50);

        let bordesInconsistentes = (statsLuma.gradientePromedioY > 20 || statsLuma.desviacionEstandarY > 65) && !suavidadExcesivaIA;

        let texturasInconsistentes = false;
        const numPixelesPorMitad = Math.floor(statsLuma.totalPixeles / 2);
        if (numPixelesPorMitad > 0 && (statsLuma.totalPixeles - numPixelesPorMitad) > 0) {
            let sumaY1 = 0; for(let i=0; i<numPixelesPorMitad; i++) sumaY1 += luminanceData[i];
            let sumaY2 = 0; for(let i=numPixelesPorMitad; i<statsLuma.totalPixeles; i++) sumaY2 += luminanceData[i];
            const mediaY1 = sumaY1 / numPixelesPorMitad;
            const mediaY2 = sumaY2 / (statsLuma.totalPixeles - numPixelesPorMitad);
            if (Math.abs(mediaY1 - mediaY2) > 28) texturasInconsistentes = true;
        }

        let contrasteExtremoLuma = statsLuma.desviacionEstandarY > 70;

        let patronesPicosSospechosos = (statsLuma.picosAltosY >= 8 && statsLuma.picosAltosY <= 60) &&
                                       (statsLuma.gradientePromedioY < 12 || entropiaY > 7.2);

        let patronesAusenciaPicosSospechosos = statsLuma.picosAltosY < MIN_PICOS_ALTOS_NATURAL &&
                                              entropiaY > 6.8 &&
                                              statsLuma.gradientePromedioY < 15;

        let patronesRepetitivosIA = (patronesPicosSospechosos || patronesAusenciaPicosSospechosos) &&
                                   blockiness < MAX_BLOCKINESS_CONSIDERED_LOW_FOR_IA;

        if (suavidadExcesivaIA) { patronesRepetitivosIA = true; }

        let compresionExcesivaJPEG = blockiness > 10 && blockiness < MAX_BLOCKINESS_CONSIDERED_LOW_FOR_IA;
        let compresionMuyExcesivaJPEG = blockiness >= MAX_BLOCKINESS_CONSIDERED_LOW_FOR_IA;

        log.debug("Detección artefactos (Luma/IA v3) flags.", { ...baseMeta, suavidadIA: suavidadExcesivaIA, bordes:bordesInconsistentes, texturas:texturasInconsistentes, contrasteExt:contrasteExtremoLuma, patronesIA:patronesRepetitivosIA, blockyMod:compresionExcesivaJPEG, blockyHigh: compresionMuyExcesivaJPEG });

        const pesos = {
            suavidadIA: 0.35,
            patronesIA: 0.25,
            bordes: 0.10,
            texturas: 0.10,
            contraste: 0.05,
            blockinessMod: 0.10,
            blockinessHigh: 0.05
        };
        let scoreCalculado = pesos.suavidadIA * (suavidadExcesivaIA ? 0 : 1) +
                             pesos.patronesIA * (patronesRepetitivosIA ? 0 : 1) +
                             pesos.bordes * (bordesInconsistentes ? 0 : 1) +
                             pesos.texturas * (texturasInconsistentes ? 0 : 1) +
                             pesos.contraste * (contrasteExtremoLuma ? 0 : 1) +
                             pesos.blockinessMod * (compresionExcesivaJPEG ? 0 : 1) +
                             pesos.blockinessHigh * (compresionMuyExcesivaJPEG ? 0 : 1) ;
        resultado.score = parseFloat((scoreCalculado * 10).toFixed(1));
        log.info(`Score base artefactos (Luma/IA v3): ${resultado.score}/10.`, { ...baseMeta });

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
        log.debug("Datos red espejo (Luma/IA v3 based) OK.", { ...baseMeta, preview: resultado.metadatos.datosParaRedEspejoArtefactos.slice(5,9).map(v=>v.toFixed(2)) });

        resultado.detalles.puntuacionArtefactos = `${resultado.score}/10`;
        resultado.detalles.propiedadesBasicasImagen = {
            dimensiones: `${width}x${height} px`,
            resolucion: sharpDensity ? `${sharpDensity} DPI` : "No disponible",
            formato: format || "No disponible"
        };
        resultado.detalles.blockinessDetectada = compresionExcesivaJPEG ? `Moderada (valor: ${blockiness.toFixed(1)})` : (compresionMuyExcesivaJPEG ? `Alta (valor: ${blockiness.toFixed(1)})` : `No significativa (valor: ${blockiness.toFixed(1)})`);

        const hallazgos = [];
        if (suavidadExcesivaIA) hallazgos.push("Detectada suavidad excesiva y complejidad anómala, característica común en imágenes generadas por IA.");
        if (patronesRepetitivosIA && !suavidadExcesivaIA) {
            if (patronesAusenciaPicosSospechosos) {
                hallazgos.push("Identificada una distribución de luminancia atípicamente uniforme o con muy pocos picos para su complejidad, posible indicio de generación sintética.");
            } else if (patronesPicosSospechosos) {
                hallazgos.push("Identificados patrones de picos en el histograma de luminancia que, junto a otras características, podrían ser indicativos de generación sintética.");
            }
        }
        if (bordesInconsistentes) hallazgos.push("Se observan bordes con contraste o variaciones abruptas en la luminancia (no atribuibles a suavidad IA).");
        if (texturasInconsistentes) hallazgos.push("Detectada posible inconsistencia en la luminosidad promedio entre grandes regiones.");
        if (contrasteExtremoLuma) hallazgos.push("El contraste general de la luminancia es extremadamente alto.");
        if (compresionExcesivaJPEG) hallazgos.push(`Detectados artefactos de compresión tipo bloque moderados (blockiness: ${blockiness.toFixed(1)}).`);
        if (compresionMuyExcesivaJPEG) hallazgos.push(`Detectados artefactos de compresión tipo bloque altos (blockiness: ${blockiness.toFixed(1)}).`);

        resultado.detalles.hallazgosClave = hallazgos.length > 0 ? hallazgos : ["No se identificaron artefactos específicos predominantes o características de IA en este análisis."];

        if (resultado.score >= 8) {
            resultado.detalles.evaluacionGeneral = "Análisis de artefactos (luminancia/IA) sin alertas mayores.";
            resultado.detalles.mensajePrincipal = `El análisis de artefactos (basado en luminancia y detección IA) otorga una puntuación de ${resultado.score}/10. Esto sugiere una imagen con pocos artefactos o características de IA evidentes. ${hallazgos.length > 0 ? "Observaciones: " + hallazgos.join(" ") : "No se observaron problemas significativos."}`;
        } else if (resultado.score >= 5) {
            resultado.detalles.evaluacionGeneral = "Algunos artefactos o características IA detectados; se recomienda cautela.";
            resultado.detalles.mensajePrincipal = `El análisis de artefactos (basado en luminancia y detección IA) asigna una puntuación de ${resultado.score}/10. Se han detectado algunos indicios de artefactos o características típicas de IA. Hallazgos: ${hallazgos.join(" ")}`;
        } else {
            resultado.detalles.evaluacionGeneral = "Indicios notables de artefactos o fuerte sospecha de IA; revisión detallada sugerida.";
            resultado.detalles.mensajePrincipal = `El análisis de artefactos (basado en luminancia y detección IA) resulta en una puntuación de ${resultado.score}/10, indicando la presencia de artefactos notables o fuertes características de IA. Hallazgos: ${hallazgos.join(" ")}`;
        }

        resultado.detalles.indiciosFotomontaje = (texturasInconsistentes || (bordesInconsistentes && !suavidadExcesivaIA)) ? "Posible" : "Bajo";
        resultado.detalles.indiciosGeneracionIA = (patronesRepetitivosIA || suavidadExcesivaIA) ? "Alto" : "Medio";

        resultado.metadatos.AnalisisLuminanciaIA_v3 = true;
        resultado.metadatos.EntropiaLuminancia_raw = parseFloat(entropiaY.toFixed(3));
        resultado.metadatos.GradientePromedioLuminancia_raw = parseFloat(statsLuma.gradientePromedioY.toFixed(2));
        resultado.metadatos.MediaLuminancia_raw = parseFloat(statsLuma.mediaY.toFixed(2));
        resultado.metadatos.DesviacionEstandarLuminancia_raw = parseFloat(statsLuma.desviacionEstandarY.toFixed(2));
        resultado.metadatos.Blockiness_raw = parseFloat(blockiness.toFixed(2));
        resultado.metadatos.PicosAltosY_raw = statsLuma.picosAltosY;
        resultado.metadatos.ArtefactosFlags_raw = { suavidadExcesivaIA, bordesInconsistentes, texturasInconsistentes, contrasteExtremoLuma, patronesRepetitivosIA, compresionExcesivaJPEG, compresionMuyExcesivaJPEG, patronesPicosSospechosos, patronesAusenciaPicosSospechosos };

    } catch (error) {
        resultado.score = null;
        const errorMsgCliente = `Ocurrió un error durante el análisis de artefactos (luminancia/IA v3): ${error.message}`;
        resultado.detalles.evaluacionGeneral = "Error en análisis de artefactos (luminancia/IA v3).";
        resultado.detalles.puntuacionArtefactos = "Error";
        resultado.detalles.hallazgosClave = ["El análisis no pudo completarse debido a un error interno."];
        resultado.detalles.mensajePrincipal = errorMsgCliente;
        resultado.metadatos.datosParaRedEspejoArtefactos = new Array(10).fill(0.5);
        log.error(`Artefactos (Luma/IA v3): EXCEPCIÓN.`, { ...baseMeta, file: logfilePath, error_message: error.message, error_stack: error.stack });
    } finally {
        // Medición de tiempo de ejecución (performance)
        const t1 = process.hrtime.bigint();
        const duracionMs = Number(t1 - t0) / 1e6;
        resultado.performance.duracionMs = parseFloat(duracionMs.toFixed(2));
        log.info(`Artefactos (Luma/IA v3): Fin. Duración ${resultado.performance.duracionMs} ms`, { ...baseMeta });
    }

    return resultado;
};