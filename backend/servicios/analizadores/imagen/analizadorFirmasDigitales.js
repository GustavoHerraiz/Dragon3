/**
 * @file analizadorFirmasDigitales.js
 * @version 3.0.0
 * @author Gustavo Herraiz
 * @description
 * Analizador de firmas digitales y credenciales de contenido en imágenes.
 * Detecta patrones de sello, cámara genuina, edición, IA, C2PA/CAI y marcas nuevas.
 * Basado en patrones externos, EXIF, XMP, IPTC y Content Credentials (C2PA/CAI).
 * Cumple estándares Dragon3/FAANG: logging estructurado, performance, robustez, KISS y documentación profesional.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import exifr from 'exifr';
import { exiftool } from 'exiftool-vendored';
import { log } from '../../utilidades/logger.js';

// --- Identificadores y versión ---
const ANALYZER_VERSION = '3.0.0';
const ANALYZER_ID = 'FIRMASDIGITALES_IMAGE_FAANG';
const ANALYZER_NAME = 'ANALIZADOR_FIRMAS_DIGITALES';

// --- Carga de patrones Dragon3 ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PATRONES_PATH = path.join(__dirname, 'analizadorHerramientasSospechosas.json');
let patrones = { softwareEdicion: [], softwareGeneracionIA: [], softwareGenerico: [], sellosVerificacion: [], marcasIA: [], marcasC2PA: [] };

try {
    if (fs.existsSync(PATRONES_PATH)) {
        const raw = fs.readFileSync(PATRONES_PATH, 'utf8');
        patrones = JSON.parse(raw);
        log.info(`Patrones de firmas digitales cargados correctamente.`, {
            analizador: ANALYZER_ID,
            component: 'Inicializacion',
            filePath: PATRONES_PATH,
            counts: {
                edicion: patrones.softwareEdicion.length,
                ia: patrones.softwareGeneracionIA.length,
                generico: patrones.softwareGenerico.length,
                sellos: patrones.sellosVerificacion.length,
                marcasIA: patrones.marcasIA?.length || 0,
                marcasC2PA: patrones.marcasC2PA?.length || 0
            }
        });
    }
} catch (e) {
    log.error(`Error al cargar patrones de firmas. Patrones vacíos.`, e, {
        analizador: ANALYZER_ID,
        component: 'Inicializacion',
        filePath: PATRONES_PATH
    });
}

/**
 * Busca si un valor coincide con algún patrón (regex) de la lista.
 * @returns {boolean}
 */
function matchPatron(valor, patronesArray, meta, patternType) {
    if (!valor || !Array.isArray(patronesArray) || patronesArray.length === 0) return false;
    return patronesArray.some(pat => {
        try {
            return new RegExp(pat, "i").test(valor);
        } catch (regexError) {
            log.warn(`Patrón inválido: "${pat}".`, regexError, { ...meta, patternType });
            return false;
        }
    });
}

/**
 * Analiza la firma digital y origen con patrones Dragon3 y C2PA/CAI.
 * @param {string} filePath - Ruta absoluta del archivo de imagen.
 * @param {object} [configAnalisis] - Configuración extra (opcional, no usada).
 * @param {string} [correlationId] - ID de correlación para trazabilidad/logs.
 * @param {string} [imagenId] - ID único de imagen para tracking.
 * @returns {Promise<object>} Resultado estructurado.
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

    // Respuesta Dragon3/FAANG
    const resultado = {
        idAnalizador: ANALYZER_ID,
        nombreAnalizador: ANALYZER_NAME,
        version: ANALYZER_VERSION,
        descripcion: "Detecta y clasifica la firma digital (sello, cámara genuina, edición, IA, C2PA, marcas nuevas, desconocida).",
        score: null,
        detalles: {
            hayFirmaDigital: false,
            tipoFirmaDigital: "desconocida",
            esConfiable: null,
            mensaje: "Análisis no procesado o patrones no disponibles."
        },
        metadatos: {},
        metadatosXMP_IPTC: {},
        contentCredentials: null,
        performance: { duracionMs: null },
        logs: [],
        correlationId,
        imagenId,
        timestamp: Date.now()
    };

    log.info(`[${ANALYZER_ID}] Inicio del análisis de firma digital.`, baseMeta);

    try {
        if (!filePath || typeof filePath !== 'string') throw new Error("Parámetro filePath inválido o ausente.");
        if (!fs.existsSync(filePath)) throw new Error(`Archivo no encontrado en la ruta: ${filePath}`);
        resultado.logs.push("Archivo validado para análisis de firmas digitales.");
        log.debug(`[${ANALYZER_ID}] Archivo validado.`, baseMeta);

        // --- EXIF rápido y metadatos avanzados ---
        const exifPromise = exifr.parse(filePath).catch(err => {
            log.warn(`[${ANALYZER_ID}] exifr.parse falló.`, err, baseMeta);
            return {};
        });
        const advancedMetadataPromise = exiftool.read(filePath).catch(err => {
            log.warn(`[${ANALYZER_ID}] exiftool.read falló.`, err, baseMeta);
            return {};
        });
        const [exif, metadatosAvanzados] = await Promise.all([exifPromise, advancedMetadataPromise]);

        resultado.logs.push(`EXIF básico y metadatos avanzados extraídos.`);

        // --- XMP, IPTC y Content Credentials ---
        resultado.metadatosXMP_IPTC = {
            creatorTool: metadatosAvanzados.CreatorTool || metadatosAvanzados['XMP:CreatorTool'] || null,
            history: metadatosAvanzados.HistorySoftwareAgent || metadatosAvanzados['XMP:HistorySoftwareAgent'] || null,
            rights: metadatosAvanzados.XMPRights || metadatosAvanzados['XMP:Rights'] || null,
            description: metadatosAvanzados.Description || metadatosAvanzados['XMP:Description'] || null,
            byline: metadatosAvanzados.Byline || metadatosAvanzados['IPTC:By-line'] || null,
            copyrightNotice: metadatosAvanzados.CopyrightNotice || metadatosAvanzados['IPTC:CopyrightNotice'] || null
        };

        // Busca Content Credentials (CAI/C2PA)
        const contentCredentialsFields = [
            'XMP-xmpMM:ContentCredentials', 'XMP:ContentCredentials', 'ContentCredentials', 'XMP-xmp:Manifest', 'Manifest'
        ];
        for (const field of contentCredentialsFields) {
            if (metadatosAvanzados[field]) {
                resultado.contentCredentials = metadatosAvanzados[field];
                log.info(`[${ANALYZER_ID}] Content Credentials detectadas. Campo: '${field}'.`, { ...baseMeta, ccField: field });
                break;
            }
        }

        // --- Busca marcas C2PA y marcasIA recientes ---
        let c2paDetected = false, marcaIADetectada = false, c2paField = '';
        if (Object.keys(metadatosAvanzados).length) {
            for (const campo in metadatosAvanzados) {
                if (matchPatron(metadatosAvanzados[campo], patrones.marcasC2PA, baseMeta, "marcasC2PA")) {
                    c2paDetected = true; c2paField = campo; break;
                }
            }
            for (const campo in metadatosAvanzados) {
                if (matchPatron(metadatosAvanzados[campo], patrones.marcasIA, baseMeta, "marcasIA")) {
                    marcaIADetectada = true; break;
                }
            }
        }

        // --- Campos relevantes para patrones ---
        const camposConcatenados = [
            exif.Software, exif.Make, exif.Model, exif.Artist, exif.DocumentName, exif.ImageDescription, exif.Copyright,
            resultado.metadatosXMP_IPTC.creatorTool, resultado.metadatosXMP_IPTC.history,
            resultado.metadatosXMP_IPTC.rights, resultado.metadatosXMP_IPTC.description,
            resultado.metadatosXMP_IPTC.byline, resultado.metadatosXMP_IPTC.copyrightNotice
        ].filter(Boolean).join(" | ").toLowerCase();

        // --- Clasificación y scoring ---
        let tipoFirma = "desconocida";
        let esConfiable = null;
        let mensaje = "";
        let score = 5;
        resultado.detalles.hayFirmaDigital = false;

        if (c2paDetected || resultado.contentCredentials) {
            tipoFirma = "c2pa"; esConfiable = true; mensaje = "C2PA/CAI Content Credentials detectadas. Alta autenticidad (verifica cadena de confianza)."; score = 10; resultado.detalles.hayFirmaDigital = true;
        } else if (marcaIADetectada || matchPatron(camposConcatenados, patrones.marcasIA, baseMeta, "marcasIA")) {
            tipoFirma = "ia"; esConfiable = false; mensaje = "Marcas de IA generativa recientes detectadas."; score = 0; resultado.detalles.hayFirmaDigital = true;
        } else if (matchPatron(camposConcatenados, patrones.sellosVerificacion, baseMeta, "sellosVerificacion")) {
            tipoFirma = "sello"; esConfiable = true; mensaje = "Sello de verificación reconocido (MBH, Dragon, etc)."; score = 10; resultado.detalles.hayFirmaDigital = true;
        } else if (matchPatron(camposConcatenados, patrones.softwareGenerico, baseMeta, "softwareGenerico")) {
            tipoFirma = "generica"; esConfiable = true; mensaje = "Firma digital compatible con dispositivo de captura genuino."; score = 8; resultado.detalles.hayFirmaDigital = true;
        } else if (matchPatron(camposConcatenados, patrones.softwareEdicion, baseMeta, "softwareEdicion")) {
            tipoFirma = "edicion"; esConfiable = null; mensaje = "Editada con software profesional. No implica IA, pero no es confiable por sí misma."; score = 5; resultado.detalles.hayFirmaDigital = true;
        } else if (matchPatron(camposConcatenados, patrones.softwareGeneracionIA, baseMeta, "softwareGeneracionIA")) {
            tipoFirma = "ia"; esConfiable = false; mensaje = "Firmado por software de generación IA."; score = 0; resultado.detalles.hayFirmaDigital = true;
        } else {
            mensaje = "No se detecta firma digital reconocible o patrones no disponibles.";
        }

        resultado.detalles.tipoFirmaDigital = tipoFirma;
        resultado.detalles.esConfiable = esConfiable;
        resultado.detalles.mensaje = mensaje;
        resultado.score = score;

        resultado.metadatos = {
            software: exif.Software || resultado.metadatosXMP_IPTC.creatorTool || null,
            make: exif.Make || null,
            model: exif.Model || null,
            copyright: exif.Copyright || resultado.metadatosXMP_IPTC.copyrightNotice || null,
            artist: exif.Artist || resultado.metadatosXMP_IPTC.byline || null,
            documentName: exif.DocumentName || null,
            selloDetectado: tipoFirma === "sello",
            creatorToolXMP: resultado.metadatosXMP_IPTC.creatorTool || null,
            historySoftwareAgentXMP: resultado.metadatosXMP_IPTC.history || null,
            c2paDetected,
            c2paField
        };

        // --- Performance ---
        const t1 = process.hrtime.bigint();
        resultado.performance.duracionMs = parseFloat((Number(t1 - t0) / 1e6).toFixed(2));
        resultado.metadatos.duracionMs = resultado.performance.duracionMs;

        resultado.logs.push(`Análisis de firma digital finalizado. Score: ${resultado.score}.`);
        log.info(`[${ANALYZER_ID}] Fin análisis firma digital. Score: ${resultado.score}.`, {
            ...baseMeta,
            finalScore: resultado.score,
            signatureType: tipoFirma,
            isReliable: esConfiable,
            hasCAI: !!resultado.contentCredentials,
            c2paDetected,
            marcaIADetectada,
            duracionMs: resultado.performance.duracionMs
        });

    } catch (error) {
        resultado.score = null;
        resultado.detalles.mensaje = `Error crítico durante el análisis de firmas digitales: ${error.message}`;
        const t1 = process.hrtime.bigint();
        resultado.performance.duracionMs = parseFloat((Number(t1 - t0) / 1e6).toFixed(2));
        resultado.metadatos.duracionMs = resultado.performance.duracionMs;
        resultado.logs.push(`Error crítico: ${error.message}`);
        log.error(`[${ANALYZER_ID}] Error crítico durante el análisis.`, error, baseMeta);
    }

    return resultado;
};