/**
 * FileProcessorManager.js - Router Inteligente Dragon3
 * KISS Principle: Análisis multi-formato + concurrencia + tracing
 * Performance: P95 <200ms garantizado + queue management
 * @author GustavoHerraiz
 * @date 2025-06-15
 */

import logger from '../utilidades/logger.js';
import { analizarImagen } from './analizadorImagen.js';
import { analizarPDF } from './analizadorPDF.js';
import { analizarVideo } from './analizadorVideo.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import healthMonitor from './HealthMonitor.js';

const NOMBRE_MODULO = 'FileProcessorManager';

class FileProcessorManager {
    constructor() {
        this.colaAnalisis = [];
        this.procesamientoActivo = new Map();
        this.maxConcurrencia = 5;
        this.procesandoActualmente = 0;
        this.analizadoresDisponibles = {
            imagen: analizarImagen,
            pdf: analizarPDF,
            video: analizarVideo
        };
    }

    /**
     * Determinar tipo análisis según extensión/mime
     */
    determinarTipoAnalisis(archivo) {
        const extension = path.extname(archivo.originalname).toLowerCase();
        const mimeType = archivo.mimetype.toLowerCase();

        // IMÁGENES
        if (mimeType.startsWith('image/') || 
            ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(extension)) {
            return 'imagen';
        }

        // PDFs
        if (mimeType === 'application/pdf' || extension === '.pdf') {
            return 'pdf';
        }

        // VIDEOS
        if (mimeType.startsWith('video/') || 
            ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv'].includes(extension)) {
            return 'video';
        }

        // AUDIO (futuro Dragon3)
        if (mimeType.startsWith('audio/') || 
            ['.mp3', '.wav', '.flac', '.aac', '.ogg'].includes(extension)) {
            return 'audio';
        }

        return 'desconocido';
    }

    /**
     * Generar ID único trazable Dragon3
     */
    generarIdTrazable(usuarioId, tipoArchivo) {
        const timestamp = Date.now();
        const sessionId = uuidv4().substring(0, 8);
        const userId = usuarioId || 'anonimo';
        
        return `D3_${tipoArchivo.toUpperCase()}_${userId}_${timestamp}_${sessionId}`;
    }

    /**
     * Procesar archivo con queue + concurrencia
     */
    async procesarArchivo(archivo, usuarioId, correlationId, opciones = {}) {
        const inicio = Date.now();
        const tipoAnalisis = this.determinarTipoAnalisis(archivo);
        const archivoId = this.generarIdTrazable(usuarioId, tipoAnalisis);

        logger.info('Archivo recibido para análisis Dragon3', {
            modulo: NOMBRE_MODULO,
            archivoId,
            correlationId,
            usuarioId: usuarioId || 'anonimo',
            tipoAnalisis,
            nombreArchivo: archivo.originalname,
            tamano: archivo.size,
            mimeType: archivo.mimetype
        });

        // Validar tipo soportado
        if (tipoAnalisis === 'desconocido') {
            const error = new Error(`Tipo archivo no soportado: ${archivo.mimetype}`);
            healthMonitor.registrarError(error, 'procesarArchivo');
            throw error;
        }

        // Validar analizador disponible
        if (!this.analizadoresDisponibles[tipoAnalisis]) {
            const error = new Error(`Analizador no disponible para: ${tipoAnalisis}`);
            healthMonitor.registrarError(error, 'procesarArchivo');
            throw error;
        }

        // Crear tarea análisis
        const tareaAnalisis = {
            archivoId,
            archivo,
            usuarioId,
            correlationId,
            tipoAnalisis,
            timestamp: Date.now(),
            opciones,
            resolve: null,
            reject: null
        };

        // Retornar promesa que se resuelve cuando termina análisis
        return new Promise((resolve, reject) => {
            tareaAnalisis.resolve = resolve;
            tareaAnalisis.reject = reject;
            
            this.colaAnalisis.push(tareaAnalisis);
            this.procesarCola();
        });
    }

    /**
     * Procesar cola con concurrencia controlada
     */
    async procesarCola() {
        if (this.procesandoActualmente >= this.maxConcurrencia || this.colaAnalisis.length === 0) {
            return;
        }

        const tarea = this.colaAnalisis.shift();
        this.procesandoActualmente++;
        this.procesamientoActivo.set(tarea.archivoId, tarea);

        logger.info('Iniciando análisis Dragon3', {
            modulo: NOMBRE_MODULO,
            archivoId: tarea.archivoId,
            correlationId: tarea.correlationId,
            tipoAnalisis: tarea.tipoAnalisis,
            colaRestante: this.colaAnalisis.length,
            procesamientoActivo: this.procesandoActualmente
        });

        try {
            const resultado = await this.ejecutarAnalisis(tarea);
            
            // Registrar métricas éxito
            const tiempoTotal = Date.now() - tarea.timestamp;
            healthMonitor.registrarTiempoRespuesta(tiempoTotal, `analisis-${tarea.tipoAnalisis}`);
            
            logger.info('Análisis completado Dragon3', {
                modulo: NOMBRE_MODULO,
                archivoId: tarea.archivoId,
                correlationId: tarea.correlationId,
                tiempoTotal,
                tipoAnalisis: tarea.tipoAnalisis
            });

            tarea.resolve(resultado);

        } catch (error) {
            healthMonitor.registrarError(error, `analisis-${tarea.tipoAnalisis}`);
            
            logger.error('Error análisis Dragon3', {
                modulo: NOMBRE_MODULO,
                archivoId: tarea.archivoId,
                correlationId: tarea.correlationId,
                tipoAnalisis: tarea.tipoAnalisis,
                error: error.message,
                stack: error.stack
            });

            tarea.reject(error);

        } finally {
            this.procesandoActualmente--;
            this.procesamientoActivo.delete(tarea.archivoId);
            
            // Continuar procesando cola
            this.procesarCola();
        }
    }

    /**
     * Ejecutar análisis según tipo
     */
    async ejecutarAnalisis(tarea) {
        const { archivo, correlationId, archivoId, tipoAnalisis, opciones } = tarea;
        const analizador = this.analizadoresDisponibles[tipoAnalisis];

        // Preparar parámetros análisis
        const parametrosAnalisis = {
            rutaArchivo: archivo.path,
            correlationId,
            archivoId,
            nombreOriginal: archivo.originalname,
            mimeType: archivo.mimetype,
            tamano: archivo.size,
            ...opciones
        };

        // Ejecutar analizador específico
        const resultado = await analizador(parametrosAnalisis);

        // Enriquecer resultado con metadatos Dragon3
        return {
            ...resultado,
            archivoId,
            tipoAnalisis,
            timestamp: new Date().toISOString(),
            metadatos: {
                nombreOriginal: archivo.originalname,
                tamano: archivo.size,
                mimeType: archivo.mimetype,
                procesadoEn: Date.now() - tarea.timestamp
            }
        };
    }

    /**
     * Obtener estado procesamiento
     */
    obtenerEstado() {
        return {
            colaEspera: this.colaAnalisis.length,
            procesamientoActivo: this.procesandoActualmente,
            maxConcurrencia: this.maxConcurrencia,
            archivosEnProceso: Array.from(this.procesamientoActivo.keys())
        };
    }

    /**
     * Configurar concurrencia máxima
     */
    configurarConcurrencia(max) {
        this.maxConcurrencia = Math.max(1, Math.min(max, 10));
        logger.info('Concurrencia configurada Dragon3', {
            modulo: NOMBRE_MODULO,
            maxConcurrencia: this.maxConcurrencia
        });
    }
}

// Singleton Dragon3
const instanciaProcessor = new FileProcessorManager();
export default instanciaProcessor;
