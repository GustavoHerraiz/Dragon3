/**
 * @file analizadorValidator.js
 * @description Valida la integridad de la imagen y extrae sus principales características, como formato, dimensiones y metadatos EXIF.
 *              Detecta patrones de mensajería, IA, edición, sellos y dispositivos genuinos, con logging Dragon3.
 */

import fs from 'fs';
import exifr from 'exifr';
import { log } from "../../utilidades/logger.js";

/**
 * Analiza y valida una imagen, extrayendo formato, dimensiones, resolución, EXIF y detectando patrones de manipulación, IA o mensajería.
 * @param {string} rutaArchivo - Ruta del archivo de imagen a analizar.
 * @returns {Promise<object>} Resultado estructurado del análisis.
 */
export const analizar = async (rutaArchivo) => {
    const resultado = {
        nombreAnalizador: "VALIDADOR_DE_IMÁGENES",
        descripcion: "Valida la integridad de la imagen y extrae sus principales características, como formato, dimensiones y metadatos EXIF.",
        score: null,
        detalles: {
            formato: "No disponible",
            dimensiones: "No disponible",
            resolucion: "No disponible",
            mensaje: "Análisis no procesado correctamente."
        },
        metadatos: {},
        logs: []
    };

    try {
        // Validar existencia del archivo
        if (!fs.existsSync(rutaArchivo)) throw new Error("El archivo no existe.");
        log.info("[VALIDADOR_DE_IMÁGENES] Archivo validado.");
        resultado.logs.push("Archivo validado.");

        // Extraer metadatos usando exifr
        const metadatosCompletos = await exifr.parse(rutaArchivo) || {};
        log.info("[VALIDADOR_DE_IMÁGENES] Metadatos EXIF extraídos correctamente.");
        resultado.logs.push("Metadatos EXIF extraídos correctamente.");

        // Procesar metadatos relevantes
        const metadatosRelevantes = {};
        if (metadatosCompletos.Make) metadatosRelevantes.Cámara = metadatosCompletos.Make;
        if (metadatosCompletos.Model) metadatosRelevantes.Modelo = metadatosCompletos.Model;
        if (metadatosCompletos.DateTimeOriginal) metadatosRelevantes.FechaDeCaptura = metadatosCompletos.DateTimeOriginal;
        if (metadatosCompletos.Software) metadatosRelevantes.Software = metadatosCompletos.Software;

        // Asignar detalles básicos
        resultado.detalles.formato = rutaArchivo.split('.').pop().toUpperCase();
        resultado.detalles.dimensiones = metadatosCompletos.ImageWidth && metadatosCompletos.ImageHeight
            ? `${metadatosCompletos.ImageWidth}x${metadatosCompletos.ImageHeight}`
            : "No disponible";
        resultado.detalles.resolucion = metadatosCompletos.XResolution && metadatosCompletos.YResolution
            ? `${metadatosCompletos.XResolution}x${metadatosCompletos.YResolution} ppi`
            : "No disponible";

        // Construir metadatos finales combinados
        resultado.metadatos = {
            Formato: resultado.detalles.formato || "No disponible",
            Dimensiones: resultado.detalles.dimensiones || "No disponible",
            Resolución: resultado.detalles.resolucion || "No disponible",
            ...metadatosRelevantes
        };

        // --- Detección de patrones de mensajería/WhatsApp ---
        const nombreArchivo = rutaArchivo.split(/[\\/]/).pop();
        const patronWhatsApp = /^(IMG-\d{4}|WhatsApp Image \d{4}-\d{2}-\d{2})/;
        const esNombreWhatsApp = patronWhatsApp.test(nombreArchivo);

        const dimensionesWhatsApp = [
            "960x1280", "1280x960", "720x1280", "800x600", "864x1152"
        ];
        const esDimensionWhatsApp = dimensionesWhatsApp.includes(resultado.detalles.dimensiones);

        const softwareEsWhatsApp = metadatosCompletos.Software && metadatosCompletos.Software.toLowerCase().includes("whatsapp");
        const exifKeys = Object.keys(metadatosCompletos);
        const exifVacio = exifKeys.length < 5;

        // --- Cargar analizadorHerramientasSospechosas.json y compilar patrones ---
        let configHerramientas = null;
        try {
            const rawConfig = fs.readFileSync('./analizadorHerramientasSospechosas.json', 'utf8');
            configHerramientas = JSON.parse(rawConfig);
        } catch (err) {
            log.warn("[VALIDADOR_DE_IMÁGENES] No se pudo leer analizadorHerramientasSospechosas.json. Se usará configuración vacía.", err);
            configHerramientas = {
                softwareEdicion: [],
                softwareGeneracionIA: [],
                softwareGenerico: [],
                sellosVerificacion: []
            };
        }

        // Compilar arrays de patrones en RegExp (case-insensitive)
        const compilarPatrones = (lista) => lista.map(pattern => new RegExp(pattern, 'i'));
        const patronesIA = compilarPatrones(configHerramientas.softwareGeneracionIA || []);
        const patronesEdicion = compilarPatrones(configHerramientas.softwareEdicion || []);
        const patronesGenerico = compilarPatrones(configHerramientas.softwareGenerico || []);
        const patronesSellos = compilarPatrones(configHerramientas.sellosVerificacion || []);

        // Detección según software en EXIF
        const softwareDetectado = metadatosCompletos.Software || "";

        const esIA = patronesIA.some(rx => rx.test(softwareDetectado));
        const esEdicion = patronesEdicion.some(rx => rx.test(softwareDetectado));
        const esGenerico = patronesGenerico.some(rx => rx.test(softwareDetectado));
        const tieneSello = patronesSellos.some(rx => rx.test(softwareDetectado));

        // --- Lógica de score y mensajes adaptados ---
        if (esNombreWhatsApp || esDimensionWhatsApp || softwareEsWhatsApp || exifVacio) {
            resultado.score = 6;
            resultado.detalles.mensaje = "Se ha detectado que la imagen ha sido enviada por mensajería. El resultado NO puede ser concluyente y no se puede analizar la autenticidad de esta imagen.";
            resultado.logs.push("Patrón de mensajería detectado.");
        } else if (esIA) {
            resultado.score = 2;
            resultado.detalles.mensaje = `Software de generación IA detectado (${softwareDetectado}). Probable imagen generada sintéticamente.`;
            resultado.logs.push("Patrón de generación IA detectado.");
            log.warn(`[VALIDADOR_DE_IMÁGENES] Software IA detectado: ${softwareDetectado}`);
        } else if (esEdicion) {
            resultado.score = 3;
            resultado.detalles.mensaje = `Software de edición detectado (${softwareDetectado}). Imagen probablemente editada.`;
            resultado.logs.push("Patrón de edición detectado.");
            log.warn(`[VALIDADOR_DE_IMÁGENES] Software de edición detectado: ${softwareDetectado}`);
        } else if (esGenerico) {
            resultado.score = 8;
            resultado.detalles.mensaje = `Software de cámara o genérico detectado (${softwareDetectado}). Imagen probablemente directa de dispositivo.`;
            resultado.logs.push("Patrón de cámara/dispositivo detectado.");
        } else if (tieneSello) {
            resultado.score = 9;
            resultado.detalles.mensaje = `Sello de verificación detectado (${softwareDetectado}). Imagen verificada por herramienta reconocida.`;
            resultado.logs.push("Sello de verificación detectado.");
        } else {
            resultado.score = 8;
            resultado.detalles.mensaje = "La imagen parece ser auténtica con datos consistentes.";
        }

        // Registrar metadatos clave de manera limpia
        const logMetadatos = Object.entries(resultado.metadatos)
            .map(([clave, valor]) => `${clave}: ${valor}`)
            .join(', ');
        log.info(`[VALIDADOR_DE_IMÁGENES] Metadatos procesados: ${logMetadatos}`);

    } catch (error) {
        resultado.score = null;
        resultado.detalles.mensaje = `Error durante el análisis: ${error.message}`;
        resultado.logs.push(`Error: ${error.message}`);
        log.error(`[VALIDADOR_DE_IMÁGENES] Error durante el análisis: ${error.message}`, error);
    }

    return resultado;
};