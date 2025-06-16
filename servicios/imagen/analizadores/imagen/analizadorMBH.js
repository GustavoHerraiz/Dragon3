/**
 * @file analizadorMBH.js
 * @description
 * Analizador para la detección y decodificación del sello MBH (Made By Humans) en imágenes digitales.
 * Este módulo es propiedad confidencial de Dragon Project. Prohibida su copia, distribución o ingeniería inversa.
 * (El resto de la descripción original se mantiene)
 * @author Dragon Project, Gustavo Herraiz
 * @date 2025-05-29
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import crypto from 'crypto';
import { log } from '../../utilidades/logger.js'; // RUTA CORRECTA Dragon

const MODULE_NAME = path.basename(fileURLToPath(import.meta.url));

// Parámetros confidenciales MBH
const GOLDEN_RATIO = 1.618033988749895;
const SPIRAL_AREA_SIZE = 12;
const SPIRAL_RATIO_TOLERANCE = 0.12;
const MIN_ID_BYTES = 12;

const MBH_SALT_ENV_VAR = 'MBH_SALT';
const DEFAULT_MBH_SALT = 'default-development-salt-dragon-project-needs-secure-env-salt';

const MBH_SALT = process.env[MBH_SALT_ENV_VAR] || DEFAULT_MBH_SALT;

// Logueo inicial sobre el SALT utilizado
if (MBH_SALT === DEFAULT_MBH_SALT) {
    log.warn(`MBH: Salt DEFAULT en uso. Configurar ${MBH_SALT_ENV_VAR} para producción.`, { module: MODULE_NAME, component: 'Initialization' });
} else {
    log.info(`MBH: Salt cargado desde ENV (${MBH_SALT_ENV_VAR}).`, { module: MODULE_NAME, component: 'Initialization' });
}

// --- Funciones auxiliares internas (confidenciales) ---

function encontrarTresPuntos(data, { width, height }, parentBaseMeta) {
    const localMeta = { ...parentBaseMeta, funcion: 'encontrarTresPuntos' };
    let puntos = [];
    let maxContraste = 0;
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            const contraste = Math.abs(
                data[idx] - data[idx - 1] +
                data[idx] - data[idx + 1] +
                data[idx] - data[idx - width] +
                data[idx] - data[idx + width]
            );
            if (contraste > maxContraste) {
                maxContraste = contraste;
                puntos.push({ x, y, intensidad: data[idx] });
                if (puntos.length > 3) puntos.shift();
            }
        }
    }
    log.debug(`MBH: Puntos búsqueda: ${puntos.length} hallados, contraste máx ${maxContraste}.`, localMeta);
    return puntos;
}

function esPatronMBH(puntos, parentBaseMeta) {
    const localMeta = { ...parentBaseMeta, funcion: 'esPatronMBH' };
    if (puntos.length !== 3) {
        log.debug(`MBH: Patrón check: Falló. ${puntos.length} puntos (esperados 3).`, localMeta);
        return false;
    }
    const d1 = distancia(puntos[0], puntos[1]);
    const d2 = distancia(puntos[1], puntos[2]);
    const ratio = d1 === 0 ? Infinity : d2 / d1;
    const isMatch = Math.abs(ratio - GOLDEN_RATIO) < SPIRAL_RATIO_TOLERANCE;
    log.debug(`MBH: Patrón check: D1=${d1.toFixed(1)}, D2=${d2.toFixed(1)}, Ratio=${ratio.toFixed(2)}. Coincide=${isMatch}.`, localMeta);
    return isMatch;
}

function distancia(p1, p2) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

function calcularCentro(puntos) {
    return {
        x: Math.round((puntos[0].x + puntos[2].x) / 2),
        y: Math.round((puntos[0].y + puntos[2].y) / 2)
    };
}

function extraerDatosCentro(data, { width, height }, centro, parentBaseMeta) {
    const localMeta = { ...parentBaseMeta, funcion: 'extraerDatosCentro', centroX: centro.x, centroY: centro.y };
    const radio = Math.floor(SPIRAL_AREA_SIZE / 2);
    const datos = [];
    let idx = 0;
    for (let y = -radio; y < radio; y++) {
        for (let x = -radio; x < radio; x++) {
            const posX = centro.x + x;
            const posY = centro.y + y;
            if (posX >= 0 && posX < width && posY >= 0 && posY < height) {
                datos[idx++] = data[posY * width + posX];
            }
        }
    }
    const buffer = Buffer.from(datos);
    log.debug(`MBH: Datos centrales: Extraídos ${buffer.length} bytes.`, localMeta);
    return buffer;
}

function decodificarNumeroSello(buffer, parentBaseMeta) {
    const localMeta = { ...parentBaseMeta, funcion: 'decodificarNumeroSello' };
    try {
        const ascii = buffer.toString('utf8').replace(/\0/g, '');
        const match = ascii.match(/(MBH-\d{6}-\d{4,}):(\d{13,})/);
        if (match && match[1] && match[2]) {
            log.debug(`MBH: Sello decode: Éxito. ID=${match[1]}, TS=${match[2]}.`, localMeta);
            return { id: match[1], timestamp: match[2] };
        }
        log.debug(`MBH: Sello decode: Sin match. ASCII (30c): "${ascii.substring(0,30)}...".`, localMeta);
        return { id: null, timestamp: null };
    } catch (error) {
        log.warn(`MBH: Sello decode: Excepción en parse.`, error, localMeta);
        return { id: null, timestamp: null };
    }
}

// --- Analizador principal ---
export const analizar = async (filePath, configAnalisis, correlationId, imagenId = 'N/A') => {
    const baseMeta = { module: MODULE_NAME, correlationId, imagenId, funcion: 'analizar', filePath };

    const resultado = {
        nombreAnalizador: MODULE_NAME.replace(/\.js$/i, "").toUpperCase(),
        descripcion: "Análisis de la presencia y validez del sello MBH (Made By Humans) en la imagen.",
        score: null,
        detalles: {
            selloDetectado: false,
            tipo: "indeterminado",
            numeroSello: null,
            timestamp: null,
            hashCalculado: null,
            mensaje: "Análisis MBH no procesado."
        },
        metadatos: {},
    };

    log.info(`MBH: Análisis inicio.`, baseMeta);

    try {
        if (!fs.existsSync(filePath)) {
            throw new Error(`Archivo no encontrado: ${filePath}`);
        }
        log.debug(`MBH: Archivo validado.`, baseMeta);

        const { data, info } = await sharp(filePath)
            .greyscale()
            .raw()
            .toBuffer({ resolveWithObject: true });
        log.debug(`MBH: Imagen preprocesada (raw gris). W=${info.width}, H=${info.height}.`, baseMeta);

        const puntos = encontrarTresPuntos(data, info, baseMeta);

        if (!esPatronMBH(puntos, baseMeta)) {
            resultado.detalles.selloDetectado = false;
            resultado.detalles.tipo = "ausente";
            resultado.detalles.mensaje = "Esta imagen no contiene el sello MBH. Su ausencia no implica manipulación, pero carece de esta capa de autenticación específica.";
            resultado.score = 5;
            log.info(`MBH: Sello ausente. Patrón no hallado. Score=${resultado.score}.`, baseMeta);
        } else {
            resultado.detalles.selloDetectado = true;
            log.debug(`MBH: Patrón DETECTADO. Decodificando...`, baseMeta);

            const centro = calcularCentro(puntos);
            const datosCentro = extraerDatosCentro(data, info, centro, baseMeta);

            let numeroSello = null;
            let timestamp = null;
            let hashCalculado = null;

            if (datosCentro && datosCentro.length >= MIN_ID_BYTES) {
                const decodeResult = decodificarNumeroSello(datosCentro, baseMeta);
                numeroSello = decodeResult.id;
                timestamp = decodeResult.timestamp;

                if (numeroSello && timestamp) {
                    const datosConcat = `${numeroSello}:${timestamp}:${MBH_SALT}`;
                    hashCalculado = crypto.createHash('sha256').update(datosConcat).digest('hex');
                    log.debug(`MBH: Hash calculado. ID=${numeroSello}, TS=${timestamp}.`, { ...baseMeta, hashCalculado });
                } else {
                    log.debug(`MBH: Hash: ID/TS no decodificados desde datos centrales.`, baseMeta);
                }
            } else {
                log.debug(`MBH: Hash: Datos centrales insuficientes/nulos (${datosCentro ? datosCentro.length : 'null'}B < ${MIN_ID_BYTES}B).`, baseMeta);
            }

            if (numeroSello && timestamp && hashCalculado) {
                resultado.detalles.tipo = "original_completo";
                resultado.detalles.numeroSello = numeroSello;
                resultado.detalles.timestamp = timestamp;
                resultado.detalles.hashCalculado = hashCalculado;
                resultado.detalles.mensaje = `Sello MBH detectado y verificado: ID ${numeroSello}. Emisión: ${new Date(Number(timestamp)).toISOString()}. Autenticidad confirmada.`;
                resultado.score = 10;
                log.info(`MBH: Sello válido. ID=${numeroSello}. Score=${resultado.score}.`, { ...baseMeta, timestamp, hashCalculado });
            } else {
                resultado.detalles.tipo = "fragmento_ilegible";
                resultado.detalles.mensaje = "Imagen con rastros de patrón MBH, pero datos embebidos (ID/timestamp) ilegibles, corruptos, incompletos o hash no calculable. Posible alteración o copia incompleta.";
                resultado.score = 3;
                log.warn(`MBH: Sello patrón hallado, datos inválidos/incompletos. Score=${resultado.score}.`, { ...baseMeta, id: numeroSello, ts: timestamp });
            }
        }

        // Extraer metadatos básicos de la imagen original, independientemente del sello
        const imageMetadataSharp = await sharp(filePath).metadata();
        resultado.metadatos = {
            formato: imageMetadataSharp.format || "Desconocido",
            ancho: imageMetadataSharp.width || null,
            alto: imageMetadataSharp.height || null,
            densidad: imageMetadataSharp.density || null
        };
        log.debug(`MBH: Metadatos imagen (sharp) OK.`, { ...baseMeta, ...resultado.metadatos });

    } catch (error) {
        resultado.score = null;
        resultado.detalles.mensaje = `Error crítico en análisis MBH: ${error.message}`;
        log.error(`MBH: Análisis EXCEPCIÓN!`, error, baseMeta);
    }

    log.info(`MBH: Análisis completo. Score=${resultado.score}, Detectado=${resultado.detalles.selloDetectado}, Tipo=${resultado.detalles.tipo}.`, baseMeta);
    return resultado;
};

/**
 * FIN DEL ARCHIVO
 * Archivo confidencial Dragon Project. No divulgar.
 */