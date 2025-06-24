/**
 * @file analizadorValidator.js
 * @version 3.1.0
 * @author Gustavo Herraiz
 * @description
 * Valida la integridad de la imagen y extrae formato, dimensiones y EXIF.
 * Detecta mensajería, IA, edición, sellos y dispositivos genuinos.
 * Logging estructurado, robustez FAANG, compatible Dragon3.
 */

import fs from 'fs';
import exifr from 'exifr';
import path from 'path';
import { fileURLToPath } from 'url';
import { log } from "../../utilidades/logger.js";

const ANALYZER_VERSION = '3.1.0';
const ANALYZER_ID = 'VALIDATOR_IMAGE_FAANG';
const ANALYZER_NAME = 'VALIDADOR_DE_IMÁGENES';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Analiza y valida una imagen, extrayendo formato, dimensiones, resolución, EXIF y detectando patrones de manipulación, IA o mensajería.
 * @param {string} filePath - Ruta absoluta del archivo de imagen.
 * @param {object} [configAnalisis] - Configuración adicional (opcional, no usado).
 * @param {string} [correlationId] - ID de correlación para trazabilidad/logs.
 * @param {string} [imagenId] - ID único de imagen para seguimiento.
 * @returns {Promise<object>} Resultado estructurado y homogeneizado.
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

    const resultado = {
        idAnalizador: ANALYZER_ID,
        nombreAnalizador: ANALYZER_NAME,
        version: ANALYZER_VERSION,
        descripcion: "Valida la integridad, formato, dimensiones y EXIF de la imagen. Detecta manipulación, IA, mensajería, edición, sellos y dispositivos genuinos.",
        score: null,
        detalles: {
            formato: "No disponible",
            dimensiones: "No disponible",
            resolucion: "No disponible",
            mensaje: "Análisis no procesado correctamente."
        },
        metadatos: {},
        performance: { duracionMs: null },
        logs: [],
        correlationId,
        imagenId,
        timestamp: Date.now()
    };

    const t0 = process.hrtime.bigint();

    try {
        // --- Validaciones iniciales ---
        if (!filePath || typeof filePath !== 'string') throw new Error("Parámetro filePath inválido o ausente.");
        if (!fs.existsSync(filePath)) throw new Error("El archivo no existe.");
        resultado.logs.push("Archivo validado.");
        log.info(`[${ANALYZER_ID}] Archivo validado.`, baseMeta);

        // --- Extracción de metadatos EXIF ---
        const metadatosCompletos = await exifr.parse(filePath) || {};
        resultado.logs.push("Metadatos EXIF extraídos correctamente.");
        log.info(`[${ANALYZER_ID}] Metadatos EXIF extraídos.`, baseMeta);

        // --- Procesado de detalles principales ---
        const formato = path.extname(filePath).slice(1).toUpperCase() || "No disponible";
        const ancho = metadatosCompletos.ImageWidth || metadatosCompletos.ExifImageWidth || metadatosCompletos.PixelXDimension || null;
        const alto  = metadatosCompletos.ImageHeight || metadatosCompletos.ExifImageHeight || metadatosCompletos.PixelYDimension || null;
        const dimensiones = (ancho && alto) ? `${ancho}x${alto}` : "No disponible";
        const resolucion = (metadatosCompletos.XResolution && metadatosCompletos.YResolution)
            ? `${metadatosCompletos.XResolution}x${metadatosCompletos.YResolution} ppi`
            : "No disponible";

        resultado.detalles.formato = formato;
        resultado.detalles.dimensiones = dimensiones;
        resultado.detalles.resolucion = resolucion;

        resultado.metadatos = {
            Formato: formato,
            Dimensiones: dimensiones,
            Resolución: resolucion,
            Cámara: metadatosCompletos.Make || "No disponible",
            Modelo: metadatosCompletos.Model || "No disponible",
            FechaDeCaptura: metadatosCompletos.DateTimeOriginal || "No disponible",
            Software: metadatosCompletos.Software || "No disponible"
        };

        // --- Patrones de mensajería/WhatsApp/Telegram ---
        const nombreArchivo = path.basename(filePath);
        const patronWhatsApp = /^(IMG-\d{4}|WhatsApp Image \d{4}-\d{2}-\d{2})/i;
        const esNombreWhatsApp = patronWhatsApp.test(nombreArchivo);

        const dimensionesMensajeria = [
            "960x1280", "1280x960", "720x1280", "800x600", "864x1152"
        ];
        const esDimensionMensajeria = dimensionesMensajeria.includes(dimensiones);

        const softwareLower = (metadatosCompletos.Software || "").toLowerCase();
        const softwareEsWhatsApp = softwareLower.includes("whatsapp");
        const exifKeys = Object.keys(metadatosCompletos);
        const exifVacio = exifKeys.length < 5;

        // --- Cargar patrones de herramientas sospechosas/IA/edición ---
        let configHerramientas = {
            softwareEdicion: [],
            softwareGeneracionIA: [],
            softwareGenerico: [],
            sellosVerificacion: []
        };
        try {
            const rawConfig = fs.readFileSync(
                path.resolve(__dirname, 'analizadorHerramientasSospechosas.json'),
                'utf8'
            );
            configHerramientas = JSON.parse(rawConfig);
            resultado.logs.push("Patrones de herramientas sospechosas cargados.");
        } catch (err) {
            resultado.logs.push("No se pudo leer analizadorHerramientasSospechosas.json, usando configuración vacía.");
            log.warn(`[${ANALYZER_ID}] No se pudo leer analizadorHerramientasSospechosas.json.`, { ...baseMeta, error: err.message });
        }

        // --- Compilación de patrones en RegExp (case-insensitive) ---
        const compilarPatrones = (lista) => Array.isArray(lista) ? lista.map(pat => new RegExp(pat, 'i')) : [];
        const patronesIA = compilarPatrones(configHerramientas.softwareGeneracionIA);
        const patronesEdicion = compilarPatrones(configHerramientas.softwareEdicion);
        const patronesGenerico = compilarPatrones(configHerramientas.softwareGenerico);
        const patronesSellos = compilarPatrones(configHerramientas.sellosVerificacion);

        // --- Detección por software ---
        const esIA = patronesIA.some(rx => rx.test(softwareLower));
        const esEdicion = patronesEdicion.some(rx => rx.test(softwareLower));
        const esGenerico = patronesGenerico.some(rx => rx.test(softwareLower));
        const tieneSello = patronesSellos.some(rx => rx.test(softwareLower));

        // --- Lógica de score y mensajes (KISS, FAANG) ---
        if (esNombreWhatsApp || esDimensionMensajeria || softwareEsWhatsApp || exifVacio) {
            resultado.score = 6;
            resultado.detalles.mensaje = "Se detecta mensajería o EXIF incompleto (WhatsApp/Telegram). Resultado NO concluyente y autenticidad no garantizada.";
            resultado.logs.push("Patrón de mensajería detectado.");
        } else if (esIA) {
            resultado.score = 2;
            resultado.detalles.mensaje = `Software de generación IA detectado (${metadatosCompletos.Software}). Imagen probablemente sintética.`;
            resultado.logs.push("Patrón de generación IA detectado.");
            log.warn(`[${ANALYZER_ID}] Software IA detectado: ${metadatosCompletos.Software}`, baseMeta);
        } else if (esEdicion) {
            resultado.score = 3;
            resultado.detalles.mensaje = `Software de edición detectado (${metadatosCompletos.Software}). Imagen probablemente editada.`;
            resultado.logs.push("Patrón de edición detectado.");
            log.warn(`[${ANALYZER_ID}] Software de edición detectado: ${metadatosCompletos.Software}`, baseMeta);
        } else if (esGenerico) {
            resultado.score = 8;
            resultado.detalles.mensaje = `Software de cámara/dispositivo detectado (${metadatosCompletos.Software}). Imagen probablemente original de dispositivo.`;
            resultado.logs.push("Patrón de cámara/dispositivo detectado.");
        } else if (tieneSello) {
            resultado.score = 9;
            resultado.detalles.mensaje = `Sello de verificación reconocido (${metadatosCompletos.Software}). Imagen verificada.`;
            resultado.logs.push("Sello de verificación detectado.");
        } else {
            resultado.score = 8;
            resultado.detalles.mensaje = "La imagen parece auténtica y coherente según metadatos.";
            resultado.logs.push("Sin patrones sospechosos, autenticidad probable.");
        }

        log.info(`[${ANALYZER_ID}] Metadatos clave: ${JSON.stringify(resultado.metadatos)}`, baseMeta);

    } catch (error) {
        resultado.score = null;
        resultado.detalles.mensaje = `Error durante el análisis: ${error.message}`;
        resultado.logs.push(`Error: ${error.message}`);
        log.error(`[${ANALYZER_ID}] Error durante el análisis: ${error.message}`, { ...baseMeta, error });
    } finally {
        const t1 = process.hrtime.bigint();
        resultado.performance.duracionMs = Number(t1 - t0) / 1e6;
    }

    return resultado;
};