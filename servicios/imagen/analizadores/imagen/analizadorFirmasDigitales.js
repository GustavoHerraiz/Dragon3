/**
 * @file analizadorFirmasDigitales.js
 * @description Analizador de firmas digitales y credenciales de contenido en imágenes.
 *              Clasifica según patrones de sello, cámara genuina, edición, IA o desconocida.
 *              Basado en patrones externos, EXIF, XMP, IPTC y Content Credentials (CAI/C2PA).
 *              Cumple estándar FAANG/Dragon3: logging, performance, robustez, KISS y documentación profesional.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import exifr from 'exifr'; // EXIF rápido
import { exiftool } from 'exiftool-vendored'; // Metadatos avanzados y Content Credentials
import { log } from '../../utilidades/logger.js';

const MODULE_NAME = path.basename(fileURLToPath(import.meta.url));
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PATRONES_PATH = path.join(__dirname, 'analizadorHerramientasSospechosas.json');
let patrones = { softwareEdicion: [], softwareGeneracionIA: [], softwareGenerico: [], sellosVerificacion: [] };

/**
 * Carga los patrones de firma digital desde el fichero JSON.
 * Si falla, continúa con patrones vacíos.
 */
try {
    const patronesRaw = fs.readFileSync(PATRONES_PATH, 'utf8');
    patrones = JSON.parse(patronesRaw);
    log.info(`Patrones de firmas digitales cargados correctamente.`, {
        module: MODULE_NAME,
        component: 'Inicialización',
        filePath: PATRONES_PATH,
        counts: {
            edicion: patrones.softwareEdicion.length,
            ia: patrones.softwareGeneracionIA.length,
            generico: patrones.softwareGenerico.length,
            sellos: patrones.sellosVerificacion.length
        }
    });
} catch (e) {
    log.error(`Error al cargar los patrones de firma digital. El analizador seguirá con patrones vacíos.`, e, {
        module: MODULE_NAME,
        component: 'Inicialización',
        filePath: PATRONES_PATH
    });
}

/**
 * Busca si un valor coincide con algún patrón (expresión regular) de la lista.
 * @param {string} valor - Texto donde buscar.
 * @param {Array<string>} patronesArray - Array de patrones regex.
 * @param {object} parentBaseMeta - Metadatos base para logs.
 * @param {string} patternType - Tipo de patrón (para logs).
 * @returns {boolean} true si hay coincidencia.
 */
function matchPatron(valor, patronesArray, parentBaseMeta, patternType) {
    const localMeta = { ...parentBaseMeta, funcion: 'matchPatron', patternType };
    if (!valor || !Array.isArray(patronesArray) || patronesArray.length === 0) {
        return false;
    }
    return patronesArray.some(pat => {
        try {
            return new RegExp(pat, "i").test(valor);
        } catch (regexError) {
            log.warn(`Patrón inválido en firmas digitales: "${pat}". Se omite.`, regexError, localMeta);
            return false;
        }
    });
}

/**
 * Analiza la firma digital de una imagen usando EXIF, XMP, IPTC y patrones Dragon.
 * Detecta sellos, cámaras genuinas, edición, IA y patrones desconocidos.
 * Incluye logging, gestión de errores y métricas de performance.
 * 
 * @param {string} filePath - Ruta absoluta del archivo de imagen.
 * @param {object} configAnalisis - Configuración (no usada, por compatibilidad).
 * @param {string} correlationId - ID de correlación para trazabilidad.
 * @param {string} imagenId - ID único de imagen.
 * @returns {Promise<object>} Resultado del análisis con score, detalles, metadatos y performance.
 */
export const analizar = async (filePath, configAnalisis, correlationId, imagenId = 'N/A') => {
    const t0 = process.hrtime.bigint();
    const baseMeta = { module: MODULE_NAME, correlationId, imagenId, funcion: 'analizar', filePath };

    const resultado = {
        nombreAnalizador: MODULE_NAME.replace(/\.js$/i, "").toUpperCase(),
        descripcion: "Detecta y clasifica la firma digital según patrones Dragon (sello, cámara genuina, edición, IA, desconocida).",
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
        performance: { duracionMs: null }
    };

    log.info(`Inicio del análisis de firma digital.`, baseMeta);

    try {
        if (!fs.existsSync(filePath)) {
            throw new Error(`Archivo no encontrado en la ruta: ${filePath}`);
        }
        log.debug(`Archivo validado.`, baseMeta);

        const exifPromise = exifr.parse(filePath).catch(err => {
            log.warn(`exifr.parse falló. EXIF básico puede faltar o ser ilegible.`, err, baseMeta);
            return {};
        });

        const advancedMetadataPromise = exiftool.read(filePath).catch(err => {
            log.warn(`exiftool.read falló. Metadatos avanzados (XMP, IPTC, CAI) pueden faltar.`, err, baseMeta);
            return {};
        });

        const [exif, metadatosAvanzados] = await Promise.all([exifPromise, advancedMetadataPromise]);

        log.debug(`EXIF básico parseado (exifr). Claves: ${Object.keys(exif).length}.`, baseMeta);
        log.debug(`Metadatos avanzados parseados (exiftool). Claves: ${Object.keys(metadatosAvanzados).length}.`, baseMeta);

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
                log.info(`Content Credentials (CAI/C2PA) detectados. Campo: '${field}'.`, { ...baseMeta, ccField: field });
                break;
            }
        }

        // Campos relevantes en texto para matching de patrones
        const camposConcatenados = [
            exif.Software, exif.Make, exif.Model, exif.Artist, exif.DocumentName, exif.ImageDescription, exif.Copyright,
            resultado.metadatosXMP_IPTC.creatorTool, resultado.metadatosXMP_IPTC.history,
            resultado.metadatosXMP_IPTC.rights, resultado.metadatosXMP_IPTC.description,
            resultado.metadatosXMP_IPTC.byline, resultado.metadatosXMP_IPTC.copyrightNotice
        ].filter(Boolean).join(" | ").toLowerCase();

        let tipoFirma = "desconocida";
        let esConfiable = null;
        let mensaje = "";
        let score = 5;
        resultado.detalles.hayFirmaDigital = false;

        if (matchPatron(camposConcatenados, patrones.sellosVerificacion, baseMeta, "sellosVerificacion")) {
            tipoFirma = "sello"; esConfiable = true; mensaje = "Sello de verificación reconocido (MBH, Dragon, etc)."; score = 10; resultado.detalles.hayFirmaDigital = true;
        } else if (matchPatron(camposConcatenados, patrones.softwareGenerico, baseMeta, "softwareGenerico")) {
            tipoFirma = "generica"; esConfiable = true; mensaje = "Firma digital compatible con dispositivo de captura genuino."; score = 8; resultado.detalles.hayFirmaDigital = true;
        } else if (matchPatron(camposConcatenados, patrones.softwareEdicion, baseMeta, "softwareEdicion")) {
            tipoFirma = "edicion"; esConfiable = null; mensaje = "Imagen editada con software profesional. No implica IA, pero no es confiable por sí misma."; score = 5; resultado.detalles.hayFirmaDigital = true;
        } else if (matchPatron(camposConcatenados, patrones.softwareGeneracionIA, baseMeta, "softwareGeneracionIA")) {
            tipoFirma = "ia"; esConfiable = false; mensaje = "Firmado por software de generación IA."; score = 0; resultado.detalles.hayFirmaDigital = true;
        } else {
            mensaje = "No se detecta firma digital reconocible o patrones no disponibles. No se puede determinar origen.";
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
            historySoftwareAgentXMP: resultado.metadatosXMP_IPTC.history || null
        };

        const t1 = process.hrtime.bigint();
        const duracionMs = Number(t1 - t0) / 1e6;
        resultado.performance.duracionMs = parseFloat(duracionMs.toFixed(2));
        resultado.metadatos.duracionMs = resultado.performance.duracionMs;

        log.info(`Análisis de firma digital finalizado. Score: ${resultado.score}.`, {
            ...baseMeta,
            finalScore: resultado.score,
            signatureType: tipoFirma,
            isReliable: esConfiable,
            hasCAI: !!resultado.contentCredentials,
            duracionMs: resultado.performance.duracionMs
        });

    } catch (error) {
        resultado.score = null;
        resultado.detalles.mensaje = `Error crítico durante el análisis de firmas digitales: ${error.message}`;
        const t1 = process.hrtime.bigint();
        const duracionMs = Number(t1 - t0) / 1e6;
        resultado.performance.duracionMs = parseFloat(duracionMs.toFixed(2));
        resultado.metadatos.duracionMs = resultado.performance.duracionMs;
        log.error(`Excepción en análisis de firmas digitales.`, error, baseMeta);
    }

    return resultado;
};