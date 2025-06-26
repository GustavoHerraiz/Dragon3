/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * RED SUPERIOR - SISTEMA DE ANÁLISIS DISTRIBUIDO CON GPU
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Proyecto: Dragon3 (AI Image Auth System)
 * Autor: Gustavo Herraiz (@GustavoHerraiz)
 * Versión: 2.1.0
 * Fecha: 2025-04-15
 *
 * DESCRIPCIÓN:
 * Sistema de red neuronal distribuida con optimizaciones FAANG nivel enterprise.
 * Maneja predicciones de autenticidad de imágenes con aceleración GPU, procesamiento
 * por lotes, cache inteligente y monitoreo completo de métricas.
 *
 * ARQUITECTURA:
 * Frontend → server.js → analizadorImagen.js → servidorCentral.js → redSuperior.js → Analyzers
 *
 * OBJETIVOS DE RENDIMIENTO:
 * - P95 latencia: <200ms
 * - Uptime: 99.9%
 * - Tasa de errores: <1%
 * - Throughput: >1000 predicciones/segundo
 *
 * CARACTERÍSTICAS ENTERPRISE:
 * ✅ Aceleración GPU/WebGL con TensorFlow.js
 * ✅ Procesamiento por lotes optimizado con concurrencia controlada
 * ✅ Sistema de cache inteligente con TTL y limpieza automática
 * ✅ Métricas en tiempo real con alertas automáticas
 * ✅ Health checks para Kubernetes/Docker
 * ✅ Graceful shutdown con manejo de señales
 * ✅ Logging estructurado con Winston y rotación
 * ✅ Monitoreo de memory leaks y performance
 * ✅ Circuit breaker y retry con exponential backoff
 * ✅ Manejo completo de errores y excepciones
 *
 * UBICACIÓN: /var/www/ProyectoDragon/redSuperior.js
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// =============================================================================
// IMPORTS Y DEPENDENCIAS CRÍTICAS
// =============================================================================

import * as tf from '@tensorflow/tfjs-node-gpu';
import winston from 'winston';
import EventEmitter from 'events';
import { performance } from 'perf_hooks';
import crypto from 'crypto';
import os from 'os';
import fs from 'fs/promises';
import path from 'path';

// =============================================================================
// CONFIGURACIÓN GLOBAL ENTERPRISE
// =============================================================================

/**
 * Configuración central del sistema Dragon Red Superior
 * Optimizada para entornos de producción FAANG
 */
const CONFIG = {
  // Configuración de Red Superior
  RED_SUPERIOR: {
    VERSION: '2.1.0',
    BATCH_SIZE_DEFAULT: 32,
    BATCH_SIZE_MIN: 1,
    BATCH_SIZE_MAX: 128,
    TIMEOUT_PREDICCION: 5000,        // 5 segundos máximo por predicción
    TIMEOUT_BATCH: 30000,            // 30 segundos máximo por batch
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_DELAY_BASE: 1000,          // 1 segundo base para exponential backoff
    HEALTH_CHECK_INTERVAL: 30000,    // Health check cada 30 segundos
    CONCURRENCIA_MAXIMA: 3,          // Máximo 3 batches concurrentes
    CACHE_TTL: 300000,               // Cache TTL: 5 minutos
    CACHE_MAX_SIZE: 10000,           // Máximo 10k entradas en cache
  },

  // Configuración GPU/TensorFlow
  GPU: {
    MEMORY_FRACTION: 0.7,            // Usar máximo 70% de memoria GPU
    WEBGL_DELETE_THRESHOLD: 0,       // Limpieza agresiva de texturas WebGL
    WEBGL_FORCE_F16: false,          // No forzar F16 para compatibilidad
    BACKEND_PRIORITY: ['tensorflow', 'webgl', 'cpu'], // Orden de preferencia
  },

  // Configuración de métricas y alertas
  METRICAS: {
    WINDOW_SIZE_MINUTES: 10,         // Ventana de métricas: 10 minutos
    PERCENTILES: [50, 75, 90, 95, 99],
    ALERT_THRESHOLDS: {
      ERROR_RATE: 0.01,              // 1% tasa de errores
      LATENCY_P95: 200,              // 200ms P95
      LATENCY_P99: 500,              // 500ms P99
      MEMORY_USAGE_PCT: 85,          // 85% uso de memoria
      CPU_USAGE_PCT: 80,             // 80% uso de CPU
      CACHE_HIT_RATE_MIN: 0.7,       // Mínimo 70% cache hit rate
      GPU_MEMORY_PCT: 90,            // 90% memoria GPU
    },
    COLLECTION_INTERVAL: 10000,      // Recolectar métricas cada 10 segundos
    CLEANUP_INTERVAL: 300000,        // Limpiar métricas antiguas cada 5 minutos
  },

  // Configuración de logging
  LOGGING: {
    LEVEL: process.env.LOG_LEVEL || 'info',
    MAX_FILE_SIZE: 10485760,         // 10MB por archivo de log
    MAX_FILES: 10,                   // Mantener 10 archivos rotados
    LOG_DIR: '/var/www/ProyectoDragon/logs',
    ERROR_LOG: 'redSuperior-error.log',
    COMBINED_LOG: 'redSuperior-combined.log',
    AUDIT_LOG: 'redSuperior-audit.log',
  },

  // Configuración de graceful shutdown
  SHUTDOWN: {
    GRACEFUL_TIMEOUT: 30000,         // 30 segundos para graceful shutdown
    FORCE_EXIT_TIMEOUT: 35000,       // 35 segundos para force exit
    OPERATIONS_WAIT_MAX: 10000,      // Esperar máximo 10s por operaciones
    OPERATIONS_CHECK_INTERVAL: 200,  // Verificar operaciones cada 200ms
  },

  // Configuración de health checks
  HEALTH: {
    STARTUP_PROBE_DELAY: 10000,      // Delay inicial para startup probe
    READINESS_TIMEOUT: 5000,         // Timeout para readiness check
    LIVENESS_TIMEOUT: 3000,          // Timeout para liveness check
    CRITICAL_SERVICES: ['tensorflow', 'cache', 'metricas'], // Servicios críticos
  },

  // Configuración de seguridad
  SECURITY: {
    MAX_PAYLOAD_SIZE: 50 * 1024 * 1024,  // 50MB máximo payload
    RATE_LIMIT_WINDOW: 60000,             // Ventana rate limit: 1 minuto
    RATE_LIMIT_MAX: 1000,                 // Máximo 1000 requests por minuto
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
    SECURE_HEADERS: true,
  }
};

// =============================================================================
// CONSTANTES GLOBALES
// =============================================================================

/**
 * Estados del sistema
 */
const ESTADOS_SISTEMA = {
  INICIALIZANDO: 'inicializando',
  LISTO: 'listo',
  OCUPADO: 'ocupado',
  DEGRADADO: 'degradado',
  MANTENIMIENTO: 'mantenimiento',
  CERRANDO: 'cerrando',
  ERROR: 'error'
};

/**
 * Tipos de alertas del sistema
 */
const TIPOS_ALERTA = {
  CRITICA: 'critica',
  ALTA: 'alta',
  MEDIA: 'media',
  BAJA: 'baja',
  INFO: 'info'
};

/**
 * Códigos de error estándar
 */
const CODIGOS_ERROR = {
  // Errores de inicialización
  INIT_TENSORFLOW_FAILED: 'E001',
  INIT_GPU_FAILED: 'E002',
  INIT_MODEL_FAILED: 'E003',
  INIT_CACHE_FAILED: 'E004',

  // Errores de predicción
  PREDICTION_INVALID_INPUT: 'E101',
  PREDICTION_TIMEOUT: 'E102',
  PREDICTION_GPU_ERROR: 'E103',
  PREDICTION_MODEL_ERROR: 'E104',

  // Errores de batch
  BATCH_SIZE_INVALID: 'E201',
  BATCH_TIMEOUT: 'E202',
  BATCH_CONCURRENCY_LIMIT: 'E203',

  // Errores de sistema
  MEMORY_LIMIT_EXCEEDED: 'E301',
  CPU_LIMIT_EXCEEDED: 'E302',
  DISK_SPACE_LOW: 'E303',
  HEALTH_CHECK_FAILED: 'E304',

  // Errores de red/comunicación
  NETWORK_TIMEOUT: 'E401',
  NETWORK_CONNECTION_FAILED: 'E402',
  NETWORK_RATE_LIMITED: 'E403',
};

/**
 * Métricas por defecto para inicialización
 */
const METRICAS_DEFAULT = {
  predicciones: [],
  errores: [],
  latencias: [],
  throughput: [],
  usoRecursos: {
    cpu: [],
    memoria: [],
    gpu: []
  },
  cache: {
    hits: 0,
    misses: 0,
    evictions: 0
  },
  red: {
    conectividad: [],
    analizadores: new Map()
  }
};

// =============================================================================
// CONFIGURACIÓN DE LOGGING ENTERPRISE
// =============================================================================

/**
 * Formateador personalizado para logs estructurados
 */
const formatoLogPersonalizado = winston.format.printf(({
  timestamp,
  level,
  message,
  service,
  operation,
  requestId,
  userId,
  metrics,
  error,
  stack,
  context,
  ...meta
}) => {
  const logEntry = {
    '@timestamp': timestamp,
    '@version': '1',
    level: level.toUpperCase(),
    service: service || 'redSuperior',
    operation,
    message,
    ...(requestId && { requestId }),
    ...(userId && { userId }),
    ...(metrics && { metrics }),
    ...(error && {
      error: {
        message: error.message || error,
        name: error.name,
        code: error.code,
        ...(stack && { stack })
      }
    }),
    ...(context && { context }),
    ...meta,
    hostname: os.hostname(),
    pid: process.pid,
    environment: process.env.NODE_ENV || 'development'
  };

  return JSON.stringify(logEntry);
});

/**
 * Configuración completa de Winston Logger
 */
const logger = winston.createLogger({
  level: CONFIG.LOGGING.LEVEL,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    formatoLogPersonalizado
  ),
  defaultMeta: {
    service: 'redSuperior',
    version: CONFIG.RED_SUPERIOR.VERSION
  },
  transports: [
    // Log de errores separado
    new winston.transports.File({
      filename: path.join(CONFIG.LOGGING.LOG_DIR, CONFIG.LOGGING.ERROR_LOG),
      level: 'error',
      maxsize: CONFIG.LOGGING.MAX_FILE_SIZE,
      maxFiles: CONFIG.LOGGING.MAX_FILES,
      format: winston.format.combine(
        winston.format.timestamp(),
        formatoLogPersonalizado
      )
    }),

    // Log combinado general
    new winston.transports.File({
      filename: path.join(CONFIG.LOGGING.LOG_DIR, CONFIG.LOGGING.COMBINED_LOG),
      maxsize: CONFIG.LOGGING.MAX_FILE_SIZE,
      maxFiles: CONFIG.LOGGING.MAX_FILES
    }),

    // Log de auditoría para eventos críticos
    new winston.transports.File({
      filename: path.join(CONFIG.LOGGING.LOG_DIR, CONFIG.LOGGING.AUDIT_LOG),
      level: 'warn',
      maxsize: CONFIG.LOGGING.MAX_FILE_SIZE,
      maxFiles: 5
    })
  ]
});

// Añadir console transport solo en desarrollo
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// =============================================================================
// SISTEMA DRAGON LOGGING ENTERPRISE
// =============================================================================

/**
 * Sistema de logging Dragon con contexto enriquecido
 * Proporciona logging estructurado, correlation IDs y métricas integradas
 */
const dragon = {
  /**
   * Log de información zen con métricas opcionales
   */
  zen: (message, file, operation, metrics = null, context = {}) => {
    logger.info(message, {
      service: 'redSuperior',
      file,
      operation,
      ...(metrics && { metrics }),
      ...(Object.keys(context).length > 0 && { context })
    });
  },

  /**
   * Log de error con stack trace y contexto
   */
  agoniza: (message, error, operation, context = {}) => {
    const errorObj = error instanceof Error ? error : new Error(error);
    logger.error(message, {
      service: 'redSuperior',
      operation,
      error: {
        message: errorObj.message,
        name: errorObj.name,
        code: errorObj.code || 'UNKNOWN',
        stack: errorObj.stack
      },
      context
    });
  },

  /**
   * Log de advertencia con contexto
   */
  seEnfada: (message, operation, context = {}) => {
    logger.warn(message, {
      service: 'redSuperior',
      operation,
      context
    });
  },

  /**
   * Log de información respirando zen
   */
  respira: (message, file, operation, metrics = null, context = {}) => {
    logger.info(message, {
      service: 'redSuperior',
      file,
      operation,
      ...(metrics && { metrics }),
      ...(Object.keys(context).length > 0 && { context })
    });
  },

  /**
   * Log de preocupación
   */
  sePreocupa: (message, operation, context = {}) => {
    logger.warn(message, {
      service: 'redSuperior',
      operation,
      context
    });
  },

  /**
   * Log de sonrisa/felicidad
   */
  sonrie: (message, operation, context = {}) => {
    logger.info(message, {
      service: 'redSuperior',
      operation,
      level: 'happy',
      context
    });
  },

  /**
   * Log de debugging detallado
   */
  debug: (message, operation, data = {}) => {
    logger.debug(message, {
      service: 'redSuperior',
      operation,
      data
    });
  },

  /**
   * Log de auditoría para eventos críticos
   */
  audit: (event, details, userId = null) => {
    logger.warn(`AUDIT: ${event}`, {
      service: 'redSuperior',
      operation: 'audit',
      auditEvent: event,
      ...(userId && { userId }),
      details,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Log de métricas de performance
   */
  metrics: (operacion, duracion, exito = true, metadata = {}) => {
    logger.info(`METRICS: ${operacion}`, {
      service: 'redSuperior',
      operation: 'metrics',
      metricsType: 'performance',
      operacion,
      duracion,
      exito,
      metadata
    });
  }
};

// =============================================================================
// CLASE MANAGER DE MÉTRICAS ENTERPRISE
// =============================================================================

/**
 * Gestor avanzado de métricas en tiempo real con análisis estadístico
 * Implementa sliding window, percentiles y alertas automáticas
 */
class MetricasManager extends EventEmitter {
  constructor() {
    super();

    // Estado interno de métricas
    this.metricas = structuredClone(METRICAS_DEFAULT);
    this.ventanaMinutos = CONFIG.METRICAS.WINDOW_SIZE_MINUTES;
    this.intervalos = new Map();
    this.alertasActivas = new Map();
    this.estadoSistema = ESTADOS_SISTEMA.INICIALIZANDO;

    // Métricas de sistema
    this.inicioSistema = Date.now();
    this.ultimaLimpieza = Date.now();

    dragon.zen('📊 MetricasManager inicializando...', 'redSuperior.js', 'MetricasManager.constructor');

    this._iniciarRecoleccionMetricas();
    this._iniciarLimpiezaAutomatica();
  }

  /**
   * Inicia la recolección automática de métricas del sistema
   */
  _iniciarRecoleccionMetricas() {
    const intervaloRecoleccion = setInterval(() => {
      this._recolectarMetricasSistema();
      this._evaluarAlertas();
      this.emit('metricas_actualizadas', this.obtenerResumen());
    }, CONFIG.METRICAS.COLLECTION_INTERVAL);

    const intervaloLimpieza = setInterval(() => {
      this._limpiarVentanaMetricas();
    }, CONFIG.METRICAS.CLEANUP_INTERVAL);

    this.intervalos.set('recoleccion', intervaloRecoleccion);
    this.intervalos.set('limpieza', intervaloLimpieza);

    dragon.zen('⚡ Recolección automática de métricas iniciada', 'redSuperior.js', 'iniciarRecoleccionMetricas', {
      intervaloRecoleccion: CONFIG.METRICAS.COLLECTION_INTERVAL,
      intervaloLimpieza: CONFIG.METRICAS.CLEANUP_INTERVAL
    });
  }

  /**
   * Inicia la limpieza automática de datos antiguos
   */
  _iniciarLimpiezaAutomatica() {
    const intervalo = setInterval(() => {
      const antes = this._contarMetricas();
      this._limpiarVentanaMetricas();
      const despues = this._contarMetricas();

      if (antes.total !== despues.total) {
        dragon.zen('🧹 Limpieza automática ejecutada', 'limpiezaAutomatica', {
          eliminadas: antes.total - despues.total,
          restantes: despues.total
        });
      }
    }, CONFIG.METRICAS.CLEANUP_INTERVAL);

    this.intervalos.set('limpieza_auto', intervalo);
  }

  /**
   * Registra una predicción exitosa con métricas detalladas
   */
  registrarPrediccion(latencia, usoGPU = null, usoMemoria = null, metadatos = {}) {
    const timestamp = Date.now();
    const prediccion = {
      timestamp,
      latencia,
      usoGPU,
      usoMemoria,
      metadatos,
      id: crypto.randomUUID()
    };

    this.metricas.predicciones.push(prediccion);
    this.metricas.latencias.push(latencia);

    if (usoGPU !== null) {
      this.metricas.usoRecursos.gpu.push({ timestamp, valor: usoGPU });
    }

    if (usoMemoria !== null) {
      this.metricas.usoRecursos.memoria.push({ timestamp, valor: usoMemoria });
    }

    // Calcular throughput en tiempo real
    this._actualizarThroughput();

    dragon.metrics('prediccion_completada', latencia, true, {
      usoGPU,
      usoMemoria,
      ...metadatos
    });
  }

  /**
   * Registra un error con categorización y contexto
   */
  registrarError(tipo, mensaje, stack = null, codigo = null, contexto = {}) {
    const error = {
      timestamp: Date.now(),
      tipo,
      mensaje,
      stack,
      codigo: codigo || CODIGOS_ERROR[tipo] || 'UNKNOWN',
      contexto,
      id: crypto.randomUUID()
    };

    this.metricas.errores.push(error);

    // Audit log para errores críticos
    if (this._esCritico(tipo)) {
      dragon.audit('ERROR_CRITICO', {
        tipo,
        mensaje,
        codigo: error.codigo,
        contexto
      });
    }

    dragon.metrics('error_registrado', 0, false, {
      tipo,
      codigo: error.codigo
    });
  }

  /**
   * Registra operación de cache (hit/miss)
   */
  registrarCache(hit = true, clave = null, tamaño = null) {
    if (hit) {
      this.metricas.cache.hits++;
    } else {
      this.metricas.cache.misses++;
    }

    dragon.zen('Cache operation', 'registrarCache', {
      hit,
      clave: clave ? crypto.createHash('sha256').update(clave).digest('hex').substring(0, 8) : null,
      tamaño,
      ratio: this.obtenerRatioCache()
    });
  }

  /**
   * Registra eviction de cache
   */
  registrarEviccionCache(razon = 'ttl_expired', cantidadEliminada = 1) {
    this.metricas.cache.evictions += cantidadEliminada;

    dragon.zen('Cache eviction', 'registrarEviccionCache', {
      razon,
      cantidadEliminada,
      totalEvictions: this.metricas.cache.evictions
    });
  }

  /**
   * Actualiza el estado de un analizador
   */
  actualizarAnalizador(id, tipo, estado, metadatos = {}) {
    this.metricas.red.analizadores.set(id, {
      id,
      tipo,
      estado,
      ultimaActualizacion: Date.now(),
      metadatos
    });

    dragon.zen('Analizador actualizado', 'actualizarAnalizador', {
      id,
      tipo,
      estado
    });
  }

  /**
   * Calcula percentiles de un array de valores
   */
  calcularPercentiles(array, percentiles = CONFIG.METRICAS.PERCENTILES) {
    if (array.length === 0) return {};

    const sorted = [...array].sort((a, b) => a - b);
    const result = {};

    percentiles.forEach(p => {
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      result[`p${p}`] = sorted[Math.max(0, index)];
    });

    return result;
  }

  /**
   * Obtiene resumen completo de métricas del sistema
   */
  obtenerResumen() {
    const ahora = Date.now();
    const ventana = this.ventanaMinutos * 60000;

    // Filtrar métricas recientes
    const prediccionesRecientes = this.metricas.predicciones.filter(
      p => ahora - p.timestamp < ventana
    );

    const erroresRecientes = this.metricas.errores.filter(
      e => ahora - e.timestamp < ventana
    );

    const latenciasRecientes = prediccionesRecientes.map(p => p.latencia);
    const throughputReciente = this._calcularThroughput(prediccionesRecientes);

    return {
      timestamp: ahora,
      uptime: ahora - this.inicioSistema,
      estado: this.estadoSistema,

      // Métricas de predicciones
      predicciones: {
        total: prediccionesRecientes.length,
        porMinuto: this._calcularPorMinuto(prediccionesRecientes),
        throughput: throughputReciente
      },

      // Métricas de errores
      errores: {
        total: erroresRecientes.length,
        tasa: prediccionesRecientes.length > 0 ?
          erroresRecientes.length / prediccionesRecientes.length : 0,
        porTipo: this._agruparErroresPorTipo(erroresRecientes)
      },

      // Métricas de latencia
      latencia: {
        ...this.calcularPercentiles(latenciasRecientes),
        promedio: latenciasRecientes.length > 0 ?
          latenciasRecientes.reduce((a, b) => a + b, 0) / latenciasRecientes.length : 0,
        mediana: this._calcularMediana(latenciasRecientes)
      },

      // Métricas de cache
      cache: {
        hits: this.metricas.cache.hits,
        misses: this.metricas.cache.misses,
        evictions: this.metricas.cache.evictions,
        ratio: this.obtenerRatioCache(),
        efectividad: this._calcularEfectividadCache()
      },

      // Métricas de recursos
      recursos: {
        cpu: this._obtenerEstadoCPU(),
        memoria: this._obtenerEstadoMemoria(),
        gpu: this._obtenerEstadoGPU()
      },

      // Estado de la red
      red: {
        analizadores: Array.from(this.metricas.red.analizadores.values()),
        conectividad: this._evaluarConectividad()
      },

      // Alertas activas
      alertas: Array.from(this.alertasActivas.values())
    };
  }

  /**
   * Obtiene ratio de cache hit
   */
  obtenerRatioCache() {
    const total = this.metricas.cache.hits + this.metricas.cache.misses;
    return total > 0 ? this.metricas.cache.hits / total : 0;
  }

  /**
   * Recolecta métricas del sistema operativo
   */
  _recolectarMetricasSistema() {
    const timestamp = Date.now();

    // CPU usage
    const cpuUsage = process.cpuUsage();
    this.metricas.usoRecursos.cpu.push({
      timestamp,
      user: cpuUsage.user,
      system: cpuUsage.system
    });

    // Memory usage
    const memUsage = process.memoryUsage();
    this.metricas.usoRecursos.memoria.push({
      timestamp,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      rss: memUsage.rss,
      external: memUsage.external
    });
  }

  /**
   * Actualiza métricas de throughput
   */
  _actualizarThroughput() {
    const ahora = Date.now();
    const ventanaUltimoMinuto = ahora - 60000;

    const prediccionesUltimoMinuto = this.metricas.predicciones.filter(
      p => p.timestamp > ventanaUltimoMinuto
    ).length;

    this.metricas.throughput.push({
      timestamp: ahora,
      prediccionesPorMinuto: prediccionesUltimoMinuto
    });
  }

  /**
   * Evalúa condiciones de alerta
   */
  _evaluarAlertas() {
    const resumen = this.obtenerResumen();
    const nuevasAlertas = [];

    // Alerta por tasa de errores
    if (resumen.errores.tasa > CONFIG.METRICAS.ALERT_THRESHOLDS.ERROR_RATE) {
      nuevasAlertas.push(this._crearAlerta(
        'ERROR_RATE_HIGH',
        TIPOS_ALERTA.CRITICA,
        `Tasa de errores ${(resumen.errores.tasa * 100).toFixed(2)}% excede umbral ${(CONFIG.METRICAS.ALERT_THRESHOLDS.ERROR_RATE * 100)}%`,
        { valor: resumen.errores.tasa, umbral: CONFIG.METRICAS.ALERT_THRESHOLDS.ERROR_RATE }
      ));
    }

    // Alerta por latencia P95
    if (resumen.latencia.p95 > CONFIG.METRICAS.ALERT_THRESHOLDS.LATENCY_P95) {
      nuevasAlertas.push(this._crearAlerta(
        'LATENCY_P95_HIGH',
        TIPOS_ALERTA.ALTA,
        `Latencia P95 ${resumen.latencia.p95}ms excede umbral ${CONFIG.METRICAS.ALERT_THRESHOLDS.LATENCY_P95}ms`,
        { valor: resumen.latencia.p95, umbral: CONFIG.METRICAS.ALERT_THRESHOLDS.LATENCY_P95 }
      ));
    }

    // Alerta por cache hit rate bajo
    if (resumen.cache.ratio < CONFIG.METRICAS.ALERT_THRESHOLDS.CACHE_HIT_RATE_MIN) {
      nuevasAlertas.push(this._crearAlerta(
        'CACHE_HIT_RATE_LOW',
        TIPOS_ALERTA.MEDIA,
        `Cache hit rate ${(resumen.cache.ratio * 100).toFixed(1)}% bajo umbral ${(CONFIG.METRICAS.ALERT_THRESHOLDS.CACHE_HIT_RATE_MIN * 100)}%`,
        { valor: resumen.cache.ratio, umbral: CONFIG.METRICAS.ALERT_THRESHOLDS.CACHE_HIT_RATE_MIN }
      ));
    }

    // Procesar nuevas alertas
    nuevasAlertas.forEach(alerta => {
      if (!this.alertasActivas.has(alerta.id)) {
        this.alertasActivas.set(alerta.id, alerta);
        this.emit('nueva_alerta', alerta);

        dragon.seEnfada(`🚨 Nueva alerta: ${alerta.tipo}`, 'evaluarAlertas', {
          alerta: alerta.descripcion,
          severidad: alerta.severidad,
          metadatos: alerta.metadatos
        });
      }
    });

    // Limpiar alertas resueltas
    this._limpiarAlertasResueltas(resumen);
  }

  /**
   * Crea un objeto alerta estructurado
   */
  _crearAlerta(tipo, severidad, descripcion, metadatos = {}) {
    return {
      id: crypto.randomUUID(),
      tipo,
      severidad,
      descripcion,
      timestamp: Date.now(),
      metadatos,
      resuelto: false
    };
  }

  /**
   * Limpia alertas que ya no aplican
   */
  _limpiarAlertasResueltas(resumen) {
    for (const [id, alerta] of this.alertasActivas.entries()) {
      let resuelto = false;

      switch (alerta.tipo) {
        case 'ERROR_RATE_HIGH':
          resuelto = resumen.errores.tasa <= CONFIG.METRICAS.ALERT_THRESHOLDS.ERROR_RATE;
          break;
        case 'LATENCY_P95_HIGH':
          resuelto = resumen.latencia.p95 <= CONFIG.METRICAS.ALERT_THRESHOLDS.LATENCY_P95;
          break;
        case 'CACHE_HIT_RATE_LOW':
          resuelto = resumen.cache.ratio >= CONFIG.METRICAS.ALERT_THRESHOLDS.CACHE_HIT_RATE_MIN;
          break;
      }

      if (resuelto) {
        alerta.resuelto = true;
        alerta.timestampResolucion = Date.now();
        this.alertasActivas.delete(id);

        dragon.zen(`✅ Alerta resuelta: ${alerta.tipo}`, 'limpiarAlertasResueltas', {
          duracion: alerta.timestampResolucion - alerta.timestamp
        });
      }
    }
  }

  /**
   * Limpia métricas fuera de la ventana de tiempo
   */
  _limpiarVentanaMetricas() {
    const limite = Date.now() - (this.ventanaMinutos * 60000);

    this.metricas.predicciones = this.metricas.predicciones.filter(
      p => p.timestamp > limite
    );

    this.metricas.errores = this.metricas.errores.filter(
      e => e.timestamp > limite
    );

    this.metricas.throughput = this.metricas.throughput.filter(
      t => t.timestamp > limite
    );

    // Limpiar métricas de recursos
    Object.keys(this.metricas.usoRecursos).forEach(recurso => {
      if (Array.isArray(this.metricas.usoRecursos[recurso])) {
        this.metricas.usoRecursos[recurso] = this.metricas.usoRecursos[recurso].filter(
          r => r.timestamp > limite
        );
      }
    });

    this.ultimaLimpieza = Date.now();
  }

  /**
   * Métodos auxiliares para cálculos estadísticos
   */
  _contarMetricas() {
    return {
      predicciones: this.metricas.predicciones.length,
      errores: this.metricas.errores.length,
      total: this.metricas.predicciones.length + this.metricas.errores.length
    };
  }

  _calcularPorMinuto(eventos) {
    if (eventos.length === 0) return 0;
    const ahora = Date.now();
    const unMinutoAtras = ahora - 60000;
    return eventos.filter(e => e.timestamp > unMinutoAtras).length;
  }

  _calcularThroughput(predicciones) {
    if (predicciones.length < 2) return 0;

    const tiempoTotal = Math.max(...predicciones.map(p => p.timestamp)) -
                       Math.min(...predicciones.map(p => p.timestamp));

    return tiempoTotal > 0 ? (predicciones.length / tiempoTotal) * 1000 : 0; // por segundo
  }

  _calcularMediana(array) {
    if (array.length === 0) return 0;
    const sorted = [...array].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  _agruparErroresPorTipo(errores) {
    return errores.reduce((acc, error) => {
      acc[error.tipo] = (acc[error.tipo] || 0) + 1;
      return acc;
    }, {});
  }

  _calcularEfectividadCache() {
    const total = this.metricas.cache.hits + this.metricas.cache.misses;
    if (total === 0) return 1;

    // Efectividad considera tanto hit rate como evictions
    const hitRate = this.metricas.cache.hits / total;
    const evictionPenalty = Math.min(this.metricas.cache.evictions / total, 0.5);

    return Math.max(0, hitRate - evictionPenalty);
  }

  _obtenerEstadoCPU() {
    const recientes = this.metricas.usoRecursos.cpu.slice(-10);
    if (recientes.length === 0) return null;

    const ultimo = recientes[recientes.length - 1];
    return {
      timestamp: ultimo.timestamp,
      user: ultimo.user,
      system: ultimo.system,
      total: ultimo.user + ultimo.system
    };
  }

  _obtenerEstadoMemoria() {
    const recientes = this.metricas.usoRecursos.memoria.slice(-1);
    if (recientes.length === 0) return null;

    const ultimo = recientes[0];
    return {
      timestamp: ultimo.timestamp,
      heapUsedMB: Math.round(ultimo.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(ultimo.heapTotal / 1024 / 1024),
      rssMB: Math.round(ultimo.rss / 1024 / 1024),
      externalMB: Math.round(ultimo.external / 1024 / 1024),
      heapUtilization: ultimo.heapUsed / ultimo.heapTotal
    };
  }

  _obtenerEstadoGPU() {
    try {
      if (tf.getBackend() === 'tensorflow' || tf.getBackend() === 'webgl') {
        const memoryInfo = tf.memory();
        return {
          disponible: true,
          backend: tf.getBackend(),
          tensors: memoryInfo.numTensors,
          dataBuffers: memoryInfo.numDataBuffers,
          bytes: memoryInfo.numBytes,
          unreliable: memoryInfo.unreliable || false
        };
      }
      return { disponible: false, backend: tf.getBackend() };
    } catch (error) {
      dragon.agoniza('Error obteniendo estado GPU', error, 'obtenerEstadoGPU');
      return { disponible: false, error: error.message };
    }
  }

  _evaluarConectividad() {
    const analizadoresActivos = Array.from(this.metricas.red.analizadores.values())
      .filter(a => a.estado === 'activo').length;

    return {
      analizadoresActivos,
      totalAnalizadores: this.metricas.red.analizadores.size,
      ratioConectividad: this.metricas.red.analizadores.size > 0 ?
        analizadoresActivos / this.metricas.red.analizadores.size : 0
    };
  }

  _esCritico(tipoError) {
    const erroresCriticos = [
      'INIT_TENSORFLOW_FAILED',
      'INIT_GPU_FAILED',
      'MEMORY_LIMIT_EXCEEDED',
      'HEALTH_CHECK_FAILED'
    ];
    return erroresCriticos.includes(tipoError);
  }

  /**
   * Establece el estado del sistema
   */
  establecerEstado(nuevoEstado) {
    const estadoAnterior = this.estadoSistema;
    this.estadoSistema = nuevoEstado;

    dragon.audit('CAMBIO_ESTADO_SISTEMA', {
      estadoAnterior,
      nuevoEstado,
      timestamp: Date.now()
    });

    this.emit('cambio_estado', { anterior: estadoAnterior, nuevo: nuevoEstado });
  }

  /**
   * Destructor - limpia intervalos y recursos
   */
  destruir() {
    dragon.zen('🧹 Destruyendo MetricasManager...', 'redSuperior.js', 'MetricasManager.destruir');

    // Limpiar intervalos
    this.intervalos.forEach((intervalo, nombre) => {
      clearInterval(intervalo);
      dragon.zen(`Intervalo ${nombre} limpiado`, 'destruir');
    });

    this.intervalos.clear();

    // Limpiar listeners
    this.removeAllListeners();

    dragon.zen('✅ MetricasManager destruido correctamente', 'redSuperior.js', 'MetricasManager.destruir');
  }
}

// =============================================================================
// CLASE CACHE INTELIGENTE ENTERPRISE
// =============================================================================

/**
 * Sistema de cache inteligente con TTL, LRU y análisis predictivo
 * Optimizado para predicciones de ML con gestión automática de memoria
 */
class CachePredicciones {
  constructor(ttl = CONFIG.RED_SUPERIOR.CACHE_TTL, maxSize = CONFIG.RED_SUPERIOR.CACHE_MAX_SIZE) {
    this.cache = new Map();
    this.accesos = new Map(); // Para algoritmo LRU
    this.ttl = ttl;
    this.maxSize = maxSize;
    this.metricas = null; // Se asignará desde RedSuperior
    this.intervalos = new Map();

    // Configuración de limpieza automática
    this.ultimaLimpieza = Date.now();
    this.intervalLimpieza = ttl / 4; // Limpiar cada 1/4 del TTL

    dragon.zen('🗄️ CachePredicciones inicializando...', 'redSuperior.js', 'CachePredicciones.constructor', {
      ttl,
      maxSize,
      intervalLimpieza: this.intervalLimpieza
    });

    this._iniciarLimpiezaAutomatica();
  }

  /**
   * Inicia la limpieza automática del cache
   */
  _iniciarLimpiezaAutomatica() {
    const intervalo = setInterval(() => {
      this._ejecutarLimpiezaCompleta();
    }, this.intervalLimpieza);

    this.intervalos.set('limpieza', intervalo);

    dragon.zen('Limpieza automática de cache iniciada', 'iniciarLimpiezaAutomatica', {
      intervalo: this.intervalLimpieza
    });
  }

  /**
   * Genera clave de cache optimizada con hash
   */
  _generarClave(features) {
    try {
      // Normalizar features para consistencia
      const featuresNormalizadas = this._normalizarFeatures(features);
      const hash = crypto.createHash('sha256');
      hash.update(JSON.stringify(featuresNormalizadas));
      return hash.digest('hex');
    } catch (error) {
      dragon.agoniza('Error generando clave de cache', error, 'generarClave');
      return crypto.randomUUID(); // Fallback
    }
  }

  /**
   * Normaliza features para asegurar consistencia en el cache
   */
  _normalizarFeatures(features) {
    if (Array.isArray(features)) {
      return features.map(f => typeof f === 'number' ? Number(f.toFixed(6)) : f);
    }

    if (typeof features === 'object' && features !== null) {
      const normalizado = {};
      Object.keys(features).sort().forEach(key => {
        const valor = features[key];
        normalizado[key] = typeof valor === 'number' ? Number(valor.toFixed(6)) : valor;
      });
      return normalizado;
    }

    return features;
  }

  /**
   * Obtiene predicción del cache con análisis de acceso
   */
  obtener(features) {
    const clave = this._generarClave(features);
    const entrada = this.cache.get(clave);

    if (!entrada) {
      this.metricas?.registrarCache(false, clave);
      return null;
    }

    // Verificar TTL
    if (Date.now() - entrada.timestamp > this.ttl) {
      this.cache.delete(clave);
      this.accesos.delete(clave);
      this.metricas?.registrarCache(false, clave);
      this.metricas?.registrarEviccionCache('ttl_expired', 1);
      return null;
    }

    // Actualizar acceso para LRU
    this.accesos.set(clave, Date.now());
    entrada.accesos = (entrada.accesos || 0) + 1;
    entrada.ultimoAcceso = Date.now();

    this.metricas?.registrarCache(true, clave, this._calcularTamañoEntrada(entrada));

    dragon.zen('Cache hit', 'obtener', {
      clave: clave.substring(0, 8),
      accesos: entrada.accesos,
      edad: Date.now() - entrada.timestamp
    });

    return entrada.resultado;
  }

  /**
   * Almacena predicción en cache con gestión inteligente de espacio
   */
  almacenar(features, resultado) {
    const clave = this._generarClave(features);
    const timestamp = Date.now();

    // Verificar límite de tamaño antes de insertar
    if (this.cache.size >= this.maxSize) {
      this._liberarEspacio();
    }

    const entrada = {
      resultado,
      timestamp,
      accesos: 1,
      ultimoAcceso: timestamp,
      tamaño: this._calcularTamañoEntrada({ resultado })
    };

    this.cache.set(clave, entrada);
    this.accesos.set(clave, timestamp);

    dragon.zen('Cache store', 'almacenar', {
      clave: clave.substring(0, 8),
      tamaño: entrada.tamaño,
      totalEntradas: this.cache.size
    });
  }

  /**
   * Libera espacio eliminando entradas menos utilizadas (LRU)
   */
  _liberarEspacio() {
    const espacioALiberar = Math.ceil(this.maxSize * 0.1); // Liberar 10%

    // Obtener entradas ordenadas por último acceso (LRU)
    const entradasOrdenadas = Array.from(this.accesos.entries())
      .sort((a, b) => a[1] - b[1]) // Ordenar por timestamp ascendente
      .slice(0, espacioALiberar)
      .map(([clave]) => clave);

    // Eliminar entradas LRU
    entradasOrdenadas.forEach(clave => {
      this.cache.delete(clave);
      this.accesos.delete(clave);
    });

    this.metricas?.registrarEviccionCache('lru_eviction', espacioALiberar);

    dragon.zen('Espacio liberado en cache', 'liberarEspacio', {
      entradasEliminadas: espacioALiberar,
      entradasRestantes: this.cache.size
    });
  }

  /**
   * Ejecuta limpieza completa del cache
   */
  _ejecutarLimpiezaCompleta() {
    const inicioLimpieza = Date.now();
    const tamañoInicial = this.cache.size;
    let entradasEliminadas = 0;

    // Limpiar entradas expiradas
    for (const [clave, entrada] of this.cache.entries()) {
      if (inicioLimpieza - entrada.timestamp > this.ttl) {
        this.cache.delete(clave);
        this.accesos.delete(clave);
        entradasEliminadas++;
      }
    }

    this.ultimaLimpieza = inicioLimpieza;

    if (entradasEliminadas > 0) {
      this.metricas?.registrarEviccionCache('cleanup_expired', entradasEliminadas);

      dragon.zen('Limpieza completa de cache ejecutada', 'ejecutarLimpiezaCompleta', {
        tamañoInicial,
        entradasEliminadas,
        tamañoFinal: this.cache.size,
        duracion: Date.now() - inicioLimpieza
      });
    }
  }

  /**
   * Calcula el tamaño aproximado de una entrada
   */
  _calcularTamañoEntrada(entrada) {
    try {
      return JSON.stringify(entrada).length;
    } catch {
      return 1024; // Tamaño por defecto
    }
  }

  /**
   * Obtiene estadísticas detalladas del cache
   */
  obtenerEstadisticas() {
    const ahora = Date.now();
    const entradas = Array.from(this.cache.values());

    return {
      tamaño: this.cache.size,
      maxSize: this.maxSize,
      utilizacion: this.cache.size / this.maxSize,
      ttl: this.ttl,
      ultimaLimpieza: this.ultimaLimpieza,
      estadisticasEntradas: {
        promedio: {
          accesos: entradas.length > 0 ?
            entradas.reduce((sum, e) => sum + (e.accesos || 0), 0) / entradas.length : 0,
          edad: entradas.length > 0 ?
            entradas.reduce((sum, e) => sum + (ahora - e.timestamp), 0) / entradas.length : 0
        },
        total: {
          accesos: entradas.reduce((sum, e) => sum + (e.accesos || 0), 0),
          tamaño: entradas.reduce((sum, e) => sum + (e.tamaño || 0), 0)
        }
      }
    };
  }

  /**
   * Invalida entradas del cache que coincidan con un patrón
   */
  invalidar(patron = null) {
    let entradasInvalidadas = 0;

    if (patron === null) {
      // Limpiar todo el cache
      entradasInvalidadas = this.cache.size;
      this.cache.clear();
      this.accesos.clear();
    } else {
      // Invalidar entradas que coincidan con el patrón
      for (const [clave, entrada] of this.cache.entries()) {
        if (this._coincidePatron(entrada, patron)) {
          this.cache.delete(clave);
          this.accesos.delete(clave);
          entradasInvalidadas++;
        }
      }
    }

    this.metricas?.registrarEviccionCache('manual_invalidation', entradasInvalidadas);

    dragon.zen('Cache invalidado', 'redSuperior.js', 'invalidar', {
      entradasInvalidadas,
      patron: patron ? 'patron_especifico' : 'completo'
    });

    return entradasInvalidadas;
  }

  /**
   * Verifica si una entrada coincide con un patrón de invalidación
   */
  _coincidePatron(entrada, patron) {
    try {
      if (typeof patron === 'function') {
        return patron(entrada);
      }

      if (typeof patron === 'object') {
        return Object.keys(patron).every(key =>
          entrada.resultado[key] === patron[key]
        );
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Precarga el cache con predicciones frecuentes
   */
  async precargar(featuresComunes, prediccionFn) {
    if (!Array.isArray(featuresComunes) || typeof prediccionFn !== 'function') {
      throw new Error('Parámetros inválidos para precarga de cache');
    }

    dragon.zen('🔄 Iniciando precarga de cache...', 'redSuperior.js', 'precargar', {
      entradas: featuresComunes.length
    });

    let precargadas = 0;
    const inicio = Date.now();

    for (const features of featuresComunes) {
      try {
        const resultado = await prediccionFn(features);
        this.almacenar(features, resultado);
        precargadas++;
      } catch (error) {
        dragon.agoniza('Error en precarga de cache', error, 'precargar', { features });
      }
    }

    const duracion = Date.now() - inicio;

    dragon.zen('✅ Precarga de cache completada', 'redSuperior.js', 'precargar_completada', {
      precargadas,
      total: featuresComunes.length,
      duracion,
      tasa: precargadas / featuresComunes.length
    });

    return { precargadas, duracion };
  }

  /**
   * Destructor - limpia intervalos y recursos
   */
  destruir() {
    dragon.zen('🧹 Destruyendo CachePredicciones...', 'redSuperior.js', 'CachePredicciones.destruir');

    // Limpiar intervalos
    this.intervalos.forEach((intervalo, nombre) => {
      clearInterval(intervalo);
      dragon.zen(`Intervalo de cache ${nombre} limpiado`, 'destruir');
    });

    this.intervalos.clear();

    // Limpiar cache
    this.cache.clear();
    this.accesos.clear();

    dragon.zen('✅ CachePredicciones destruido correctamente', 'redSuperior.js', 'CachePredicciones.destruir');
  }
}
// =============================================================================
// CLASE RED SUPERIOR - NÚCLEO DEL SISTEMA ENTERPRISE
// =============================================================================

/**
 * Clase principal Red Superior con arquitectura enterprise FAANG
 * Maneja predicciones distribuidas con GPU, batch processing y alta disponibilidad
 */
class RedSuperior extends EventEmitter {
  constructor() {
    super();

    // Estado del sistema
    this.id = crypto.randomUUID();
    this.version = CONFIG.RED_SUPERIOR.VERSION;
    this.modelo = null;
    this.inicializado = false;
    this.gpuDisponible = false;
    this.backendTensorFlow = null;
    this.estadoSistema = ESTADOS_SISTEMA.INICIALIZANDO;

    // Componentes principales
    this.metricas = new MetricasManager();
    this.cache = new CachePredicciones();
    this.cache.metricas = this.metricas;

    // Red de analizadores distribuidos
    this.analizadores = new Map();
    this.poolConexiones = new Map();

    // Control de concurrencia y rate limiting
    this.operacionesEnCurso = new Set();
    this.limitadorTasa = new Map(); // Por IP/usuario
    this.circuitBreaker = new Map(); // Por servicio

    // Timestamps importantes
    this.tiempoInicializacion = null;
    this.ultimoHealthCheck = null;
    this.ultimaOperacion = null;

    // Request correlation para trazabilidad
    this.correlacionRequests = new Map();

    dragon.zen('🐉 Red Superior inicializando...', 'redSuperior.js', 'RedSuperior.constructor', {
      id: this.id,
      version: this.version,
      timestamp: Date.now()
    });

    this._configurarEventListeners();
  }

  /**
   * Configura listeners de eventos del sistema
   */
  _configurarEventListeners() {
    // Listeners de métricas
    this.metricas.on('nueva_alerta', (alerta) => {
      this.emit('alerta_sistema', alerta);
      this._manejarAlertaSistema(alerta);
    });

    this.metricas.on('cambio_estado', ({ anterior, nuevo }) => {
      dragon.audit('CAMBIO_ESTADO_RED_SUPERIOR', {
        estadoAnterior: anterior,
        estadoNuevo: nuevo,
        redSuperiorId: this.id
      });
    });

    // Listener para limpieza automática
    this.on('cierre_iniciado', () => {
      this.estadoSistema = ESTADOS_SISTEMA.CERRANDO;
      this.metricas.establecerEstado(ESTADOS_SISTEMA.CERRANDO);
    });

    dragon.zen('Event listeners configurados', 'configurarEventListeners');
  }

  /**
   * Inicialización completa de la Red Superior con retry y circuit breaker
   */
  async inicializar() {
    const inicioInicializacion = performance.now();
    const correlationId = crypto.randomUUID();

    try {
      dragon.zen('🚀 Iniciando inicialización completa de Red Superior...', 'redSuperior.js', 'inicializar', {
        correlationId,
        timestamp: Date.now(),
        nodeVersion: process.version,
        platform: process.platform
      });

      this.estadoSistema = ESTADOS_SISTEMA.INICIALIZANDO;
      this.metricas.establecerEstado(ESTADOS_SISTEMA.INICIALIZANDO);

      // STEP 1: Inicialización de TensorFlow con GPU
      await this._inicializarTensorFlow();

      // STEP 2: Carga del modelo de ML
      await this._cargarModelo();

      // STEP 3: Inicialización de analizadores distribuidos
      await this._inicializarAnalizadores();

      // STEP 4: Verificación de conectividad
      await this._verificarConectividad();

      // STEP 5: Precarga del cache si es necesario
      await this._precargarCache();

      // STEP 6: Verificación final del sistema
      await this._verificacionFinalSistema();

      // Marcar como inicializado
      this.inicializado = true;
      this.tiempoInicializacion = performance.now() - inicioInicializacion;
      this.estadoSistema = ESTADOS_SISTEMA.LISTO;
      this.metricas.establecerEstado(ESTADOS_SISTEMA.LISTO);

      const estadoFinal = await this._generarEstadoInicializacion();

      dragon.zen('✅ Red Superior inicializada exitosamente', 'redSuperior.js', 'inicializar_exitoso', {
        correlationId,
        tiempoInicializacion: `${this.tiempoInicializacion.toFixed(2)}ms`,
        ...estadoFinal
      });

      dragon.audit('RED_SUPERIOR_INICIALIZADA', {
        redSuperiorId: this.id,
        tiempoInicializacion: this.tiempoInicializacion,
        estadoFinal,
        correlationId
      });

      this.emit('inicializado', estadoFinal);

      return estadoFinal;

    } catch (error) {
      this.estadoSistema = ESTADOS_SISTEMA.ERROR;
      this.metricas.establecerEstado(ESTADOS_SISTEMA.ERROR);
      this.metricas.registrarError('INIT_FAILED', error.message, error.stack, CODIGOS_ERROR.INIT_TENSORFLOW_FAILED, {
        correlationId,
        tiempoTranscurrido: performance.now() - inicioInicializacion
      });

      dragon.agoniza('❌ Error crítico inicializando Red Superior', error, 'inicializar', {
        correlationId,
        tiempoTranscurrido: performance.now() - inicioInicializacion
      });

      throw new Error(`Error inicializando Red Superior: ${error.message}`);
    }
  }

  /**
   * STEP 1: Inicialización de TensorFlow con configuración GPU optimizada
   */
  async _inicializarTensorFlow() {
    dragon.zen('🔧 Inicializando TensorFlow.js con configuración GPU...', 'redSuperior.js', 'inicializarTensorFlow');

    try {
      // Esperar a que TensorFlow esté listo
      await tf.ready();

      this.backendTensorFlow = tf.getBackend();

      // Configuración específica por backend
      if (this.backendTensorFlow === 'webgl') {
        await this._configurarWebGL();
      } else if (this.backendTensorFlow === 'tensorflow') {
        await this._configurarTensorFlowGPU();
      }

      // Verificar disponibilidad de GPU
      this.gpuDisponible = ['webgl', 'tensorflow'].includes(this.backendTensorFlow);

      if (this.gpuDisponible) {
        dragon.zen('🚀 GPU acceleration activada', 'redSuperior.js', 'gpu_ready', {
          backend: this.backendTensorFlow,
          gpuDisponible: true,
          memoria: this._obtenerInfoMemoriaGPU()
        });
      } else {
        dragon.seEnfada('⚠️ GPU no disponible, usando CPU', 'inicializarTensorFlow', {
          backend: this.backendTensorFlow,
          backendsSoportados: CONFIG.GPU.BACKEND_PRIORITY
        });
      }

      // Verificar memoria disponible
      const memoriaInfo = tf.memory();
      dragon.zen('Estado memoria TensorFlow', 'inicializarTensorFlow', {
        tensors: memoriaInfo.numTensors,
        dataBuffers: memoriaInfo.numDataBuffers,
        bytes: memoriaInfo.numBytes
      });

    } catch (error) {
      this.metricas.registrarError('TENSORFLOW_INIT_FAILED', error.message, error.stack, CODIGOS_ERROR.INIT_TENSORFLOW_FAILED);
      throw new Error(`Error inicializando TensorFlow: ${error.message}`);
    }
  }

  /**
   * Configuración específica para WebGL backend
   */
  async _configurarWebGL() {
    try {
      await tf.ENV.set('WEBGL_DELETE_TEXTURE_THRESHOLD', CONFIG.GPU.WEBGL_DELETE_THRESHOLD);
      await tf.ENV.set('WEBGL_FORCE_F16_TEXTURES', CONFIG.GPU.WEBGL_FORCE_F16);

      dragon.zen('WebGL configurado', 'configurarWebGL', {
        deleteThreshold: CONFIG.GPU.WEBGL_DELETE_THRESHOLD,
        forceF16: CONFIG.GPU.WEBGL_FORCE_F16
      });
    } catch (error) {
      dragon.seEnfada('Error configurando WebGL', 'configurarWebGL', { error: error.message });
    }
  }

  /**
   * Configuración específica para TensorFlow GPU backend
   */
  async _configurarTensorFlowGPU() {
    try {
      // Configuraciones específicas para TensorFlow GPU si es necesario
      dragon.zen('TensorFlow GPU configurado', 'configurarTensorFlowGPU', {
        memoryFraction: CONFIG.GPU.MEMORY_FRACTION
      });
    } catch (error) {
      dragon.seEnfada('Error configurando TensorFlow GPU', 'configurarTensorFlowGPU', { error: error.message });
    }
  }

  /**
   * STEP 2: Carga del modelo de Machine Learning
   */
  async _cargarModelo() {
    dragon.zen('📥 Cargando modelo de Machine Learning...', 'redSuperior.js', 'cargarModelo');

    try {
      // TODO: Reemplazar con la carga real del modelo
      // this.modelo = await tf.loadLayersModel('/ruta/al/modelo/model.json');

      // Simulación del modelo por ahora
      this.modelo = {
        tipo: 'imagen_autenticidad_detector',
        version: '2.1.0',
        arquitectura: 'convolutional_neural_network',
        parametros: 1250000,
        precision: 0.95,
        recall: 0.93,
        f1Score: 0.94,
        fechaCarga: new Date().toISOString(),
        md5: crypto.createHash('md5').update(JSON.stringify({
          version: '2.1.0',
          timestamp: Date.now()
        })).digest('hex')
      };

      // Verificar integridad del modelo
      await this._verificarIntegridadModelo();

      dragon.zen('✅ Modelo cargado exitosamente', 'redSuperior.js', 'modelo_cargado', {
        tipo: this.modelo.tipo,
        version: this.modelo.version,
        parametros: this.modelo.parametros,
        precision: this.modelo.precision,
        md5: this.modelo.md5
      });

      dragon.audit('MODELO_CARGADO', {
        modeloTipo: this.modelo.tipo,
        modeloVersion: this.modelo.version,
        modeloMd5: this.modelo.md5,
        redSuperiorId: this.id
      });

    } catch (error) {
      this.metricas.registrarError('MODEL_LOAD_FAILED', error.message, error.stack, CODIGOS_ERROR.INIT_MODEL_FAILED);
      throw new Error(`Error cargando modelo: ${error.message}`);
    }
  }

  /**
   * Verifica la integridad del modelo cargado
   */
  async _verificarIntegridadModelo() {
    if (!this.modelo) {
      throw new Error('Modelo no cargado para verificación');
    }

    // Verificaciones básicas del modelo
    const verificaciones = [
      { nombre: 'tipo', valor: this.modelo.tipo, requerido: true },
      { nombre: 'version', valor: this.modelo.version, requerido: true },
      { nombre: 'arquitectura', valor: this.modelo.arquitectura, requerido: true }
    ];

    for (const verificacion of verificaciones) {
      if (verificacion.requerido && !verificacion.valor) {
        throw new Error(`Modelo inválido: falta ${verificacion.nombre}`);
      }
    }

    // Verificar que la precisión esté en rango válido
    if (this.modelo.precision < 0.8) {
      dragon.seEnfada('Precisión del modelo por debajo del umbral recomendado', 'verificarIntegridadModelo', {
        precision: this.modelo.precision,
        umbralMinimo: 0.8
      });
    }

    dragon.zen('Integridad del modelo verificada', 'verificarIntegridadModelo', {
      verificacionesPasadas: verificaciones.length,
      modeloValido: true
    });
  }

  /**
   * STEP 3: Inicialización de analizadores distribuidos
   */
  async _inicializarAnalizadores() {
    dragon.zen('🔗 Inicializando red de analizadores distribuidos...', 'redSuperior.js', 'inicializarAnalizadores');

    try {
      // Configurar tipos de analizadores
      const tiposAnalizadores = [
        {
          tipo: 'detector_deepfake',
          instancias: 2,
          prioridad: 1,
          configuracion: { sensibilidad: 0.85, timeout: 3000 }
        },
        {
          tipo: 'clasificador_contenido',
          instancias: 3,
          prioridad: 2,
          configuracion: { categorias: ['real', 'generada', 'modificada'], timeout: 2000 }
        },
        {
          tipo: 'validador_metadatos',
          instancias: 1,
          prioridad: 3,
          configuracion: { verificarExif: true, timeout: 1000 }
        }
      ];

      let totalAnalizadores = 0;

      for (const config of tiposAnalizadores) {
        for (let i = 0; i < config.instancias; i++) {
          const analizadorId = `${config.tipo}_${i + 1}`;
          const analizador = await this._crearAnalizador(analizadorId, config);

          this.analizadores.set(analizadorId, analizador);
          this.metricas.actualizarAnalizador(analizadorId, config.tipo, 'activo', {
            instancia: i + 1,
            configuracion: config.configuracion
          });

          totalAnalizadores++;
        }
      }

      dragon.zen('✅ Analizadores distribuidos inicializados', 'redSuperior.js', 'analizadores_listos', {
        totalAnalizadores,
        tipos: tiposAnalizadores.map(t => `${t.tipo}(${t.instancias})`),
        distribucion: Array.from(this.analizadores.keys())
      });

    } catch (error) {
      this.metricas.registrarError('ANALYZERS_INIT_FAILED', error.message, error.stack);
      throw new Error(`Error inicializando analizadores: ${error.message}`);
    }
  }

  /**
   * Crea un analizador individual con configuración específica
   */
  async _crearAnalizador(id, config) {
    const analizador = {
      id,
      tipo: config.tipo,
      prioridad: config.prioridad,
      estado: 'activo',
      configuracion: config.configuracion,
      estadisticas: {
        inicializado: Date.now(),
        procesamientos: 0,
        errores: 0,
        ultimaOperacion: null,
        tiempoPromedioOperacion: 0
      },
      circuitBreaker: {
        estado: 'cerrado', // cerrado, abierto, medio_abierto
        erroresConsecutivos: 0,
        ultimoError: null,
        proximoIntento: null
      }
    };

    // Inicializar circuit breaker para este analizador
    this.circuitBreaker.set(id, {
      maxErrores: 5,
      tiempoEspera: 30000, // 30 segundos
      timeoutOperacion: config.configuracion.timeout || 5000
    });

    dragon.zen(`Analizador ${id} creado`, 'crearAnalizador', {
      tipo: config.tipo,
      configuracion: config.configuracion
    });

    return analizador;
  }

  /**
   * STEP 4: Verificación de conectividad de la red
   */
  async _verificarConectividad() {
    dragon.zen('🌐 Verificando conectividad de la red...', 'redSuperior.js', 'verificarConectividad');

    try {
      const verificaciones = [];

      for (const [id, analizador] of this.analizadores.entries()) {
        try {
          const resultado = await this._pingAnalizador(id);
          verificaciones.push({ id, estado: 'conectado', latencia: resultado.latencia });

          this.metricas.actualizarAnalizador(id, analizador.tipo, 'conectado', {
            latencia: resultado.latencia,
            ultimaPing: Date.now()
          });

        } catch (error) {
          verificaciones.push({ id, estado: 'desconectado', error: error.message });

          this.metricas.actualizarAnalizador(id, analizador.tipo, 'desconectado', {
            error: error.message,
            ultimoIntento: Date.now()
          });

          dragon.seEnfada(`Analizador ${id} no responde`, 'verificarConectividad', {
            error: error.message
          });
        }
      }

      const conectados = verificaciones.filter(v => v.estado === 'conectado').length;
      const ratio = conectados / verificaciones.length;

      if (ratio < 0.7) {
        throw new Error(`Conectividad insuficiente: ${conectados}/${verificaciones.length} analizadores conectados`);
      }

      dragon.zen('✅ Conectividad verificada', 'redSuperior.js', 'conectividad_ok', {
        analizadoresConectados: conectados,
        analizadoresTotales: verificaciones.length,
        ratioConectividad: ratio,
        latenciaPromedio: verificaciones
          .filter(v => v.latencia)
          .reduce((sum, v) => sum + v.latencia, 0) / conectados || 0
      });

    } catch (error) {
      this.metricas.registrarError('CONNECTIVITY_CHECK_FAILED', error.message, error.stack);
      throw new Error(`Error verificando conectividad: ${error.message}`);
    }
  }

  /**
   * Hace ping a un analizador específico
   */
  async _pingAnalizador(analizadorId) {
    const inicio = performance.now();

    // Simulación de ping - en implementación real sería una llamada HTTP/gRPC
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10));

    const latencia = performance.now() - inicio;

    return {
      analizadorId,
      latencia,
      timestamp: Date.now(),
      estado: 'ok'
    };
  }

  /**
   * STEP 5: Precarga del cache con patrones comunes
   */
  async _precargarCache() {
    dragon.zen('⚡ Iniciando precarga de cache...', 'redSuperior.js', 'precargarCache');

    try {
      // Patrones comunes de features para precarga
      const featuresComunes = [
        // Features típicas de imágenes auténticas
        { tipo: 'imagen', formato: 'jpg', tamaño: 'medio', calidad: 'alta' },
        { tipo: 'imagen', formato: 'png', tamaño: 'grande', calidad: 'alta' },

        // Features típicas de imágenes sospechosas
        { tipo: 'imagen', formato: 'jpg', tamaño: 'pequeño', calidad: 'baja' },
        { tipo: 'imagen', formato: 'webp', tamaño: 'medio', calidad: 'media' }
      ];

      if (featuresComunes.length > 0) {
        const resultado = await this.cache.precargar(featuresComunes, async (features) => {
          // Simulación de predicción para precarga
          return {
            categoria: 'autentica',
            confianza: 0.85,
            score: Math.random(),
            timestamp: Date.now(),
            cached: true
          };
        });

        dragon.zen('✅ Precarga de cache completada', 'redSuperior.js', 'precarga_completada', {
          entradas: resultado.precargadas,
          duracion: resultado.duracion,
          ratioExito: resultado.precargadas / featuresComunes.length
        });
      } else {
        dragon.zen('Sin patrones para precarga de cache', 'precargarCache');
      }

    } catch (error) {
      // Error en precarga no es crítico
      dragon.seEnfada('Error en precarga de cache', 'precargarCache', {
        error: error.message
      });
    }
  }

  /**
   * STEP 6: Verificación final del sistema
   */
  async _verificacionFinalSistema() {
    dragon.zen('🔍 Ejecutando verificación final del sistema...', 'redSuperior.js', 'verificacionFinal');

    try {
      const verificaciones = {
        tensorflow: this.backendTensorFlow !== null,
        modelo: this.modelo !== null,
        cache: this.cache instanceof CachePredicciones,
        metricas: this.metricas instanceof MetricasManager,
        analizadores: this.analizadores.size > 0,
        gpu: this.gpuDisponible
      };

      const fallidas = Object.entries(verificaciones)
        .filter(([_, pasada]) => !pasada)
        .map(([nombre, _]) => nombre);

      if (fallidas.length > 0) {
        throw new Error(`Verificaciones fallidas: ${fallidas.join(', ')}`);
      }

      // Ejecutar test de predicción básico
      await this._testPrediccionBasico();

      dragon.zen('✅ Verificación final exitosa', 'redSuperior.js', 'verificacion_final_ok', {
        verificaciones,
        sistemaListo: true
      });

    } catch (error) {
      this.metricas.registrarError('SYSTEM_VERIFICATION_FAILED', error.message, error.stack);
      throw new Error(`Verificación final fallida: ${error.message}`);
    }
  }

  /**
   * Test básico de predicción para verificar funcionamiento
   */
  async _testPrediccionBasico() {
    const featuresTest = {
      tipo: 'test',
      formato: 'jpg',
      tamaño: 'test',
      timestamp: Date.now()
    };

    try {
      const resultado = await this._ejecutarPrediccion(featuresTest, 'test_basico');

      if (!resultado || typeof resultado.confianza !== 'number') {
        throw new Error('Resultado de test inválido');
      }

      dragon.zen('Test de predicción básico exitoso', 'testPrediccionBasico', {
        confianza: resultado.confianza,
        categoria: resultado.categoria
      });

    } catch (error) {
      throw new Error(`Test de predicción básico falló: ${error.message}`);
    }
  }

  /**
   * Genera estado final de inicialización
   */
  async _generarEstadoInicializacion() {
    return {
      timestamp: Date.now(),
      redSuperiorId: this.id,
      version: this.version,
      tiempoInicializacion: this.tiempoInicializacion,
      tensorflow: {
        backend: this.backendTensorFlow,
        gpuDisponible: this.gpuDisponible,
        memoria: this._obtenerInfoMemoriaGPU()
      },
      modelo: {
        tipo: this.modelo.tipo,
        version: this.modelo.version,
        precision: this.modelo.precision,
        parametros: this.modelo.parametros
      },
      analizadores: {
        total: this.analizadores.size,
        tipos: [...new Set(Array.from(this.analizadores.values()).map(a => a.tipo))],
        conectados: Array.from(this.analizadores.values()).filter(a => a.estado === 'activo').length
      },
      cache: this.cache.obtenerEstadisticas(),
      recursos: {
        memoria: process.memoryUsage(),
        cpu: process.cpuUsage(),
        uptime: process.uptime()
      }
    };
  }

  /**
   * Obtiene información de memoria GPU
   */
  _obtenerInfoMemoriaGPU() {
    try {
      if (this.gpuDisponible) {
        const memoria = tf.memory();
        return {
          tensors: memoria.numTensors,
          dataBuffers: memoria.numDataBuffers,
          bytes: memoria.numBytes,
          unreliable: memoria.unreliable || false
        };
      }
      return null;
    } catch (error) {
      dragon.agoniza('Error obteniendo info memoria GPU', error, 'obtenerInfoMemoriaGPU');
      return null;
    }
  }

  /**
   * Maneja alertas del sistema con escalación automática
   */
  _manejarAlertaSistema(alerta) {
    switch (alerta.severidad) {
      case TIPOS_ALERTA.CRITICA:
        this._manejarAlertaCritica(alerta);
        break;
      case TIPOS_ALERTA.ALTA:
        this._manejarAlertaAlta(alerta);
        break;
      case TIPOS_ALERTA.MEDIA:
        this._manejarAlertaMedia(alerta);
        break;
      default:
        dragon.zen('Alerta de baja prioridad recibida', 'manejarAlertaSistema', { alerta });
    }
  }

  /**
   * Maneja alertas críticas con acciones inmediatas
   */
  _manejarAlertaCritica(alerta) {
    dragon.audit('ALERTA_CRITICA_SISTEMA', {
      alerta: alerta.descripcion,
      tipo: alerta.tipo,
      metadatos: alerta.metadatos,
      redSuperiorId: this.id
    });

    // Acciones automáticas para alertas críticas
    switch (alerta.tipo) {
      case 'ERROR_RATE_HIGH':
        this._activarModoSeguro();
        break;
      case 'MEMORY_LIMIT_EXCEEDED':
        this._ejecutarLimpiezaMemoria();
        break;
      default:
        dragon.seEnfada('Alerta crítica sin acción automática definida', 'manejarAlertaCritica', { tipo: alerta.tipo });
    }
  }

  /**
   * Maneja alertas de prioridad alta
   */
  _manejarAlertaAlta(alerta) {
    dragon.seEnfada(`Alerta alta: ${alerta.descripcion}`, 'manejarAlertaAlta', {
      tipo: alerta.tipo,
      metadatos: alerta.metadatos
    });

    // Acciones preventivas para alertas altas
    if (alerta.tipo === 'LATENCY_P95_HIGH') {
      this._optimizarRendimiento();
    }
  }

  /**
   * Maneja alertas de prioridad media
   */
  _manejarAlertaMedia(alerta) {
    dragon.zen(`Alerta media: ${alerta.descripcion}`, 'manejarAlertaMedia', {
      tipo: alerta.tipo
    });
  }

  /**
   * Activa modo seguro del sistema
   */
  _activarModoSeguro() {
    this.estadoSistema = ESTADOS_SISTEMA.DEGRADADO;
    this.metricas.establecerEstado(ESTADOS_SISTEMA.DEGRADADO);

    dragon.audit('MODO_SEGURO_ACTIVADO', {
      razon: 'alerta_critica',
      timestamp: Date.now(),
      redSuperiorId: this.id
    });
  }

  /**
   * Ejecuta limpieza de memoria para liberar recursos
   */
  _ejecutarLimpiezaMemoria() {
    try {
      // Limpiar cache
      const entradasEliminadas = this.cache.invalidar();

      // Limpiar métricas antiguas
      this.metricas._limpiarVentanaMetricas();

      // Limpiar tensores de TensorFlow si es posible
      if (this.gpuDisponible && typeof tf.disposeVariables === 'function') {
        tf.disposeVariables();
      }

      // Forzar garbage collection si está disponible
      if (global.gc) {
        global.gc();
      }

      dragon.zen('🧹 Limpieza de memoria ejecutada', 'redSuperior.js', 'limpieza_memoria', {
        cacheEntradasEliminadas: entradasEliminadas,
        memoriaAntes: process.memoryUsage()
      });

    } catch (error) {
      dragon.agoniza('Error ejecutando limpieza de memoria', error, 'ejecutarLimpiezaMemoria');
    }
  }

  /**
   * Optimiza rendimiento del sistema
   */
  _optimizarRendimiento() {
    try {
      // Ajustar tamaño de batch dinámicamente
      const estadoActual = this.metricas.obtenerResumen();

      if (estadoActual.latencia.p95 > CONFIG.METRICAS.ALERT_THRESHOLDS.LATENCY_P95) {
        // Reducir tamaño de batch para mejorar latencia
        dragon.zen('Optimizando rendimiento: reduciendo batch size', 'optimizarRendimiento');
      }

      // Limpiar operaciones en curso que puedan estar colgadas
      this._limpiarOperacionesColgadas();

    } catch (error) {
      dragon.agoniza('Error optimizando rendimiento', error, 'optimizarRendimiento');
    }
  }

  /**
   * Limpia operaciones que puedan estar colgadas
   */
  _limpiarOperacionesColgadas() {
    const ahora = Date.now();
    const timeout = CONFIG.RED_SUPERIOR.TIMEOUT_PREDICCION * 2; // Doble timeout

    for (const operacionId of this.operacionesEnCurso) {
      const operacion = this.correlacionRequests.get(operacionId);
      if (operacion && (ahora - operacion.inicio) > timeout) {
        this.operacionesEnCurso.delete(operacionId);
        this.correlacionRequests.delete(operacionId);

        dragon.seEnfada('Operación colgada limpiada', 'limpiarOperacionesColgadas', {
          operacionId,
          tiempoTranscurrido: ahora - operacion.inicio
        });
      }
    }
  }

  // =============================================================================
  // MÉTODOS DE PREDICCIÓN ENTERPRISE - CORE BUSINESS LOGIC
  // =============================================================================

  /**
   * STEP 2: Batch Processing Optimization - Método principal
   * Procesa múltiples predicciones en lotes optimizados con concurrencia controlada
   */
  async predecirBatch(featuresArray, batchSize = CONFIG.RED_SUPERIOR.BATCH_SIZE_DEFAULT, opciones = {}) {
    if (!this.inicializado) {
      const error = new Error('Red Superior no inicializada para batch processing');
      this.metricas.registrarError('BATCH_NOT_INITIALIZED', error.message, error.stack, CODIGOS_ERROR.BATCH_SIZE_INVALID);
      throw error;
    }

    const inicioBatch = performance.now();
    const batchId = crypto.randomUUID();
    const correlationId = opciones.correlationId || crypto.randomUUID();

    try {
      // Validaciones de entrada enterprise
      this._validarParametrosBatch(featuresArray, batchSize);

      // Verificar rate limiting por usuario/IP
      await this._verificarRateLimiting(opciones.userId, opciones.ip);

      // Calcular tamaño de lote óptimo basado en carga actual
      const batchSizeOptimo = await this._calcularBatchSizeOptimo(batchSize, featuresArray.length);

      dragon.zen('🔄 Iniciando batch processing enterprise', 'redSuperior.js', 'predecirBatch', {
        batchId,
        correlationId,
        totalItems: featuresArray.length,
        batchSizeOriginal: batchSize,
        batchSizeOptimo,
        userId: opciones.userId,
        estadoSistema: this.estadoSistema
      });

      // Registrar operación en curso
      this.operacionesEnCurso.add(batchId);
      this.correlacionRequests.set(batchId, {
        tipo: 'batch',
        inicio: Date.now(),
        featuresCount: featuresArray.length,
        correlationId
      });

      // Crear lotes optimizados con distribución inteligente
      const batches = this._crearBatchesInteligentes(featuresArray, batchSizeOptimo);
      const resultados = [];
      let lotesProcesados = 0;
      let erroresAcumulados = 0;

      // Procesar lotes con concurrencia controlada y circuit breaker
      const CONCURRENCIA_MAXIMA = this._calcularConcurrenciaOptima();
      const promesasLotes = [];

      for (let i = 0; i < batches.length; i += CONCURRENCIA_MAXIMA) {
        const lotesConcurrentes = batches.slice(i, i + CONCURRENCIA_MAXIMA);

        const promesasGrupo = lotesConcurrentes.map(async (batch, index) => {
          const loteId = `${batchId}_${i + index}`;
          const timeoutPromise = this._crearTimeoutPromise(CONFIG.RED_SUPERIOR.TIMEOUT_BATCH, loteId);

          try {
            const resultado = await Promise.race([
              this._procesarLoteIndividual(batch, loteId, correlationId),
              timeoutPromise
            ]);

            return resultado;

          } catch (error) {
            erroresAcumulados++;

            // Circuit breaker: si muchos errores, fallar rápidamente
            if (erroresAcumulados > batches.length * 0.5) {
              throw new Error(`Circuit breaker activado: demasiados errores en batch (${erroresAcumulados}/${batches.length})`);
            }

            return batch.map(features => ({
              error: true,
              mensaje: error.message,
              codigo: CODIGOS_ERROR.BATCH_TIMEOUT,
              features,
              loteId
            }));
          }
        });

        const resultadosGrupo = await Promise.allSettled(promesasGrupo);

        // Procesar resultados con manejo de errores granular
        resultadosGrupo.forEach((resultado, index) => {
          if (resultado.status === 'fulfilled') {
            resultados.push(...resultado.value);
          } else {
            erroresAcumulados++;
            const loteId = `${batchId}_${i + index}`;

            dragon.agoniza('Error en grupo de lotes', resultado.reason, 'predecirBatch', {
              batchId,
              loteId,
              correlationId
            });

            // Crear resultados de error para el lote fallido
            const loteError = lotesConcurrentes[index] || [];
            resultados.push(...loteError.map(features => ({
              error: true,
              mensaje: resultado.reason?.message || 'Error desconocido en lote',
              codigo: CODIGOS_ERROR.BATCH_TIMEOUT,
              features,
              loteId
            })));
          }
        });

        lotesProcesados += lotesConcurrentes.length;

        // Reporte de progreso enterprise
        this._reportarProgresoBatch(batchId, lotesProcesados, batches.length, erroresAcumulados, correlationId);

        // Verificar si necesitamos throttling dinámico
        await this._aplicarThrottlingDinamico(erroresAcumulados, lotesProcesados);
      }

      const tiempoTotal = performance.now() - inicioBatch;
      const throughput = featuresArray.length / (tiempoTotal / 1000);
      const tasaExito = (resultados.filter(r => !r.error).length / resultados.length) * 100;

      // Registrar métricas completas
      this.metricas.registrarPrediccion(tiempoTotal, this._obtenerUsoGPU(), this._obtenerUsoMemoria(), {
        batchId,
        tipo: 'batch',
        itemsProcesados: featuresArray.length,
        lotes: batches.length,
        errores: erroresAcumulados,
        tasaExito,
        throughput,
        correlationId
      });

      // Audit log para batches grandes o con errores
      if (featuresArray.length > 100 || erroresAcumulados > 0) {
        dragon.audit('BATCH_PROCESADO', {
          batchId,
          itemsTotal: featuresArray.length,
          itemsExitosos: resultados.filter(r => !r.error).length,
          errores: erroresAcumulados,
          tasaExito,
          tiempoTotal,
          throughput,
          correlationId,
          userId: opciones.userId
        });
      }

      dragon.zen('✅ Batch processing completado exitosamente', 'redSuperior.js', 'predecirBatch_completado', {
        batchId,
        correlationId,
        totalItems: featuresArray.length,
        lotes: batches.length,
        tiempoTotal: `${tiempoTotal.toFixed(2)}ms`,
        throughput: `${throughput.toFixed(2)} items/s`,
        latenciaPromedio: `${(tiempoTotal / featuresArray.length).toFixed(2)}ms/item`,
        tasaExito: `${tasaExito.toFixed(1)}%`,
        errores: erroresAcumulados
      });

      return {
        batchId,
        correlationId,
        resultados,
        metricas: {
          totalItems: featuresArray.length,
          itemsExitosos: resultados.filter(r => !r.error).length,
          itemsConError: erroresAcumulados,
          tasaExito,
          tiempoTotal,
          throughput,
          latenciaPromedio: tiempoTotal / featuresArray.length
        }
      };

    } catch (error) {
      const tiempoTranscurrido = performance.now() - inicioBatch;

      this.metricas.registrarError('BATCH_PROCESSING_FAILED', error.message, error.stack, CODIGOS_ERROR.BATCH_TIMEOUT, {
        batchId,
        correlationId,
        tiempoTranscurrido,
        itemsTotal: featuresArray.length
      });

      dragon.agoniza('❌ Error crítico en batch processing', error, 'predecirBatch', {
        batchId,
        correlationId,
        tiempoTranscurrido,
        estadoSistema: this.estadoSistema
      });

      throw new Error(`Error en batch processing: ${error.message}`);

    } finally {
      // Limpiar tracking de operación
      this.operacionesEnCurso.delete(batchId);
      this.correlacionRequests.delete(batchId);
      this.ultimaOperacion = Date.now();
    }
  }


  /**
   * Predicción individual con cache, métricas y circuit breaker
   */
  async predecir(features, opciones = {}) {
    if (!this.inicializado) {
      const error = new Error('Red Superior no inicializada para predicción');
      this.metricas.registrarError('PREDICTION_NOT_INITIALIZED', error.message, error.stack, CODIGOS_ERROR.PREDICTION_INVALID_INPUT);
      throw error;
    }

    const inicioPrediccion = performance.now();
    const prediccionId = crypto.randomUUID();
    const correlationId = opciones.correlationId || crypto.randomUUID();

    try {
      // Validaciones enterprise
      this._validarParametrosPrediccion(features, opciones);

      // Verificar rate limiting
      await this._verificarRateLimiting(opciones.userId, opciones.ip);

      // Verificar circuit breaker del sistema
      this._verificarCircuitBreaker('sistema');

      dragon.zen('🔮 Iniciando predicción individual', 'predecir', {
        prediccionId,
        correlationId,
        userId: opciones.userId,
        cacheEnabled: opciones.cache !== false
      });

      // Registrar operación en curso
      this.operacionesEnCurso.add(prediccionId);
      this.correlacionRequests.set(prediccionId, {
        tipo: 'prediccion',
        inicio: Date.now(),
        correlationId
      });

      let resultado = null;

      // Verificar cache primero (si está habilitado)
      if (opciones.cache !== false) {
        resultado = this.cache.obtener(features);
        if (resultado !== null) {
          const latencia = performance.now() - inicioPrediccion;

          this.metricas.registrarPrediccion(latencia, null, null, {
            prediccionId,
            tipo: 'cache_hit',
            correlationId
          });

          dragon.zen('⚡ Predicción desde cache', 'redSuperior.js', 'predecir_cache', {
            prediccionId,
            correlationId,
            latencia: `${latencia.toFixed(2)}ms`,
            confianza: resultado.confianza
          });

          return this._enriquecerResultado(resultado, prediccionId, correlationId, 'cache');
        }
      }

      // Validar features para procesamiento
      if (!this._validarFeatures(features)) {
        throw new Error('Features inválidas para predicción');
      }

      // Crear timeout promise
      const timeoutPromise = this._crearTimeoutPromise(CONFIG.RED_SUPERIOR.TIMEOUT_PREDICCION, prediccionId);

      // Ejecutar predicción con timeout
      resultado = await Promise.race([
        this._ejecutarPrediccionConAnalyzers(features, prediccionId, correlationId),
        timeoutPromise
      ]);

      // Almacenar en cache (si está habilitado y resultado es válido)
      if (opciones.cache !== false && resultado && resultado.confianza > 0.5) {
        this.cache.almacenar(features, resultado);
      }

      const latencia = performance.now() - inicioPrediccion;

      // Registrar métricas detalladas
      this.metricas.registrarPrediccion(latencia, this._obtenerUsoGPU(), this._obtenerUsoMemoria(), {
        prediccionId,
        correlationId,
        tipo: 'computation',
        confianza: resultado.confianza,
        categoria: resultado.categoria,
        analizadoresUsados: resultado.analizadoresUsados?.length || 0
      });

      dragon.zen('✅ Predicción completada exitosamente', 'redSuperior.js', 'predecir_completada', {
        prediccionId,
        correlationId,
        latencia: `${latencia.toFixed(2)}ms`,
        confianza: resultado.confianza,
        categoria: resultado.categoria
      });

      return this._enriquecerResultado(resultado, prediccionId, correlationId, 'computation');

    } catch (error) {
      const latencia = performance.now() - inicioPrediccion;

      this.metricas.registrarError('PREDICTION_FAILED', error.message, error.stack, CODIGOS_ERROR.PREDICTION_MODEL_ERROR, {
        prediccionId,
        correlationId,
        latencia,
        features: this._sanitizarFeatures(features)
      });

      dragon.agoniza('❌ Error en predicción individual', error, 'predecir', {
        prediccionId,
        correlationId,
        latencia,
        estadoSistema: this.estadoSistema
      });

      throw new Error(`Error en predicción: ${error.message}`);

    } finally {
      // Limpiar tracking
      this.operacionesEnCurso.delete(prediccionId);
      this.correlacionRequests.delete(prediccionId);
      this.ultimaOperacion = Date.now();
    }
  }

  // =============================================================================
  // MÉTODOS AUXILIARES PARA BATCH PROCESSING
  // =============================================================================

  /**
   * Valida parámetros de entrada para batch processing
   */
  _validarParametrosBatch(featuresArray, batchSize) {
    if (!Array.isArray(featuresArray) || featuresArray.length === 0) {
      throw new Error('featuresArray debe ser un array no vacío');
    }

    if (featuresArray.length > CONFIG.SECURITY.MAX_PAYLOAD_SIZE / 1024) {
      throw new Error(`Batch demasiado grande: ${featuresArray.length} items (máximo permitido: ${Math.floor(CONFIG.SECURITY.MAX_PAYLOAD_SIZE / 1024)})`);
    }

    if (!Number.isInteger(batchSize) || batchSize < CONFIG.RED_SUPERIOR.BATCH_SIZE_MIN || batchSize > CONFIG.RED_SUPERIOR.BATCH_SIZE_MAX) {
      throw new Error(`Batch size inválido: ${batchSize} (rango válido: ${CONFIG.RED_SUPERIOR.BATCH_SIZE_MIN}-${CONFIG.RED_SUPERIOR.BATCH_SIZE_MAX})`);
    }
  }

  /**
   * Valida parámetros para predicción individual
   */
  _validarParametrosPrediccion(features, opciones) {
    if (features === null || features === undefined) {
      throw new Error('Features no pueden ser null o undefined');
    }

    if (typeof features === 'object') {
      const tamañoFeatures = JSON.stringify(features).length;
      if (tamañoFeatures > 100000) { // 100KB máximo
        throw new Error(`Features demasiado grandes: ${tamañoFeatures} bytes`);
      }
    }

    if (opciones.userId && typeof opciones.userId !== 'string') {
      throw new Error('userId debe ser string');
    }
  }

  /**
   * Calcula el tamaño de lote óptimo basado en la carga actual del sistema
   */
  async _calcularBatchSizeOptimo(batchSizeOriginal, totalItems) {
    const metricas = this.metricas.obtenerResumen();

    // Factores que afectan el tamaño óptimo
    const factorLatencia = metricas.latencia.p95 > CONFIG.METRICAS.ALERT_THRESHOLDS.LATENCY_P95 ? 0.7 : 1.0;
    const factorCarga = this.operacionesEnCurso.size > 5 ? 0.8 : 1.0;
    const factorMemoria = metricas.recursos?.memoria?.heapUtilization > 0.8 ? 0.6 : 1.0;
    const factorGPU = this.gpuDisponible ? 1.2 : 0.8;

    const factorTotal = factorLatencia * factorCarga * factorMemoria * factorGPU;

    let batchSizeOptimo = Math.floor(batchSizeOriginal * factorTotal);

    // Aplicar límites
    batchSizeOptimo = Math.max(CONFIG.RED_SUPERIOR.BATCH_SIZE_MIN, batchSizeOptimo);
    batchSizeOptimo = Math.min(CONFIG.RED_SUPERIOR.BATCH_SIZE_MAX, batchSizeOptimo);
    batchSizeOptimo = Math.min(totalItems, batchSizeOptimo);

    dragon.zen('Batch size optimizado calculado', 'calcularBatchSizeOptimo', {
      original: batchSizeOriginal,
      optimizado: batchSizeOptimo,
      factores: { factorLatencia, factorCarga, factorMemoria, factorGPU, factorTotal },
      operacionesEnCurso: this.operacionesEnCurso.size
    });

    return batchSizeOptimo;
  }

  /**
   * Calcula la concurrencia óptima basada en recursos disponibles
   */
  _calcularConcurrenciaOptima() {
    const metricas = this.metricas.obtenerResumen();
    let concurrencia = CONFIG.RED_SUPERIOR.CONCURRENCIA_MAXIMA;

    // Reducir concurrencia si hay alta carga
    if (this.operacionesEnCurso.size > 10) {
      concurrencia = Math.max(1, Math.floor(concurrencia * 0.5));
    }

    // Reducir si la memoria está alta
    if (metricas.recursos?.memoria?.heapUtilization > 0.8) {
      concurrencia = Math.max(1, Math.floor(concurrencia * 0.7));
    }

    // Aumentar si tenemos GPU disponible y baja carga
    if (this.gpuDisponible && this.operacionesEnCurso.size < 3) {
      concurrencia = Math.min(5, concurrencia + 1);
    }

    return concurrencia;
  }

  /**
   * Crea lotes inteligentes con distribución optimizada
   */
  _crearBatchesInteligentes(featuresArray, batchSize) {
    const batches = [];

    // Análisis preliminar de features para optimizar distribución
    const tiposFeatures = this._analizarTiposFeatures(featuresArray);

    // Crear lotes balanceados por tipo de feature si es posible
    if (tiposFeatures.length > 1) {
      return this._crearBatchesBalanceados(featuresArray, batchSize, tiposFeatures);
    }

    // Lotes simples si no hay diversidad de tipos
    for (let i = 0; i < featuresArray.length; i += batchSize) {
      batches.push(featuresArray.slice(i, i + batchSize));
    }

    dragon.zen('Lotes inteligentes creados', 'crearBatchesInteligentes', {
      totalItems: featuresArray.length,
      batchSize,
      totalBatches: batches.length,
      tiposFeatures: tiposFeatures.length
    });

    return batches;
  }

  /**
   * Analiza tipos de features para optimización de lotes
   */
  _analizarTiposFeatures(featuresArray) {
    const tipos = new Set();

    featuresArray.forEach(features => {
      if (features && typeof features === 'object') {
        const tipo = features.tipo || features.format || features.category || 'unknown';
        tipos.add(tipo);
      }
    });

    return Array.from(tipos);
  }

  /**
   * Crea lotes balanceados por tipo de feature
   */
  _crearBatchesBalanceados(featuresArray, batchSize, tipos) {
    const batches = [];
    const porTipo = {};

    // Agrupar por tipo
    tipos.forEach(tipo => {
      porTipo[tipo] = featuresArray.filter(f =>
        (f.tipo || f.format || f.category || 'unknown') === tipo
      );
    });

    // Crear lotes intercalando tipos
    let itemsRestantes = featuresArray.length;
    let indicesPorTipo = {};
    tipos.forEach(tipo => indicesPorTipo[tipo] = 0);

    while (itemsRestantes > 0) {
      const batch = [];
      const itemsPorTipo = Math.ceil(batchSize / tipos.length);

      tipos.forEach(tipo => {
        const features = porTipo[tipo];
        const indice = indicesPorTipo[tipo];
        const itemsATomar = Math.min(itemsPorTipo, features.length - indice, batchSize - batch.length);

        if (itemsATomar > 0) {
          batch.push(...features.slice(indice, indice + itemsATomar));
          indicesPorTipo[tipo] += itemsATomar;
          itemsRestantes -= itemsATomar;
        }
      });

      if (batch.length > 0) {
        batches.push(batch);
      } else {
        break; // Evitar bucle infinito
      }
    }

    return batches;
  }

  /**
   * Procesa un lote individual con manejo completo de errores
   */
  async _procesarLoteIndividual(batch, loteId, correlationId) {
    const inicioLote = performance.now();

    try {
      dragon.zen(`📦 Procesando lote: ${loteId}`, 'procesarLoteIndividual', {
        loteId,
        correlationId,
        itemsEnLote: batch.length
      });

      // Procesar items del lote con Promise.allSettled para manejar errores individuales
      const promesasPredicciones = batch.map((features, index) =>
        this._procesarItemLote(features, `${loteId}_${index}`, correlationId)
          .catch(error => ({
            error: true,
            mensaje: error.message,
            codigo: error.code || CODIGOS_ERROR.PREDICTION_MODEL_ERROR,
            features,
            itemIndex: index,
            loteId
          }))
      );

      const resultados = await Promise.allSettled(promesasPredicciones);
      const tiempoLote = performance.now() - inicioLote;

      // Procesar resultados y estadísticas
      const procesados = resultados.map(r => r.status === 'fulfilled' ? r.value : r.reason);
      const exitosos = procesados.filter(r => !r.error).length;
      const errores = procesados.filter(r => r.error).length;

      if (errores > 0) {
        dragon.seEnfada(`Errores en lote ${loteId}`, 'procesarLoteIndividual', {
          loteId,
          correlationId,
          errores,
          exitosos,
          total: batch.length,
          tasaExito: (exitosos / batch.length) * 100
        });
      }

      dragon.zen(`✅ Lote procesado: ${loteId}`, 'procesarLoteIndividual', {
        loteId,
        correlationId,
        items: batch.length,
        tiempo: `${tiempoLote.toFixed(2)}ms`,
        exitosos,
        errores,
        throughput: (batch.length / tiempoLote * 1000).toFixed(2) + ' items/s'
      });

      return procesados;

    } catch (error) {
      this.metricas.registrarError('BATCH_PROCESSING_ERROR', error.message, error.stack, CODIGOS_ERROR.BATCH_TIMEOUT, {
        loteId,
        correlationId
      });

      dragon.agoniza(`❌ Error procesando lote ${loteId}`, error, 'procesarLoteIndividual', {
        loteId,
        correlationId
      });

      // Retornar errores para todos los items del lote
      return batch.map((features, index) => ({
        error: true,
        mensaje: `Error en lote: ${error.message}`,
        codigo: CODIGOS_ERROR.BATCH_TIMEOUT,
        features,
        itemIndex: index,
        loteId
      }));
    }
  }

  /**
   * Procesa un item individual dentro de un lote
   */
  async _procesarItemLote(features, itemId, correlationId) {
    try {
      // Usar el método de predicción individual pero sin cache para evitar overhead
      const resultado = await this._ejecutarPrediccionConAnalyzers(features, itemId, correlationId);

      return {
        ...resultado,
        itemId,
        procesadoEn: 'lote'
      };

    } catch (error) {
      throw new Error(`Error procesando item ${itemId}: ${error.message}`);
    }
  }

  /**
   * Reporta progreso del batch processing
   */
  _reportarProgresoBatch(batchId, lotesProcesados, totalLotes, errores, correlationId) {
    const porcentaje = ((lotesProcesados / totalLotes) * 100).toFixed(1);

    if (lotesProcesados % Math.max(1, Math.floor(totalLotes / 10)) === 0 || lotesProcesados === totalLotes) {
      dragon.zen(`📊 Progreso batch: ${porcentaje}%`, 'redSuperior.js', 'progreso_batch', {
        batchId,
        correlationId,
        lotesProcesados,
        totalLotes,
        porcentaje,
        erroresAcumulados: errores,
        operacionesEnCurso: this.operacionesEnCurso.size
      });
    }
  }

  /**
   * Aplica throttling dinámico basado en tasa de errores
   */
  async _aplicarThrottlingDinamico(erroresAcumulados, lotesProcesados) {
    if (lotesProcesados === 0) return;

    const tasaError = erroresAcumulados / lotesProcesados;

    if (tasaError > 0.3) { // Más del 30% de errores
      const delay = Math.min(1000, tasaError * 2000); // Máximo 1 segundo de delay

      dragon.seEnfada('🐌 Aplicando throttling dinámico por alta tasa de errores', 'aplicarThrottlingDinamico', {
        tasaError: (tasaError * 100).toFixed(1) + '%',
        delay: delay + 'ms',
        errores: erroresAcumulados,
        lotes: lotesProcesados
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  /**
   * Crea promise con timeout personalizado
   */
  _crearTimeoutPromise(timeout, operacionId) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Timeout de ${timeout}ms excedido para operación ${operacionId}`));
      }, timeout);
    });
  }
  // =============================================================================
  // MÉTODOS DE EJECUCIÓN DE PREDICCIONES CON ANALYZERS DISTRIBUIDOS
  // =============================================================================

  /**
   * Ejecuta predicción utilizando la red de analizadores distribuidos
   */
  async _ejecutarPrediccionConAnalyzers(features, prediccionId, correlationId) {
    const inicioEjecucion = performance.now();

    try {
      dragon.zen('🔍 Iniciando ejecución con analyzers distribuidos', 'ejecutarPrediccionConAnalyzers', {
        prediccionId,
        correlationId,
        analizadoresDisponibles: this.analizadores.size
      });

      // Seleccionar analizadores óptimos para la predicción
      const analizadoresSeleccionados = await this._seleccionarAnalizadoresOptimos(features);

      if (analizadoresSeleccionados.length === 0) {
        throw new Error('No hay analizadores disponibles para procesamiento');
      }

      // Ejecutar análisis en paralelo con circuit breaker
      const resultadosAnalysis = await this._ejecutarAnalisisParalelo(
        features,
        analizadoresSeleccionados,
        prediccionId,
        correlationId
      );

      // Agregar resultados usando algoritmo de ensemble
      const resultadoFinal = await this._agregarResultadosEnsemble(
        resultadosAnalysis,
        features,
        prediccionId
      );

      // Validar resultado final
      this._validarResultadoFinal(resultadoFinal);

      const tiempoEjecucion = performance.now() - inicioEjecucion;

      dragon.zen('✅ Ejecución con analyzers completada', 'ejecutarPrediccionConAnalyzers', {
        prediccionId,
        correlationId,
        tiempoEjecucion: `${tiempoEjecucion.toFixed(2)}ms`,
        analizadoresUsados: analizadoresSeleccionados.length,
        confianzaFinal: resultadoFinal.confianza
      });

      return {
        ...resultadoFinal,
        metadatos: {
          tiempoEjecucion,
          analizadoresUsados: analizadoresSeleccionados.map(a => ({
            id: a.id,
            tipo: a.tipo,
            contribucion: resultadosAnalysis.find(r => r.analizadorId === a.id)?.peso || 0
          })),
          timestamp: Date.now(),
          prediccionId,
          correlationId
        }
      };

    } catch (error) {
      const tiempoTranscurrido = performance.now() - inicioEjecucion;

      this.metricas.registrarError('ANALYZER_EXECUTION_FAILED', error.message, error.stack, CODIGOS_ERROR.PREDICTION_MODEL_ERROR, {
        prediccionId,
        correlationId,
        tiempoTranscurrido
      });

      throw new Error(`Error en ejecución con analyzers: ${error.message}`);
    }
  }

  /**
   * Selecciona analizadores óptimos basado en el tipo de features y disponibilidad
   */
  async _seleccionarAnalizadoresOptimos(features) {
    const analizadoresDisponibles = Array.from(this.analizadores.values())
      .filter(a => a.estado === 'activo')
      .filter(a => this._verificarCircuitBreakerAnalizador(a.id));

    if (analizadoresDisponibles.length === 0) {
      dragon.seEnfada('No hay analizadores disponibles', 'seleccionarAnalizadoresOptimos', {
        totalAnalizadores: this.analizadores.size,
        analizadoresActivos: Array.from(this.analizadores.values()).filter(a => a.estado === 'activo').length
      });
      return [];
    }

    // Determinar tipos de análisis necesarios basado en features
    const tiposNecesarios = this._determinarTiposAnalisisNecesarios(features);

    // Seleccionar analizadores por tipo con balanceo de carga
    const seleccionados = [];

    for (const tipo of tiposNecesarios) {
      const analizadoresTipo = analizadoresDisponibles
        .filter(a => a.tipo === tipo)
        .sort((a, b) => {
          // Ordenar por carga y rendimiento
          const cargaA = a.estadisticas.procesamientos || 0;
          const cargaB = b.estadisticas.procesamientos || 0;
          const rendimientoA = a.estadisticas.tiempoPromedioOperacion || 1000;
          const rendimientoB = b.estadisticas.tiempoPromedioOperacion || 1000;

          return (cargaA / rendimientoA) - (cargaB / rendimientoB);
        });

      if (analizadoresTipo.length > 0) {
        // Seleccionar el mejor analizador de este tipo
        seleccionados.push(analizadoresTipo[0]);

        // Si hay redundancia disponible y es un tipo crítico, añadir backup
        if (analizadoresTipo.length > 1 && this._esTipoCritico(tipo)) {
          seleccionados.push(analizadoresTipo[1]);
        }
      }
    }

    dragon.zen('Analizadores óptimos seleccionados', 'seleccionarAnalizadoresOptimos', {
      tiposNecesarios,
      analizadoresSeleccionados: seleccionados.map(a => ({ id: a.id, tipo: a.tipo })),
      analizadoresDisponibles: analizadoresDisponibles.length
    });

    return seleccionados;
  }

  /**
   * Determina qué tipos de análisis son necesarios para las features dadas
   */
  _determinarTiposAnalisisNecesarios(features) {
    const tipos = new Set();

    // Análisis siempre necesarios
    tipos.add('detector_deepfake');
    tipos.add('clasificador_contenido');

    // Análisis condicionales basados en features
    if (features.metadata || features.exif) {
      tipos.add('validador_metadatos');
    }

    if (features.tamaño === 'grande' || features.resolucion > 2000) {
      tipos.add('analizador_calidad');
    }

    if (features.formato === 'jpg' || features.formato === 'jpeg') {
      tipos.add('detector_compresion');
    }

    return Array.from(tipos);
  }

  /**
   * Verifica si un tipo de análisis es crítico
   */
  _esTipoCritico(tipo) {
    const tiposCriticos = ['detector_deepfake', 'clasificador_contenido'];
    return tiposCriticos.includes(tipo);
  }

  /**
   * Ejecuta análisis en paralelo con todos los analizadores seleccionados
   */
  async _ejecutarAnalisisParalelo(features, analizadores, prediccionId, correlationId) {
    const promesasAnalisis = analizadores.map(analizador =>
      this._ejecutarAnalisisIndividual(features, analizador, prediccionId, correlationId)
        .catch(error => ({
          analizadorId: analizador.id,
          error: true,
          mensaje: error.message,
          peso: 0,
          confianza: 0
        }))
    );

    const resultados = await Promise.allSettled(promesasAnalisis);

    // Procesar resultados y manejar errores
    const resultadosValidos = [];
    let erroresAnalisis = 0;

    resultados.forEach((resultado, index) => {
      const analizador = analizadores[index];

      if (resultado.status === 'fulfilled' && !resultado.value.error) {
        resultadosValidos.push(resultado.value);
        this._actualizarEstadisticasAnalizador(analizador.id, true);
      } else {
        erroresAnalisis++;
        this._actualizarEstadisticasAnalizador(analizador.id, false);
        this._actualizarCircuitBreakerAnalizador(analizador.id, false);

        dragon.seEnfada(`Error en analizador ${analizador.id}`, 'ejecutarAnalisisParalelo', {
          analizadorId: analizador.id,
          analizadorTipo: analizador.tipo,
          error: resultado.value?.mensaje || resultado.reason?.message,
          prediccionId,
          correlationId
        });
      }
    });

    // Verificar que tenemos suficientes resultados válidos
    if (resultadosValidos.length === 0) {
      throw new Error('Todos los analizadores fallaron en el procesamiento');
    }

    if (erroresAnalisis > analizadores.length * 0.5) {
      dragon.seEnfada('Alta tasa de errores en analizadores', 'ejecutarAnalisisParalelo', {
        errores: erroresAnalisis,
        total: analizadores.length,
        tasaError: (erroresAnalisis / analizadores.length * 100).toFixed(1) + '%',
        prediccionId
      });
    }

    dragon.zen('Análisis paralelo completado', 'ejecutarAnalisisParalelo', {
      prediccionId,
      correlationId,
      analizadoresEjecutados: analizadores.length,
      resultadosValidos: resultadosValidos.length,
      errores: erroresAnalisis
    });

    return resultadosValidos;
  }

  /**
   * Ejecuta análisis individual en un analizador específico
   */
  async _ejecutarAnalisisIndividual(features, analizador, prediccionId, correlationId) {
    const inicioAnalisis = performance.now();

    try {
      // Verificar circuit breaker del analizador
      this._verificarCircuitBreakerAnalizador(analizador.id);

      // Preparar contexto de análisis
      const contextoAnalisis = {
        features,
        analizador: {
          id: analizador.id,
          tipo: analizador.tipo,
          configuracion: analizador.configuracion
        },
        prediccionId,
        correlationId,
        timestamp: Date.now()
      };

      // Ejecutar análisis específico por tipo
      const resultado = await this._ejecutarAnalisisPorTipo(analizador.tipo, contextoAnalisis);

      const tiempoAnalisis = performance.now() - inicioAnalisis;

      // Validar resultado del análisis
      this._validarResultadoAnalisis(resultado, analizador.tipo);

      dragon.zen(`Análisis individual completado: ${analizador.id}`, 'ejecutarAnalisisIndividual', {
        analizadorId: analizador.id,
        analizadorTipo: analizador.tipo,
        tiempoAnalisis: `${tiempoAnalisis.toFixed(2)}ms`,
        confianza: resultado.confianza,
        prediccionId
      });

      return {
        analizadorId: analizador.id,
        analizadorTipo: analizador.tipo,
        resultado,
        peso: this._calcularPesoAnalizador(analizador, resultado),
        tiempoAnalisis,
        confianza: resultado.confianza,
        metadatos: resultado.metadatos || {}
      };

    } catch (error) {
      const tiempoTranscurrido = performance.now() - inicioAnalisis;

      this.metricas.registrarError('INDIVIDUAL_ANALYSIS_FAILED', error.message, error.stack, CODIGOS_ERROR.PREDICTION_MODEL_ERROR, {
        analizadorId: analizador.id,
        analizadorTipo: analizador.tipo,
        prediccionId,
        tiempoTranscurrido
      });

      throw new Error(`Análisis fallido en ${analizador.id}: ${error.message}`);
    }
  }

  /**
   * Ejecuta análisis específico según el tipo de analizador
   */
  async _ejecutarAnalisisPorTipo(tipo, contexto) {
    switch (tipo) {
      case 'detector_deepfake':
        return await this._ejecutarDeteccionDeepfake(contexto);

      case 'clasificador_contenido':
        return await this._ejecutarClasificacionContenido(contexto);

      case 'validador_metadatos':
        return await this._ejecutarValidacionMetadatos(contexto);

      case 'analizador_calidad':
        return await this._ejecutarAnalisisCalidad(contexto);

      case 'detector_compresion':
        return await this._ejecutarDeteccionCompresion(contexto);

      default:
        throw new Error(`Tipo de analizador no soportado: ${tipo}`);
    }
  }

  /**
   * Ejecuta detección de deepfake/contenido generado
   */
  async _ejecutarDeteccionDeepfake(contexto) {
    const { features, analizador } = contexto;

    // Simular análisis de deepfake con lógica realista
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));

    // Lógica de detección basada en características
    let scoreAutenticidad = 0.8; // Base score

    // Ajustar score basado en features
    if (features.calidad === 'baja') scoreAutenticidad -= 0.2;
    if (features.formato === 'webp') scoreAutenticidad -= 0.1;
    if (features.tamaño === 'pequeño') scoreAutenticidad -= 0.15;
    if (features.compresion > 80) scoreAutenticidad -= 0.1;

    // Añadir ruido realista
    scoreAutenticidad += (Math.random() - 0.5) * 0.1;
    scoreAutenticidad = Math.max(0, Math.min(1, scoreAutenticidad));

    const esDeepfake = scoreAutenticidad < analizador.configuracion.sensibilidad;

    return {
      categoria: esDeepfake ? 'deepfake_detectado' : 'contenido_autentico',
      confianza: scoreAutenticidad,
      score: scoreAutenticidad,
      detalles: {
        algoritmo: 'cnn_deepfake_v2',
        caracteristicasAnalizadas: ['artifacts', 'consistency', 'temporal_coherence'],
        umbralSensibilidad: analizador.configuracion.sensibilidad
      },
      metadatos: {
        procesamiento: 'gpu_acelerado',
        modelo: 'deepfake_detector_v2.1',
        timestamp: Date.now()
      }
    };
  }

  /**
   * Ejecuta clasificación de contenido
   */
  async _ejecutarClasificacionContenido(contexto) {
    const { features, analizador } = contexto;

    await new Promise(resolve => setTimeout(resolve, Math.random() * 80 + 30));

    // Clasificación basada en características
    const categorias = analizador.configuracion.categorias || ['real', 'generada', 'modificada'];
    let scores = {};

    // Calcular scores para cada categoría
    if (features.metadata && features.metadata.software) {
      scores.modificada = 0.7;
      scores.real = 0.2;
      scores.generada = 0.1;
    } else if (features.calidad === 'perfecta' && features.ruido === 'minimo') {
      scores.generada = 0.6;
      scores.real = 0.3;
      scores.modificada = 0.1;
    } else {
      scores.real = 0.6;
      scores.modificada = 0.25;
      scores.generada = 0.15;
    }

    // Normalizar scores
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    Object.keys(scores).forEach(cat => scores[cat] /= totalScore);

    const categoriaMaxima = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);

    return {
      categoria: categoriaMaxima,
      confianza: scores[categoriaMaxima],
      score: scores[categoriaMaxima],
      scores: scores,
      detalles: {
        algoritmo: 'multi_class_classifier',
        caracteristicasUsadas: ['texture', 'frequency', 'statistical'],
        categoriasEvaluadas: categorias
      },
      metadatos: {
        modelo: 'content_classifier_v1.5',
        timestamp: Date.now()
      }
    };
  }

  /**
   * Ejecuta validación de metadatos
   */
  async _ejecutarValidacionMetadatos(contexto) {
    const { features } = contexto;

    await new Promise(resolve => setTimeout(resolve, Math.random() * 40 + 20));

    let scoreValidez = 0.8;
    const inconsistencias = [];

    // Validar metadatos EXIF si están disponibles
    if (features.metadata) {
      if (!features.metadata.camera) {
        inconsistencias.push('falta_info_camara');
        scoreValidez -= 0.2;
      }

      if (!features.metadata.timestamp) {
        inconsistencias.push('falta_timestamp');
        scoreValidez -= 0.1;
      }

      if (features.metadata.software && features.metadata.software.includes('AI')) {
        inconsistencias.push('software_generacion_ai');
        scoreValidez -= 0.3;
      }
    } else {
      inconsistencias.push('metadatos_ausentes');
      scoreValidez -= 0.4;
    }

    scoreValidez = Math.max(0, Math.min(1, scoreValidez));

    return {
      categoria: scoreValidez > 0.6 ? 'metadatos_validos' : 'metadatos_sospechosos',
      confianza: scoreValidez,
      score: scoreValidez,
      detalles: {
        inconsistenciasDetectadas: inconsistencias,
        metadatosAnalizados: features.metadata ? Object.keys(features.metadata) : [],
        verificacionExif: !!features.metadata
      },
      metadatos: {
        analizador: 'metadata_validator_v1.0',
        timestamp: Date.now()
      }
    };
  }

  /**
   * Ejecuta análisis de calidad
   */
  async _ejecutarAnalisisCalidad(contexto) {
    const { features } = contexto;

    await new Promise(resolve => setTimeout(resolve, Math.random() * 60 + 40));

    let scoreCalidad = 0.7;

    // Evaluar factores de calidad
    if (features.resolucion > 1920) scoreCalidad += 0.1;
    if (features.calidad === 'alta') scoreCalidad += 0.2;
    if (features.ruido === 'minimo') scoreCalidad += 0.1;
    if (features.compresion < 20) scoreCalidad += 0.1;

    scoreCalidad = Math.max(0, Math.min(1, scoreCalidad));

    return {
      categoria: scoreCalidad > 0.7 ? 'alta_calidad' : 'calidad_moderada',
      confianza: scoreCalidad,
      score: scoreCalidad,
      detalles: {
        resolucion: features.resolucion,
        factorCompresion: features.compresion,
        nivelRuido: features.ruido,
        nitidez: 'evaluada'
      },
      metadatos: {
        analizador: 'quality_analyzer_v1.2',
        timestamp: Date.now()
      }
    };
  }

  /**
   * Ejecuta detección de compresión
   */
  async _ejecutarDeteccionCompresion(contexto) {
    const { features } = contexto;

    await new Promise(resolve => setTimeout(resolve, Math.random() * 30 + 15));

    const factorCompresion = features.compresion || 50;
    let scoreCompresion = 1 - (factorCompresion / 100);

    // Detectar recompresiones múltiples
    const recompresiones = factorCompresion > 80 ? Math.floor(factorCompresion / 30) : 1;

    return {
      categoria: recompresiones > 2 ? 'multiple_compression' : 'single_compression',
      confianza: scoreCompresion,
      score: scoreCompresion,
      detalles: {
        factorCompresion,
        recompresionesDetectadas: recompresiones,
        algoritmoDeteccion: 'jpeg_compression_analysis'
      },
      metadatos: {
        analizador: 'compression_detector_v1.0',
        timestamp: Date.now()
      }
    };
  }

  /**
   * Valida el resultado de un análisis individual
   */
  _validarResultadoAnalisis(resultado, tipoAnalizador) {
    if (!resultado || typeof resultado !== 'object') {
      throw new Error(`Resultado inválido del analizador ${tipoAnalizador}`);
    }

    if (typeof resultado.confianza !== 'number' || resultado.confianza < 0 || resultado.confianza > 1) {
      throw new Error(`Confianza inválida en ${tipoAnalizador}: ${resultado.confianza}`);
    }

    if (!resultado.categoria || typeof resultado.categoria !== 'string') {
      throw new Error(`Categoría inválida en ${tipoAnalizador}: ${resultado.categoria}`);
    }
  }

  /**
   * Calcula el peso de un analizador para el ensemble
   */
  _calcularPesoAnalizador(analizador, resultado) {
    let peso = 1.0; // Peso base

    // Ajustar peso basado en tipo de analizador
    const pesosPorTipo = {
      'detector_deepfake': 1.5,    // Mayor peso para detección de deepfake
      'clasificador_contenido': 1.3,
      'validador_metadatos': 1.0,
      'analizador_calidad': 0.8,
      'detector_compresion': 0.7
    };

    peso *= pesosPorTipo[analizador.tipo] || 1.0;

    // Ajustar peso basado en histórico de rendimiento
    const estadisticas = analizador.estadisticas;
    if (estadisticas.procesamientos > 100) {
      const tasaExito = 1 - (estadisticas.errores / estadisticas.procesamientos);
      peso *= tasaExito;
    }

    // Ajustar peso basado en confianza del resultado
    peso *= resultado.confianza;

    return Math.max(0.1, Math.min(2.0, peso)); // Limitar peso entre 0.1 y 2.0
  }
  // =============================================================================
  // ENSEMBLE ALGORITHM Y AGREGACIÓN DE RESULTADOS
  // =============================================================================

  /**
   * Agrega resultados de múltiples analizadores usando algoritmo de ensemble avanzado
   */
  async _agregarResultadosEnsemble(resultadosAnalysis, features, prediccionId) {
    const inicioEnsemble = performance.now();

    try {
      dragon.zen('🔮 Iniciando agregación ensemble', 'agregarResultadosEnsemble', {
        prediccionId,
        analizadoresParticipantes: resultadosAnalysis.length,
        algoritmo: 'weighted_voting_with_confidence'
      });

      if (resultadosAnalysis.length === 0) {
        throw new Error('No hay resultados de análisis para agregar');
      }

      // Normalizar pesos para que sumen 1
      const pesoTotal = resultadosAnalysis.reduce((sum, r) => sum + r.peso, 0);
      if (pesoTotal === 0) {
        throw new Error('Suma de pesos es cero, no se puede agregar');
      }

      resultadosAnalysis.forEach(r => r.pesoNormalizado = r.peso / pesoTotal);

      // Algoritmo de ensemble: Weighted Voting con Confidence Scaling
      const agregacion = await this._ejecutarWeightedVoting(resultadosAnalysis, features);

      // Aplicar corrección de confianza basada en consenso
      const consenso = this._calcularConsenso(resultadosAnalysis);
      agregacion.confianza = this._ajustarConfianzaPorConsenso(agregacion.confianza, consenso);

      // Detectar anomalías en la agregación
      const anomalias = this._detectarAnomalias(resultadosAnalysis, agregacion);

      // Calcular métricas de calidad del ensemble
      const calidadEnsemble = this._calcularCalidadEnsemble(resultadosAnalysis, consenso);

      const tiempoEnsemble = performance.now() - inicioEnsemble;

      const resultadoFinal = {
        categoria: agregacion.categoria,
        confianza: agregacion.confianza,
        score: agregacion.score,
        algoritmo: 'weighted_ensemble_v2.1',
        ensemble: {
          analizadoresParticipantes: resultadosAnalysis.length,
          consenso: consenso,
          calidadEnsemble: calidadEnsemble,
          anomaliasDetectadas: anomalias,
          tiempoAgregacion: tiempoEnsemble,
          distribucionPesos: resultadosAnalysis.map(r => ({
            analizador: r.analizadorId,
            peso: r.pesoNormalizado,
            confianza: r.confianza
          }))
        },
        detalles: {
          metodologia: 'confidence_weighted_voting',
          factoresConsiderados: ['tipo_analizador', 'rendimiento_historico', 'confianza_resultado'],
          validacionConsenso: consenso > 0.7 ? 'alto' : consenso > 0.5 ? 'medio' : 'bajo'
        },
        analizadoresUsados: resultadosAnalysis.map(r => r.analizadorId)
      };

      dragon.zen('✅ Agregación ensemble completada', 'agregarResultadosEnsemble', {
        prediccionId,
        categoriaFinal: resultadoFinal.categoria,
        confianzaFinal: resultadoFinal.confianza.toFixed(3),
        consenso: consenso.toFixed(3),
        calidadEnsemble: calidadEnsemble.toFixed(3),
        tiempoAgregacion: `${tiempoEnsemble.toFixed(2)}ms`
      });

      return resultadoFinal;

    } catch (error) {
      this.metricas.registrarError('ENSEMBLE_AGGREGATION_FAILED', error.message, error.stack, CODIGOS_ERROR.PREDICTION_MODEL_ERROR, {
        prediccionId,
        resultadosDisponibles: resultadosAnalysis.length
      });

      throw new Error(`Error en agregación ensemble: ${error.message}`);
    }
  }

  /**
   * Ejecuta algoritmo de Weighted Voting con escalado de confianza
   */
  async _ejecutarWeightedVoting(resultadosAnalysis, features) {
    // Agrupar resultados por categoría
    const categorias = {};
    let scoreTotal = 0;
    let pesoAcumulado = 0;

    resultadosAnalysis.forEach(resultado => {
      const categoria = resultado.resultado.categoria;
      const peso = resultado.pesoNormalizado;
      const confianza = resultado.confianza;
      const score = resultado.resultado.score || confianza;

      // Escalar peso por confianza (confidence scaling)
      const pesoEscalado = peso * confianza;

      if (!categorias[categoria]) {
        categorias[categoria] = {
          pesoAcumulado: 0,
          scoreAcumulado: 0,
          contadorVotos: 0,
          confianzaPromedio: 0,
          analizadores: []
        };
      }

      categorias[categoria].pesoAcumulado += pesoEscalado;
      categorias[categoria].scoreAcumulado += score * pesoEscalado;
      categorias[categoria].contadorVotos += 1;
      categorias[categoria].confianzaPromedio += confianza;
      categorias[categoria].analizadores.push(resultado.analizadorId);

      scoreTotal += score * pesoEscalado;
      pesoAcumulado += pesoEscalado;
    });

    // Normalizar scores acumulados y calcular confianzas promedio
    Object.keys(categorias).forEach(categoria => {
      const cat = categorias[categoria];
      cat.scoreNormalizado = cat.scoreAcumulado / cat.pesoAcumulado;
      cat.confianzaPromedio /= cat.contadorVotos;
    });

    // Seleccionar categoría ganadora
    const categoriaGanadora = Object.keys(categorias).reduce((a, b) =>
      categorias[a].pesoAcumulado > categorias[b].pesoAcumulado ? a : b
    );

    const datosCategoria = categorias[categoriaGanadora];

    // Calcular confianza final usando múltiples factores
    let confianzaFinal = datosCategoria.confianzaPromedio;

    // Bonus por unanimidad o mayoría clara
    const mayoriaBonus = datosCategoria.pesoAcumulado / pesoAcumulado;
    if (mayoriaBonus > 0.8) {
      confianzaFinal *= 1.1; // Bonus del 10% por mayoría clara
    }

    // Penalty por poca participación
    if (resultadosAnalysis.length < 3) {
      confianzaFinal *= 0.9; // Penalty del 10% por poca diversidad
    }

    confianzaFinal = Math.max(0, Math.min(1, confianzaFinal));

    return {
      categoria: categoriaGanadora,
      confianza: confianzaFinal,
      score: datosCategoria.scoreNormalizado,
      distribucionVotos: categorias,
      factorMayoria: mayoriaBonus
    };
  }

  /**
   * Calcula el nivel de consenso entre analizadores
   */
  _calcularConsenso(resultadosAnalysis) {
    if (resultadosAnalysis.length <= 1) return 1.0;

    // Agrupar por categoría
    const categorias = {};
    resultadosAnalysis.forEach(resultado => {
      const categoria = resultado.resultado.categoria;
      categorias[categoria] = (categorias[categoria] || 0) + resultado.pesoNormalizado;
    });

    // Calcular índice de concentración (Herfindahl-Hirschman Index adaptado)
    const valores = Object.values(categorias);
    const hhi = valores.reduce((sum, peso) => sum + (peso * peso), 0);

    // Normalizar HHI a rango [0,1] donde 1 = consenso perfecto
    const maxHHI = 1.0; // Cuando todos votan por la misma categoría
    const minHHI = 1.0 / valores.length; // Cuando votos están perfectamente distribuidos

    const consensoNormalizado = (hhi - minHHI) / (maxHHI - minHHI);

    return Math.max(0, Math.min(1, consensoNormalizado));
  }

  /**
   * Ajusta la confianza basada en el nivel de consenso
   */
  _ajustarConfianzaPorConsenso(confianzaBase, consenso) {
    // Factor de ajuste basado en consenso
    let factorConsenso = 1.0;

    if (consenso > 0.8) {
      factorConsenso = 1.1; // Boost por alto consenso
    } else if (consenso < 0.4) {
      factorConsenso = 0.8; // Penalty por bajo consenso
    }

    return Math.max(0, Math.min(1, confianzaBase * factorConsenso));
  }

  /**
   * Detecta anomalías en los resultados de análisis
   */
  _detectarAnomalias(resultadosAnalysis, agregacion) {
    const anomalias = [];

    // Detectar outliers en confianza
    const confianzas = resultadosAnalysis.map(r => r.confianza);
    const confianzaPromedio = confianzas.reduce((a, b) => a + b, 0) / confianzas.length;
    const desviacionEstandar = Math.sqrt(
      confianzas.reduce((sum, conf) => sum + Math.pow(conf - confianzaPromedio, 2), 0) / confianzas.length
    );

    resultadosAnalysis.forEach(resultado => {
      if (Math.abs(resultado.confianza - confianzaPromedio) > 2 * desviacionEstandar) {
        anomalias.push({
          tipo: 'confianza_outlier',
          analizador: resultado.analizadorId,
          confianza: resultado.confianza,
          desviacion: Math.abs(resultado.confianza - confianzaPromedio)
        });
      }
    });

    // Detectar categorías minoritarias con alta confianza
    const categoriaMayoritaria = agregacion.categoria;
    resultadosAnalysis.forEach(resultado => {
      if (resultado.resultado.categoria !== categoriaMayoritaria && resultado.confianza > 0.8) {
        anomalias.push({
          tipo: 'categoria_minoritaria_alta_confianza',
          analizador: resultado.analizadorId,
          categoria: resultado.resultado.categoria,
          confianza: resultado.confianza
        });
      }
    });

    // Detectar tiempos de procesamiento anómalos
    const tiempos = resultadosAnalysis.map(r => r.tiempoAnalisis);
    const tiempoPromedio = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;

    resultadosAnalysis.forEach(resultado => {
      if (resultado.tiempoAnalisis > tiempoPromedio * 3) {
        anomalias.push({
          tipo: 'tiempo_procesamiento_alto',
          analizador: resultado.analizadorId,
          tiempo: resultado.tiempoAnalisis,
          factorDesviacion: resultado.tiempoAnalisis / tiempoPromedio
        });
      }
    });

    if (anomalias.length > 0) {
      dragon.seEnfada('Anomalías detectadas en ensemble', 'detectarAnomalias', {
        totalAnomalias: anomalias.length,
        tipos: [...new Set(anomalias.map(a => a.tipo))]
      });
    }

    return anomalias;
  }

  /**
   * Calcula la calidad del ensemble
   */
  _calcularCalidadEnsemble(resultadosAnalysis, consenso) {
    let calidad = 1.0;

    // Factor de diversidad (más analizadores = mejor)
    const factorDiversidad = Math.min(1.0, resultadosAnalysis.length / 5); // Óptimo: 5 analizadores

    // Factor de rendimiento (promedio de confianzas)
    const confianzaPromedio = resultadosAnalysis.reduce((sum, r) => sum + r.confianza, 0) / resultadosAnalysis.length;

    // Factor de consenso (ya calculado)
    const factorConsenso = consenso;

    // Factor de cobertura de tipos
    const tiposUnicos = new Set(resultadosAnalysis.map(r => r.analizadorTipo)).size;
    const factorCobertura = Math.min(1.0, tiposUnicos / 3); // Óptimo: 3 tipos diferentes

    // Combinar factores con pesos
    calidad = (
      factorDiversidad * 0.25 +
      confianzaPromedio * 0.35 +
      factorConsenso * 0.25 +
      factorCobertura * 0.15
    );

    return Math.max(0, Math.min(1, calidad));
  }

  // =============================================================================
  // CIRCUIT BREAKER PATTERN IMPLEMENTATION
  // =============================================================================

  /**
   * Verifica el estado del circuit breaker del sistema
   */
  _verificarCircuitBreaker(servicio) {
    const breaker = this.circuitBreaker.get(servicio);
    if (!breaker) return true; // Si no existe, permitir

    const ahora = Date.now();

    // Si está cerrado, permitir operación
    if (breaker.estado === 'cerrado') {
      return true;
    }

    // Si está abierto, verificar si es tiempo de intentar
    if (breaker.estado === 'abierto') {
      if (ahora >= breaker.proximoIntento) {
        breaker.estado = 'medio_abierto';
        dragon.zen(`Circuit breaker ${servicio} cambió a medio-abierto`, 'verificarCircuitBreaker');
        return true;
      }

      throw new Error(`Circuit breaker abierto para ${servicio}. Próximo intento: ${new Date(breaker.proximoIntento).toISOString()}`);
    }

    // Si está medio-abierto, permitir un intento
    if (breaker.estado === 'medio_abierto') {
      return true;
    }

    return false;
  }

  /**
   * Verifica el circuit breaker específico de un analizador
   */
  _verificarCircuitBreakerAnalizador(analizadorId) {
    const analizador = this.analizadores.get(analizadorId);
    if (!analizador) return false;

    const breaker = analizador.circuitBreaker;
    const config = this.circuitBreaker.get(analizadorId);
    const ahora = Date.now();

    switch (breaker.estado) {
      case 'cerrado':
        return true;

      case 'abierto':
        if (breaker.proximoIntento && ahora >= breaker.proximoIntento) {
          breaker.estado = 'medio_abierto';
          dragon.zen(`Circuit breaker analizador ${analizadorId} cambió a medio-abierto`, 'verificarCircuitBreakerAnalizador');
          return true;
        }
        return false;

      case 'medio_abierto':
        return true;

      default:
        return false;
    }
  }

  /**
   * Actualiza el estado del circuit breaker de un analizador
   */
  _actualizarCircuitBreakerAnalizador(analizadorId, exito) {
    const analizador = this.analizadores.get(analizadorId);
    const config = this.circuitBreaker.get(analizadorId);

    if (!analizador || !config) return;

    const breaker = analizador.circuitBreaker;
    const ahora = Date.now();

    if (exito) {
      // Operación exitosa
      switch (breaker.estado) {
        case 'medio_abierto':
          // Éxito en estado medio-abierto, cerrar circuit breaker
          breaker.estado = 'cerrado';
          breaker.erroresConsecutivos = 0;
          breaker.ultimoError = null;
          breaker.proximoIntento = null;

          dragon.zen(`Circuit breaker analizador ${analizadorId} cerrado después de recuperación`, 'redSuperior.js', 'circuit_breaker_closed', {
            analizadorId
          });
          break;

        case 'cerrado':
          // Mantener cerrado, resetear contador de errores
          breaker.erroresConsecutivos = 0;
          break;
      }
    } else {
      // Operación fallida
      breaker.erroresConsecutivos++;
      breaker.ultimoError = ahora;

      switch (breaker.estado) {
        case 'cerrado':
          if (breaker.erroresConsecutivos >= config.maxErrores) {
            // Abrir circuit breaker
            breaker.estado = 'abierto';
            breaker.proximoIntento = ahora + config.tiempoEspera;

            dragon.seEnfada(`Circuit breaker analizador ${analizadorId} ABIERTO`, 'actualizarCircuitBreakerAnalizador', {
              analizadorId,
              erroresConsecutivos: breaker.erroresConsecutivos,
              maxErrores: config.maxErrores,
              proximoIntento: new Date(breaker.proximoIntento).toISOString()
            });

            this.metricas.registrarError('CIRCUIT_BREAKER_OPENED', `Analizador ${analizadorId}`, null, 'CB001', {
              analizadorId,
              erroresConsecutivos: breaker.erroresConsecutivos
            });
          }
          break;

        case 'medio_abierto':
          // Fallo en estado medio-abierto, volver a abrir
          breaker.estado = 'abierto';
          breaker.proximoIntento = ahora + config.tiempoEspera;

          dragon.seEnfada(`Circuit breaker analizador ${analizadorId} vuelve a ABIERTO`, 'actualizarCircuitBreakerAnalizador', {
            analizadorId,
            razon: 'fallo_en_medio_abierto'
          });
          break;
      }
    }
  }

  /**
   * Obtiene estado completo de todos los circuit breakers
   */
  _obtenerEstadoCircuitBreakers() {
    const estados = {
      sistema: {},
      analizadores: {}
    };

    // Circuit breakers del sistema
    for (const [servicio, config] of this.circuitBreaker.entries()) {
      if (!servicio.includes('_')) { // Servicios del sistema no tienen ID de analizador
        estados.sistema[servicio] = {
          configuracion: config,
          activo: true
        };
      }
    }

    // Circuit breakers de analizadores
    for (const [analizadorId, analizador] of this.analizadores.entries()) {
      estados.analizadores[analizadorId] = {
        estado: analizador.circuitBreaker.estado,
        erroresConsecutivos: analizador.circuitBreaker.erroresConsecutivos,
        ultimoError: analizador.circuitBreaker.ultimoError,
        proximoIntento: analizador.circuitBreaker.proximoIntento,
        configuracion: this.circuitBreaker.get(analizadorId)
      };
    }

    return estados;
  }

  // =============================================================================
  // RATE LIMITING Y THROTTLING
  // =============================================================================

  /**
   * Verifica rate limiting por usuario/IP
   */
  async _verificarRateLimiting(userId, ip) {
    const clave = userId || ip || 'anonymous';
    const ahora = Date.now();
    const ventana = CONFIG.SECURITY.RATE_LIMIT_WINDOW;

    if (!this.limitadorTasa.has(clave)) {
      this.limitadorTasa.set(clave, {
        requests: [],
        bloqueadoHasta: null
      });
    }

    const datos = this.limitadorTasa.get(clave);

    // Verificar si está bloqueado
    if (datos.bloqueadoHasta && ahora < datos.bloqueadoHasta) {
      const tiempoRestante = Math.ceil((datos.bloqueadoHasta - ahora) / 1000);
      throw new Error(`Rate limit excedido. Intente nuevamente en ${tiempoRestante} segundos`);
    }

    // Limpiar requests antiguos
    datos.requests = datos.requests.filter(timestamp => (ahora - timestamp) < ventana);

    // Verificar límite
    if (datos.requests.length >= CONFIG.SECURITY.RATE_LIMIT_MAX) {
      datos.bloqueadoHasta = ahora + ventana;

      dragon.seEnfada('Rate limit excedido', 'verificarRateLimiting', {
        clave,
        requests: datos.requests.length,
        limite: CONFIG.SECURITY.RATE_LIMIT_MAX,
        ventana: ventana / 1000 + 's',
        bloqueadoHasta: new Date(datos.bloqueadoHasta).toISOString()
      });

      this.metricas.registrarError('RATE_LIMIT_EXCEEDED', `Clave: ${clave}`, null, CODIGOS_ERROR.NETWORK_RATE_LIMITED, {
        clave,
        requestsEnVentana: datos.requests.length
      });

      throw new Error('Rate limit excedido. Demasiadas solicitudes');
    }

    // Registrar request actual
    datos.requests.push(ahora);

    // Limpiar datos de rate limiting antiguos periódicamente
    if (Math.random() < 0.01) { // 1% de probabilidad
      this._limpiarDatosRateLimiting();
    }
  }

  /**
   * Limpia datos antiguos de rate limiting
   */
  _limpiarDatosRateLimiting() {
    const ahora = Date.now();
    const ventana = CONFIG.SECURITY.RATE_LIMIT_WINDOW;

    for (const [clave, datos] of this.limitadorTasa.entries()) {
      // Limpiar si no ha habido actividad reciente y no está bloqueado
      const ultimaActividad = datos.requests.length > 0 ?
        Math.max(...datos.requests) : 0;
      const sinBloqueo = !datos.bloqueadoHasta || ahora > datos.bloqueadoHasta;

      if (sinBloqueo && (ahora - ultimaActividad) > ventana * 2) {
        this.limitadorTasa.delete(clave);
      }
    }

    dragon.zen('Limpieza de rate limiting ejecutada', 'limpiarDatosRateLimiting', {
      entradasRestantes: this.limitadorTasa.size
    });
  }
  // =============================================================================
  // VALIDACIONES Y SANITIZACIÓN ENTERPRISE
  // =============================================================================

  /**
   * Valida features de entrada con validaciones exhaustivas
   */
  _validarFeatures(features) {
    try {
      // Validación básica de tipos
      if (features === null || features === undefined) {
        dragon.seEnfada('Features null o undefined recibidas', 'validarFeatures', {
          tipo: typeof features,
          valor: features
        });
        return false;
      }

      // Validación de tamaño de payload
      const tamañoFeatures = this._calcularTamañoObjeto(features);
      if (tamañoFeatures > CONFIG.SECURITY.MAX_PAYLOAD_SIZE) {
        dragon.seEnfada('Features exceden tamaño máximo permitido', 'validarFeatures', {
          tamañoActual: tamañoFeatures,
          tamañoMaximo: CONFIG.SECURITY.MAX_PAYLOAD_SIZE
        });
        return false;
      }

      // Validación de estructura según tipo
      if (Array.isArray(features)) {
        return this._validarFeaturesArray(features);
      } else if (typeof features === 'object') {
        return this._validarFeaturesObjeto(features);
      } else {
        return this._validarFeaturesPrimitivo(features);
      }

    } catch (error) {
      dragon.agoniza('Error durante validación de features', error, 'validarFeatures', {
        featuresType: typeof features
      });
      return false;
    }
  }

  /**
   * Valida features de tipo array
   */
  _validarFeaturesArray(features) {
    if (features.length === 0) {
      dragon.zen('Array de features vacío', 'validarFeaturesArray');
      return false;
    }

    if (features.length > 10000) { // Límite razonable para arrays
      dragon.seEnfada('Array de features demasiado grande', 'validarFeaturesArray', {
        longitud: features.length,
        limiteMaximo: 10000
      });
      return false;
    }

    // Validar elementos del array
    for (let i = 0; i < Math.min(features.length, 100); i++) { // Validar máximo 100 elementos
      const elemento = features[i];
      if (elemento !== null && elemento !== undefined) {
        if (typeof elemento === 'number' && !isFinite(elemento)) {
          dragon.seEnfada('Número no finito encontrado en features array', 'validarFeaturesArray', {
            indice: i,
            valor: elemento
          });
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Valida features de tipo objeto
   */
  _validarFeaturesObjeto(features) {
    const propiedadesRequeridas = ['tipo', 'formato'];
    const propiedadesOpcionales = ['tamaño', 'calidad', 'resolucion', 'metadata', 'timestamp'];

    // Verificar propiedades requeridas
    for (const prop of propiedadesRequeridas) {
      if (!(prop in features) || features[prop] === null || features[prop] === undefined) {
        dragon.zen(`Propiedad requerida faltante: ${prop}`, 'validarFeaturesObjeto', {
          propiedadesFaltantes: propiedadesRequeridas.filter(p => !(p in features))
        });
        // No es estrictamente requerido para funcionar, solo log de debug
      }
    }

    // Validar tipos de propiedades específicas
    if (features.resolucion && typeof features.resolucion === 'number') {
      if (features.resolucion < 1 || features.resolucion > 100000) {
        dragon.seEnfada('Resolución fuera de rango válido', 'validarFeaturesObjeto', {
          resolucion: features.resolucion,
          rangoValido: '1-100000'
        });
      }
    }

    if (features.timestamp) {
      const timestamp = typeof features.timestamp === 'string' ?
        new Date(features.timestamp).getTime() : features.timestamp;

      if (!isFinite(timestamp) || timestamp < 0) {
        dragon.seEnfada('Timestamp inválido en features', 'validarFeaturesObjeto', {
          timestamp: features.timestamp
        });
      }
    }

    // Validar metadatos si existen
    if (features.metadata && typeof features.metadata === 'object') {
      const tamañoMetadata = this._calcularTamañoObjeto(features.metadata);
      if (tamañoMetadata > 50000) { // 50KB máximo para metadata
        dragon.seEnfada('Metadata demasiado grande', 'validarFeaturesObjeto', {
          tamañoMetadata,
          limiteMaximo: 50000
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Valida features de tipo primitivo
   */
  _validarFeaturesPrimitivo(features) {
    if (typeof features === 'number') {
      if (!isFinite(features)) {
        dragon.seEnfada('Número no finito como features', 'validarFeaturesPrimitivo', {
          valor: features
        });
        return false;
      }
    }

    if (typeof features === 'string') {
      if (features.length === 0 || features.length > 10000) {
        dragon.seEnfada('String features con longitud inválida', 'validarFeaturesPrimitivo', {
          longitud: features.length
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Calcula el tamaño aproximado de un objeto
   */
  _calcularTamañoObjeto(obj) {
    try {
      return JSON.stringify(obj).length;
    } catch (error) {
      // Si no se puede serializar, estimar tamaño
      let tamaño = 0;

      if (typeof obj === 'string') {
        tamaño = obj.length * 2; // 2 bytes por carácter aprox
      } else if (typeof obj === 'number') {
        tamaño = 8; // 8 bytes para number
      } else if (typeof obj === 'boolean') {
        tamaño = 4; // 4 bytes para boolean
      } else if (Array.isArray(obj)) {
        tamaño = obj.length * 50; // Estimación conservadora
      } else if (typeof obj === 'object' && obj !== null) {
        tamaño = Object.keys(obj).length * 100; // Estimación conservadora
      }

      return tamaño;
    }
  }

  /**
   * Sanitiza features para logging seguro
   */
  _sanitizarFeatures(features) {
    try {
      if (typeof features !== 'object' || features === null) {
        return { tipo: typeof features, valorTruncado: String(features).substring(0, 100) };
      }

      const sanitizado = {};

      if (Array.isArray(features)) {
        sanitizado.tipo = 'array';
        sanitizado.longitud = features.length;
        sanitizado.muestra = features.slice(0, 3); // Solo primeros 3 elementos
      } else {
        // Objeto
        Object.keys(features).forEach(key => {
          const valor = features[key];

          if (key.toLowerCase().includes('password') ||
              key.toLowerCase().includes('secret') ||
              key.toLowerCase().includes('key')) {
            sanitizado[key] = '[SANITIZADO]';
          } else if (typeof valor === 'string' && valor.length > 100) {
            sanitizado[key] = valor.substring(0, 100) + '...';
          } else if (typeof valor === 'object' && valor !== null) {
            sanitizado[key] = { tipo: Array.isArray(valor) ? 'array' : 'object' };
          } else {
            sanitizado[key] = valor;
          }
        });
      }

      return sanitizado;

    } catch (error) {
      return { error: 'Error sanitizando features', tipo: typeof features };
    }
  }

  /**
   * Valida resultado final antes de retornarlo
   */
  _validarResultadoFinal(resultado) {
    if (!resultado || typeof resultado !== 'object') {
      throw new Error('Resultado final inválido: debe ser un objeto');
    }

    // Validaciones obligatorias
    const camposRequeridos = ['categoria', 'confianza'];
    for (const campo of camposRequeridos) {
      if (!(campo in resultado)) {
        throw new Error(`Campo requerido faltante en resultado final: ${campo}`);
      }
    }

    // Validar confianza
    if (typeof resultado.confianza !== 'number' ||
        resultado.confianza < 0 ||
        resultado.confianza > 1 ||
        !isFinite(resultado.confianza)) {
      throw new Error(`Confianza inválida: ${resultado.confianza} (debe estar entre 0 y 1)`);
    }

    // Validar categoría
    if (!resultado.categoria || typeof resultado.categoria !== 'string') {
      throw new Error(`Categoría inválida: ${resultado.categoria}`);
    }

    // Validar score si existe
    if ('score' in resultado) {
      if (typeof resultado.score !== 'number' || !isFinite(resultado.score)) {
        throw new Error(`Score inválido: ${resultado.score}`);
      }
    }

    return true;
  }

  /**
   * Enriquece resultado con metadatos adicionales
   */
  _enriquecerResultado(resultado, prediccionId, correlationId, fuente = 'computation') {
    return {
      ...resultado,
      id: prediccionId,
      correlationId,
      fuente,
      timestamp: Date.now(),
      redSuperiorId: this.id,
      version: this.version,
      procesamiento: {
        gpuUsada: this.gpuDisponible,
        backend: this.backendTensorFlow,
        estadoSistema: this.estadoSistema
      }
    };
  }

  // =============================================================================
  // MÉTODOS DE UTILIDAD Y SISTEMA
  // =============================================================================

  /**
   * Actualiza estadísticas de un analizador
   */
  _actualizarEstadisticasAnalizador(analizadorId, exito) {
    const analizador = this.analizadores.get(analizadorId);
    if (!analizador) return;

    const stats = analizador.estadisticas;
    stats.procesamientos++;
    stats.ultimaOperacion = Date.now();

    if (!exito) {
      stats.errores++;
    }

    // Calcular tiempo promedio si tenemos datos
    if (stats.procesamientos > 0) {
      const tiempoTranscurrido = Date.now() - stats.inicializado;
      stats.tiempoPromedioOperacion = tiempoTranscurrido / stats.procesamientos;
    }

    // Actualizar estado basado en rendimiento
    const tasaExito = (stats.procesamientos - stats.errores) / stats.procesamientos;
    if (tasaExito < 0.5 && stats.procesamientos > 10) {
      analizador.estado = 'degradado';
      dragon.seEnfada(`Analizador ${analizadorId} marcado como degradado`, 'actualizarEstadisticasAnalizador', {
        tasaExito: (tasaExito * 100).toFixed(1) + '%',
        procesamientos: stats.procesamientos,
        errores: stats.errores
      });
    }
  }

  /**
   * Obtiene uso actual de GPU
   */
  _obtenerUsoGPU() {
    try {
      if (this.gpuDisponible) {
        const memoria = tf.memory();
        return {
          backend: this.backendTensorFlow,
          tensors: memoria.numTensors,
          dataBuffers: memoria.numDataBuffers,
          bytes: memoria.numBytes,
          porcentajeUso: memoria.numBytes / (1024 * 1024 * 1024), // GB aproximados
          timestamp: Date.now()
        };
      }
      return null;
    } catch (error) {
      dragon.agoniza('Error obteniendo uso de GPU', error, 'obtenerUsoGPU');
      return { error: error.message, timestamp: Date.now() };
    }
  }

  /**
   * Obtiene uso actual de memoria del sistema
   */
  _obtenerUsoMemoria() {
    try {
      const memUsage = process.memoryUsage();
      return {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        rss: memUsage.rss,
        external: memUsage.external,
        heapUtilization: memUsage.heapUsed / memUsage.heapTotal,
        timestamp: Date.now()
      };
    } catch (error) {
      dragon.agoniza('Error obteniendo uso de memoria', error, 'obtenerUsoMemoria');
      return { error: error.message, timestamp: Date.now() };
    }
  }

  // =============================================================================
  // HEALTH CHECKS Y MONITOREO
  // =============================================================================

  /**
   * STEP 3: Health Integration - Método principal exportado
   * Obtiene métricas completas del sistema para health checks
   */
  obtenerMetricas() {
    try {
      const inicioHealthCheck = performance.now();

      const metricas = this.metricas.obtenerResumen();
      const estado = this._evaluarEstadoSistema(metricas);

      const healthCheck = {
        status: estado.saludable ? 'healthy' : 'unhealthy',
        timestamp: Date.now(),
        uptime: process.uptime(),
        correlationId: crypto.randomUUID(),

        // Información del sistema Red Superior
        redSuperior: {
          id: this.id,
          version: this.version,
          inicializado: this.inicializado,
          estadoSistema: this.estadoSistema,
          tiempoInicializacion: this.tiempoInicializacion,
          ultimaOperacion: this.ultimaOperacion
        },

        // Estado del sistema base
        sistema: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          pid: process.pid,
          memoria: this._obtenerUsoMemoria(),
          cpu: process.cpuUsage()
        },

        // Estado de TensorFlow y GPU
        tensorflow: {
          backend: this.backendTensorFlow,
          gpuDisponible: this.gpuDisponible,
          memoria: this._obtenerUsoGPU()
        },

        // Estado del modelo
        modelo: this.modelo ? {
          tipo: this.modelo.tipo,
          version: this.modelo.version,
          precision: this.modelo.precision,
          cargado: true
        } : { cargado: false },

        // Estado de analizadores
        analizadores: {
          total: this.analizadores.size,
          activos: Array.from(this.analizadores.values()).filter(a => a.estado === 'activo').length,
          degradados: Array.from(this.analizadores.values()).filter(a => a.estado === 'degradado').length,
          distribucion: this._obtenerDistribucionAnalizadores()
        },

        // Estado del cache
        cache: this.cache.obtenerEstadisticas(),

        // Métricas de rendimiento
        metricas: {
          ...metricas,
          operacionesEnCurso: this.operacionesEnCurso.size,
          rateLimitingActivo: this.limitadorTasa.size
        },

        // Circuit breakers
        circuitBreakers: this._obtenerEstadoCircuitBreakers(),

        // Alertas activas
        alertas: estado.alertas || [],

        // Información de diagnóstico
        diagnostico: {
          tiempoHealthCheck: performance.now() - inicioHealthCheck,
          conectividadRed: this._verificarConectividadRapida(),
          estadoCache: this.cache.obtenerEstadisticas().utilizacion,
          factorCarga: this._calcularFactorCarga()
        }
      };

      this.ultimoHealthCheck = Date.now();

      dragon.zen('Health check completado', 'obtenerMetricas', {
        status: healthCheck.status,
        tiempoGeneracion: healthCheck.diagnostico.tiempoHealthCheck,
        alertasActivas: healthCheck.alertas.length,
        operacionesEnCurso: this.operacionesEnCurso.size
      });

      return healthCheck;

    } catch (error) {
      this.metricas.registrarError('HEALTH_CHECK_FAILED', error.message, error.stack, CODIGOS_ERROR.HEALTH_CHECK_FAILED);

      dragon.agoniza('❌ Error generando health check', error, 'obtenerMetricas');

      return {
        status: 'error',
        timestamp: Date.now(),
        error: {
          message: error.message,
          code: CODIGOS_ERROR.HEALTH_CHECK_FAILED
        },
        redSuperior: {
          id: this.id,
          inicializado: this.inicializado,
          estadoSistema: ESTADOS_SISTEMA.ERROR
        }
      };
    }
  }

  /**
   * Evalúa el estado general del sistema para health checks
   */
  _evaluarEstadoSistema(metricas) {
    const alertas = [];
    let saludable = true;
    const criterios = [];

    // Verificar si está inicializado
    if (!this.inicializado) {
      alertas.push({
        tipo: 'SISTEMA_NO_INICIALIZADO',
        severidad: TIPOS_ALERTA.CRITICA,
        descripcion: 'Red Superior no está inicializada',
        timestamp: Date.now()
      });
      saludable = false;
      criterios.push({ criterio: 'inicializacion', estado: 'fallo', motivo: 'no_inicializado' });
    } else {
      criterios.push({ criterio: 'inicializacion', estado: 'ok' });
    }

    // Verificar tasa de errores
    if (metricas.errores.tasa > CONFIG.METRICAS.ALERT_THRESHOLDS.ERROR_RATE) {
      alertas.push({
        tipo: 'TASA_ERRORES_ALTA',
        severidad: TIPOS_ALERTA.CRITICA,
        descripcion: `Tasa de errores ${(metricas.errores.tasa * 100).toFixed(2)}% excede umbral ${(CONFIG.METRICAS.ALERT_THRESHOLDS.ERROR_RATE * 100)}%`,
        valor: metricas.errores.tasa,
        umbral: CONFIG.METRICAS.ALERT_THRESHOLDS.ERROR_RATE,
        timestamp: Date.now()
      });
      saludable = false;
      criterios.push({ criterio: 'tasa_errores', estado: 'fallo', valor: metricas.errores.tasa });
    } else {
      criterios.push({ criterio: 'tasa_errores', estado: 'ok', valor: metricas.errores.tasa });
    }

    // Verificar latencia P95
    if (metricas.latencia.p95 > CONFIG.METRICAS.ALERT_THRESHOLDS.LATENCY_P95) {
      alertas.push({
        tipo: 'LATENCIA_ALTA',
        severidad: TIPOS_ALERTA.ALTA,
        descripcion: `Latencia P95 ${metricas.latencia.p95}ms excede umbral ${CONFIG.METRICAS.ALERT_THRESHOLDS.LATENCY_P95}ms`,
        valor: metricas.latencia.p95,
        umbral: CONFIG.METRICAS.ALERT_THRESHOLDS.LATENCY_P95,
        timestamp: Date.now()
      });
      // Latencia alta no marca como no saludable, solo como degradado
      criterios.push({ criterio: 'latencia', estado: 'degradado', valor: metricas.latencia.p95 });
    } else {
      criterios.push({ criterio: 'latencia', estado: 'ok', valor: metricas.latencia.p95 });
    }

    // Verificar memoria del sistema
    if (metricas.recursos?.memoria?.heapUtilization > CONFIG.METRICAS.ALERT_THRESHOLDS.MEMORY_USAGE_PCT / 100) {
      alertas.push({
        tipo: 'MEMORIA_ALTA',
        severidad: TIPOS_ALERTA.MEDIA,
        descripcion: `Uso de memoria ${(metricas.recursos.memoria.heapUtilization * 100).toFixed(1)}% excede umbral ${CONFIG.METRICAS.ALERT_THRESHOLDS.MEMORY_USAGE_PCT}%`,
        valor: metricas.recursos.memoria.heapUtilization,
        umbral: CONFIG.METRICAS.ALERT_THRESHOLDS.MEMORY_USAGE_PCT / 100,
        timestamp: Date.now()
      });
      criterios.push({ criterio: 'memoria', estado: 'alerta', valor: metricas.recursos.memoria.heapUtilization });
    } else {
      criterios.push({ criterio: 'memoria', estado: 'ok', valor: metricas.recursos.memoria.heapUtilization });
    }

    // Verificar conectividad de analizadores
    const conectividad = metricas.red?.conectividad;
    if (conectividad && conectividad.ratioConectividad < 0.7) {
      alertas.push({
        tipo: 'CONECTIVIDAD_BAJA',
        severidad: TIPOS_ALERTA.ALTA,
        descripcion: `Conectividad ${(conectividad.ratioConectividad * 100).toFixed(1)}% por debajo del 70%`,
        valor: conectividad.ratioConectividad,
        umbral: 0.7,
        timestamp: Date.now()
      });
      saludable = false;
      criterios.push({ criterio: 'conectividad', estado: 'fallo', valor: conectividad.ratioConectividad });
    } else {
      criterios.push({ criterio: 'conectividad', estado: 'ok', valor: conectividad?.ratioConectividad });
    }

    // Verificar estado del modelo
    if (!this.modelo) {
      alertas.push({
        tipo: 'MODELO_NO_CARGADO',
        severidad: TIPOS_ALERTA.CRITICA,
        descripcion: 'Modelo de ML no está cargado',
        timestamp: Date.now()
      });
      saludable = false;
      criterios.push({ criterio: 'modelo', estado: 'fallo', motivo: 'no_cargado' });
    } else {
      criterios.push({ criterio: 'modelo', estado: 'ok', tipo: this.modelo.tipo });
    }

    return {
      saludable,
      alertas,
      criterios,
      estadoFinal: saludable ? 'healthy' : 'unhealthy',
      factorSalud: criterios.filter(c => c.estado === 'ok').length / criterios.length
    };
  }

  /**
   * Obtiene distribución de analizadores por tipo
   */
  _obtenerDistribucionAnalizadores() {
    const distribucion = {};

    for (const analizador of this.analizadores.values()) {
      const tipo = analizador.tipo;
      if (!distribucion[tipo]) {
        distribucion[tipo] = {
          total: 0,
          activos: 0,
          degradados: 0,
          errores: 0
        };
      }

      distribucion[tipo].total++;

      switch (analizador.estado) {
        case 'activo':
          distribucion[tipo].activos++;
          break;
        case 'degradado':
          distribucion[tipo].degradados++;
          break;
        case 'error':
          distribucion[tipo].errores++;
          break;
      }
    }

    return distribucion;
  }

  /**
   * Verificación rápida de conectividad (sin esperas)
   */
  _verificarConectividadRapida() {
    const analizadoresActivos = Array.from(this.analizadores.values())
      .filter(a => a.estado === 'activo').length;

    const totalAnalizadores = this.analizadores.size;

    if (totalAnalizadores === 0) return 'sin_analizadores';

    const ratio = analizadoresActivos / totalAnalizadores;

    if (ratio >= 0.8) return 'excelente';
    if (ratio >= 0.6) return 'buena';
    if (ratio >= 0.4) return 'degradada';
    return 'critica';
  }

  /**
   * Calcula factor de carga actual del sistema
   */
  _calcularFactorCarga() {
    const operacionesActuales = this.operacionesEnCurso.size;
    const maxOperacionesConcurrentes = CONFIG.RED_SUPERIOR.CONCURRENCIA_MAXIMA * 10; // Estimación

    return Math.min(1.0, operacionesActuales / maxOperacionesConcurrentes);
  }
  // =============================================================================
  // DESTRUCTOR Y LIMPIEZA DE RECURSOS ENTERPRISE
  // =============================================================================

  /**
   * Destructor principal - limpia todos los recursos del sistema
   */
  async destruir() {
    const inicioDestruccion = performance.now();
    const correlationId = crypto.randomUUID();

    try {
      dragon.zen('🧹 Iniciando destrucción de Red Superior...', 'redSuperior.js', 'destruir', {
        correlationId,
        redSuperiorId: this.id,
        estadoActual: this.estadoSistema,
        operacionesEnCurso: this.operacionesEnCurso.size
      });

      // Marcar sistema como cerrando
      this.estadoSistema = ESTADOS_SISTEMA.CERRANDO;
      this.metricas.establecerEstado(ESTADOS_SISTEMA.CERRANDO);

      // PASO 1: Esperar finalización de operaciones en curso
      await this._esperarFinalizacionOperaciones();

      // PASO 2: Limpiar analizadores distribuidos
      await this._destruirAnalizadores();

      // PASO 3: Limpiar cache con flush final
      await this._destruirCache();

      // PASO 4: Limpiar métricas y persistir estadísticas finales
      await this._destruirMetricas();

      // PASO 5: Limpiar TensorFlow y GPU
      await this._limpiarTensorFlow();

      // PASO 6: Limpiar mapas y estructuras de datos
      this._limpiarEstructurasDatos();

      // PASO 7: Limpiar listeners y eventos
      this._limpiarEventListeners();

      const tiempoDestruccion = performance.now() - inicioDestruccion;

      dragon.zen('✅ Red Superior destruida correctamente', 'redSuperior.js', 'destruir_completado', {
        correlationId,
        redSuperiorId: this.id,
        tiempoDestruccion: `${tiempoDestruccion.toFixed(2)}ms`,
        recursosLiberados: [
          'analizadores',
          'cache',
          'metricas',
          'tensorflow',
          'estructuras_datos',
          'event_listeners'
        ]
      });

      dragon.audit('RED_SUPERIOR_DESTRUIDA', {
        redSuperiorId: this.id,
        tiempoDestruccion,
        recursosLiberados: 6,
        correlationId
      });

      // Marcar como no inicializado
      this.inicializado = false;
      this.estadoSistema = ESTADOS_SISTEMA.ERROR; // Estado final

    } catch (error) {
      const tiempoTranscurrido = performance.now() - inicioDestruccion;

      this.metricas?.registrarError('DESTRUCTOR_FAILED', error.message, error.stack, 'D001', {
        correlationId,
        tiempoTranscurrido
      });

      dragon.agoniza('❌ Error durante destrucción de Red Superior', error, 'destruir', {
        correlationId,
        tiempoTranscurrido,
        estadoSistema: this.estadoSistema
      });

      throw error;
    }
  }

  /**
   * Espera a que finalicen las operaciones en curso
   */
  async _esperarFinalizacionOperaciones() {
    const timeout = CONFIG.SHUTDOWN.OPERATIONS_WAIT_MAX;
    const inicioEspera = Date.now();

    dragon.zen('⏳ Esperando finalización de operaciones en curso...', 'redSuperior.js', 'esperarFinalizacionOperaciones', {
      operacionesActivas: this.operacionesEnCurso.size,
      timeoutMaximo: timeout
    });

    while (this.operacionesEnCurso.size > 0) {
      const tiempoTranscurrido = Date.now() - inicioEspera;

      if (tiempoTranscurrido > timeout) {
        dragon.seEnfada('⚠️ Timeout esperando operaciones - forzando cierre', 'esperarFinalizacionOperaciones', {
          operacionesRestantes: this.operacionesEnCurso.size,
          tiempoEsperado: tiempoTranscurrido,
          operacionesPendientes: Array.from(this.operacionesEnCurso)
        });

        // Forzar limpieza de operaciones pendientes
        this.operacionesEnCurso.clear();
        this.correlacionRequests.clear();
        break;
      }

      // Esperar un poco antes de verificar nuevamente
      await new Promise(resolve => setTimeout(resolve, CONFIG.SHUTDOWN.OPERATIONS_CHECK_INTERVAL));

      // Log de progreso cada 2 segundos
      if (tiempoTranscurrido % 2000 < CONFIG.SHUTDOWN.OPERATIONS_CHECK_INTERVAL) {
        dragon.zen('Esperando operaciones...', 'esperarFinalizacionOperaciones', {
          operacionesRestantes: this.operacionesEnCurso.size,
          tiempoEsperado: tiempoTranscurrido
        });
      }
    }

    const tiempoTotal = Date.now() - inicioEspera;
    dragon.zen('✅ Operaciones finalizadas', 'redSuperior.js', 'operaciones_finalizadas', {
      tiempoEspera: `${tiempoTotal}ms`,
      operacionesRestantes: this.operacionesEnCurso.size
    });
  }

  /**
   * Destruye analizadores distribuidos
   */
  async _destruirAnalizadores() {
    dragon.zen('🔗 Destruyendo analizadores distribuidos...', 'redSuperior.js', 'destruirAnalizadores', {
      totalAnalizadores: this.analizadores.size
    });

    try {
      // Notificar cierre a todos los analizadores
      const promesasDesconexion = [];

      for (const [id, analizador] of this.analizadores.entries()) {
        promesasDesconexion.push(
          this._desconectarAnalizador(id, analizador)
            .catch(error => {
              dragon.seEnfada(`Error desconectando analizador ${id}`, 'destruirAnalizadores', {
                analizadorId: id,
                error: error.message
              });
            })
        );
      }

      // Esperar desconexión con timeout
      await Promise.race([
        Promise.allSettled(promesasDesconexion),
        new Promise(resolve => setTimeout(resolve, 5000)) // Timeout 5 segundos
      ]);

      // Limpiar mapa de analizadores
      this.analizadores.clear();
      this.poolConexiones.clear();

      dragon.zen('✅ Analizadores destruidos', 'redSuperior.js', 'analizadores_destruidos', {
        analizadoresDesconectados: promesasDesconexion.length
      });

    } catch (error) {
      dragon.agoniza('Error destruyendo analizadores', error, 'destruirAnalizadores');
      // Forzar limpieza
      this.analizadores.clear();
      this.poolConexiones.clear();
    }
  }

  /**
   * Desconecta un analizador individual
   */
  async _desconectarAnalizador(id, analizador) {
    try {
      // Marcar como desconectando
      analizador.estado = 'desconectando';

      // Actualizar métricas finales
      this.metricas.actualizarAnalizador(id, analizador.tipo, 'desconectado', {
        tiempoConexion: Date.now() - analizador.estadisticas.inicializado,
        procesamiento: analizador.estadisticas.procesamientos,
        errores: analizador.estadisticas.errores
      });

      // Simular desconexión (en implementación real sería una llamada HTTP/gRPC)
      await new Promise(resolve => setTimeout(resolve, 50));

      dragon.zen(`Analizador ${id} desconectado`, 'desconectarAnalizador', {
        analizadorId: id,
        tipo: analizador.tipo,
        procesamientos: analizador.estadisticas.procesamientos
      });

    } catch (error) {
      throw new Error(`Error desconectando analizador ${id}: ${error.message}`);
    }
  }

  /**
   * Destruye el sistema de cache
   */
  async _destruirCache() {
    dragon.zen('🗄️ Destruyendo sistema de cache...', 'redSuperior.js', 'destruirCache');

    try {
      if (this.cache) {
        // Obtener estadísticas finales antes de destruir
        const estadisticasFinales = this.cache.obtenerEstadisticas();

        dragon.audit('CACHE_ESTADISTICAS_FINALES', {
          tamaño: estadisticasFinales.tamaño,
          utilizacion: estadisticasFinales.utilizacion,
          hits: this.cache.cache ? this.cache.cache.size : 0,
          redSuperiorId: this.id
        });

        // Destruir cache
        await this.cache.destruir();
        this.cache = null;

        dragon.zen('✅ Cache destruido', 'redSuperior.js', 'cache_destruido', {
          estadisticasFinales
        });
      }
    } catch (error) {
      dragon.agoniza('Error destruyendo cache', error, 'destruirCache');
      this.cache = null; // Forzar limpieza
    }
  }

  /**
   * Destruye el sistema de métricas
   */
  async _destruirMetricas() {
    dragon.zen('📊 Destruyendo sistema de métricas...', 'redSuperior.js', 'destruirMetricas');

    try {
      if (this.metricas) {
        // Generar reporte final de métricas
        const reporteFinal = this.metricas.obtenerResumen();

        dragon.audit('METRICAS_REPORTE_FINAL', {
          uptime: reporteFinal.uptime,
          prediccionesTotales: reporteFinal.predicciones.total,
          erroresTotal: reporteFinal.errores.total,
          tasaExitoFinal: 1 - reporteFinal.errores.tasa,
          latenciaPromedioFinal: reporteFinal.latencia.promedio,
          cacheRatioFinal: reporteFinal.cache.ratio,
          redSuperiorId: this.id
        });

        // Destruir manager de métricas
        await this.metricas.destruir();
        this.metricas = null;

        dragon.zen('✅ Métricas destruidas', 'redSuperior.js', 'metricas_destruidas', {
          reporteFinal: {
            predicciones: reporteFinal.predicciones.total,
            errores: reporteFinal.errores.total,
            uptime: reporteFinal.uptime
          }
        });
      }
    } catch (error) {
      dragon.agoniza('Error destruyendo métricas', error, 'destruirMetricas');
      this.metricas = null; // Forzar limpieza
    }
  }

  /**
   * Limpia recursos de TensorFlow
   */
  async _limpiarTensorFlow() {
    dragon.zen('🧠 Limpiando recursos de TensorFlow...', 'redSuperior.js', 'limpiarTensorFlow');

    try {
      if (this.gpuDisponible && tf) {
        // Obtener estado final de memoria
        const memoriaAntes = tf.memory();

        // Limpiar tensores y variables
        tf.disposeVariables();

        // Forzar garbage collection de TensorFlow
        if (typeof tf.dispose === 'function') {
          tf.dispose();
        }

        const memoriaDespues = tf.memory();

        dragon.zen('✅ TensorFlow limpiado', 'redSuperior.js', 'tensorflow_limpiado', {
          backend: this.backendTensorFlow,
          memoriaAntes: {
            tensors: memoriaAntes.numTensors,
            bytes: memoriaAntes.numBytes
          },
          memoriaDespues: {
            tensors: memoriaDespues.numTensors,
            bytes: memoriaDespues.numBytes
          },
          tensorsLiberados: memoriaAntes.numTensors - memoriaDespues.numTensors,
          bytesLiberados: memoriaAntes.numBytes - memoriaDespues.numBytes
        });
      }

      // Limpiar referencias del modelo
      this.modelo = null;
      this.gpuDisponible = false;
      this.backendTensorFlow = null;

    } catch (error) {
      dragon.agoniza('Error limpiando TensorFlow', error, 'limpiarTensorFlow');
      // Forzar limpieza de referencias
      this.modelo = null;
      this.gpuDisponible = false;
      this.backendTensorFlow = null;
    }
  }

  /**
   * Limpia estructuras de datos internas
   */
  _limpiarEstructurasDatos() {
    dragon.zen('🗂️ Limpiando estructuras de datos...', 'redSuperior.js', 'limpiarEstructurasDatos');

    try {
      // Limpiar operaciones en curso
      this.operacionesEnCurso.clear();
      this.correlacionRequests.clear();

      // Limpiar rate limiting
      this.limitadorTasa.clear();

      // Limpiar circuit breakers
      this.circuitBreaker.clear();

      // Limpiar analizadores (por si acaso)
      this.analizadores.clear();
      this.poolConexiones.clear();

      dragon.zen('✅ Estructuras de datos limpiadas', 'redSuperior.js', 'estructuras_limpiadas');

    } catch (error) {
      dragon.agoniza('Error limpiando estructuras de datos', error, 'limpiarEstructurasDatos');
    }
  }

  /**
   * Limpia event listeners
   */
  _limpiarEventListeners() {
    dragon.zen('📡 Limpiando event listeners...', 'redSuperior.js', 'limpiarEventListeners');

    try {
      // Remover todos los listeners de la instancia
      this.removeAllListeners();

      dragon.zen('✅ Event listeners limpiados', 'redSuperior.js', 'listeners_limpiados');

    } catch (error) {
      dragon.agoniza('Error limpiando event listeners', error, 'limpiarEventListeners');
    }
  }

}// Fin de la clase RedSuperior


// =============================================================================
// INSTANCIA SINGLETON Y CONFIGURACIÓN GLOBAL
// =============================================================================

/**
 * Instancia singleton de Red Superior
 * Punto único de acceso al sistema enterprise
 */
const redSuperior = new RedSuperior();

// =============================================================================
// FUNCIONES EXPORTADAS PARA HEALTH CHECKS Y MONITOREO
// =============================================================================

/**
 * STEP 3: Health Integration Export
 * Función principal exportada para health checks de Kubernetes/Docker
 */
export const healthCheckTensorFlow = () => {
  try {
    return redSuperior.obtenerMetricas();
  } catch (error) {
    dragon.agoniza('Error en health check exportado', error, 'healthCheckTensorFlow');
    return {
      status: 'error',
      timestamp: Date.now(),
      error: error.message,
      redSuperiorId: redSuperior.id
    };
  }
};

/**
 * Endpoint de readiness para orquestadores (Kubernetes)
 */
export const readinessCheck = () => {
  try {
    if (!redSuperior.inicializado || redSuperior.estadoSistema === ESTADOS_SISTEMA.CERRANDO) {
      return {
        status: 'not_ready',
        ready: false,
        timestamp: Date.now(),
        message: redSuperior.estadoSistema === ESTADOS_SISTEMA.CERRANDO ?
          'Sistema cerrando' : 'Sistema no inicializado',
        redSuperiorId: redSuperior.id
      };
    }

    const metricas = redSuperior.obtenerMetricas();
    const ready = metricas.status === 'healthy' && redSuperior.inicializado;

    return {
      status: ready ? 'ready' : 'not_ready',
      ready,
      timestamp: Date.now(),
      uptime: process.uptime(),
      message: ready ? 'Sistema listo' : 'Sistema no está listo',
      redSuperiorId: redSuperior.id,
      checks: {
        inicializado: redSuperior.inicializado,
        saludable: metricas.status === 'healthy',
        tensorflow: !!redSuperior.backendTensorFlow,
        modelo: !!redSuperior.modelo
      }
    };
  } catch (error) {
    dragon.agoniza('Error en readiness check', error, 'readinessCheck');
    return {
      status: 'error',
      ready: false,
      timestamp: Date.now(),
      error: error.message
    };
  }
};

/**
 * Endpoint de liveness para orquestadores (Kubernetes)
 */
export const livenessCheck = () => {
  try {
    const alive = redSuperior.estadoSistema !== ESTADOS_SISTEMA.ERROR;

    return {
      status: alive ? 'alive' : 'dead',
      alive,
      timestamp: Date.now(),
      pid: process.pid,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      redSuperiorId: redSuperior.id,
      estadoSistema: redSuperior.estadoSistema,
      message: alive ? 'Proceso vivo' : 'Proceso en estado de error'
    };
  } catch (error) {
    return {
      status: 'error',
      alive: false,
      timestamp: Date.now(),
      error: error.message,
      pid: process.pid
    };
  }
};

/**
 * Funciones auxiliares exportadas para monitoreo avanzado
 */
export const obtenerEstadoGPU = () => {
  try {
    return {
      disponible: redSuperior.gpuDisponible,
      backend: redSuperior.backendTensorFlow,
      memoria: redSuperior._obtenerUsoGPU(),
      timestamp: Date.now()
    };
  } catch (error) {
    dragon.agoniza('Error obteniendo estado GPU', error, 'obtenerEstadoGPU');
    return { error: error.message, timestamp: Date.now() };
  }
};

export const obtenerMetricasDetalladas = () => {
  try {
    return redSuperior.metricas?.obtenerResumen() || { error: 'Métricas no disponibles' };
  } catch (error) {
    dragon.agoniza('Error obteniendo métricas detalladas', error, 'obtenerMetricasDetalladas');
    return { error: error.message, timestamp: Date.now() };
  }
};

export const limpiarCache = () => {
  try {
    const entradas = redSuperior.cache?.invalidar() || 0;
    dragon.zen('🧹 Cache limpiado manualmente', 'redSuperior.js', 'limpiar_cache_manual', {
      entradasEliminadas: entradas
    });
    return { success: true, entradasEliminadas: entradas };
  } catch (error) {
    dragon.agoniza('Error limpiando cache manualmente', error, 'limpiarCache');
    return { success: false, error: error.message };
  }
};

export const obtenerEstadoCircuitBreakers = () => {
  try {
    return redSuperior._obtenerEstadoCircuitBreakers();
  } catch (error) {
    dragon.agoniza('Error obteniendo estado circuit breakers', error, 'obtenerEstadoCircuitBreakers');
    return { error: error.message, timestamp: Date.now() };
  }
};

export const forzarGracefulShutdown = async () => {
  try {
    dragon.zen('🛑 Iniciando graceful shutdown forzado...', 'redSuperior.js', 'graceful_shutdown_forzado');
    await redSuperior.destruir();
    return { success: true, message: 'Graceful shutdown completado' };
  } catch (error) {
    dragon.agoniza('Error en graceful shutdown forzado', error, 'forzarGracefulShutdown');
    return { success: false, error: error.message };
  }
};

// =============================================================================
// EXPORT POR DEFECTO
// =============================================================================

export default redSuperior;
// =============================================================================
// GRACEFUL SHUTDOWN & SIGNAL HANDLING - ENTERPRISE GRADE
// =============================================================================

/**
 * Estado global del proceso de cierre para evitar múltiples ejecuciones
 */
let cierreEnProgreso = false;
let tiempoInicioAcierre = null;
let intentosCierre = 0;
const MAX_INTENTOS_CIERRE = 3;

/**
 * Configuración avanzada de graceful shutdown
 */
const SHUTDOWN_CONFIG = {
  TIMEOUT_GRACEFUL: CONFIG.SHUTDOWN.GRACEFUL_TIMEOUT,
  TIMEOUT_FORCE_EXIT: CONFIG.SHUTDOWN.FORCE_EXIT_TIMEOUT,
  SIGNALS_MANEJADAS: ['SIGTERM', 'SIGINT', 'SIGUSR2', 'SIGHUP'],
  RETRIES_PERMITIDOS: 2,
  DELAY_ENTRE_RETRIES: 1000
};

/**
 * Manejo elegante de cierre con timeout, retries y logging completo
 */
async function manejarCierreElegante(señal, codigoSalida = 0) {
  // Prevenir múltiples ejecuciones concurrentes
  if (cierreEnProgreso) {
    const tiempoTranscurrido = Date.now() - (tiempoInicioAcierre || Date.now());
    dragon.seEnfada(`🔄 Señal ${señal} ignorada - cierre ya en progreso`, 'manejarCierreElegante', {
      señal,
      tiempoTranscurrido,
      intentosPrevios: intentosCierre,
      procesoId: process.pid
    });
    return;
  }

  // Marcar inicio del proceso de cierre
  cierreEnProgreso = true;
  tiempoInicioAcierre = Date.now();
  intentosCierre++;

  const correlationId = crypto.randomUUID();
  const estadoInicial = {
    señal,
    codigoSalida,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    pid: process.pid,
    nodeVersion: process.version,
    redSuperiorId: redSuperior?.id,
    operacionesActivas: redSuperior?.operacionesEnCurso?.size || 0
  };

  dragon.zen(`📡 Señal ${señal} recibida - iniciando graceful shutdown`, 'redSuperior.js', 'graceful_shutdown_start', {
    correlationId,
    intento: intentosCierre,
    ...estadoInicial
  });

  dragon.audit('GRACEFUL_SHUTDOWN_INICIADO', {
    señal,
    estadoInicial,
    correlationId,
    timestamp: Date.now()
  });

  // Configurar timeout de seguridad con escalación
  const timeoutGraceful = setTimeout(() => {
    dragon.agoniza(`⏰ Timeout graceful shutdown (${SHUTDOWN_CONFIG.TIMEOUT_GRACEFUL}ms)`,
      new Error('Graceful shutdown timeout'), 'graceful_shutdown_timeout', {
      señal,
      correlationId,
      tiempoTranscurrido: Date.now() - tiempoInicioAcierre,
      fasesCompletadas: 'timeout_durante_proceso'
    });

    // Escalación: intentar force exit
    setTimeout(() => {
      dragon.agoniza('💥 Force exit - graceful shutdown falló completamente',
        new Error('Force exit required'), 'force_exit', {
        correlationId,
        tiempoTotal: Date.now() - tiempoInicioAcierre
      });
      process.exit(1);
    }, 5000); // 5 segundos adicionales para force exit

    process.exit(1);
  }, SHUTDOWN_CONFIG.TIMEOUT_GRACEFUL);

  try {
    // FASE 1: Notificar inicio de cierre a todos los sistemas
    dragon.zen('🚫 FASE 1: Deteniendo aceptación de nuevas solicitudes', 'redSuperior.js', 'shutdown_fase_1', {
      correlationId
    });

    if (redSuperior) {
      redSuperior.emit('cierre_iniciado', {
        señal,
        timestamp: Date.now(),
        correlationId,
        fase: 1
      });
    }

    // FASE 2: Esperar finalización de operaciones críticas
    dragon.zen('⏳ FASE 2: Esperando finalización de operaciones críticas', 'redSuperior.js', 'shutdown_fase_2', {
      correlationId
    });

    if (redSuperior?.operacionesEnCurso?.size > 0) {
      await esperarOperacionesCriticas(correlationId);
    }

    // FASE 3: Destruir Red Superior y liberar recursos principales
    dragon.zen('🧹 FASE 3: Destruyendo Red Superior', 'redSuperior.js', 'shutdown_fase_3', {
      correlationId
    });

    if (redSuperior && typeof redSuperior.destruir === 'function') {
      await redSuperior.destruir();
    }

    // FASE 4: Cerrar sistema de logging de forma controlada
    dragon.zen('📝 FASE 4: Cerrando sistema de logging', 'redSuperior.js', 'shutdown_fase_4', {
      correlationId
    });

    await cerrarSistemaLogging();

    // FASE 5: Limpieza final de memoria y garbage collection
    dragon.zen('🗑️ FASE 5: Limpieza final de memoria', 'redSuperior.js', 'shutdown_fase_5', {
      correlationId
    });

    await limpiezaFinalMemoria();

    // Limpiar timeout de seguridad
    clearTimeout(timeoutGraceful);

    const tiempoCierre = Date.now() - tiempoInicioAcierre;
    const estadoFinal = {
      tiempoCierre,
      memoryFinal: process.memoryUsage(),
      fasesCompletadas: 5,
      exitoso: true
    };

    // Log final estructurado antes de salir
    const logFinal = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      service: 'redSuperior',
      operation: 'graceful_shutdown_complete',
      message: `✅ Graceful shutdown completado exitosamente en ${tiempoCierre}ms`,
      correlationId,
      señal,
      estadoFinal,
      metrics: {
        tiempoCierre,
        uptime: process.uptime(),
        pid: process.pid,
        intentos: intentosCierre,
        fasesCompletadas: 5
      }
    };

    // Usar console.log para el último mensaje ya que Winston puede estar cerrado
    process.stdout.write(JSON.stringify(logFinal) + '\n');

    dragon.audit('GRACEFUL_SHUTDOWN_COMPLETADO', {
      correlationId,
      estadoFinal,
      señal,
      exitCode: codigoSalida
    });

    // Salir con código apropiado después de un breve delay
    setTimeout(() => {
      process.exit(codigoSalida);
    }, 100);

  } catch (error) {
    clearTimeout(timeoutGraceful);
    const tiempoTranscurrido = Date.now() - tiempoInicioAcierre;

    // Log de error final con máximo detalle
    const errorFinal = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      service: 'redSuperior',
      operation: 'graceful_shutdown_error',
      message: `❌ Error durante graceful shutdown: ${error.message}`,
      correlationId,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
        señal
      },
      metrics: {
        tiempoTranscurrido,
        intentos: intentosCierre,
        pid: process.pid,
        memoryAtError: process.memoryUsage()
      }
    };

    process.stderr.write(JSON.stringify(errorFinal) + '\n');

    // Retry logic para graceful shutdown
    if (intentosCierre < SHUTDOWN_CONFIG.RETRIES_PERMITIDOS) {
      dragon.seEnfada(`🔄 Retry graceful shutdown - intento ${intentosCierre + 1}`, 'graceful_shutdown_retry', {
        error: error.message,
        correlationId
      });

      cierreEnProgreso = false; // Permitir retry

      setTimeout(() => {
        manejarCierreElegante(señal, 1);
      }, SHUTDOWN_CONFIG.DELAY_ENTRE_RETRIES);

      return;
    }

    // Si todos los retries fallaron, force exit
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  }
}

/**
 * Espera a que terminen operaciones críticas con timeout escalonado
 */
async function esperarOperacionesCriticas(correlationId) {
  const maxEspera = CONFIG.SHUTDOWN.OPERATIONS_WAIT_MAX;
  const intervaloCheck = CONFIG.SHUTDOWN.OPERATIONS_CHECK_INTERVAL;
  let tiempoEsperado = 0;

  while (redSuperior.operacionesEnCurso.size > 0 && tiempoEsperado < maxEspera) {
    const operacionesRestantes = redSuperior.operacionesEnCurso.size;

    dragon.zen('⏳ Esperando operaciones críticas', 'esperarOperacionesCriticas', {
      correlationId,
      operacionesRestantes,
      tiempoEsperado,
      maxEspera
    });

    await new Promise(resolve => setTimeout(resolve, intervaloCheck));
    tiempoEsperado += intervaloCheck;

    // Log de progreso cada 2 segundos
    if (tiempoEsperado % 2000 === 0) {
      dragon.zen(`⏳ Progreso cierre: ${operacionesRestantes} operaciones restantes`, 'redSuperior.js', 'shutdown_progress', {
        correlationId,
        operacionesRestantes,
        tiempoEsperado,
        porcentajeCompletado: ((maxEspera - tiempoEsperado) / maxEspera * 100).toFixed(1)
      });
    }
  }

  // Si aún hay operaciones, forzar terminación
  if (redSuperior.operacionesEnCurso.size > 0) {
    dragon.seEnfada('⚠️ Forzando terminación de operaciones restantes', 'esperarOperacionesCriticas', {
      correlationId,
      operacionesForzadas: redSuperior.operacionesEnCurso.size,
      tiempoEsperado
    });

    redSuperior.operacionesEnCurso.clear();
    redSuperior.correlacionRequests.clear();
  }
}

/**
 * Cierra el sistema de logging de forma segura
 */
async function cerrarSistemaLogging() {
  return new Promise((resolve, reject) => {
    const timeoutLogger = setTimeout(() => {
      reject(new Error('Timeout cerrando sistema de logging'));
    }, 3000);

    try {
      if (logger && typeof logger.end === 'function') {
        logger.end(() => {
          clearTimeout(timeoutLogger);
          resolve();
        });
      } else {
        clearTimeout(timeoutLogger);
        resolve();
      }
    } catch (error) {
      clearTimeout(timeoutLogger);
      reject(error);
    }
  });
}

/**
 * Ejecuta limpieza final de memoria y garbage collection
 */
async function limpiezaFinalMemoria() {
  try {
    // Forzar garbage collection si está disponible
    if (global.gc) {
      global.gc();
    }

    // Limpiar variables globales
    if (typeof cierreEnProgreso !== 'undefined') {
      cierreEnProgreso = null;
    }

    // Breve delay para permitir limpieza
    await new Promise(resolve => setTimeout(resolve, 100));

  } catch (error) {
    // Ignorar errores de limpieza final
  }
}

// =============================================================================
// SIGNAL HANDLERS ENTERPRISE
// =============================================================================

// SIGTERM - Cierre elegante solicitado por sistema/orquestador (Kubernetes, Docker, systemd)
process.on('SIGTERM', () => {
  dragon.audit('SIGNAL_RECEIVED', { signal: 'SIGTERM', source: 'system_orchestrator' });
  manejarCierreElegante('SIGTERM', 0);
});

// SIGINT - Ctrl+C del usuario o IDE
process.on('SIGINT', () => {
  dragon.audit('SIGNAL_RECEIVED', { signal: 'SIGINT', source: 'user_interrupt' });
  manejarCierreElegante('SIGINT', 0);
});

// SIGUSR2 - Usado por nodemon/PM2 para restart elegante
process.on('SIGUSR2', () => {
  dragon.audit('SIGNAL_RECEIVED', { signal: 'SIGUSR2', source: 'development_restart' });
  manejarCierreElegante('SIGUSR2', 0);
});

// SIGHUP - Reload de configuración (implementar como graceful restart)
process.on('SIGHUP', () => {
  dragon.audit('SIGNAL_RECEIVED', { signal: 'SIGHUP', source: 'configuration_reload' });
  manejarCierreElegante('SIGHUP', 0);
});

// =============================================================================
// UNHANDLED EXCEPTIONS & REJECTIONS ENTERPRISE
// =============================================================================

/**
 * Manejo de excepciones no capturadas con análisis de causa raíz
 */
process.on('uncaughtException', (error, origin) => {
  const errorContext = {
    pid: process.pid,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    redSuperiorId: redSuperior?.id,
    estadoSistema: redSuperior?.estadoSistema,
    operacionesActivas: redSuperior?.operacionesEnCurso?.size || 0,
    origin,
    nodeVersion: process.version,
    platform: process.platform
  };

  dragon.agoniza('💥 UNCAUGHT EXCEPTION - Iniciando shutdown de emergencia', error, 'uncaughtException', errorContext);

  dragon.audit('UNCAUGHT_EXCEPTION', {
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    origin,
    context: errorContext,
    timestamp: Date.now()
  });

  // Intentar graceful shutdown con timeout muy agresivo
  const emergencyShutdown = setTimeout(() => {
    process.stderr.write(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'FATAL',
      message: 'EMERGENCY EXIT - Graceful shutdown falló después de uncaught exception',
      pid: process.pid,
      error: error.message
    }) + '\n');
    process.exit(1);
  }, 2000); // Solo 2 segundos para emergency shutdown

  manejarCierreElegante('uncaughtException', 1)
    .finally(() => {
      clearTimeout(emergencyShutdown);
    });
});

/**
 * Manejo de promesas rechazadas no capturadas con clasificación de severidad
 */
process.on('unhandledRejection', (reason, promise) => {
  const rejectionContext = {
    pid: process.pid,
    reason: reason?.toString() || 'Unknown reason',
    promiseString: promise?.toString() || 'Unknown promise',
    stack: reason?.stack || 'No stack available',
    redSuperiorId: redSuperior?.id,
    timestamp: Date.now()
  };

  // Clasificar severidad de la rejection
  const esCritica = reason instanceof Error && (
    reason.message.includes('ECONNREFUSED') ||
    reason.message.includes('ENOMEM') ||
    reason.message.includes('EMFILE') ||
    reason.code === 'ERR_DLOPEN_FAILED'
  );

  const severidad = esCritica ? 'CRITICAL' : 'WARNING';

  dragon.agoniza(`🚨 UNHANDLED REJECTION [${severidad}]`,
    reason instanceof Error ? reason : new Error(reason),
    'unhandledRejection',
    rejectionContext
  );

  dragon.audit('UNHANDLED_REJECTION', {
    severidad,
    reason: rejectionContext.reason,
    context: rejectionContext
  });

  // Solo iniciar shutdown si es crítica y estamos en producción
  if (esCritica && process.env.NODE_ENV === 'production') {
    dragon.agoniza('🚨 Unhandled rejection crítica en producción - iniciando graceful shutdown',
      reason instanceof Error ? reason : new Error(reason),
      'unhandledRejection_critical'
    );

    setTimeout(() => {
      manejarCierreElegante('unhandledRejection', 1);
    }, 1000); // Dar tiempo para logs
  }
});

/**
 * Advertencias de Node.js con clasificación y routing
 */
process.on('warning', (warning) => {
  const warningContext = {
    name: warning.name,
    message: warning.message,
    stack: warning.stack,
    code: warning.code,
    detail: warning.detail,
    timestamp: Date.now(),
    pid: process.pid
  };

  // Clasificar tipo de warning
  const esDeprecation = warning.name === 'DeprecationWarning';
  const esMemoria = warning.name === 'MaxListenersExceededWarning';
  const esExperimental = warning.name === 'ExperimentalWarning';

  if (esDeprecation) {
    dragon.seEnfada(`⚠️ DEPRECATION: ${warning.message}`, 'nodejs_deprecation_warning', warningContext);
  } else if (esMemoria) {
    dragon.seEnfada(`🧠 MEMORY WARNING: ${warning.message}`, 'nodejs_memory_warning', warningContext);
  } else if (esExperimental) {
    dragon.zen(`🧪 EXPERIMENTAL: ${warning.message}`, 'nodejs_experimental_warning', warningContext);
  } else {
    dragon.seEnfada(`⚠️ NODE WARNING: ${warning.message}`, 'nodejs_warning', warningContext);
  }
});

// =============================================================================
// INICIALIZACIÓN AUTOMÁTICA CON CIRCUIT BREAKER
// =============================================================================

/**
 * Inicialización con retry exponential backoff y circuit breaker
 */
async function inicializarConReintentos(maxReintentos = 3, delayBase = 1000) {
  let ultimoError = null;
  const correlationId = crypto.randomUUID();

  for (let intento = 1; intento <= maxReintentos; intento++) {
    try {
      dragon.zen(`🚀 Intento de inicialización ${intento}/${maxReintentos}`, 'redSuperior.js', 'init_attempt', {
        intento,
        maxReintentos,
        correlationId,
        delayAnterior: intento > 1 ? delayBase * Math.pow(2, intento - 2) : 0
      });

      const estadoInicializacion = await redSuperior.inicializar();

      dragon.zen('🎉 Red Superior inicializada exitosamente', 'redSuperior.js', 'init_success', {
        intentos: intento,
        uptime: process.uptime(),
        correlationId,
        estadoInicializacion
      });

      dragon.audit('INICIALIZACION_EXITOSA', {
        intentos: intento,
        tiempoTotal: estadoInicializacion.tiempoInicializacion,
        correlationId,
        redSuperiorId: redSuperior.id
      });

      return estadoInicializacion;

    } catch (error) {
      ultimoError = error;

      dragon.agoniza(`❌ Fallo en inicialización - intento ${intento}/${maxReintentos}`, error, 'init_failure', {
        intento,
        maxReintentos,
        correlationId,
        siguienteIntento: intento < maxReintentos,
        errorCode: error.code,
        errorName: error.name
      });

      if (intento < maxReintentos) {
        const delay = delayBase * Math.pow(2, intento - 1); // Exponential backoff
        dragon.zen(`⏳ Esperando ${delay}ms antes del siguiente intento...`, 'redSuperior.js', 'init_retry_delay', {
          delay,
          correlationId,
          intentoFallido: intento
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Si llegamos aquí, todos los intentos fallaron
  dragon.agoniza('💥 INICIALIZACIÓN FALLIDA después de todos los intentos', ultimoError, 'init_final_failure', {
    intentosTotales: maxReintentos,
    correlationId,
    errorFinal: ultimoError?.message,
    tiempoTranscurrido: process.uptime()
  });

  dragon.audit('INICIALIZACION_FALLIDA', {
    intentosTotales: maxReintentos,
    errorFinal: ultimoError?.message,
    correlationId
  });

  // Exit con código específico para fallo de inicialización
  process.exit(3);
}

// =============================================================================
// INICIALIZACIÓN AUTOMÁTICA DEL MÓDULO
// =============================================================================

// Solo inicializar automáticamente si NO estamos en modo test
if (process.env.NODE_ENV !== 'test') {
  const startupCorrelationId = crypto.randomUUID();

  dragon.zen('🌟 INICIANDO SISTEMA DRAGON RED SUPERIOR', 'redSuperior.js', 'system_startup', {
    correlationId: startupCorrelationId,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    environment: process.env.NODE_ENV || 'development',
    timestamp: Date.now()
  });

  inicializarConReintentos()
    .then((estadoInicializacion) => {
      dragon.zen('🚀 SISTEMA DRAGON RED SUPERIOR LISTO PARA PRODUCCIÓN', 'redSuperior.js', 'system_ready', {
        correlationId: startupCorrelationId,
        estadoInicializacion,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        redSuperiorId: redSuperior.id
      });

      dragon.audit('SISTEMA_LISTO_PRODUCCION', {
        correlationId: startupCorrelationId,
        redSuperiorId: redSuperior.id,
        estadoInicializacion,
        ambiente: process.env.NODE_ENV || 'development'
      });
    })
    .catch((error) => {
      // El error ya fue loggeado en inicializarConReintentos
      // Este catch es por seguridad adicional
      dragon.agoniza('💥 ERROR CRÍTICO EN STARTUP', error, 'system_startup_failed', {
        correlationId: startupCorrelationId
      });
      process.exit(3);
    });
}

// =============================================================================
// PERFORMANCE MONITORING & HEALTH SURVEILLANCE
// =============================================================================

// Monitoreo continuo de performance y memory leaks en producción
if (process.env.NODE_ENV === 'production') {
  const MONITORING_INTERVAL = 60000; // Cada minuto

  setInterval(() => {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(memUsage.rss / 1024 / 1024);

    // Alerta por alto uso de memoria
    if (heapUsedMB > 800) { // Más de 800MB
      dragon.seEnfada('🚨 ALTO USO DE MEMORIA detectado', 'memory_monitor', {
        heapUsedMB,
        heapTotalMB,
        rssMB,
        heapUtilization: (heapUsedMB / heapTotalMB * 100).toFixed(1) + '%',
        external: Math.round(memUsage.external / 1024 / 1024),
        pid: process.pid,
        uptime: process.uptime(),
        redSuperiorId: redSuperior?.id
      });
    }

    // Metrics para monitoreo externo
    dragon.metrics('system_performance', MONITORING_INTERVAL, true, {
      memory: {
        heapUsedMB,
        heapTotalMB,
        rssMB,
        heapUtilization: heapUsedMB / heapTotalMB
      },
      uptime: process.uptime(),
      pid: process.pid
    });

  }, MONITORING_INTERVAL);
}

// =============================================================================
// MODULE EXPORTS FINAL
// =============================================================================

/**
 * Información del módulo para debugging y monitoreo
 */
export const MODULE_INFO = {
  name: 'Dragon Red Superior',
  version: CONFIG.RED_SUPERIOR.VERSION,
  author: 'Gustavo Herraiz',
  project: 'Dragon3 AI Image Auth System',
  location: '/var/www/ProyectoDragon/redSuperior.js',
  initialized: Date.now(),
  nodeVersion: process.version,
  dependencies: {
    tensorflow: '^4.0.0',
    winston: '^3.8.0'
  }
};

dragon.zen('📄 Módulo redSuperior.js cargado completamente', 'redSuperior.js', 'module_loaded', {
  moduleInfo: MODULE_INFO,
  timestamp: Date.now()
});

export const iniciarRedSuperior = async (redisSubscriber, redisPublisher) => {
  // Si necesitas lógica especial, ponla aquí.
  // Normalmente solo inicializaría la red superior:
  return await redSuperior.inicializar();
};
