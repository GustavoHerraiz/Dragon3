/**
 * @file analizadorPantalla.js
 * @description Analizador para detección de imágenes de pantalla o volcados directos, usando vector de características para red Fénix.
 *              Cumple estándar Dragon3/FAANG: logging (Winston), performance, robustez, documentación profesional y estructura homogénea.
 */

import fs from 'fs';
import sharp from 'sharp';
import { performance } from 'perf_hooks';
import { log } from '../../utilidades/logger.js';

const MODULE_NAME = 'DETECCIÓN_DE_PANTALLA';
const MAX_DPI_NORMALIZATION = 600.0;

/**
 * Detección de patrones de rejilla (v2.4, robusto para imágenes a pantalla/foto)
 * @param {object} imagenSharp - Objeto sharp de la imagen.
 * @param {object} baseMeta - Objeto con metadatos de log.
 * @returns {Promise<boolean>} true si detecta patrón de rejilla (pantalla), false si no.
 */
async function detectarPatronRejilla(imagenSharp, baseMeta) {
    try {
        const MINIATURE_SIZE = 128;
        const SUBGRID_DIVISIONS = 6;
        const ANGLE_TOLERANCE = 12;

        const { data, info } = await imagenSharp
            .clone()
            .resize(MINIATURE_SIZE, MINIATURE_SIZE, {
                kernel: 'lanczos3',
                fit: 'inside'
            })
            .normalise()
            .linear(1.2, -15)
            .raw()
            .toBuffer({ resolveWithObject: true });

        const width = info.width;
        const height = info.height;
        const pixelCount = width * height;

        let histogram = new Array(256).fill(0);
        for (let i = 0; i < data.length; i++) {
            histogram[data[i]]++;
        }

        const p95 = findPercentile(histogram, 0.95);
        const p5 = findPercentile(histogram, 0.05);
        const dynamicRange = p95 - p5;

        const sobelData = new Float32Array(pixelCount);
        let maxMagnitude = 0;

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                const gx = (
                    -1 * data[idx - width - 1] + 1 * data[idx - width + 1] +
                    -2 * data[idx - 1]         + 2 * data[idx + 1] +
                    -1 * data[idx + width - 1] + 1 * data[idx + width + 1]
                );
                const gy = (
                    -1 * data[idx - width - 1] - 2 * data[idx - width] - 1 * data[idx - width + 1] +
                    1 * data[idx + width - 1] + 2 * data[idx + width] + 1 * data[idx + width + 1]
                );
                const magnitude = Math.sqrt(gx * gx + gy * gy);
                sobelData[idx] = magnitude;
                if (magnitude > maxMagnitude) maxMagnitude = magnitude;
            }
        }

        const edgeThreshold = Math.max(25, dynamicRange * 0.25);
        let edgePixels = 0;
        const edgeMap = new Array(pixelCount).fill(false);
        const angleMap = new Array(pixelCount).fill(0);

        for (let i = 0; i < sobelData.length; i++) {
            if (sobelData[i] > edgeThreshold) {
                edgePixels++;
                edgeMap[i] = true;

                const x = i % width;
                const y = Math.floor(i / width);
                if (x > 0 && y > 0 && x < width-1 && y < height-1) {
                    const gx = sobelData[i] - sobelData[i-1];
                    const gy = sobelData[i] - sobelData[i-width];
                    angleMap[i] = Math.atan2(gy, gx);
                }
            }
        }

        let horizontalLines = 0;
        let verticalLines = 0;
        let regularPattern = 0;

        for (let y = 2; y < height - 2; y++) {
            for (let x = 2; x < width - 2; x++) {
                const idx = y * width + x;
                if (!edgeMap[idx]) continue;

                const angle = angleMap[idx];
                const isHorizontal = Math.abs(angle) < ANGLE_TOLERANCE * Math.PI/180;
                const isVertical = Math.abs(angle - Math.PI/2) < ANGLE_TOLERANCE * Math.PI/180;

                if (isHorizontal) {
                    if (edgeMap[idx-1] && edgeMap[idx+1]) horizontalLines++;
                }
                if (isVertical) {
                    if (edgeMap[idx-width] && edgeMap[idx+width]) verticalLines++;
                }
                if (edgeMap[idx-2] && edgeMap[idx-1] && edgeMap[idx+1] && edgeMap[idx+2]) {
                    const avgSpacing = (sobelData[idx-2] + sobelData[idx-1] + sobelData[idx+1] + sobelData[idx+2]) / 4;
                    if (Math.abs(sobelData[idx] - avgSpacing) < edgeThreshold * 0.3) {
                        regularPattern++;
                    }
                }
            }
        }

        const edgeDensity = edgePixels / pixelCount;
        const lineRatio = (horizontalLines + verticalLines) / Math.max(1, edgePixels);
        const regularityScore = regularPattern / Math.max(1, edgePixels);

        const isGridPattern = (
            edgeDensity > 0.15 &&
            edgeDensity < 0.35 &&
            lineRatio > 0.6 &&
            regularityScore > 0.4 &&
            (horizontalLines > width * 0.3) &&
            (verticalLines > height * 0.3)
        );

        log.debug(`Detección Rejilla v2.6:
            Edge Density: ${edgeDensity.toFixed(3)}
            Line Ratio: ${lineRatio.toFixed(3)}
            Regularity: ${regularityScore.toFixed(3)}
            Horizontal: ${horizontalLines}/${width} (${(horizontalLines/width).toFixed(2)})
            Vertical: ${verticalLines}/${height} (${(verticalLines/height).toFixed(2)})`,
            { ...baseMeta }
        );

        return isGridPattern;

    } catch (error) {
        log.error("Error en detector v2.6", { ...baseMeta, error });
        return false;
    }
}

/**
 * Calcula el percentil de un histograma.
 * @param {Array<number>} histogram - Histograma de 256 valores.
 * @param {number} percentile - Percentil (0.05, 0.95, etc.)
 * @returns {number} Valor de intensidad correspondiente al percentil.
 */
function findPercentile(histogram, percentile) {
    let total = histogram.reduce((sum, val) => sum + val, 0);
    let target = total * percentile;
    let count = 0;

    for (let i = 0; i < histogram.length; i++) {
        count += histogram[i];
        if (count >= target) return i;
    }
    return 255;
}

/**
 * Analizador principal (v3.3.1) para clasificación de pantalla vs volcado directo.
 * Devuelve score, detalles, metadatos y vector de características para red Fénix.
 * @param {string} rutaArchivo - Ruta absoluta de la imagen.
 * @param {string} correlationId - ID de correlación.
 * @param {string} imagenId - ID imagen.
 * @returns {Promise<object>} Resultado del análisis.
 */
export const analizar = async (rutaArchivo, correlationId = 'N/A', imagenId = 'N/A') => {
    const baseMeta = { cid: correlationId, img: imagenId, mod: MODULE_NAME, func: 'analizar' };
    const T0 = performance.now();

    const resultado = {
        nombreAnalizador: MODULE_NAME,
        descripcion: "Detecta si una imagen es una foto de pantalla o un volcado directo (v3.3.1, vector red Fénix)",
        score: null,
        detalles: {
            tipoCaptura: "Indeterminado",
            mensaje: "Análisis inicial no concluyente",
            patronRejillaDetectado: false,
        },
        metadatos: {
            formato: "N/A",
            dimensiones: "N/A",
            densidad: "N/A",
            tiempoMetaExtraccionMs: "0.0",
            datosNormalizadosParaRedPantalla: new Array(10).fill(0.5)
        },
        tiempoMs: "0.0"
    };

    try {
        if (!fs.existsSync(rutaArchivo)) {
            log.error("Archivo de entrada no encontrado.", { ...baseMeta, file: rutaArchivo });
            resultado.detalles.tipoCaptura = "Error de sistema";
            resultado.detalles.mensaje = `Error: Archivo no existe: ${rutaArchivo}`;
            resultado.tiempoMs = (performance.now() - T0).toFixed(1);
            return resultado;
        }

        const imagenSharp = sharp(rutaArchivo);
        const metadata = await imagenSharp.metadata();
        resultado.metadatos.tiempoMetaExtraccionMs = (performance.now() - T0).toFixed(1);

        const formatoLowerCase = metadata.format?.toLowerCase();
        resultado.metadatos.formato = metadata.format || "N/A";
        resultado.metadatos.densidad = metadata.density || "N/A";
        const anchoImg = metadata.width;
        const altoImg = metadata.height;
        resultado.metadatos.dimensiones = (anchoImg && altoImg) ? `${anchoImg}x${altoImg}` : "N/A";

        // --- Cálculo de las 10 características para la Red Fénix ---
        // 1. rejillaVisible
        const feat_rejillaVisible_bool = await detectarPatronRejilla(imagenSharp, baseMeta);
        resultado.detalles.patronRejillaDetectado = feat_rejillaVisible_bool;
        const feat_rejillaVisible = feat_rejillaVisible_bool ? 1.0 : 0.0;

        // 2. esPNG, 3. esBMP, 4. esJPG, 5. esOtroFormatoConocido
        const feat_esPNG_bool = formatoLowerCase === 'png';
        const feat_esBMP_bool = formatoLowerCase === 'bmp';
        const feat_esJPG_bool = formatoLowerCase === 'jpeg' || formatoLowerCase === 'jpg';
        const otrosFormatosConocidos = ['gif', 'webp', 'heif', 'avif'];
        const feat_esOtroFormatoConocido_bool = otrosFormatosConocidos.includes(formatoLowerCase);

        const feat_esPNG = feat_esPNG_bool ? 1.0 : 0.0;
        const feat_esBMP = feat_esBMP_bool ? 1.0 : 0.0;
        const feat_esJPG = feat_esJPG_bool ? 1.0 : 0.0;
        const feat_esOtroFormatoConocido = feat_esOtroFormatoConocido_bool ? 1.0 : 0.0;

        // 6. tieneMetadatosExtensos
        const feat_tieneMetadatosExtensos_bool = !!(metadata.exif || metadata.iptc || metadata.xmp);
        const feat_tieneMetadatosExtensos = feat_tieneMetadatosExtensos_bool ? 1.0 : 0.0;

        // 7. densidadNormalizada
        const densidadVal = parseFloat(metadata.density);
        const feat_densidadNormalizada = (isNaN(densidadVal) || densidadVal <= 0) ? 0.5 : Math.min(1.0, densidadVal / MAX_DPI_NORMALIZATION);

        // 8. ratioAspectoComun
        let ratio = 0;
        if (anchoImg && altoImg && anchoImg > 0 && altoImg > 0) {
            ratio = anchoImg / altoImg;
        }
        const ratiosComunes = [16/9, 4/3, 16/10, 3/2, 1, 9/16, 3/4, 10/16, 2/3];
        const feat_esRatioComun_bool = ratio > 0 ? ratiosComunes.some(rc => Math.abs(ratio - rc) < 0.025) : false;
        const feat_esRatioComun = feat_esRatioComun_bool ? 1.0 : 0.0;

        // 9. dimensionTipicaPantalla
        const dimensionesPantallaComunes = [
            '1366x768', '1920x1080', '2560x1440', '3840x2160', '1280x720', '1600x900',
            '1440x900', '2560x1600', '1680x1050', '1280x800', '1024x768', '800x600',
            '768x1366', '1080x1920', '1440x2560', '2160x3840', '720x1280', '900x1600'
        ];
        const dimensionActual = (anchoImg && altoImg) ? `${anchoImg}x${altoImg}` : '';
        const feat_esDimensionTipicaPantalla_bool = dimensionesPantallaComunes.includes(dimensionActual);
        const feat_esDimensionTipicaPantalla = feat_esDimensionTipicaPantalla_bool ? 1.0 : 0.0;

        // Lógica heurística para el score INTERNO de este analizador
        if (feat_rejillaVisible_bool) {
            resultado.detalles.tipoCaptura = "Foto tomada a una pantalla";
            resultado.detalles.mensaje = "Patrón de rejilla detectado, sugestivo de fotografía a una pantalla.";
            resultado.score = 2;
        } else if ((feat_esPNG_bool || feat_esBMP_bool) && !feat_tieneMetadatosExtensos_bool && feat_esDimensionTipicaPantalla_bool) {
            resultado.detalles.tipoCaptura = "Volcado directo de pantalla";
            resultado.detalles.mensaje = "Formato, ausencia de metadatos y dimensiones sugieren volcado directo.";
            resultado.score = 6;
        } else if (feat_esJPG_bool && feat_tieneMetadatosExtensos_bool && !feat_esDimensionTipicaPantalla_bool) {
             resultado.detalles.tipoCaptura = "Fotografía (no de pantalla)";
             resultado.detalles.mensaje = "Características sugieren fotografía general, no de pantalla.";
             resultado.score = 10;
        } else {
            resultado.detalles.tipoCaptura = "Indeterminado";
            resultado.detalles.mensaje = "No se detectó patrón de rejilla ni cumple criterios claros de volcado directo o fotografía.";
            resultado.score = 8;
        }

        // 10. scoreHeuristicoInterno (Normalizado)
        const feat_scoreHeuristicoInterno = resultado.score !== null ? resultado.score / 10.0 : 0.5;

        log.debug("Características individuales para Red Fénix:", {
            ...baseMeta,
            f1_rejilla: feat_rejillaVisible,
            f2_PNG: feat_esPNG,
            f3_BMP: feat_esBMP,
            f4_JPG: feat_esJPG,
            f5_OtroFmt: feat_esOtroFormatoConocido,
            f6_MetaExt: feat_tieneMetadatosExtensos,
            f7_DensidadNorm: feat_densidadNormalizada.toFixed(2),
            f8_RatioComun: feat_esRatioComun,
            f9_DimTipica: feat_esDimensionTipicaPantalla,
            f10_ScoreHeur: feat_scoreHeuristicoInterno.toFixed(2)
        });

        resultado.metadatos.datosNormalizadosParaRedPantalla = [
            feat_rejillaVisible,
            feat_esPNG,
            feat_esBMP,
            feat_esJPG,
            feat_esOtroFormatoConocido,
            feat_tieneMetadatosExtensos,
            feat_densidadNormalizada,
            feat_esRatioComun,
            feat_esDimensionTipicaPantalla,
            feat_scoreHeuristicoInterno
        ];

        log.info(`Análisis completado (v3.3.1). Score Heurístico: ${resultado.score}, Tipo: ${resultado.detalles.tipoCaptura}, Rejilla: ${resultado.detalles.patronRejillaDetectado}`, {
            ...baseMeta,
            file: rutaArchivo.split('/').pop(),
            datosRed: JSON.stringify(resultado.metadatos.datosNormalizadosParaRedPantalla)
        });

    } catch (error) {
        log.error("Error fatal en analizadorPantalla (v3.3.1)", {
            ...baseMeta,
            file: rutaArchivo.split('/').pop(),
            errorMessage: error.message,
            stack: error.stack.substring(0, 1000)
        });
        resultado.detalles.tipoCaptura = "Error de sistema";
        resultado.detalles.mensaje = `Error en el análisis: ${error.message}`;
    }

    resultado.tiempoMs = (performance.now() - T0).toFixed(1);
    return resultado;
};