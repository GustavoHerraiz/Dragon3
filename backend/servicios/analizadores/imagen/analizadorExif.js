/**
 * @file analizadorExif.js
 * @version 3.1.0
 * @author Gustavo Herraiz
 * @description
 * Analizador de metadatos EXIF, XMP e IPTC. Extrae información clave sobre edición, cámara, software, fechas y normaliza para IA.
 * Cumple los estándares Dragon3/FAANG: logger central, performance, robustez y documentación profesional.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import exifr from 'exifr';
import imageSize from 'image-size';
import { log } from '../../utilidades/logger.js';

const ANALYZER_VERSION = '3.1.0';
const ANALYZER_ID = 'EXIF_IMAGE_FAANG';
const ANALYZER_NAME = 'ANALIZADOR_EXIF';
const MODULE_NAME = path.basename(fileURLToPath(import.meta.url));

/** Listados de software y cámaras conocidos para heurísticas */
const softwareConocidoEdicion = [ /* ... igual que tu lista ... */ ];
const softwareConocidoIA = [ /* ... igual que tu lista ... */ ];
const camarasConocidas = [ /* ... igual que tu lista ... */ ];

log.info(`EXIF: Listas software/cámaras cargadas.`, {
    analizador: ANALYZER_ID,
    swEdicion: softwareConocidoEdicion.length,
    swIA: softwareConocidoIA.length,
    camaras: camarasConocidas.length
});

/** Helpers utilitarios */
const formatSimpleDate = (dateValue) => {
    if (dateValue instanceof Date) {
        try { return dateValue.toISOString(); } catch (e) { return String(dateValue); }
    }
    return dateValue || "No disponible";
};
const getResolutionUnitString = (unitNumber) => {
    if (unitNumber === 2) return 'pulgadas';
    if (unitNumber === 3) return 'cm';
    return 'ppi';
};
const safeParseFloat = (value, def = 0) => {
    const parsed = parseFloat(value); return isNaN(parsed) ? def : parsed;
};
const normalizeDimensionsExif = (exif, realDimsStr) => {
    const exifW = safeParseFloat(exif.ExifImageWidth || exif.ImageWidth, null);
    const exifH = safeParseFloat(exif.ExifImageHeight || exif.ImageHeight, null);
    if (exifW === null || exifH === null) return 0.2;
    let realW, realH;
    if (realDimsStr && realDimsStr !== "No disponible" && realDimsStr.includes('x')) {
        [realW, realH] = realDimsStr.split('x').map(d => parseInt(d, 10));
    }
    if (realW && realH && (exifW === realW && exifH === realH)) return 0.6;
    if (exifW > 100 && exifH > 100) return 0.5;
    return 0.3;
};
const normalizeSoftware = (exif) => {
    const s = (exif.CreatorTool || exif.Software || "").toLowerCase();
    if (!s) return 0.3;
    if (softwareConocidoIA.some(sw => s.includes(sw))) return 0.1;
    if (softwareConocidoEdicion.some(sw => s.includes(sw))) return 0.5;
    if (s.length > 2) return 0.7;
    return 0.4;
};
const normalizeDate = (dateStr, referenceDateStr = null) => {
    if (!dateStr || dateStr === "No disponible") return 0.9;
    let date;
    try {
        if (dateStr instanceof Date) date = dateStr;
        else if (typeof dateStr === 'string') date = new Date(dateStr);
        else return 0.87;
        if (isNaN(date.getTime())) return 0.88;
        const now = new Date();
        const ageYears = (now - date) / (365.25 * 24 * 60 * 60 * 1000);
        if (ageYears < -0.01 || ageYears > 30) return 0.8;
        if (ageYears < (1/12)) return 0.1;
        if (ageYears < 1) return 0.3;
        if (referenceDateStr && referenceDateStr !== "No disponible") {
            let refDate;
            if (referenceDateStr instanceof Date) refDate = referenceDateStr;
            else if (typeof referenceDateStr === 'string') refDate = new Date(referenceDateStr);
            if (refDate && !isNaN(refDate.getTime()) && Math.abs(date - refDate) < 60000) return 0.2;
        }
        return 0.5;
    } catch { return 0.85; }
};
const normalizeResolution = (resVal) => {
    const val = safeParseFloat(resVal, 0);
    if (val === 0) return 0.1;
    if ((val >= 72 && val <= 96) || (val >= 200 && val <= 350)) return 0.6;
    if (val > 96 && val < 200) return 0.5;
    if (val > 350 && val <= 600) return 0.7;
    return 0.3;
};
const normalizeProporcionDimensiones = (exif) => {
    const exifW = safeParseFloat(exif.ExifImageWidth || exif.ImageWidth, null);
    const exifH = safeParseFloat(exif.ExifImageHeight || exif.ImageHeight, null);
    if (exifW === null || exifH === null || exifW <= 0 || exifH <= 0) return 0.5;
    return Math.min(exifW, exifH) / Math.max(exifW, exifH);
};

/**
 * Analiza los metadatos EXIF/XMP/IPTC, calcula heurísticas, score y performance.
 * @param {string} filePath - Ruta absoluta del archivo.
 * @param {object} [configAnalisis] - Configuración (opcional, no usada).
 * @param {string} [correlationId] - ID de correlación.
 * @param {string} [imagenId] - ID imagen.
 * @returns {Promise<object>} Resultados completos.
 */
export const analizar = async (
    filePath,
    configAnalisis = {},
    correlationId = 'N/A',
    imagenId = 'N/A'
) => {
    const t0 = process.hrtime.bigint();
    const baseMeta = {
        analizador: ANALYZER_ID,
        version: ANALYZER_VERSION,
        correlationId,
        imagenId,
        filePath
    };

    // Contrato Dragon3 homogéneo
    const resultado = {
        idAnalizador: ANALYZER_ID,
        nombreAnalizador: ANALYZER_NAME,
        version: ANALYZER_VERSION,
        descripcion: "Analiza los metadatos EXIF/XMP/IPTC, normaliza parámetros clave y puntúa la autenticidad.",
        score: 0,
        detalles: {
            mensaje: "Análisis no procesado o metadatos no encontrados.",
            softwareDetectado: "No disponible",
            camaraDetectada: "No disponible",
            tipoSoftware: "Desconocido"
        },
        metadatos: {},
        todosLosMetadatosExifParseados: {},
        performance: { duracionMs: null },
        logs: [],
        correlationId,
        imagenId,
        timestamp: Date.now()
    };

    log.info(`[${ANALYZER_ID}] EXIF: Análisis iniciado.`, baseMeta);

    let formatoReal = "No disponible", dimensionesReales = "No disponible";

    try {
        if (!fs.existsSync(filePath)) throw new Error(`Archivo no encontrado en la ruta: ${filePath}`);
        fs.accessSync(filePath, fs.constants.R_OK);

        const dimensions = imageSize(filePath);
        if (dimensions && dimensions.type && typeof dimensions.width === 'number' && typeof dimensions.height === 'number') {
            formatoReal = dimensions.type.toUpperCase();
            dimensionesReales = `${dimensions.width}x${dimensions.height}`;
        }

        // --- Extracción EXIF/XMP/IPTC ---
        const options = { xmp: true, iptc: true, icc: false, jfif: true, gps: true, thumbnail: false, multiSegment: true };
        const exifData = await exifr.parse(filePath, options);
        if (!exifData || Object.keys(exifData).length === 0) {
            resultado.score = 3;
            resultado.detalles.mensaje = "No se encontraron metadatos EXIF, XMP o IPTC significativos.";
            resultado.metadatos = {
                formato: formatoReal,
                dimensionesReales,
                dimensionesEXIF: "No disponible",
                resolucion: "No disponible",
                datosNormalizadosParaRedExif: new Array(10).fill(0.1)
            };
            const t1 = process.hrtime.bigint();
            resultado.performance.duracionMs = parseFloat((Number(t1 - t0) / 1e6).toFixed(2));
            resultado.metadatos.duracionMs = resultado.performance.duracionMs;
            resultado.logs.push("No hay metadatos EXIF/XMP/IPTC significativos.");
            log.info(`[${ANALYZER_ID}] EXIF: Sin metadatos. Score: ${resultado.score}. Duración: ${resultado.performance.duracionMs}ms.`, baseMeta);
            return resultado;
        }
        resultado.todosLosMetadatosExifParseados = { ...exifData };

        // --- Metadatos básicos para cliente ---
        const detallesBasicos = {
            formato: formatoReal,
            dimensionesReales,
            dimensionesEXIF: (exifData.ExifImageWidth && exifData.ExifImageHeight)
                ? `${exifData.ExifImageWidth}x${exifData.ExifImageHeight}`
                : (exifData.ImageWidth && exifData.ImageHeight ? `${exifData.ImageWidth}x${exifData.ImageHeight}` : "No disponible"),
            resolucion: (exifData.XResolution && exifData.YResolution)
                ? `${exifData.XResolution}x${exifData.YResolution} ${getResolutionUnitString(exifData.ResolutionUnit)}`
                : "No disponible"
        };

        // --- Score heurístico simple y tipo software/cámara ---
        let currentScore = 6;
        let softwareEncontrado = null, tipoSoftwareDetectado = "Desconocido";
        const softwareString = String(exifData.CreatorTool || exifData.Software || "").toLowerCase();
        if (softwareString) {
            softwareEncontrado = exifData.CreatorTool || exifData.Software;
            if (softwareConocidoIA.some(sw => softwareString.includes(sw))) tipoSoftwareDetectado = "IA";
            else if (softwareConocidoEdicion.some(sw => softwareString.includes(sw))) tipoSoftwareDetectado = "Edicion";
        }
        resultado.detalles.softwareDetectado = softwareEncontrado || "No disponible";
        resultado.detalles.tipoSoftware = tipoSoftwareDetectado;

        let camaraEncontrada = null;
        const camaraFuente = `${exifData.Make || ""} ${exifData.Model || ""}`.trim().toLowerCase();
        if (camaraFuente) {
            if (camarasConocidas.some(cam => camaraFuente.includes(cam.toLowerCase()))) camaraEncontrada = camaraFuente;
            else if (camaraFuente.length > 2) camaraEncontrada = camaraFuente;
        }
        resultado.detalles.camaraDetectada = camaraEncontrada || "No disponible";

        // --- Puntuación heurística básica ---
        if (exifData.DateTimeOriginal instanceof Date || exifData.CreateDate instanceof Date || exifData.DateCreated instanceof Date) currentScore += 1;
        if (camaraEncontrada) {
            const esMovilConocido = ["apple", "samsung", "google", "iphone", "pixel", "galaxy"].some(m => camaraFuente.includes(m));
            currentScore += esMovilConocido ? 1 : 2;
        }
        if (tipoSoftwareDetectado === "Edicion") currentScore -= 1;
        if (tipoSoftwareDetectado === "IA") currentScore -= 4;
        if (detallesBasicos.dimensionesEXIF === "No disponible") currentScore -= 1;
        resultado.score = Math.max(0, Math.min(10, Math.round(currentScore)));

        // --- Normalización para redes o IA ---
        const datosNormalizadosParaRed = [
            normalizeDimensionsExif(exifData, dimensionesReales),
            normalizeSoftware(exifData),
            normalizeDate(exifData.DateTimeOriginal || exifData.CreateDate || exifData.DateCreated),
            normalizeDate(exifData.ModifyDate || exifData.MetadataDate, exifData.DateTimeOriginal || exifData.CreateDate || exifData.DateCreated),
            normalizeResolution(exifData.XResolution),
            normalizeResolution(exifData.YResolution),
            normalizeProporcionDimensiones(exifData),
            0.5, 0.5, 0.5
        ];
        resultado.metadatos = {
            ...detallesBasicos,
            datosNormalizadosParaRedExif: datosNormalizadosParaRed.map(val => Math.max(0, Math.min(1, parseFloat(val) || 0.5)))
        };
        resultado.detalles.mensaje =
            tipoSoftwareDetectado === "IA" ? "Metadatos sugieren posible generación por IA." :
            tipoSoftwareDetectado === "Edicion" ? "Metadatos indican uso de software de edición." :
            camaraEncontrada ? "Metadatos consistentes con captura por cámara." : "Metadatos analizados.";

        // --- Performance ---
        const t1 = process.hrtime.bigint();
        resultado.performance.duracionMs = parseFloat((Number(t1 - t0) / 1e6).toFixed(2));
        resultado.metadatos.duracionMs = resultado.performance.duracionMs;
        resultado.logs.push(`Score: ${resultado.score}, Software: ${tipoSoftwareDetectado}, Cámara: ${camaraEncontrada || "No disponible"}`);
        log.info(`[${ANALYZER_ID}] EXIF: Fin análisis. Score: ${resultado.score}. Duración: ${resultado.performance.duracionMs}ms.`, baseMeta);

    } catch (error) {
        resultado.score = 1;
        resultado.detalles.mensaje = `Error crítico durante el análisis: ${error.message}`;
        resultado.metadatos.formato = formatoReal;
        resultado.metadatos.dimensionesReales = dimensionesReales;
        resultado.metadatos.datosNormalizadosParaRedExif = new Array(10).fill(0.2);
        const t1 = process.hrtime.bigint();
        resultado.performance.duracionMs = parseFloat((Number(t1 - t0) / 1e6).toFixed(2));
        resultado.metadatos.duracionMs = resultado.performance.duracionMs;
        resultado.logs.push(`Error crítico: ${error.message}`);
        log.error(`[${ANALYZER_ID}] EXIF: EXCEPCIÓN en análisis!`, { ...baseMeta, mensajeError: error.message, stack: error.stack, duracionMs: resultado.performance.duracionMs });
    }

    return resultado;
};