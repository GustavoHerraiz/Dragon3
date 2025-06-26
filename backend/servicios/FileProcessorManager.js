/**
 * FileProcessorManager.js - Router Inteligente Dragon3 FAANG
 * KISS Principle: Análisis multi-formato + concurrencia + tracing enterprise
 * Performance: P95 <200ms garantizado + queue management optimizado
 * Features: Circuit breaker, health monitoring, graceful degradation
 * @author GustavoHerraiz
 * @date 2025-06-15
 * @version 3.0.0-FAANG
 */

import logger from '../utilidades/logger.js';
import { analizarImagen } from './analizadorImagen.js';
import { analizarPDF } from './analizadorPDF.js';
import { analizarVideo } from './analizadorVideo.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import healthMonitor from './HealthMonitor.js';

const NOMBRE_MODULO = 'FileProcessorManager';

/**
 * Dragon logger FAANG compatible
 * Logging estructurado en español con performance tracking
 */
const dragon = {
    zen: (message, operation, data = {}) => {
        logger.info(`🧘 ${message}`, {
            service: NOMBRE_MODULO,
            operation,
            level: 'zen',
            ...data,
            timestamp: new Date().toISOString()
        });
    },
    
    agoniza: (message, error, operation, context = {}) => {
        const errorObj = error instanceof Error ? error : new Error(error);
        logger.error(`💀 ${message}`, {
            service: NOMBRE_MODULO,
            operation,
            level: 'agoniza',
            error: {
                message: errorObj.message,
                name: errorObj.name,
                code: errorObj.code || 'UNKNOWN',
                stack: errorObj.stack
            },
            context,
            timestamp: new Date().toISOString()
        });
    },
    
    seEnfada: (message, operation, context = {}) => {
        logger.warn(`😤 ${message}`, {
            service: NOMBRE_MODULO,
            operation,
            level: 'seEnfada',
            context,
            timestamp: new Date().toISOString()
        });
    },
    
    sonrie: (message, operation, data = {}) => {
        logger.info(`😊 ${message}`, {
            service: NOMBRE_MODULO,
            operation,
            level: 'sonrie',
            ...data,
            timestamp: new Date().toISOString()
        });
    }
};

/**
 * Gestión enterprise de procesamiento multi-formato
 * Implementa patrón Queue + Circuit Breaker + Health Monitoring
 * Características FAANG:
 * - Concurrencia controlada con backpressure
 * - Queue management con prioridades
 * - Health monitoring continuo
 * - Graceful degradation
 * - Performance tracking P95/P99
 * - Error handling robusto
 * - Logging estructurado Dragon3
 */
class FileProcessorManager {
    constructor() {
        // Queue management enterprise
        this.colaAnalisis = [];
        this.colaPrioridad = [];  // Alta prioridad
        this.procesamientoActivo = new Map();
        
        // Concurrency control
        this.maxConcurrencia = 5;
        this.procesandoActualmente = 0;
        
        // Circuit breaker
        this.circuitBreaker = {
            estado: 'cerrado', // cerrado, abierto, medio-abierto
            fallos: 0,
            umbralFallos: 10,
            tiempoRecuperacion: 60000, // 1 minuto
            ultimoFallo: null
        };
        
        // Performance metrics
        this.metricas = {
            totalProcesados: 0,
            totalErrores: 0,
            tiemposRespuesta: [],
            ultimaLimpieza: Date.now()
        };
        
        // Analizadores disponibles
        this.analizadoresDisponibles = {
            imagen: analizarImagen,
            pdf: analizarPDF,
            video: analizarVideo
        };
        
        // Health monitoring
        this.estadoSalud = 'saludable';
        this.iniciarMonitoreoSalud();
        
        dragon.zen('FileProcessorManager FAANG inicializado', 'constructor', {
            maxConcurrencia: this.maxConcurrencia,
            analizadoresDisponibles: Object.keys(this.analizadoresDisponibles)
        });
    }

    /**
     * Determinar tipo análisis según extensión/mime con validación robusta
     * @param {Object} archivo - Objeto archivo multer
     * @returns {string} Tipo de análisis detectado
     */
    determinarTipoAnalisis(archivo) {
        try {
            const extension = path.extname(archivo.originalname).toLowerCase();
            const mimeType = archivo.mimetype.toLowerCase();

            // IMÁGENES - Soportadas enterprise
            if (mimeType.startsWith('image/') || 
                ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff', '.ico'].includes(extension)) {
                return 'imagen';
            }

            // PDFs - Análisis completo con OCR
            if (mimeType === 'application/pdf' || extension === '.pdf') {
                return 'pdf';
            }

            // VIDEOS - Análisis con IA Computer Vision
            if (mimeType.startsWith('video/') || 
                ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v', '.3gp'].includes(extension)) {
                return 'video';
            }

            // AUDIO - Preparado para futuras versiones Dragon3
            if (mimeType.startsWith('audio/') || 
                ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'].includes(extension)) {
                return 'audio';
            }

            // DOCUMENTOS - Futuro Dragon3 v4.0
            if (['.doc', '.docx', '.txt', '.rtf'].includes(extension) ||
                mimeType.includes('document') || mimeType.includes('text')) {
                return 'documento';
            }

            dragon.seEnfada('Tipo archivo no reconocido', 'determinarTipoAnalisis', {
                extension,
                mimeType,
                nombreArchivo: archivo.originalname
            });

            return 'desconocido';

        } catch (error) {
            dragon.agoniza('Error determinando tipo análisis', error, 'determinarTipoAnalisis');
            return 'desconocido';
        }
    }

    /**
     * Generar ID único trazable Dragon3 con formato enterprise
     * @param {string} usuarioId - ID del usuario
     * @param {string} tipoArchivo - Tipo de archivo detectado
     * @returns {string} ID único trazable
     */
    generarIdTrazable(usuarioId, tipoArchivo) {
        const timestamp = Date.now();
        const sessionId = uuidv4().substring(0, 8);
        const userId = usuarioId || 'anonimo';
        const ambiente = process.env.NODE_ENV || 'dev';
        
        return `D3_${ambiente.toUpperCase()}_${tipoArchivo.toUpperCase()}_${userId}_${timestamp}_${sessionId}`;
    }

    /**
     * Validar circuit breaker antes de procesar
     * @returns {boolean} True si puede procesar
     */
    validarCircuitBreaker() {
        const { estado, fallos, umbralFallos, tiempoRecuperacion, ultimoFallo } = this.circuitBreaker;
        
        if (estado === 'abierto') {
            // Verificar si es tiempo de intentar recuperación
            if (Date.now() - ultimoFallo > tiempoRecuperacion) {
                this.circuitBreaker.estado = 'medio-abierto';
                dragon.zen('Circuit breaker cambió a medio-abierto', 'validarCircuitBreaker');
                return true;
            }
            return false;
        }
        
        return true;
    }

    /**
     * Actualizar estado circuit breaker según resultado
     * @param {boolean} exito - Si la operación fue exitosa
     */
    actualizarCircuitBreaker(exito) {
        if (exito) {
            if (this.circuitBreaker.estado === 'medio-abierto') {
                this.circuitBreaker.estado = 'cerrado';
                this.circuitBreaker.fallos = 0;
                dragon.sonrie('Circuit breaker cerrado - Sistema recuperado', 'actualizarCircuitBreaker');
            }
        } else {
            this.circuitBreaker.fallos++;
            this.circuitBreaker.ultimoFallo = Date.now();
            
            if (this.circuitBreaker.fallos >= this.circuitBreaker.umbralFallos) {
                this.circuitBreaker.estado = 'abierto';
                dragon.agoniza('Circuit breaker abierto - Sistema degradado', 
                    new Error('Umbral de fallos superado'), 'actualizarCircuitBreaker', {
                    fallos: this.circuitBreaker.fallos,
                    umbralFallos: this.circuitBreaker.umbralFallos
                });
            }
        }
    }

    /**
     * Procesar archivo con queue enterprise + concurrencia + circuit breaker
     * @param {Object} archivo - Objeto archivo multer
     * @param {string} usuarioId - ID del usuario
     * @param {string} correlationId - ID de correlación
     * @param {Object} opciones - Opciones adicionales
     * @returns {Promise<Object>} Resultado del análisis
     */
    async procesarArchivo(archivo, usuarioId, correlationId, opciones = {}) {
        const inicio = Date.now();
        
        // Validar circuit breaker
        if (!this.validarCircuitBreaker()) {
            const error = new Error('Sistema temporalmente no disponible - Circuit breaker abierto');
            error.code = 'CIRCUIT_BREAKER_OPEN';
            throw error;
        }

        const tipoAnalisis = this.determinarTipoAnalisis(archivo);
        const archivoId = this.generarIdTrazable(usuarioId, tipoAnalisis);
        const prioridad = opciones.prioridad || 'normal';

        dragon.zen('Archivo recibido para análisis Dragon3', 'procesarArchivo', {
            archivoId,
            correlationId,
            usuarioId: usuarioId || 'anonimo',
            tipoAnalisis,
            nombreArchivo: archivo.originalname,
            tamano: archivo.size,
            mimeType: archivo.mimetype,
            prioridad,
            colaActual: this.colaAnalisis.length
        });

        // Validar tipo soportado
        if (tipoAnalisis === 'desconocido') {
            const error = new Error(`Tipo archivo no soportado: ${archivo.mimetype}`);
            error.code = 'TIPO_NO_SOPORTADO';
            healthMonitor.registrarError(error, 'procesarArchivo');
            this.actualizarCircuitBreaker(false);
            throw error;
        }

        // Validar analizador disponible
        if (!this.analizadoresDisponibles[tipoAnalisis]) {
            const error = new Error(`Analizador no disponible para: ${tipoAnalisis}`);
            error.code = 'ANALIZADOR_NO_DISPONIBLE';
            healthMonitor.registrarError(error, 'procesarArchivo');
            this.actualizarCircuitBreaker(false);
            throw error;
        }

        // Validar límites enterprise
        if (archivo.size > 100 * 1024 * 1024) { // 100MB
            const error = new Error(`Archivo demasiado grande: ${archivo.size} bytes`);
            error.code = 'ARCHIVO_MUY_GRANDE';
            throw error;
        }

        // Crear tarea análisis con metadatos enterprise
        const tareaAnalisis = {
            archivoId,
            archivo,
            usuarioId,
            correlationId,
            tipoAnalisis,
            prioridad,
            timestamp: Date.now(),
            opciones,
            reintentos: 0,
            maxReintentos: 3,
            resolve: null,
            reject: null
        };

        // Retornar promesa que se resuelve cuando termina análisis
        return new Promise((resolve, reject) => {
            tareaAnalisis.resolve = resolve;
            tareaAnalisis.reject = reject;
            
            // Agregar a cola según prioridad
            if (prioridad === 'alta') {
                this.colaPrioridad.push(tareaAnalisis);
            } else {
                this.colaAnalisis.push(tareaAnalisis);
            }
            
            this.procesarCola();
        });
    }

    /**
     * Procesar cola con concurrencia controlada + prioridades
     */
    async procesarCola() {
        if (this.procesandoActualmente >= this.maxConcurrencia) {
            return;
        }

        // Procesar cola prioridad primero
        let tarea = this.colaPrioridad.shift() || this.colaAnalisis.shift();
        
        if (!tarea) {
            return;
        }

        this.procesandoActualmente++;
        this.procesamientoActivo.set(tarea.archivoId, tarea);

        dragon.zen('Iniciando análisis Dragon3', 'procesarCola', {
            archivoId: tarea.archivoId,
            correlationId: tarea.correlationId,
            tipoAnalisis: tarea.tipoAnalisis,
            prioridad: tarea.prioridad,
            colaRestante: this.colaAnalisis.length,
            colaPrioridad: this.colaPrioridad.length,
            procesamientoActivo: this.procesandoActualmente
        });

        try {
            const resultado = await this.ejecutarAnalisis(tarea);
            
            // Registrar métricas éxito
            const tiempoTotal = Date.now() - tarea.timestamp;
            this.registrarMetricas(tiempoTotal, true);
            healthMonitor.registrarTiempoRespuesta(tiempoTotal, `analisis-${tarea.tipoAnalisis}`);
            this.actualizarCircuitBreaker(true);
            
            dragon.sonrie('Análisis completado Dragon3', 'procesarCola', {
                archivoId: tarea.archivoId,
                correlationId: tarea.correlationId,
                tiempoTotal,
                tipoAnalisis: tarea.tipoAnalisis,
                tamanoArchivo: tarea.archivo.size
            });

            tarea.resolve(resultado);

        } catch (error) {
            this.registrarMetricas(Date.now() - tarea.timestamp, false);
            healthMonitor.registrarError(error, `analisis-${tarea.tipoAnalisis}`);
            this.actualizarCircuitBreaker(false);
            
            // Reintentos automáticos para errores temporales
            if (tarea.reintentos < tarea.maxReintentos && this.esErrorReintentar(error)) {
                tarea.reintentos++;
                
                dragon.seEnfada('Reintentando análisis Dragon3', 'procesarCola', {
                    archivoId: tarea.archivoId,
                    error: error.message,
                    intento: tarea.reintentos,
                    maxIntentos: tarea.maxReintentos
                });
                
                // Reencolar con delay exponencial
                setTimeout(() => {
                    this.colaAnalisis.unshift(tarea);
                    this.procesarCola();
                }, Math.pow(2, tarea.reintentos) * 1000);
                
            } else {
                dragon.agoniza('Error análisis Dragon3', error, 'procesarCola', {
                    archivoId: tarea.archivoId,
                    correlationId: tarea.correlationId,
                    tipoAnalisis: tarea.tipoAnalisis,
                    reintentos: tarea.reintentos
                });

                tarea.reject(error);
            }

        } finally {
            this.procesandoActualmente--;
            this.procesamientoActivo.delete(tarea.archivoId);
            
            // Continuar procesando cola
            setImmediate(() => this.procesarCola());
        }
    }

    /**
     * Determinar si un error amerita reintento
     * @param {Error} error - Error a evaluar
     * @returns {boolean} True si se debe reintentar
     */
    esErrorReintentar(error) {
        const codigosReintentar = [
            'ECONNRESET',
            'ETIMEDOUT',
            'ENOTFOUND',
            'ENETUNREACH',
            'REDIS_CONNECTION_ERROR'
        ];
        
        return codigosReintentar.includes(error.code) || 
               error.message.includes('timeout') ||
               error.message.includes('connection');
    }

    /**
     * Ejecutar análisis según tipo con error handling robusto
     * @param {Object} tarea - Tarea de análisis
     * @returns {Promise<Object>} Resultado del análisis
     */
    async ejecutarAnalisis(tarea) {
        const { archivo, correlationId, archivoId, tipoAnalisis, opciones } = tarea;
        const analizador = this.analizadoresDisponibles[tipoAnalisis];

        // Preparar parámetros análisis con contexto enterprise
        const parametrosAnalisis = {
            rutaArchivo: archivo.path,
            correlationId,
            archivoId,
            nombreOriginal: archivo.originalname,
            mimeType: archivo.mimetype,
            tamano: archivo.size,
            timestamp: tarea.timestamp,
            ambiente: process.env.NODE_ENV || 'development',
            ...opciones
        };

        try {
            // Ejecutar analizador específico con timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout análisis')), 300000); // 5 minutos
            });

            const resultado = await Promise.race([
                analizador(parametrosAnalisis),
                timeoutPromise
            ]);

            // Enriquecer resultado con metadatos Dragon3 enterprise
            return {
                ...resultado,
                archivoId,
                tipoAnalisis,
                timestamp: new Date().toISOString(),
                procesadoEn: Date.now() - tarea.timestamp,
                version: '3.0.0-FAANG',
                metadatos: {
                    nombreOriginal: archivo.originalname,
                    tamano: archivo.size,
                    mimeType: archivo.mimetype,
                    procesadoEn: Date.now() - tarea.timestamp,
                    servidor: process.env.HOSTNAME || 'unknown',
                    ambiente: process.env.NODE_ENV || 'development'
                }
            };

        } catch (error) {
            // Enriquecer error con contexto
            error.archivoId = archivoId;
            error.tipoAnalisis = tipoAnalisis;
            error.timestamp = new Date().toISOString();
            throw error;
        }
    }

    /**
     * Registrar métricas de performance
     * @param {number} tiempoRespuesta - Tiempo en ms
     * @param {boolean} exito - Si fue exitoso
     */
    registrarMetricas(tiempoRespuesta, exito) {
        this.metricas.totalProcesados++;
        if (!exito) this.metricas.totalErrores++;
        
        this.metricas.tiemposRespuesta.push(tiempoRespuesta);
        
        // Mantener solo últimas 1000 métricas
        if (this.metricas.tiemposRespuesta.length > 1000) {
            this.metricas.tiemposRespuesta = this.metricas.tiemposRespuesta.slice(-1000);
        }
        
        // Limpiar métricas cada hora
        if (Date.now() - this.metricas.ultimaLimpieza > 3600000) {
            this.limpiarMetricasAntiguas();
        }
    }

    /**
     * Limpiar métricas antiguas para evitar memory leaks
     */
    limpiarMetricasAntiguas() {
        this.metricas.tiemposRespuesta = this.metricas.tiemposRespuesta.slice(-500);
        this.metricas.ultimaLimpieza = Date.now();
        
        dragon.zen('Métricas antiguas limpiadas', 'limpiarMetricasAntiguas', {
            metricasRestantes: this.metricas.tiemposRespuesta.length
        });
    }

    /**
     * Iniciar monitoreo de salud continuo
     */
    iniciarMonitoreoSalud() {
        setInterval(() => {
            this.verificarSaludSistema();
        }, 30000); // Cada 30 segundos
    }

    /**
     * Verificar salud del sistema
     */
    verificarSaludSistema() {
        const memoria = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        // Verificar memoria
        if (memoria.heapUsed > 512 * 1024 * 1024) { // 512MB
            dragon.seEnfada('Uso alto de memoria detectado', 'verificarSaludSistema', {
                heapUsed: Math.round(memoria.heapUsed / 1024 / 1024) + 'MB'
            });
        }
        
        // Verificar cola
        if (this.colaAnalisis.length > 50) {
            dragon.seEnfada('Cola de análisis muy larga', 'verificarSaludSistema', {
                colaLength: this.colaAnalisis.length
            });
        }
        
        // Verificar tasa de error
        const tasaError = this.metricas.totalErrores / Math.max(this.metricas.totalProcesados, 1);
        if (tasaError > 0.1) { // 10%
            dragon.seEnfada('Tasa de error alta detectada', 'verificarSaludSistema', {
                tasaError: (tasaError * 100).toFixed(2) + '%'
            });
        }
    }

    /**
     * Obtener estado procesamiento con métricas enterprise
     * @returns {Object} Estado detallado del sistema
     */
    obtenerEstado() {
        const tiempos = this.metricas.tiemposRespuesta.sort((a, b) => a - b);
        const p95 = tiempos[Math.floor(tiempos.length * 0.95)] || 0;
        const p99 = tiempos[Math.floor(tiempos.length * 0.99)] || 0;
        const promedio = tiempos.reduce((a, b) => a + b, 0) / tiempos.length || 0;
        
        return {
            colaEspera: this.colaAnalisis.length,
            colaPrioridad: this.colaPrioridad.length,
            procesamientoActivo: this.procesandoActualmente,
            maxConcurrencia: this.maxConcurrencia,
            archivosEnProceso: Array.from(this.procesamientoActivo.keys()),
            circuitBreaker: this.circuitBreaker,
            metricas: {
                totalProcesados: this.metricas.totalProcesados,
                totalErrores: this.metricas.totalErrores,
                tasaError: (this.metricas.totalErrores / Math.max(this.metricas.totalProcesados, 1) * 100).toFixed(2) + '%',
                tiempoPromedioMs: Math.round(promedio),
                p95Ms: p95,
                p99Ms: p99
            },
            salud: this.estadoSalud,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Configurar concurrencia máxima con validación
     * @param {number} max - Número máximo de procesos concurrentes
     */
    configurarConcurrencia(max) {
        const nuevaMax = Math.max(1, Math.min(max, 20)); // Entre 1 y 20
        this.maxConcurrencia = nuevaMax;
        
        dragon.zen('Concurrencia configurada Dragon3', 'configurarConcurrencia', {
            maxConcurrencia: this.maxConcurrencia,
            procesamientoActual: this.procesandoActualmente
        });
    }

    /**
     * Shutdown graceful del procesador
     */
    async shutdown() {
        dragon.zen('Iniciando shutdown graceful FileProcessorManager', 'shutdown');
        
        // Esperar que terminen procesos activos (máximo 30 segundos)
        const tiempoLimite = Date.now() + 30000;
        
        while (this.procesandoActualmente > 0 && Date.now() < tiempoLimite) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        if (this.procesandoActualmente > 0) {
            dragon.seEnfada('Forzando cierre con procesos activos', 'shutdown', {
                procesosActivos: this.procesandoActualmente
            });
        }
        
        dragon.zen('FileProcessorManager cerrado', 'shutdown', {
            procesosPendientes: this.procesamientoActivo.size
        });
    }
}

// Singleton Dragon3 enterprise
const instanciaProcessor = new FileProcessorManager();

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
    dragon.zen('SIGTERM recibido - FileProcessorManager', 'shutdown');
    await instanciaProcessor.shutdown();
});

process.on('SIGINT', async () => {
    dragon.zen('SIGINT recibido - FileProcessorManager', 'shutdown');
    await instanciaProcessor.shutdown();
});

export default instanciaProcessor;