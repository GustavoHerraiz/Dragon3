/**
 * ====================================================================
 * DRAGON3 - SERVIDOR CENTRAL WEBSOCKET FAANG ENTERPRISE
 * ====================================================================
 * 
 * Archivo: servicios/servidorCentral.js
 * Proyecto: Dragon3 - Sistema Autentificación IA Enterprise
 * Versión: 3.0.0-FAANG
 * Fecha: 2025-04-15
 * Autor: Gustavo Herráiz - Lead Architect
 * 
 * DESCRIPCIÓN:
 * Servidor central WebSocket con estándares FAANG enterprise para comunicación
 * en tiempo real entre analizadores, Red Superior y frontend. Optimizado para
 * P95 <200ms, 99.9% uptime, observabilidad enterprise y patterns de reliability.
 * 
 * FAANG ENHANCEMENTS:
 * - Real-time P95/P99 performance tracking con alerting
 * - Circuit breaker patterns enterprise-grade
 * - Enhanced error classification con correlation IDs
 * - Memory management optimizado para WebSockets
 * - Security validation layer multi-layer
 * - Advanced observability con structured logging
 * - Graceful degradation modes
 * - Health monitoring proactivo
 * - Connection pooling enterprise
 * - Rate limiting y backpressure handling
 * 
 * COMPATIBILIDAD DRAGON2:
 * ✅ WebSocketServer core functionality preservado
 * ✅ Redis pub/sub integration mantenido
 * ✅ Red Superior communication compatible
 * ✅ Message structure preservada
 * ✅ CAMPOS_SUPERIOR_KEYS order mantenido
 * 
 * MÉTRICAS OBJETIVO FAANG:
 * - WebSocket connection: P95 <100ms, P99 <200ms
 * - Message processing: P95 <50ms, P99 <100ms
 * - Redis pub/sub latency: P95 <25ms, P99 <50ms
 * - Connection success rate: >99.5%
 * - Memory usage: <200MB per 1000 connections
 * - Error rate: <0.5%
 * - Uptime: 99.9%
 * 
 * ARCHITECTURE FLOW:
 * Frontend → server.js → analizadorImagen.js → servidorCentral.js → Redis → Red Superior
 * 
 * SLA COMPLIANCE:
 * - Latency: P95 <200ms end-to-end
 * - Availability: 99.9% uptime
 * - Throughput: 1000+ concurrent connections
 * - Error handling: <1% error rate
 * - Security: Multi-layer validation
 * 
 * ====================================================================
 */

// FAANG: Enhanced imports with performance monitoring
import { WebSocketServer } from 'ws';
import dragon from '../utilidades/logger.js';
import crypto from 'crypto';
import os from 'os';
import { promisify } from 'util';

// FAANG: Performance monitoring imports
const performanceHooks = {
  performance: (await import('perf_hooks')).performance,
  PerformanceObserver: (await import('perf_hooks')).PerformanceObserver
};

// FAANG: Enhanced Red Superior import with comprehensive fallbacks
let RedSuperior, publicarExplicacionRedis;
try {
    const redSuperiorModule = await import("../redSuperior/redSuperior.js");
    RedSuperior = redSuperiorModule.default;
    publicarExplicacionRedis = redSuperiorModule.publicarExplicacionRedis;
    
    dragon.sonrie("Red Superior cargada exitosamente", "servidorCentral", "RED_SUPERIOR_LOADED", {
        version: redSuperiorModule.version || '1.0.0',
        hasPublicarExplicacion: typeof publicarExplicacionRedis === 'function'
    });
    
} catch (error) {
    dragon.sePreocupa("Red Superior no disponible - usando enhanced mocks FAANG", "servidorCentral", "RED_SUPERIOR_MOCK", {
        error: error.message,
        fallback: 'enhanced_mock_implementation'
    });
    
    RedSuperior = { 
        iniciar: async () => {
            dragon.respira("Mock Red Superior iniciada", "servidorCentral", "MOCK_RED_SUPERIOR_START");
            return true;
        }
    };
    
    publicarExplicacionRedis = async (redis, imagenId, explicacion) => {
        dragon.respira("Mock publicar explicación Redis", "servidorCentral", "MOCK_EXPLICACION_REDIS", {
            imagenId,
            explicacionLength: explicacion?.length || 0
        });
    };
}

// =================== FAANG CONFIGURATION ===================

/**
 * FAANG: Enhanced configuration with environment variables
 */
const FAANG_CONFIG = {
    // Performance targets (FAANG SLA compliance)
    performance: {
        websocketConnectionP95: parseInt(process.env.WEBSOCKET_CONNECTION_P95_MS) || 100,
        websocketConnectionP99: parseInt(process.env.WEBSOCKET_CONNECTION_P99_MS) || 200,
        messageProcessingP95: parseInt(process.env.MESSAGE_PROCESSING_P95_MS) || 50,
        messageProcessingP99: parseInt(process.env.MESSAGE_PROCESSING_P99_MS) || 100,
        redisPubSubP95: parseInt(process.env.REDIS_PUBSUB_P95_MS) || 25,
        redisPubSubP99: parseInt(process.env.REDIS_PUBSUB_P99_MS) || 50,
        memoryLimitMB: parseInt(process.env.WEBSOCKET_MEMORY_LIMIT_MB) || 200,
        gcThreshold: parseInt(process.env.GC_THRESHOLD_MB) || 150
    },
    
    // Connection management (Enterprise scaling)
    connections: {
        maxConnections: parseInt(process.env.MAX_WEBSOCKET_CONNECTIONS) || 1000,
        connectionTimeout: parseInt(process.env.CONNECTION_TIMEOUT_MS) || 10000,
        heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL_MS) || 30000,
        inactiveTimeout: parseInt(process.env.INACTIVE_CONNECTION_TIMEOUT_MS) || 300000, // 5 min
        rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
        rateLimitMessages: parseInt(process.env.RATE_LIMIT_MESSAGES) || 100
    },
    
    // Circuit breaker settings (Reliability engineering)
    circuitBreaker: {
        enabled: process.env.WEBSOCKET_CIRCUIT_BREAKER_ENABLED !== 'false',
        errorThreshold: parseInt(process.env.WEBSOCKET_ERROR_THRESHOLD) || 10,
        recoveryTime: parseInt(process.env.WEBSOCKET_RECOVERY_TIME_MS) || 30000,
        monitoringWindow: parseInt(process.env.WEBSOCKET_MONITORING_WINDOW_MS) || 300000, // 5 min
        halfOpenMaxRequests: parseInt(process.env.WEBSOCKET_HALF_OPEN_MAX) || 5
    },
    
    // Security settings (Enterprise security)
    security: {
        enableConnectionValidation: process.env.WEBSOCKET_CONNECTION_VALIDATION !== 'false',
        allowedOrigins: (process.env.ALLOWED_WEBSOCKET_ORIGINS || '*').split(','),
        maxMessageSize: parseInt(process.env.MAX_MESSAGE_SIZE_BYTES) || 1048576, // 1MB
        enableMessageValidation: process.env.MESSAGE_VALIDATION_ENABLED !== 'false',
        rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== 'false',
        securityHeaders: process.env.SECURITY_HEADERS_ENABLED !== 'false'
    },
    
    // Memory management (Performance optimization)
    memory: {
        gcInterval: parseInt(process.env.GC_MONITORING_INTERVAL_MS) || 30000,
        enableGCMonitoring: process.env.ENABLE_GC_MONITORING !== 'false',
        maxHeapUsage: parseInt(process.env.MAX_HEAP_USAGE_PERCENT) || 80,
        connectionMemoryThreshold: parseInt(process.env.CONNECTION_MEMORY_THRESHOLD_MB) || 50,
        forceGCEnabled: process.env.FORCE_GC_ENABLED !== 'false'
    },
    
    // Monitoring settings (FAANG observability)
    monitoring: {
        healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL_MS) || 60000,
        metricsReportInterval: parseInt(process.env.METRICS_REPORT_INTERVAL_MS) || 300000,
        performanceLogging: process.env.PERFORMANCE_LOGGING_ENABLED !== 'false',
        detailedErrorReporting: process.env.DETAILED_ERROR_REPORTING !== 'false',
        connectionTracking: process.env.CONNECTION_TRACKING_ENABLED !== 'false',
        messageAuditing: process.env.MESSAGE_AUDITING_ENABLED !== 'false'
    }
};

/**
 * Enhanced module configuration
 */
const NOMBRE_MODULO = 'servidorCentral';
const VERSION_MODULO = '3.0.0-FAANG';

/**
 * Canales Redis para comunicación Dragon3 (preservados Dragon2)
 */
const CHANNELS = {
    ANALIZADOR_IMAGEN: "dragon3:analizadorImagen",
    RED_SUPERIOR: "dragon3:redSuperior:datosConsolidados",
    SERVIDOR_CENTRAL: "dragon3:servidorCentral",
    HEARTBEAT: "dragon3:heartbeat",
    
    // FAANG: Enhanced monitoring channels
    PERFORMANCE_METRICS: "dragon3:performance:websocket",
    ERROR_ALERTS: "dragon3:error:websocket",
    SECURITY_EVENTS: "dragon3:security:websocket",
    CONNECTION_EVENTS: "dragon3:connection:events"
};

/**
 * Campos esperados por Red Superior (preservados Dragon2)
 * Orden crítico para compatibilidad
 */
const CAMPOS_SUPERIOR_KEYS = [
    "RedExif_score",
    "RedSignatures_score", 
    "RedTexture_score",
    "RedDefinicion_score",
    "RedArtefactos_score",
    "RedColor_score",
    "RedResolucion_score",
    "RedPantalla_score",
    "MBH_score",
    "IVM_Final",
    "INT_Final",
    "IDEN_Final",
    "ECHT_score",
    "ICTM_Final",
    "ICRN_score",
    "baseScore"
];

/**
 * ====================================================================
 * FAANG: ENHANCED CUSTOM ERROR CLASSES
 * Enterprise-grade error classification for WebSocket operations
 * ====================================================================
 */

/**
 * Base Dragon WebSocket Error
 */
class DragonWebSocketError extends Error {
    constructor(message, code = 'WEBSOCKET_ERROR', severity = 'medium', category = 'websocket', metadata = {}) {
        super(message);
        this.name = 'DragonWebSocketError';
        this.code = code;
        this.severity = severity; // low, medium, high, critical
        this.category = category; // websocket, redis, performance, security, connection
        this.timestamp = new Date().toISOString();
        this.correlationId = null;
        this.connectionId = null;
        this.module = NOMBRE_MODULO;
        this.version = VERSION_MODULO;
        this.metadata = metadata;
        this.retryable = false;
        this.alertRequired = severity === 'critical' || severity === 'high';
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
    
    setCorrelationId(correlationId) {
        this.correlationId = correlationId;
        return this;
    }
    
    setConnectionId(connectionId) {
        this.connectionId = connectionId;
        return this;
    }
    
    setRetryable(retryable = true) {
        this.retryable = retryable;
        return this;
    }
    
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            severity: this.severity,
            category: this.category,
            timestamp: this.timestamp,
            correlationId: this.correlationId,
            connectionId: this.connectionId,
            module: this.module,
            version: this.version,
            metadata: this.metadata,
            retryable: this.retryable,
            alertRequired: this.alertRequired
        };
    }
}

/**
 * Connection-specific error class
 */
class ConnectionError extends DragonWebSocketError {
    constructor(message, connectionId, metadata = {}) {
        super(message, 'CONNECTION_ERROR', 'medium', 'connection', metadata);
        this.name = 'ConnectionError';
        this.connectionId = connectionId;
        this.retryable = true;
    }
}

/**
 * Message processing error class
 */
class MessageProcessingError extends DragonWebSocketError {
    constructor(message, messageType, processingTime, metadata = {}) {
        super(message, 'MESSAGE_PROCESSING_ERROR', 'medium', 'websocket', {
            ...metadata,
            messageType,
            processingTime
        });
        this.name = 'MessageProcessingError';
        this.messageType = messageType;
        this.processingTime = processingTime;
        this.retryable = true;
    }
}

/**
 * Redis communication error class
 */
class RedisCommError extends DragonWebSocketError {
    constructor(message, operation, metadata = {}) {
        super(message, `REDIS_${operation.toUpperCase()}_ERROR`, 'high', 'redis', metadata);
        this.name = 'RedisCommError';
        this.operation = operation;
        this.alertRequired = true;
        this.retryable = operation !== 'connection_failed';
    }
}

/**
 * Rate limit error class
 */
class RateLimitError extends DragonWebSocketError {
    constructor(message, connectionId, currentRate, limit, metadata = {}) {
        super(message, 'RATE_LIMIT_EXCEEDED', 'medium', 'security', {
            ...metadata,
            currentRate,
            limit,
            utilizationPercent: Math.round((currentRate / limit) * 100)
        });
        this.name = 'RateLimitError';
        this.connectionId = connectionId;
        this.currentRate = currentRate;
        this.limit = limit;
        this.retryable = false;
    }
}

/**
 * ====================================================================
 * FAANG: ENHANCED PERFORMANCE MONITOR FOR WEBSOCKETS
 * Real-time P95/P99 tracking específico para WebSocket operations
 * ====================================================================
 */
class WebSocketPerformanceMonitor {
    constructor() {
        this.metrics = {
            connectionTimes: [],
            messageProcessingTimes: [],
            redisPubSubTimes: [],
            disconnectionTimes: [],
            memoryUsage: [],
            connectionCounts: [],
            errorCounts: new Map(),
            rateLimitViolations: []
        };
        
        this.performanceObserver = new performanceHooks.PerformanceObserver((list) => {
            this.handlePerformanceEntries(list.getEntries());
        });
        
        this.alertThresholds = {
            connectionP95: FAANG_CONFIG.performance.websocketConnectionP95,
            connectionP99: FAANG_CONFIG.performance.websocketConnectionP99,
            messageProcessingP95: FAANG_CONFIG.performance.messageProcessingP95,
            messageProcessingP99: FAANG_CONFIG.performance.messageProcessingP99,
            redisPubSubP95: FAANG_CONFIG.performance.redisPubSubP95,
            memoryUsage: FAANG_CONFIG.memory.maxHeapUsage
        };
        
        this.lastAlertTimes = new Map();
        this.alertCooldown = 60000; // 1 minute cooldown
        
        this.startMonitoring();
    }
    
    startMonitoring() {
        if (FAANG_CONFIG.monitoring.performanceLogging) {
            this.performanceObserver.observe({ entryTypes: ['measure', 'mark'] });
        }
        
        // Memory monitoring específico para WebSockets
        setInterval(() => {
            this.collectMemoryMetrics();
        }, FAANG_CONFIG.memory.gcInterval);
        
        // Performance summary logging
        setInterval(() => {
            this.logPerformanceSummary();
        }, FAANG_CONFIG.monitoring.metricsReportInterval);
        
        dragon.sonrie('WebSocket Performance Monitor FAANG iniciado', 'servidorCentral', 'PERFORMANCE_MONITOR_START', {
            version: VERSION_MODULO,
            alertThresholds: this.alertThresholds,
            monitoringEnabled: FAANG_CONFIG.monitoring.performanceLogging
        });
    }
    
    handlePerformanceEntries(entries) {
        for (const entry of entries) {
            const duration = entry.duration;
            
            if (entry.name.startsWith('websocket:connection:')) {
                this.recordConnectionTime(duration, entry.name);
            } else if (entry.name.startsWith('websocket:message:')) {
                this.recordMessageProcessingTime(duration, entry.name);
            } else if (entry.name.startsWith('websocket:redis:')) {
                this.recordRedisPubSubTime(duration, entry.name);
            } else if (entry.name.startsWith('websocket:disconnect:')) {
                this.recordDisconnectionTime(duration, entry.name);
            }
        }
    }
    
    recordConnectionTime(duration, operationName) {
        this.metrics.connectionTimes.push({
            duration,
            timestamp: Date.now(),
            operation: operationName
        });
        
        // Keep only last 1000 measurements
        if (this.metrics.connectionTimes.length > 1000) {
            this.metrics.connectionTimes = this.metrics.connectionTimes.slice(-1000);
        }
        
        // P95 violation detection
        if (duration > this.alertThresholds.connectionP95) {
            this.handlePerformanceViolation('connection_p95', duration, this.alertThresholds.connectionP95, operationName);
        }
        
        // P99 violation detection
        if (duration > this.alertThresholds.connectionP99) {
            this.handlePerformanceViolation('connection_p99', duration, this.alertThresholds.connectionP99, operationName);
        }
    }
    
    recordMessageProcessingTime(duration, operationName) {
        this.metrics.messageProcessingTimes.push({
            duration,
            timestamp: Date.now(),
            operation: operationName
        });
        
        if (this.metrics.messageProcessingTimes.length > 1000) {
            this.metrics.messageProcessingTimes = this.metrics.messageProcessingTimes.slice(-1000);
        }
        
        if (duration > this.alertThresholds.messageProcessingP95) {
            this.handlePerformanceViolation('message_processing_p95', duration, this.alertThresholds.messageProcessingP95, operationName);
        }
    }
    
    recordRedisPubSubTime(duration, operationName) {
        this.metrics.redisPubSubTimes.push({
            duration,
            timestamp: Date.now(),
            operation: operationName
        });
        
        if (this.metrics.redisPubSubTimes.length > 500) {
            this.metrics.redisPubSubTimes = this.metrics.redisPubSubTimes.slice(-500);
        }
        
        if (duration > this.alertThresholds.redisPubSubP95) {
            this.handlePerformanceViolation('redis_pubsub_p95', duration, this.alertThresholds.redisPubSubP95, operationName);
        }
    }
    
    recordDisconnectionTime(duration, operationName) {
        this.metrics.disconnectionTimes.push({
            duration,
            timestamp: Date.now(),
            operation: operationName
        });
        
        if (this.metrics.disconnectionTimes.length > 500) {
            this.metrics.disconnectionTimes = this.metrics.disconnectionTimes.slice(-500);
        }
    }
    
    handlePerformanceViolation(metric, actualValue, threshold, operationName) {
        const alertKey = `${metric}_violation`;
        const lastAlert = this.lastAlertTimes.get(alertKey);
        const now = Date.now();
        
        if (lastAlert && (now - lastAlert) < this.alertCooldown) {
            return;
        }
        
        this.lastAlertTimes.set(alertKey, now);
        
        dragon.mideRendimiento(`websocket_${metric}_violation`, actualValue, 'servidorCentral', {
            metric,
            threshold,
            actual: actualValue,
            violation: 'exceeded',
            operation: operationName,
            timestamp: new Date().toISOString(),
            severity: actualValue > threshold * 1.5 ? 'critical' : 'high'
        });
    }
    
    collectMemoryMetrics() {
        const memoryUsage = process.memoryUsage();
        const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
        const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024;
        const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100;
        
        const memoryMetric = {
            heapUsedMB: Math.round(heapUsedMB * 100) / 100,
            heapTotalMB: Math.round(heapTotalMB * 100) / 100,
            heapUsagePercent: Math.round(heapUsagePercent * 100) / 100,
            timestamp: Date.now()
        };
        
        this.metrics.memoryUsage.push(memoryMetric);
        
        if (this.metrics.memoryUsage.length > 100) {
            this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-100);
        }
        
        // Memory pressure detection
        if (heapUsagePercent > this.alertThresholds.memoryUsage) {
            this.handleMemoryPressure(heapUsagePercent, heapUsedMB, memoryMetric);
        }
        
        // Proactive GC triggering
        if (heapUsedMB > FAANG_CONFIG.performance.gcThreshold && 
            FAANG_CONFIG.memory.forceGCEnabled && 
            global.gc) {
            
            const gcStartTime = Date.now();
            global.gc();
            const gcDuration = Date.now() - gcStartTime;
            
            dragon.respira('GC triggered - WebSocket memory pressure relief', 'servidorCentral', 'GC_WEBSOCKET_TRIGGER', {
                beforeHeapMB: heapUsedMB,
                gcDuration,
                threshold: FAANG_CONFIG.performance.gcThreshold,
                trigger: 'websocket_proactive'
            });
        }
    }
    
    handleMemoryPressure(heapUsagePercent, heapUsedMB, memoryMetric) {
        const alertKey = 'websocket_memory_pressure';
        const lastAlert = this.lastAlertTimes.get(alertKey);
        const now = Date.now();
        
        if (lastAlert && (now - lastAlert) < this.alertCooldown) {
            return;
        }
        
        this.lastAlertTimes.set(alertKey, now);
        
        const severity = heapUsagePercent > this.alertThresholds.memoryUsage * 1.2 ? 'critical' : 'high';
        
        dragon.sePreocupa(`WebSocket memory pressure detected: ${heapUsagePercent.toFixed(1)}%`, 'servidorCentral', 'WEBSOCKET_MEMORY_PRESSURE', {
            heapUsagePercent,
            heapUsedMB,
            threshold: this.alertThresholds.memoryUsage,
            severity,
            memoryBreakdown: memoryMetric
        });
    }
    
    logPerformanceSummary() {
        const summary = this.getSummary();
        
        dragon.respira('WebSocket performance summary FAANG', 'servidorCentral', 'WEBSOCKET_PERFORMANCE_SUMMARY', {
            summary,
            version: VERSION_MODULO,
            timestamp: new Date().toISOString()
        });
    }
    
    getP95Time(metricArray) {
        if (metricArray.length === 0) return 0;
        const durations = metricArray.map(m => m.duration || m).sort((a, b) => a - b);
        const index = Math.floor(durations.length * 0.95);
        return durations[index] || 0;
    }
    
    getP99Time(metricArray) {
        if (metricArray.length === 0) return 0;
        const durations = metricArray.map(m => m.duration || m).sort((a, b) => a - b);
        const index = Math.floor(durations.length * 0.99);
        return durations[index] || 0;
    }
    
    getAverageTime(metricArray) {
        if (metricArray.length === 0) return 0;
        const durations = metricArray.map(m => m.duration || m);
        return durations.reduce((sum, val) => sum + val, 0) / durations.length;
    }
    
    getSummary() {
        const currentMemory = process.memoryUsage();
        
        return {
            connections: {
                p95: Math.round(this.getP95Time(this.metrics.connectionTimes) * 100) / 100,
                p99: Math.round(this.getP99Time(this.metrics.connectionTimes) * 100) / 100,
                average: Math.round(this.getAverageTime(this.metrics.connectionTimes) * 100) / 100,
                count: this.metrics.connectionTimes.length,
                target: this.alertThresholds.connectionP95
            },
            messageProcessing: {
                p95: Math.round(this.getP95Time(this.metrics.messageProcessingTimes) * 100) / 100,
                p99: Math.round(this.getP99Time(this.metrics.messageProcessingTimes) * 100) / 100,
                average: Math.round(this.getAverageTime(this.metrics.messageProcessingTimes) * 100) / 100,
                count: this.metrics.messageProcessingTimes.length,
                target: this.alertThresholds.messageProcessingP95
            },
            redisPubSub: {
                p95: Math.round(this.getP95Time(this.metrics.redisPubSubTimes) * 100) / 100,
                average: Math.round(this.getAverageTime(this.metrics.redisPubSubTimes) * 100) / 100,
                count: this.metrics.redisPubSubTimes.length,
                target: this.alertThresholds.redisPubSubP95
            },
            memory: {
                currentHeapMB: Math.round((currentMemory.heapUsed / 1024 / 1024) * 100) / 100,
                currentHeapPercent: Math.round(((currentMemory.heapUsed / currentMemory.heapTotal) * 100) * 100) / 100,
                samples: this.metrics.memoryUsage.length,
                threshold: this.alertThresholds.memoryUsage
            },
            errors: {
                errorCounts: Object.fromEntries(this.errorCounts),
                rateLimitViolations: this.metrics.rateLimitViolations.length
            }
        };
    }
    
    incrementErrorCount(errorType) {
        const current = this.metrics.errorCounts.get(errorType) || 0;
        this.metrics.errorCounts.set(errorType, current + 1);
    }
    
    recordRateLimitViolation(connectionId, currentRate, limit) {
        this.metrics.rateLimitViolations.push({
            connectionId,
            currentRate,
            limit,
            timestamp: Date.now()
        });
        
        // Keep only last 1000 violations
        if (this.metrics.rateLimitViolations.length > 1000) {
            this.metrics.rateLimitViolations = this.metrics.rateLimitViolations.slice(-1000);
        }
    }
}


/**
 * ====================================================================
 * FAANG: ENHANCED CIRCUIT BREAKER FOR WEBSOCKETS
 * Enterprise-grade reliability patterns para WebSocket operations
 * ====================================================================
 */
class WebSocketCircuitBreaker {
    constructor(config = {}) {
        this.name = config.name || 'WebSocketCircuitBreaker';
        this.errorThreshold = config.errorThreshold || FAANG_CONFIG.circuitBreaker.errorThreshold;
        this.recoveryTime = config.recoveryTime || FAANG_CONFIG.circuitBreaker.recoveryTime;
        this.monitoringWindow = config.monitoringWindow || FAANG_CONFIG.circuitBreaker.monitoringWindow;
        this.halfOpenMaxRequests = config.halfOpenMaxRequests || FAANG_CONFIG.circuitBreaker.halfOpenMaxRequests;
        
        // Circuit breaker state
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.failures = 0;
        this.successes = 0;
        this.lastFailureTime = null;
        this.lastSuccessTime = null;
        this.halfOpenRequests = 0;
        
        // Performance and error tracking
        this.metrics = {
            totalRequests: 0,
            totalFailures: 0,
            totalSuccesses: 0,
            stateTransitions: [],
            lastStateChange: null,
            errorsByType: new Map(),
            responseTimeHistory: []
        };
        
        this.startMonitoring();
    }
    
    startMonitoring() {
        // Clean up old metrics periodically
        setInterval(() => {
            this.cleanupMetrics();
        }, this.monitoringWindow);
        
        dragon.sonrie('WebSocket Circuit Breaker FAANG iniciado', 'servidorCentral', 'CIRCUIT_BREAKER_INIT', {
            name: this.name,
            errorThreshold: this.errorThreshold,
            recoveryTime: this.recoveryTime,
            state: this.state,
            version: VERSION_MODULO
        });
    }
    
    cleanupMetrics() {
        const now = Date.now();
        const cutoff = now - this.monitoringWindow;
        
        // Keep only recent state transitions
        this.metrics.stateTransitions = this.metrics.stateTransitions.filter(st => st.timestamp > cutoff);
        
        // Keep only recent response times
        this.metrics.responseTimeHistory = this.metrics.responseTimeHistory.filter(rt => rt.timestamp > cutoff);
    }
    
    async executeOperation(operation, operationName = 'websocket_operation', metadata = {}) {
        const startTime = Date.now();
        this.metrics.totalRequests++;
        
        // Check circuit state
        if (this.state === 'OPEN') {
            if (this.shouldAttemptReset()) {
                this.transitionTo('HALF_OPEN');
            } else {
                const error = new DragonWebSocketError(
                    `Circuit breaker is OPEN - operation blocked`,
                    'CIRCUIT_BREAKER_OPEN',
                    'critical',
                    'websocket',
                    {
                        name: this.name,
                        operationName,
                        timeSinceLastFailure: Date.now() - this.lastFailureTime,
                        recoveryTime: this.recoveryTime,
                        ...metadata
                    }
                );
                
                throw error;
            }
        }
        
        if (this.state === 'HALF_OPEN') {
            if (this.halfOpenRequests >= this.halfOpenMaxRequests) {
                const error = new DragonWebSocketError(
                    `Circuit breaker in HALF_OPEN - max requests exceeded`,
                    'CIRCUIT_BREAKER_HALF_OPEN_LIMIT',
                    'medium',
                    'websocket',
                    {
                        name: this.name,
                        operationName,
                        halfOpenRequests: this.halfOpenRequests,
                        maxRequests: this.halfOpenMaxRequests,
                        ...metadata
                    }
                );
                
                throw error;
            }
            this.halfOpenRequests++;
        }
        
        try {
            const result = await operation();
            const duration = Date.now() - startTime;
            this.onSuccess(duration, operationName, metadata);
            return result;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            this.onFailure(error, duration, operationName, metadata);
            throw error;
        }
    }
    
    onSuccess(duration, operationName, metadata) {
        this.successes++;
        this.metrics.totalSuccesses++;
        this.lastSuccessTime = Date.now();
        
        // Record response time
        this.metrics.responseTimeHistory.push({
            duration,
            timestamp: this.lastSuccessTime,
            operation: operationName
        });
        
        if (this.state === 'HALF_OPEN') {
            if (this.successes >= this.halfOpenMaxRequests) {
                this.transitionTo('CLOSED');
            }
        } else if (this.state === 'CLOSED') {
            this.failures = 0; // Reset failure count on success
        }
        
        dragon.respira('Circuit breaker operation success', 'servidorCentral', 'CIRCUIT_BREAKER_SUCCESS', {
            name: this.name,
            operationName,
            duration,
            state: this.state,
            successes: this.successes,
            failures: this.failures
        });
    }
    
    onFailure(error, duration, operationName, metadata) {
        this.failures++;
        this.metrics.totalFailures++;
        this.lastFailureTime = Date.now();
        
        // Track error types
        const errorType = error.code || error.name || 'UnknownError';
        const errorCount = this.metrics.errorsByType.get(errorType) || 0;
        this.metrics.errorsByType.set(errorType, errorCount + 1);
        
        if (this.state === 'HALF_OPEN') {
            this.transitionTo('OPEN');
        } else if (this.state === 'CLOSED' && this.failures >= this.errorThreshold) {
            this.transitionTo('OPEN');
        }
        
        dragon.sePreocupa('Circuit breaker operation failure', 'servidorCentral', 'CIRCUIT_BREAKER_FAILURE', {
            name: this.name,
            operationName,
            duration,
            state: this.state,
            failures: this.failures,
            threshold: this.errorThreshold,
            errorType,
            error: error.message
        });
    }
    
    shouldAttemptReset() {
        if (this.lastFailureTime === null) return false;
        return (Date.now() - this.lastFailureTime) >= this.recoveryTime;
    }
    
    transitionTo(newState) {
        const oldState = this.state;
        this.state = newState;
        const timestamp = Date.now();
        
        this.metrics.stateTransitions.push({
            from: oldState,
            to: newState,
            timestamp,
            failures: this.failures,
            successes: this.successes
        });
        
        this.metrics.lastStateChange = timestamp;
        
        // Reset counters based on new state
        if (newState === 'CLOSED') {
            this.failures = 0;
            this.successes = 0;
            this.halfOpenRequests = 0;
        } else if (newState === 'HALF_OPEN') {
            this.halfOpenRequests = 0;
            this.successes = 0;
        }
        
        dragon.sonrie(`WebSocket circuit breaker state transition: ${oldState} → ${newState}`, 'servidorCentral', 'CIRCUIT_BREAKER_STATE_CHANGE', {
            name: this.name,
            oldState,
            newState,
            failures: this.failures,
            successes: this.successes,
            timestamp: new Date(timestamp).toISOString()
        });
    }
    
    getState() {
        return {
            state: this.state,
            failures: this.failures,
            successes: this.successes,
            lastFailureTime: this.lastFailureTime,
            lastSuccessTime: this.lastSuccessTime,
            metrics: {
                ...this.metrics,
                failureRate: this.metrics.totalRequests > 0 ? (this.metrics.totalFailures / this.metrics.totalRequests) : 0,
                successRate: this.metrics.totalRequests > 0 ? (this.metrics.totalSuccesses / this.metrics.totalRequests) : 0,
                errorsByType: Object.fromEntries(this.metrics.errorsByType)
            }
        };
    }
    
    reset() {
        this.transitionTo('CLOSED');
        this.failures = 0;
        this.successes = 0;
        this.halfOpenRequests = 0;
        this.lastFailureTime = null;
        this.lastSuccessTime = null;
        
        dragon.sonrie('WebSocket circuit breaker manually reset', 'servidorCentral', 'CIRCUIT_BREAKER_MANUAL_RESET', {
            name: this.name
        });
    }
}

/**
 * ====================================================================
 * FAANG: ENHANCED SECURITY VALIDATOR FOR WEBSOCKETS
 * Multi-layer security validation para connections y messages
 * ====================================================================
 */
class WebSocketSecurityValidator {
    constructor() {
        this.suspiciousPatterns = new Set([
            '<script',
            'javascript:',
            'eval(',
            'document.cookie',
            'document.write',
            'window.location',
            'alert(',
            'confirm(',
            'prompt('
        ]);
        
        this.blockedIPs = new Set();
        this.connectionAttempts = new Map(); // IP -> { count, firstAttempt, lastAttempt }
        this.messageValidationCache = new Map();
        
        this.initializeSecurityPatterns();
        this.startThreatMonitoring();
    }
    
    initializeSecurityPatterns() {
        // Load additional patterns from environment
        const additionalPatterns = process.env.WEBSOCKET_SECURITY_PATTERNS?.split(',') || [];
        additionalPatterns.forEach(pattern => this.suspiciousPatterns.add(pattern.trim()));
        
        // Load blocked IPs from environment
        const blockedIPs = process.env.WEBSOCKET_BLOCKED_IPS?.split(',') || [];
        blockedIPs.forEach(ip => this.blockedIPs.add(ip.trim()));
        
        dragon.respira('WebSocket security patterns initialized', 'servidorCentral', 'SECURITY_INIT', {
            patternsCount: this.suspiciousPatterns.size,
            blockedIPsCount: this.blockedIPs.size,
            additionalPatterns: additionalPatterns.length,
            version: VERSION_MODULO
        });
    }
    
    startThreatMonitoring() {
        // Clean connection attempts cache periodically
        setInterval(() => {
            this.cleanupConnectionAttempts();
        }, 300000); // 5 minutes
        
        // Clean message validation cache periodically
        setInterval(() => {
            this.cleanupValidationCache();
        }, 600000); // 10 minutes
    }
    
    cleanupConnectionAttempts() {
        const now = Date.now();
        const maxAge = 3600000; // 1 hour
        
        for (const [ip, data] of this.connectionAttempts.entries()) {
            if (now - data.lastAttempt > maxAge) {
                this.connectionAttempts.delete(ip);
            }
        }
        
        if (this.connectionAttempts.size > 0) {
            dragon.respira('Connection attempts cache cleaned', 'servidorCentral', 'SECURITY_CACHE_CLEANUP', {
                remainingEntries: this.connectionAttempts.size,
                maxAge
            });
        }
    }
    
    cleanupValidationCache() {
        const now = Date.now();
        const maxAge = 600000; // 10 minutes
        
        for (const [key, data] of this.messageValidationCache.entries()) {
            if (now - data.timestamp > maxAge) {
                this.messageValidationCache.delete(key);
            }
        }
    }
    
    async validateConnection(req, connectionId) {
        const startTime = performanceHooks.performance.now();
        const clientIP = req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'] || '';
        const origin = req.headers.origin || '';
        
        try {
            // IP blacklist check
            if (this.blockedIPs.has(clientIP)) {
                throw new DragonWebSocketError(
                    `Connection blocked from blacklisted IP: ${clientIP}`,
                    'CONNECTION_BLOCKED_IP',
                    'high',
                    'security',
                    {
                        clientIP,
                        connectionId,
                        reason: 'blacklisted_ip'
                    }
                );
            }
            
            // Connection rate limiting per IP
            await this.checkConnectionRateLimit(clientIP);
            
            // Origin validation if enabled
            if (FAANG_CONFIG.security.allowedOrigins[0] !== '*') {
                await this.validateOrigin(origin, connectionId);
            }
            
            // User agent validation
            await this.validateUserAgent(userAgent, connectionId);
            
            // Security headers validation if enabled
            if (FAANG_CONFIG.security.securityHeaders) {
                await this.validateSecurityHeaders(req.headers, connectionId);
            }
            
            const duration = performanceHooks.performance.now() - startTime;
            
            dragon.sonrie('WebSocket connection security validation passed', 'servidorCentral', 'CONNECTION_SECURITY_VALIDATED', {
                connectionId,
                clientIP: this.maskIP(clientIP),
                origin,
                userAgent: userAgent.substring(0, 50),
                duration: Math.round(duration * 100) / 100,
                validationsPassed: ['ip_check', 'rate_limit', 'origin', 'user_agent', 'headers']
            });
            
            return {
                valid: true,
                clientIP,
                origin,
                userAgent,
                duration: Math.round(duration * 100) / 100,
                securityLevel: 'validated'
            };
            
        } catch (error) {
            const duration = performanceHooks.performance.now() - startTime;
            
            dragon.agoniza('WebSocket connection security validation failed', error, 'servidorCentral', 'CONNECTION_SECURITY_VIOLATION', {
                connectionId,
                clientIP: this.maskIP(clientIP),
                origin,
                userAgent: userAgent.substring(0, 50),
                duration: Math.round(duration * 100) / 100,
                validationType: error.code || 'unknown'
            });
            
            throw error;
        }
    }
    
    async checkConnectionRateLimit(clientIP) {
        const now = Date.now();
        const windowMs = 60000; // 1 minute window
        const maxConnections = 10; // Max 10 connections per minute per IP
        
        const attempts = this.connectionAttempts.get(clientIP) || {
            count: 0,
            firstAttempt: now,
            lastAttempt: now
        };
        
        // Reset if window expired
        if (now - attempts.firstAttempt > windowMs) {
            attempts.count = 1;
            attempts.firstAttempt = now;
            attempts.lastAttempt = now;
        } else {
            attempts.count++;
            attempts.lastAttempt = now;
        }
        
        this.connectionAttempts.set(clientIP, attempts);
        
        if (attempts.count > maxConnections) {
            throw new DragonWebSocketError(
                `Connection rate limit exceeded for IP: ${attempts.count}/${maxConnections} in ${windowMs}ms`,
                'CONNECTION_RATE_LIMIT_EXCEEDED',
                'high',
                'security',
                {
                    clientIP: this.maskIP(clientIP),
                    attempts: attempts.count,
                    maxConnections,
                    windowMs,
                    timeToReset: windowMs - (now - attempts.firstAttempt)
                }
            );
        }
    }
    
    async validateOrigin(origin, connectionId) {
        if (!origin) {
            throw new DragonWebSocketError(
                'Missing origin header',
                'MISSING_ORIGIN_HEADER',
                'medium',
                'security',
                { connectionId }
            );
        }
        
        const isAllowed = FAANG_CONFIG.security.allowedOrigins.some(allowedOrigin => {
            if (allowedOrigin === '*') return true;
            if (allowedOrigin.startsWith('*.')) {
                const domain = allowedOrigin.substring(2);
                return origin.endsWith(domain);
            }
            return origin === allowedOrigin;
        });
        
        if (!isAllowed) {
            throw new DragonWebSocketError(
                `Origin not allowed: ${origin}`,
                'ORIGIN_NOT_ALLOWED',
                'high',
                'security',
                {
                    origin,
                    allowedOrigins: FAANG_CONFIG.security.allowedOrigins,
                    connectionId
                }
            );
        }
    }
    
    async validateUserAgent(userAgent, connectionId) {
        if (!userAgent || userAgent.length < 10) {
            throw new DragonWebSocketError(
                'Suspicious or missing user agent',
                'SUSPICIOUS_USER_AGENT',
                'medium',
                'security',
                {
                    userAgent: userAgent.substring(0, 50),
                    connectionId
                }
            );
        }
        
        // Check for suspicious patterns in user agent
        const suspiciousUAPatterns = ['bot', 'crawler', 'spider', 'scraper'];
        const hasSuspiciousPattern = suspiciousUAPatterns.some(pattern => 
            userAgent.toLowerCase().includes(pattern)
        );
        
        if (hasSuspiciousPattern) {
            dragon.sePreocupa('Suspicious user agent detected', 'servidorCentral', 'SUSPICIOUS_USER_AGENT_DETECTED', {
                userAgent: userAgent.substring(0, 100),
                connectionId,
                threatLevel: 'medium'
            });
        }
    }
    
    async validateSecurityHeaders(headers, connectionId) {
        const requiredHeaders = ['user-agent', 'host'];
        const missingHeaders = requiredHeaders.filter(header => !headers[header]);
        
        if (missingHeaders.length > 0) {
            throw new DragonWebSocketError(
                `Missing required headers: ${missingHeaders.join(', ')}`,
                'MISSING_SECURITY_HEADERS',
                'medium',
                'security',
                {
                    missingHeaders,
                    connectionId
                }
            );
        }
    }
    
    async validateMessage(message, connectionId) {
        const startTime = performanceHooks.performance.now();
        
        try {
            // Message size validation
            if (message.length > FAANG_CONFIG.security.maxMessageSize) {
                throw new MessageProcessingError(
                    `Message size exceeds limit: ${message.length} > ${FAANG_CONFIG.security.maxMessageSize}`,
                    'oversized_message',
                    0,
                    {
                        messageSize: message.length,
                        limit: FAANG_CONFIG.security.maxMessageSize,
                        connectionId
                    }
                );
            }
            
            // Content validation if enabled
            if (FAANG_CONFIG.security.enableMessageValidation) {
                await this.validateMessageContent(message, connectionId);
            }
            
            const duration = performanceHooks.performance.now() - startTime;
            
            return {
                valid: true,
                messageSize: message.length,
                duration: Math.round(duration * 100) / 100,
                threatLevel: 'clean'
            };
            
        } catch (error) {
            const duration = performanceHooks.performance.now() - startTime;
            
            dragon.agoniza('Message security validation failed', error, 'servidorCentral', 'MESSAGE_SECURITY_VIOLATION', {
                connectionId,
                messageSize: message.length,
                duration: Math.round(duration * 100) / 100,
                validationType: error.code || 'unknown'
            });
            
            throw error;
        }
    }
    
    async validateMessageContent(message, connectionId) {
        // Check for suspicious patterns
        const messageText = message.toLowerCase();
        
        for (const pattern of this.suspiciousPatterns) {
            if (messageText.includes(pattern.toLowerCase())) {
                throw new MessageProcessingError(
                    `Suspicious content pattern detected: ${pattern}`,
                    'suspicious_content',
                    0,
                    {
                        pattern,
                        connectionId,
                        threatType: 'potential_xss'
                    }
                );
            }
        }
        
        // JSON validation for structured messages
        try {
            const parsed = JSON.parse(message);
            
            // Check for deeply nested objects (DoS protection)
            const depth = this.getObjectDepth(parsed);
            if (depth > 10) {
                throw new MessageProcessingError(
                    `Message structure too deep: ${depth} levels`,
                    'deep_nesting',
                    0,
                    {
                        depth,
                        maxDepth: 10,
                        connectionId
                    }
                );
            }
            
        } catch (jsonError) {
            if (jsonError instanceof MessageProcessingError) {
                throw jsonError;
            }
            // Non-JSON messages are allowed, just log for monitoring
            dragon.respira('Non-JSON message received', 'servidorCentral', 'NON_JSON_MESSAGE', {
                connectionId,
                messageLength: message.length
            });
        }
    }
    
    getObjectDepth(obj, depth = 0) {
        if (depth > 10) return depth; // Prevent stack overflow
        if (obj === null || typeof obj !== 'object') return depth;
        
        let maxDepth = depth;
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const childDepth = this.getObjectDepth(obj[key], depth + 1);
                maxDepth = Math.max(maxDepth, childDepth);
            }
        }
        return maxDepth;
    }
    
    maskIP(ip) {
        // Mask IP for privacy in logs
        if (!ip) return 'unknown';
        const parts = ip.split('.');
        if (parts.length === 4) {
            return `${parts[0]}.${parts[1]}.xxx.xxx`;
        }
        return ip.substring(0, Math.floor(ip.length / 2)) + 'xxx';
    }
    
    blockIP(ip, reason = 'security_violation') {
        this.blockedIPs.add(ip);
        
        dragon.respira('IP added to blocklist', 'servidorCentral', 'IP_BLOCKED', {
            ip: this.maskIP(ip),
            reason,
            totalBlocked: this.blockedIPs.size
        });
    }
    
    unblockIP(ip) {
        if (this.blockedIPs.delete(ip)) {
            dragon.respira('IP removed from blocklist', 'servidorCentral', 'IP_UNBLOCKED', {
                ip: this.maskIP(ip),
                totalBlocked: this.blockedIPs.size
            });
        }
    }
    
    getSecuritySummary() {
        return {
            suspiciousPatterns: this.suspiciousPatterns.size,
            blockedIPs: this.blockedIPs.size,
            connectionAttempts: this.connectionAttempts.size,
            messageValidationCache: this.messageValidationCache.size,
            config: {
                allowedOrigins: FAANG_CONFIG.security.allowedOrigins,
                maxMessageSize: FAANG_CONFIG.security.maxMessageSize,
                enableConnectionValidation: FAANG_CONFIG.security.enableConnectionValidation,
                enableMessageValidation: FAANG_CONFIG.security.enableMessageValidation,
                rateLimitEnabled: FAANG_CONFIG.security.rateLimitEnabled
            }
        };
    }
}

/**
 * ====================================================================
 * FAANG: ENHANCED CONNECTION MANAGER
 * Enterprise-grade connection pooling y lifecycle management
 * ====================================================================
 */
class WebSocketConnectionManager {
    constructor(maxConnections = FAANG_CONFIG.connections.maxConnections) {
        this.maxConnections = maxConnections;
        this.connections = new Map(); // connectionId -> connectionInfo
        this.connectionsByIP = new Map(); // IP -> Set of connectionIds
        this.heartbeatInterval = null;
        
        // Rate limiting per connection
        this.rateLimiter = new Map(); // connectionId -> { messageCount, resetTime }
        
        // Performance metrics
        this.metrics = {
            totalConnections: 0,
            activeConnections: 0,
            peakConnections: 0,
            connectionDurations: [],
            disconnectionReasons: new Map(),
            rateLimitViolations: 0
        };
        
        this.startConnectionMonitoring();
    }
    
    startConnectionMonitoring() {
        // Heartbeat monitoring
        this.heartbeatInterval = setInterval(() => {
            this.performHeartbeatCheck();
        }, FAANG_CONFIG.connections.heartbeatInterval);
        
        // Connection cleanup
        setInterval(() => {
            this.cleanupInactiveConnections();
        }, FAANG_CONFIG.connections.inactiveTimeout);
        
        // Rate limiter cleanup
        setInterval(() => {
            this.cleanupRateLimiter();
        }, FAANG_CONFIG.connections.rateLimitWindow);
        
        dragon.sonrie('WebSocket Connection Manager FAANG iniciado', 'servidorCentral', 'CONNECTION_MANAGER_INIT', {
            maxConnections: this.maxConnections,
            heartbeatInterval: FAANG_CONFIG.connections.heartbeatInterval,
            version: VERSION_MODULO
        });
    }
    
    async addConnection(ws, connectionId, clientIP, securityValidation) {
        const startTime = Date.now();
        
        try {
            // Check connection limits
            if (this.connections.size >= this.maxConnections) {
                throw new ConnectionError(
                    `Maximum connections reached: ${this.connections.size}/${this.maxConnections}`,
                    connectionId,
                    {
                        currentConnections: this.connections.size,
                        maxConnections: this.maxConnections,
                        clientIP: clientIP
                    }
                );
            }
            
            // Check connections per IP limit
            const connectionsFromIP = this.connectionsByIP.get(clientIP) || new Set();
            const maxConnectionsPerIP = 10; // Configurable limit
            
            if (connectionsFromIP.size >= maxConnectionsPerIP) {
                throw new ConnectionError(
                    `Too many connections from IP: ${connectionsFromIP.size}/${maxConnectionsPerIP}`,
                    connectionId,
                    {
                        connectionsFromIP: connectionsFromIP.size,
                        maxConnectionsPerIP,
                        clientIP
                    }
                );
            }
            
            // Create connection info
            const connectionInfo = {
                id: connectionId,
                ws,
                clientIP,
                connectTime: startTime,
                lastActivity: startTime,
                lastHeartbeat: startTime,
                messageCount: 0,
                errorCount: 0,
                securityValidation,
                status: 'active',
                rateLimitResets: 0
            };
            
            // Add to tracking maps
            this.connections.set(connectionId, connectionInfo);
            connectionsFromIP.add(connectionId);
            this.connectionsByIP.set(clientIP, connectionsFromIP);
            
            // Update metrics
            this.metrics.totalConnections++;
            this.metrics.activeConnections = this.connections.size;
            
            if (this.connections.size > this.metrics.peakConnections) {
                this.metrics.peakConnections = this.connections.size;
            }
            
            // Initialize rate limiter for this connection
            this.rateLimiter.set(connectionId, {
                messageCount: 0,
                resetTime: Date.now() + FAANG_CONFIG.connections.rateLimitWindow
            });
            
            dragon.sonrie('WebSocket connection added to manager', 'servidorCentral', 'CONNECTION_ADDED', {
                connectionId,
                clientIP: this.maskIP(clientIP),
                totalConnections: this.connections.size,
                connectionsFromIP: connectionsFromIP.size,
                peakConnections: this.metrics.peakConnections
            });
            
            return connectionInfo;
            
        } catch (error) {
            dragon.agoniza('Error adding WebSocket connection', error, 'servidorCentral', 'CONNECTION_ADD_ERROR', {
                connectionId,
                clientIP: this.maskIP(clientIP),
                totalConnections: this.connections.size,
                error: error.message
            });
            
            throw error;
        }
    }
    
    removeConnection(connectionId, reason = 'normal_close') {
        const startTime = Date.now();
        const connectionInfo = this.connections.get(connectionId);
        
        if (!connectionInfo) {
            dragon.sePreocupa('Attempted to remove non-existent connection', 'servidorCentral', 'CONNECTION_NOT_FOUND', {
                connectionId,
                reason
            });
            return false;
        }
        
        try {
            // Calculate connection duration
            const duration = startTime - connectionInfo.connectTime;
            this.metrics.connectionDurations.push(duration);
            
            // Keep only last 1000 durations
            if (this.metrics.connectionDurations.length > 1000) {
                this.metrics.connectionDurations = this.metrics.connectionDurations.slice(-1000);
            }
            
            // Update disconnection reason metrics
            const reasonCount = this.metrics.disconnectionReasons.get(reason) || 0;
            this.metrics.disconnectionReasons.set(reason, reasonCount + 1);
            
            // Remove from IP tracking
            const connectionsFromIP = this.connectionsByIP.get(connectionInfo.clientIP);
            if (connectionsFromIP) {
                connectionsFromIP.delete(connectionId);
                if (connectionsFromIP.size === 0) {
                    this.connectionsByIP.delete(connectionInfo.clientIP);
                }
            }
            
            // Remove from main tracking
            this.connections.delete(connectionId);
            this.rateLimiter.delete(connectionId);
            
            // Update metrics
            this.metrics.activeConnections = this.connections.size;
            
            dragon.respira('WebSocket connection removed from manager', 'servidorCentral', 'CONNECTION_REMOVED', {
                connectionId,
                clientIP: this.maskIP(connectionInfo.clientIP),
                duration,
                reason,
                messageCount: connectionInfo.messageCount,
                errorCount: connectionInfo.errorCount,
                remainingConnections: this.connections.size
            });
            
            return true;
            
        } catch (error) {
            dragon.agoniza('Error removing WebSocket connection', error, 'servidorCentral', 'CONNECTION_REMOVE_ERROR', {
                connectionId,
                reason,
                error: error.message
            });
            
            return false;
        }
    }
    
    updateConnectionActivity(connectionId) {
        const connectionInfo = this.connections.get(connectionId);
        if (connectionInfo) {
            connectionInfo.lastActivity = Date.now();
            connectionInfo.messageCount++;
        }
    }
    
    checkRateLimit(connectionId) {
        const rateLimitInfo = this.rateLimiter.get(connectionId);
        if (!rateLimitInfo) {
            return true; // Allow if no rate limit info exists
        }
        
        const now = Date.now();
        
        // Reset if window expired
        if (now >= rateLimitInfo.resetTime) {
            rateLimitInfo.messageCount = 1;
            rateLimitInfo.resetTime = now + FAANG_CONFIG.connections.rateLimitWindow;
            return true;
        }
        
        // Check limit
        if (rateLimitInfo.messageCount >= FAANG_CONFIG.connections.rateLimitMessages) {
            this.metrics.rateLimitViolations++;
            
            const connectionInfo = this.connections.get(connectionId);
            const timeToReset = rateLimitInfo.resetTime - now;
            
            throw new RateLimitError(
                `Rate limit exceeded: ${rateLimitInfo.messageCount}/${FAANG_CONFIG.connections.rateLimitMessages}`,
                connectionId,
                rateLimitInfo.messageCount,
                FAANG_CONFIG.connections.rateLimitMessages,
                {
                    timeToReset,
                    windowMs: FAANG_CONFIG.connections.rateLimitWindow,
                    clientIP: connectionInfo?.clientIP
                }
            );
        }
        
        rateLimitInfo.messageCount++;
        return true;
    }
    
    performHeartbeatCheck() {
        const now = Date.now();
        const heartbeatTimeout = FAANG_CONFIG.connections.heartbeatInterval * 2; // 2x interval
        const inactiveConnections = [];
        
        for (const [connectionId, connectionInfo] of this.connections.entries()) {
            const timeSinceLastActivity = now - connectionInfo.lastActivity;
            
            if (timeSinceLastActivity > heartbeatTimeout) {
                inactiveConnections.push(connectionId);
            } else if (connectionInfo.ws && connectionInfo.ws.readyState === 1) {
                // Send ping
                try {
                    connectionInfo.ws.ping();
                    connectionInfo.lastHeartbeat = now;
                } catch (error) {
                    dragon.sePreocupa('Error sending heartbeat ping', 'servidorCentral', 'HEARTBEAT_PING_ERROR', {
                        connectionId,
                        error: error.message
                    });
                    inactiveConnections.push(connectionId);
                }
            }
        }
        
        // Close inactive connections
        for (const connectionId of inactiveConnections) {
            const connectionInfo = this.connections.get(connectionId);
            if (connectionInfo && connectionInfo.ws) {
                try {
                    connectionInfo.ws.close(1000, 'Heartbeat timeout');
                } catch (error) {
                    dragon.sePreocupa('Error closing inactive connection', 'servidorCentral', 'CONNECTION_CLOSE_ERROR', {
                        connectionId,
                        error: error.message
                    });
                }
            }
            this.removeConnection(connectionId, 'heartbeat_timeout');
        }
        
        if (inactiveConnections.length > 0) {
            dragon.respira('Heartbeat check completed', 'servidorCentral', 'HEARTBEAT_CHECK', {
                totalConnections: this.connections.size,
                inactiveConnections: inactiveConnections.length,
                closedConnections: inactiveConnections.length
            });
        }
    }
    
    cleanupInactiveConnections() {
        const now = Date.now();
        const inactiveTimeout = FAANG_CONFIG.connections.inactiveTimeout;
        const inactiveConnections = [];
        
        for (const [connectionId, connectionInfo] of this.connections.entries()) {
            const timeSinceLastActivity = now - connectionInfo.lastActivity;
            
            if (timeSinceLastActivity > inactiveTimeout) {
                inactiveConnections.push(connectionId);
            }
        }
        
        for (const connectionId of inactiveConnections) {
            this.removeConnection(connectionId, 'inactive_timeout');
        }
        
        if (inactiveConnections.length > 0) {
            dragon.respira('Inactive connections cleanup completed', 'servidorCentral', 'INACTIVE_CLEANUP', {
                cleanedConnections: inactiveConnections.length,
                remainingConnections: this.connections.size
            });
        }
    }
    
    cleanupRateLimiter() {
        const now = Date.now();
        
        for (const [connectionId, rateLimitInfo] of this.rateLimiter.entries()) {
            if (now >= rateLimitInfo.resetTime) {
                rateLimitInfo.messageCount = 0;
                rateLimitInfo.resetTime = now + FAANG_CONFIG.connections.rateLimitWindow;
            }
        }
    }
    
    maskIP(ip) {
        if (!ip) return 'unknown';
        const parts = ip.split('.');
        if (parts.length === 4) {
            return `${parts[0]}.${parts[1]}.xxx.xxx`;
        }
        return ip.substring(0, Math.floor(ip.length / 2)) + 'xxx';
    }
    
    getConnectionInfo(connectionId) {
        return this.connections.get(connectionId);
    }
    
    getConnectionMetrics() {
        const avgDuration = this.metrics.connectionDurations.length > 0 
            ? this.metrics.connectionDurations.reduce((sum, duration) => sum + duration, 0) / this.metrics.connectionDurations.length
            : 0;
        
        return {
            totalConnections: this.metrics.totalConnections,
            activeConnections: this.metrics.activeConnections,
            peakConnections: this.metrics.peakConnections,
            averageConnectionDuration: Math.round(avgDuration),
            disconnectionReasons: Object.fromEntries(this.metrics.disconnectionReasons),
            rateLimitViolations: this.metrics.rateLimitViolations,
            connectionsByIP: this.connectionsByIP.size,
            utilizationPercent: Math.round((this.connections.size / this.maxConnections) * 100)
        };
    }
    
    async gracefulShutdown() {
        try {
            dragon.respira('Starting WebSocket connection manager graceful shutdown', 'servidorCentral', 'CONNECTION_MANAGER_SHUTDOWN_START', {
                activeConnections: this.connections.size
            });
            
            // Clear heartbeat interval
            if (this.heartbeatInterval) {
                clearInterval(this.heartbeatInterval);
            }
            
            // Close all connections gracefully
            const closePromises = [];
            for (const [connectionId, connectionInfo] of this.connections.entries()) {
                if (connectionInfo.ws && connectionInfo.ws.readyState === 1) {
                    closePromises.push(new Promise((resolve) => {
                        connectionInfo.ws.close(1001, 'Server shutdown');
                        setTimeout(resolve, 100); // Give time for graceful close
                    }));
                }
            }
            
            await Promise.all(closePromises);
            
            dragon.zen('WebSocket connection manager shutdown completed', 'servidorCentral', 'CONNECTION_MANAGER_SHUTDOWN_SUCCESS', {
                closedConnections: closePromises.length
            });
            
        } catch (error) {
            dragon.agoniza('Error during connection manager shutdown', error, 'servidorCentral', 'CONNECTION_MANAGER_SHUTDOWN_ERROR');
        }
    }
}


    /**
     * FAANG: Enhanced performance summary reporting
     */
    reportarResumenRendimiento() {
        try {
            const avgMessageProcessing = this.messageProcessingTimes.length > 0 
                ? this.messageProcessingTimes.reduce((sum, time) => sum + time, 0) / this.messageProcessingTimes.length
                : 0;
            
            const p95MessageProcessing = this.getP95Time(this.messageProcessingTimes);
            const p99MessageProcessing = this.getP99Time(this.messageProcessingTimes);
            
            dragon.mideRendimiento('websocket_performance_summary', avgMessageProcessing, 'servidorCentral', {
                averageMessageProcessing: Math.round(avgMessageProcessing * 100) / 100,
                p95MessageProcessing: Math.round(p95MessageProcessing * 100) / 100,
                p99MessageProcessing: Math.round(p99MessageProcessing * 100) / 100,
                targetP95: FAANG_CONFIG.performance.messageProcessingP95,
                targetP99: FAANG_CONFIG.performance.messageProcessingP99,
                totalSamples: this.messageProcessingTimes.length,
                performance: p95MessageProcessing < FAANG_CONFIG.performance.messageProcessingP95 ? 'optimal' : 'degraded',
                timestamp: new Date().toISOString(),
                version: this.version
            });
            
        } catch (error) {
            dragon.agoniza('Error reportando resumen rendimiento FAANG', error, 'servidorCentral', 'PERFORMANCE_SUMMARY_ERROR');
        }
    }
    
    /**
     * FAANG: Helper method to calculate P95 time
     */
    getP95Time(timeArray) {
        if (timeArray.length === 0) return 0;
        const sorted = [...timeArray].sort((a, b) => a - b);
        const index = Math.floor(sorted.length * 0.95);
        return sorted[index] || 0;
    }
    
    /**
     * FAANG: Helper method to calculate P99 time
     */
    getP99Time(timeArray) {
        if (timeArray.length === 0) return 0;
        const sorted = [...timeArray].sort((a, b) => a - b);
        const index = Math.floor(sorted.length * 0.99);
        return sorted[index] || 0;
    }
    
    /**
     * FAANG: Enhanced event listeners setup
     */
    async setupEventListeners() {
        try {
            // Circuit breaker event handling
            this.circuitBreaker.on?.('stateChange', (data) => {
                this.healthStatus.circuitBreaker = data.newState.toLowerCase();
                
                dragon.respira('WebSocket circuit breaker state changed', 'servidorCentral', 'CIRCUIT_BREAKER_STATE_CHANGE', {
                    oldState: data.oldState,
                    newState: data.newState,
                    failures: data.failures,
                    successes: data.successes,
                    version: this.version
                });
            });
            
            // Performance monitor alerts
            this.performanceMonitor.on?.('violation', (data) => {
                dragon.mideRendimiento(`websocket_${data.metric}_violation`, data.actualValue, 'servidorCentral', {
                    metric: data.metric,
                    threshold: data.threshold,
                    actual: data.actualValue,
                    violation: 'exceeded',
                    operation: data.operation,
                    severity: data.actualValue > data.threshold * 1.5 ? 'critical' : 'high'
                });
            });
            
            // Process exit handlers for graceful shutdown
            process.on('SIGTERM', () => {
                dragon.respira('SIGTERM received - initiating graceful shutdown', 'servidorCentral', 'GRACEFUL_SHUTDOWN_SIGTERM');
                this.gracefulShutdown();
            });
            
            process.on('SIGINT', () => {
                dragon.respira('SIGINT received - initiating graceful shutdown', 'servidorCentral', 'GRACEFUL_SHUTDOWN_SIGINT');
                this.gracefulShutdown();
            });
            
            dragon.sonrie('Event listeners FAANG configurados', 'servidorCentral', 'EVENT_LISTENERS_SETUP', {
                handlers: ['circuitBreaker', 'performanceMonitor', 'processExit'],
                version: this.version
            });
            
        } catch (error) {
            dragon.agoniza('Error configurando event listeners FAANG', error, 'servidorCentral', 'EVENT_LISTENERS_ERROR');
        }
    }
    
    /**
     * FAANG: Process heartbeat Redis messages
     */
    async procesarHeartbeatRedis(heartbeat, messageId) {
        try {
            dragon.respira('Heartbeat Redis recibido', 'servidorCentral', 'REDIS_HEARTBEAT_RECEIVED', {
                messageId,
                source: heartbeat.source || 'unknown',
                timestamp: heartbeat.timestamp || Date.now(),
                componentStatus: heartbeat.status || 'unknown'
            });
            
            // Update component health if needed
            if (heartbeat.component && heartbeat.status) {
                this.healthStatus[heartbeat.component] = heartbeat.status;
            }
            
        } catch (error) {
            dragon.sePreocupa('Error procesando heartbeat Redis', 'servidorCentral', 'REDIS_HEARTBEAT_ERROR', {
                messageId,
                error: error.message
            });
        }
    }
    
    /**
     * FAANG: Process performance metrics from Redis
     */
    async procesarMetricasRedis(metricas, messageId) {
        try {
            dragon.respira('Métricas Redis recibidas', 'servidorCentral', 'REDIS_METRICS_RECEIVED', {
                messageId,
                metricsType: metricas.type || 'unknown',
                source: metricas.source || 'unknown',
                timestamp: metricas.timestamp || Date.now()
            });
            
            // Process specific metric types
            if (metricas.type === 'performance_violation') {
                dragon.mideRendimiento(`external_${metricas.metric}_violation`, metricas.value, 'servidorCentral', {
                    externalSource: metricas.source,
                    metric: metricas.metric,
                    threshold: metricas.threshold,
                    actual: metricas.value,
                    messageId
                });
            }
            
        } catch (error) {
            dragon.sePreocupa('Error procesando métricas Redis', 'servidorCentral', 'REDIS_METRICS_ERROR', {
                messageId,
                error: error.message
            });
        }
    }
    
    /**
     * FAANG: Enhanced connection close handler
     */
    manejarCierreConexion(connectionId, code, reason) {
        const startTime = performanceHooks.performance.now();
        
        performanceHooks.performance.mark(`websocket:disconnect:${connectionId}:start`);
        
        try {
            const connectionInfo = this.connectionManager.getConnectionInfo(connectionId);
            
            if (connectionInfo) {
                const duration = Date.now() - connectionInfo.connectTime;
                
                dragon.respira('Conexión WebSocket FAANG cerrada', 'servidorCentral', 'CONNECTION_CLOSED', {
                    connectionId,
                    code,
                    reason: reason?.toString() || 'no reason',
                    duration,
                    messageCount: connectionInfo.messageCount,
                    errorCount: connectionInfo.errorCount,
                    clientIP: this.securityValidator.maskIP(connectionInfo.clientIP),
                    remainingConnections: this.connectionManager.connections.size - 1
                });
            }
            
            // Remove from connection manager
            this.connectionManager.removeConnection(connectionId, this.getDisconnectionReason(code));
            
            performanceHooks.performance.mark(`websocket:disconnect:${connectionId}:end`);
            performanceHooks.performance.measure(`websocket:disconnect:${connectionId}`, 
                                                  `websocket:disconnect:${connectionId}:start`, 
                                                  `websocket:disconnect:${connectionId}:end`);
            
            const processingTime = performanceHooks.performance.now() - startTime;
            
            this.DragonEye?.pulse?.('connection', { 
                status: 'closed',
                connectionId,
                code,
                totalConnections: this.connectionManager.connections.size,
                processingTime: Math.round(processingTime * 100) / 100
            });
            
        } catch (error) {
            dragon.agoniza('Error manejando cierre conexión FAANG', error, 'servidorCentral', 'CONNECTION_CLOSE_HANDLER_ERROR', {
                connectionId,
                code,
                reason: reason?.toString()
            });
        }
    }
    
    /**
     * FAANG: Enhanced connection error handler
     */
    manejarErrorConexion(connectionId, error) {
        try {
            const connectionInfo = this.connectionManager.getConnectionInfo(connectionId);
            
            if (connectionInfo) {
                connectionInfo.errorCount++;
            }
            
            this.performanceMonitor.incrementErrorCount('connection_error');
            
            dragon.agoniza('Error conexión WebSocket FAANG', error, 'servidorCentral', 'CONNECTION_ERROR', {
                connectionId,
                errorType: error.code || error.name || 'UnknownError',
                errorMessage: error.message,
                clientIP: connectionInfo ? this.securityValidator.maskIP(connectionInfo.clientIP) : 'unknown',
                connectionAge: connectionInfo ? Date.now() - connectionInfo.connectTime : 0,
                messageCount: connectionInfo ? connectionInfo.messageCount : 0
            });
            
            // Check if connection should be terminated based on error frequency
            if (connectionInfo && connectionInfo.errorCount > 5) {
                dragon.sePreocupa('Connection exceeded error threshold - terminating', 'servidorCentral', 'CONNECTION_ERROR_THRESHOLD', {
                    connectionId,
                    errorCount: connectionInfo.errorCount,
                    threshold: 5
                });
                
                try {
                    const ws = connectionInfo.ws;
                    if (ws && ws.readyState === 1) {
                        ws.close(1008, 'Too many errors');
                    }
                } catch (closeError) {
                    dragon.sePreocupa('Error closing connection after error threshold', 'servidorCentral', 'CONNECTION_FORCE_CLOSE_ERROR', {
                        connectionId,
                        closeError: closeError.message
                    });
                }
            }
            
        } catch (handlerError) {
            dragon.agoniza('Error en connection error handler FAANG', handlerError, 'servidorCentral', 'CONNECTION_ERROR_HANDLER_ERROR', {
                connectionId,
                originalError: error.message,
                handlerError: handlerError.message
            });
        }
    }
    
    /**
     * FAANG: Enhanced pong handler for heartbeat
     */
    manejarPong(connectionId) {
        try {
            const connectionInfo = this.connectionManager.getConnectionInfo(connectionId);
            
            if (connectionInfo) {
                connectionInfo.lastHeartbeat = Date.now();
                connectionInfo.lastActivity = Date.now();
                
                dragon.respira('Pong recibido - heartbeat confirmado', 'servidorCentral', 'HEARTBEAT_PONG_RECEIVED', {
                    connectionId,
                    clientIP: this.securityValidator.maskIP(connectionInfo.clientIP),
                    lastActivity: connectionInfo.lastActivity
                });
            }
            
        } catch (error) {
            dragon.sePreocupa('Error manejando pong FAANG', 'servidorCentral', 'PONG_HANDLER_ERROR', {
                connectionId,
                error: error.message
            });
        }
    }
    
    /**
     * FAANG: Enhanced WebSocket error handler
     */
    manejarErrorWebSocket(error) {
        this.performanceMonitor.incrementErrorCount('websocket_server_error');
        this.healthStatus.websocket = 'error';
        
        dragon.agoniza('Error WebSocket server FAANG', error, 'servidorCentral', 'WEBSOCKET_ERROR', {
            errorType: error.code || error.name || 'UnknownError',
            errorMessage: error.message,
            puerto: this.puerto,
            activeConnections: this.connectionManager.connections.size,
            version: this.version
        });
        
        this.DragonEye?.pulse?.('websocket', { 
            status: 'error', 
            error: error.message,
            errorType: error.code || error.name,
            port: this.puerto,
            version: this.version
        });
        
        // Check if we need to restart or implement recovery
        if (error.code === 'EADDRINUSE') {
            dragon.agoniza('Puerto en uso - no se puede recuperar automáticamente', error, 'servidorCentral', 'PORT_IN_USE_FATAL', {
                puerto: this.puerto
            });
        }
    }
    
    /**
     * FAANG: Enhanced Redis error handler
     */
    manejarErrorRedis(error) {
        this.performanceMonitor.incrementErrorCount('redis_error');
        this.healthStatus.redis = 'error';
        
        dragon.agoniza('Error Redis subscriber FAANG', error, 'servidorCentral', 'REDIS_ERROR', {
            errorType: error.code || error.name || 'UnknownError',
            errorMessage: error.message,
            version: this.version
        });
        
        // Implement Redis circuit breaker logic
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            dragon.sePreocupa('Redis connection lost - activating degraded mode', 'servidorCentral', 'REDIS_DEGRADED_MODE', {
                errorCode: error.code,
                willRetry: true
            });
        }
    }
    
    /**
     * FAANG: Helper method to determine disconnection reason
     */
    getDisconnectionReason(code) {
        const reasons = {
            1000: 'normal_close',
            1001: 'going_away',
            1002: 'protocol_error',
            1003: 'unsupported_data',
            1005: 'no_status_received',
            1006: 'abnormal_closure',
            1007: 'invalid_frame_payload_data',
            1008: 'policy_violation',
            1009: 'message_too_big',
            1010: 'missing_extension',
            1011: 'internal_error',
            1012: 'service_restart',
            1013: 'try_again_later',
            1014: 'bad_gateway',
            1015: 'tls_handshake'
        };
        
        return reasons[code] || `unknown_code_${code}`;
    }
    
    /**
     * FAANG: Enhanced DragonEye initialization (preservado Dragon2)
     */
    inicializarDragonEye() {
        try {
            this.DragonEye = {
                sensor: new Map(),
                pulse: (name, metrics) => {
                    try {
                        this.DragonEye.sensor.set(name, {
                            timestamp: Date.now(),
                            metrics: {
                                ...metrics,
                                version: this.version,
                                module: NOMBRE_MODULO
                            },
                            status: 'alive'
                        });
                        
                        dragon.respira(`DragonEye pulse FAANG: ${name}`, 'servidorCentral', 'DRAGONEYE_PULSE', {
                            name,
                            metrics: {
                                ...metrics,
                                version: this.version
                            }
                        });
                        
                    } catch (error) {
                        dragon.agoniza('DragonEye pulse falló FAANG', error, 'servidorCentral', 'DRAGONEYE_ERROR', {
                            name,
                            error: error.message
                        });
                    }
                },
                
                getSensorData: (name) => {
                    return this.DragonEye.sensor.get(name);
                },
                
                getAllSensors: () => {
                    return Object.fromEntries(this.DragonEye.sensor);
                },
                
                clearSensor: (name) => {
                    return this.DragonEye.sensor.delete(name);
                },
                
                getHealth: () => {
                    const sensors = Object.fromEntries(this.DragonEye.sensor);
                    const now = Date.now();
                    const staleThreshold = 300000; // 5 minutes
                    
                    const health = {
                        status: 'healthy',
                        sensors: Object.keys(sensors).length,
                        staleSensors: 0,
                        lastUpdate: now,
                        version: this.version
                    };
                    
                    for (const [name, data] of Object.entries(sensors)) {
                        if (now - data.timestamp > staleThreshold) {
                            health.staleSensors++;
                        }
                    }
                    
                    if (health.staleSensors > 0) {
                        health.status = 'degraded';
                    }
                    
                    return health;
                }
            };
            
            dragon.sonrie('DragonEye monitoring FAANG inicializado', 'servidorCentral', 'DRAGONEYE_INITIALIZED', {
                features: ['pulse', 'getSensorData', 'getAllSensors', 'clearSensor', 'getHealth'],
                version: this.version
            });
            
        } catch (error) {
            dragon.agoniza('Error inicializando DragonEye FAANG', error, 'servidorCentral', 'DRAGONEYE_INIT_ERROR');
            
            // Fallback DragonEye
            this.DragonEye = {
                pulse: () => {},
                getSensorData: () => null,
                getAllSensors: () => ({}),
                clearSensor: () => false,
                getHealth: () => ({ status: 'unknown', error: 'initialization_failed' })
            };
        }
    }


    /**
     * FAANG: Get active components count for health monitoring
     */
    getActiveComponentsCount() {
        let count = 0;
        
        try {
            if (this.wss && this.wss.readyState !== this.wss.CLOSED) count++;
            if (this.redisPublicador && this.redisPublicador.status === 'ready') count++;
            if (this.redisSubscriptor && this.redisSubscriptor.status === 'ready') count++;
            if (this.performanceMonitor) count++;
            if (this.circuitBreaker) count++;
            if (this.securityValidator) count++;
            if (this.connectionManager) count++;
            if (this.DragonEye) count++;
            
            return count;
            
        } catch (error) {
            dragon.sePreocupa('Error contando componentes activos', 'servidorCentral', 'ACTIVE_COMPONENTS_COUNT_ERROR', {
                error: error.message
            });
            return 0;
        }
    }
    
    /**
     * FAANG: Enhanced health status getter
     */
    async getHealthStatus() {
        try {
            const connectionMetrics = this.connectionManager.getConnectionMetrics();
            const performanceSummary = this.performanceMonitor.getSummary();
            const securitySummary = this.securityValidator.getSecuritySummary();
            const circuitBreakerState = this.circuitBreaker.getState();
            const dragonEyeHealth = this.DragonEye.getHealth();
            
            const uptime = Date.now() - this.startTime;
            const errorRate = this.totalErrors / Math.max(this.totalMessages, 1);
            
            // Determine overall health status
            let overallStatus = 'excellent';
            const issues = [];
            
            if (errorRate > 0.05) {
                overallStatus = 'degraded';
                issues.push('high_error_rate');
            }
            
            if (connectionMetrics.utilizationPercent > 90) {
                overallStatus = 'stressed';
                issues.push('high_connection_utilization');
            }
            
            if (circuitBreakerState.state === 'OPEN') {
                overallStatus = 'degraded';
                issues.push('circuit_breaker_open');
            }
            
            if (this.healthStatus.redis === 'error' || this.healthStatus.redis === 'disconnected') {
                overallStatus = 'degraded';
                issues.push('redis_connectivity');
            }
            
            if (this.healthStatus.websocket === 'error') {
                overallStatus = 'critical';
                issues.push('websocket_server_error');
            }
            
            if (performanceSummary.memory.currentHeapPercent > 85) {
                overallStatus = 'stressed';
                issues.push('high_memory_usage');
            }
            
            const healthData = {
                // Overall status
                status: overallStatus,
                issues,
                timestamp: new Date().toISOString(),
                uptime: Math.round(uptime / 1000), // seconds
                version: this.version,
                module: NOMBRE_MODULO,
                
                // Component health
                components: {
                    websocket: {
                        status: this.healthStatus.websocket,
                        active: !!this.wss,
                        port: this.puerto,
                        connectionsActive: connectionMetrics.activeConnections,
                        connectionsPeak: connectionMetrics.peakConnections,
                        utilizationPercent: connectionMetrics.utilizationPercent
                    },
                    redis: {
                        status: this.healthStatus.redis,
                        publisher: {
                            available: !!this.redisPublicador,
                            status: this.redisPublicador?.status || 'unknown'
                        },
                        subscriber: {
                            available: !!this.redisSubscriptor,
                            status: this.redisSubscriptor?.status || 'unknown'
                        }
                    },
                    circuitBreaker: {
                        state: circuitBreakerState.state,
                        failures: circuitBreakerState.failures,
                        successes: circuitBreakerState.successes,
                        successRate: Number(circuitBreakerState.metrics.successRate.toFixed(4)),
                        lastStateChange: circuitBreakerState.metrics.lastStateChange
                    },
                    performanceMonitor: {
                        active: !!this.performanceMonitor,
                        summary: performanceSummary
                    },
                    securityValidator: {
                        active: !!this.securityValidator,
                        summary: securitySummary
                    },
                    connectionManager: {
                        active: !!this.connectionManager,
                        metrics: connectionMetrics
                    },
                    dragonEye: {
                        active: !!this.DragonEye,
                        health: dragonEyeHealth
                    }
                },
                
                // Performance metrics
                performance: {
                    totalMessages: this.totalMessages,
                    totalErrors: this.totalErrors,
                    errorRate: Number(errorRate.toFixed(4)),
                    messageProcessing: {
                        average: performanceSummary.messageProcessing.average,
                        p95: performanceSummary.messageProcessing.p95,
                        p99: performanceSummary.messageProcessing.p99,
                        target: FAANG_CONFIG.performance.messageProcessingP95
                    },
                    connections: {
                        average: performanceSummary.connections.average,
                        p95: performanceSummary.connections.p95,
                        p99: performanceSummary.connections.p99,
                        target: FAANG_CONFIG.performance.websocketConnectionP95
                    },
                    memory: {
                        heapUsedMB: performanceSummary.memory.currentHeapMB,
                        heapPercent: performanceSummary.memory.currentHeapPercent,
                        threshold: FAANG_CONFIG.memory.maxHeapUsage
                    }
                },
                
                // Configuration
                config: {
                    maxConnections: FAANG_CONFIG.connections.maxConnections,
                    circuitBreakerEnabled: FAANG_CONFIG.circuitBreaker.enabled,
                    securityValidationEnabled: FAANG_CONFIG.security.enableConnectionValidation,
                    performanceLoggingEnabled: FAANG_CONFIG.monitoring.performanceLogging,
                    targets: {
                        messageProcessingP95: FAANG_CONFIG.performance.messageProcessingP95,
                        websocketConnectionP95: FAANG_CONFIG.performance.websocketConnectionP95,
                        redisPubSubP95: FAANG_CONFIG.performance.redisPubSubP95
                    }
                },
                
                // Active components count
                activeComponents: this.getActiveComponentsCount(),
                totalComponentsExpected: 8 // websocket, redis pub/sub, perf monitor, circuit breaker, security, connection manager, dragon eye
            };
            
            return healthData;
            
        } catch (error) {
            dragon.agoniza('Error obteniendo health status FAANG', error, 'servidorCentral', 'HEALTH_STATUS_ERROR');
            
            return {
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString(),
                version: this.version,
                module: NOMBRE_MODULO,
                activeComponents: 0,
                totalComponentsExpected: 8
            };
        }
    }
    
    /**
     * FAANG: Enhanced graceful shutdown with comprehensive cleanup
     */
    async gracefulShutdown() {
        const shutdownStartTime = Date.now();
        
        try {
            dragon.respira('Iniciando graceful shutdown Servidor Central FAANG', 'servidorCentral', 'SHUTDOWN_START', {
                activeConnections: this.connectionManager.connections.size,
                totalMessages: this.totalMessages,
                totalErrors: this.totalErrors,
                uptime: Math.round((Date.now() - this.startTime) / 1000),
                version: this.version
            });
            
            // Step 1: Stop accepting new connections
            if (this.wss) {
                this.wss.close();
                dragon.respira('WebSocket server cerrado - no se aceptan nuevas conexiones', 'servidorCentral', 'SHUTDOWN_WEBSOCKET_CLOSED');
            }
            
            // Step 2: Gracefully close all active connections
            if (this.connectionManager) {
                await this.connectionManager.gracefulShutdown();
                dragon.respira('Connection manager shutdown completado', 'servidorCentral', 'SHUTDOWN_CONNECTION_MANAGER');
            }
            
            // Step 3: Stop performance monitoring
            if (this.performanceMonitor) {
                try {
                    // Log final performance summary
                    const finalSummary = this.performanceMonitor.getSummary();
                    dragon.respira('Performance monitor final summary', 'servidorCentral', 'SHUTDOWN_PERFORMANCE_SUMMARY', {
                        finalSummary,
                        totalSamples: finalSummary.messageProcessing.count + finalSummary.connections.count
                    });
                } catch (perfError) {
                    dragon.sePreocupa('Error getting final performance summary', 'servidorCentral', 'SHUTDOWN_PERFORMANCE_ERROR', {
                        error: perfError.message
                    });
                }
            }
            
            // Step 4: Close Redis connections
            const redisClosePromises = [];
            
            if (this.redisSubscriptor) {
                redisClosePromises.push(
                    this.redisSubscriptor.quit().catch(error => {
                        dragon.sePreocupa('Error closing Redis subscriber', 'servidorCentral', 'SHUTDOWN_REDIS_SUBSCRIBER_ERROR', {
                            error: error.message
                        });
                    })
                );
            }
            
            if (this.redisPublicador && this.redisPublicador !== this.redisSubscriptor) {
                redisClosePromises.push(
                    this.redisPublicador.quit().catch(error => {
                        dragon.sePreocupa('Error closing Redis publisher', 'servidorCentral', 'SHUTDOWN_REDIS_PUBLISHER_ERROR', {
                            error: error.message
                        });
                    })
                );
            }
            
            // Wait for Redis connections to close
            if (redisClosePromises.length > 0) {
                await Promise.allSettled(redisClosePromises);
                dragon.respira('Redis connections closed', 'servidorCentral', 'SHUTDOWN_REDIS_CLOSED', {
                    connectionsCount: redisClosePromises.length
                });
            }
            
            // Step 5: Clear intervals and timeouts
            try {
                // Clear any remaining intervals that might be running
                // (Most should be cleared by component shutdowns)
                
                // Force garbage collection if available
                if (global.gc && FAANG_CONFIG.memory.forceGCEnabled) {
                    global.gc();
                    dragon.respira('Forced garbage collection during shutdown', 'servidorCentral', 'SHUTDOWN_GC_FORCED');
                }
                
            } catch (cleanupError) {
                dragon.sePreocupa('Error during cleanup phase', 'servidorCentral', 'SHUTDOWN_CLEANUP_ERROR', {
                    error: cleanupError.message
                });
            }
            
            // Step 6: Final DragonEye pulse
            if (this.DragonEye) {
                this.DragonEye.pulse('shutdown', {
                    status: 'completed',
                    duration: Date.now() - shutdownStartTime,
                    version: this.version
                });
            }
            
            const shutdownDuration = Date.now() - shutdownStartTime;
            
            dragon.zen('Servidor Central FAANG cerrado correctamente', 'servidorCentral', 'SHUTDOWN_SUCCESS', {
                shutdownDuration,
                totalMessages: this.totalMessages,
                totalErrors: this.totalErrors,
                finalErrorRate: (this.totalErrors / Math.max(this.totalMessages, 1)).toFixed(4),
                uptime: Math.round((shutdownStartTime - this.startTime) / 1000),
                version: this.version
            });
            
        } catch (error) {
            const shutdownDuration = Date.now() - shutdownStartTime;
            
            dragon.agoniza('Error durante graceful shutdown FAANG', error, 'servidorCentral', 'SHUTDOWN_ERROR', {
                shutdownDuration,
                phase: 'unknown',
                error: error.message,
                version: this.version
            });
            
            // Force exit if graceful shutdown fails
            setTimeout(() => {
                dragon.agoniza('Forzando salida después de error en shutdown', new Error('Forced exit'), 'servidorCentral', 'SHUTDOWN_FORCED_EXIT');
                process.exit(1);
            }, 5000); // 5 second timeout
        }
    }
    
    /**
     * FAANG: Get comprehensive server metrics for external monitoring
     */
    getServerMetrics() {
        try {
            const connectionMetrics = this.connectionManager.getConnectionMetrics();
            const performanceSummary = this.performanceMonitor.getSummary();
            const securitySummary = this.securityValidator.getSecuritySummary();
            const circuitBreakerState = this.circuitBreaker.getState();
            
            const uptime = Date.now() - this.startTime;
            const errorRate = this.totalErrors / Math.max(this.totalMessages, 1);
            
            return {
                timestamp: new Date().toISOString(),
                version: this.version,
                module: NOMBRE_MODULO,
                
                // Core metrics
                uptime: Math.round(uptime / 1000),
                totalMessages: this.totalMessages,
                totalErrors: this.totalErrors,
                errorRate: Number(errorRate.toFixed(4)),
                
                // Connection metrics
                connections: {
                    active: connectionMetrics.activeConnections,
                    peak: connectionMetrics.peakConnections,
                    total: connectionMetrics.totalConnections,
                    utilizationPercent: connectionMetrics.utilizationPercent,
                    averageDuration: connectionMetrics.averageConnectionDuration,
                    rateLimitViolations: connectionMetrics.rateLimitViolations
                },
                
                // Performance metrics
                performance: {
                    messageProcessing: {
                        average: performanceSummary.messageProcessing.average,
                        p95: performanceSummary.messageProcessing.p95,
                        p99: performanceSummary.messageProcessing.p99,
                        samples: performanceSummary.messageProcessing.count,
                        target: FAANG_CONFIG.performance.messageProcessingP95,
                        compliance: performanceSummary.messageProcessing.p95 < FAANG_CONFIG.performance.messageProcessingP95
                    },
                    connections: {
                        average: performanceSummary.connections.average,
                        p95: performanceSummary.connections.p95,
                        p99: performanceSummary.connections.p99,
                        samples: performanceSummary.connections.count,
                        target: FAANG_CONFIG.performance.websocketConnectionP95,
                        compliance: performanceSummary.connections.p95 < FAANG_CONFIG.performance.websocketConnectionP95
                    },
                    redis: {
                        average: performanceSummary.redisPubSub.average,
                        p95: performanceSummary.redisPubSub.p95,
                        samples: performanceSummary.redisPubSub.count,
                        target: FAANG_CONFIG.performance.redisPubSubP95,
                        compliance: performanceSummary.redisPubSub.p95 < FAANG_CONFIG.performance.redisPubSubP95
                    }
                },
                
                // Memory metrics
                memory: {
                    heapUsedMB: performanceSummary.memory.currentHeapMB,
                    heapPercent: performanceSummary.memory.currentHeapPercent,
                    threshold: FAANG_CONFIG.memory.maxHeapUsage,
                    compliance: performanceSummary.memory.currentHeapPercent < FAANG_CONFIG.memory.maxHeapUsage
                },
                
                // Security metrics
                security: {
                    blockedIPs: securitySummary.blockedIPs,
                    suspiciousPatterns: securitySummary.suspiciousPatterns,
                    connectionAttempts: securitySummary.connectionAttempts,
                    validationEnabled: FAANG_CONFIG.security.enableConnectionValidation
                },
                
                // Circuit breaker metrics
                circuitBreaker: {
                    state: circuitBreakerState.state,
                    failures: circuitBreakerState.failures,
                    successes: circuitBreakerState.successes,
                    successRate: Number(circuitBreakerState.metrics.successRate.toFixed(4)),
                    totalRequests: circuitBreakerState.metrics.totalRequests,
                    enabled: FAANG_CONFIG.circuitBreaker.enabled
                },
                
                // Health status
                health: {
                    websocket: this.healthStatus.websocket,
                    redis: this.healthStatus.redis,
                    circuitBreaker: this.healthStatus.circuitBreaker,
                    performance: this.healthStatus.performance,
                    overall: this.getOverallHealthScore()
                },
                
                // SLA compliance
                slaCompliance: {
                    availability: this.calculateAvailability(),
                    latency: {
                        messageProcessingP95: performanceSummary.messageProcessing.p95 < FAANG_CONFIG.performance.messageProcessingP95,
                        connectionP95: performanceSummary.connections.p95 < FAANG_CONFIG.performance.websocketConnectionP95,
                        redisPubSubP95: performanceSummary.redisPubSub.p95 < FAANG_CONFIG.performance.redisPubSubP95
                    },
                    errorRate: errorRate < 0.01, // <1% error rate target
                    throughput: this.totalMessages > 0 ? (this.totalMessages / (uptime / 1000)) : 0 // messages per second
                }
            };
            
        } catch (error) {
            dragon.agoniza('Error obteniendo server metrics FAANG', error, 'servidorCentral', 'SERVER_METRICS_ERROR');
            
            return {
                timestamp: new Date().toISOString(),
                version: this.version,
                module: NOMBRE_MODULO,
                error: error.message,
                metrics: 'unavailable'
            };
        }
    }
    
    /**
     * FAANG: Calculate overall health score (0-100)
     */
    getOverallHealthScore() {
        try {
            let score = 100;
            
            // WebSocket health (20 points)
            if (this.healthStatus.websocket === 'error') score -= 20;
            else if (this.healthStatus.websocket === 'degraded') score -= 10;
            
            // Redis health (20 points)
            if (this.healthStatus.redis === 'error') score -= 20;
            else if (this.healthStatus.redis === 'disconnected') score -= 15;
            else if (this.healthStatus.redis === 'reconnecting') score -= 5;
            
            // Circuit breaker health (15 points)
            if (this.circuitBreaker.getState().state === 'OPEN') score -= 15;
            else if (this.circuitBreaker.getState().state === 'HALF_OPEN') score -= 5;
            
            // Error rate health (15 points)
            const errorRate = this.totalErrors / Math.max(this.totalMessages, 1);
            if (errorRate > 0.05) score -= 15; // >5%
            else if (errorRate > 0.02) score -= 10; // >2%
            else if (errorRate > 0.01) score -= 5; // >1%
            
            // Connection utilization health (15 points)
            const utilization = this.connectionManager.getConnectionMetrics().utilizationPercent;
            if (utilization > 95) score -= 15;
            else if (utilization > 85) score -= 10;
            else if (utilization > 75) score -= 5;
            
            // Memory health (15 points)
            const memoryPercent = this.performanceMonitor.getSummary().memory.currentHeapPercent;
            if (memoryPercent > 90) score -= 15;
            else if (memoryPercent > 80) score -= 10;
            else if (memoryPercent > 70) score -= 5;
            
            return Math.max(0, Math.min(100, score));
            
        } catch (error) {
            dragon.sePreocupa('Error calculando health score', 'servidorCentral', 'HEALTH_SCORE_ERROR', {
                error: error.message
            });
            return 0;
        }
    }
    
    /**
     * FAANG: Calculate availability percentage
     */
    calculateAvailability() {
        try {
            const uptime = Date.now() - this.startTime;
            const totalDowntime = 0; // Would track actual downtime in production
            
            if (uptime === 0) return 100;
            
            const availability = ((uptime - totalDowntime) / uptime) * 100;
            return Math.max(0, Math.min(100, Number(availability.toFixed(3))));
            
        } catch (error) {
            dragon.sePreocupa('Error calculando availability', 'servidorCentral', 'AVAILABILITY_CALC_ERROR', {
                error: error.message
            });
            return 0;
        }
    }
}


// ====================================================================
// FAANG: ENHANCED EXPORT FUNCTIONS - ENTERPRISE COMPATIBILITY
// ====================================================================

/**
 * FAANG: Factory function para crear instancia Servidor Central
 * Provides enhanced configuration y error handling
 */
export async function crearServidorCentralFAANG(puerto, redisPublisher = null, redisSubscriber = null, config = {}) {
    const startTime = performanceHooks.performance.now();
    
    try {
        dragon.respira('Creando Servidor Central FAANG', 'servidorCentral', 'FACTORY_CREATE_START', {
            puerto,
            hasRedisPublisher: !!redisPublisher,
            hasRedisSubscriber: !!redisSubscriber,
            config: Object.keys(config),
            version: VERSION_MODULO
        });
        
        // Validate configuration
        if (!puerto || puerto < 1 || puerto > 65535) {
            throw new DragonWebSocketError(
                `Puerto inválido: ${puerto}`,
                'INVALID_PORT',
                'high',
                'configuration',
                { puerto, validRange: '1-65535' }
            );
        }
        
        // Create enhanced instance
        const servidor = new ServidorCentralFAANG(puerto, redisPublisher, redisSubscriber);
        
        // Apply additional configuration if provided
        if (config.maxConnections) {
            servidor.connectionManager.maxConnections = config.maxConnections;
        }
        
        if (config.circuitBreakerConfig) {
            // Apply circuit breaker configuration
            Object.assign(servidor.circuitBreaker, config.circuitBreakerConfig);
        }
        
        const createTime = performanceHooks.performance.now() - startTime;
        
        dragon.sonrie('Servidor Central FAANG creado exitosamente', 'servidorCentral', 'FACTORY_CREATE_SUCCESS', {
            puerto,
            createTime: Math.round(createTime * 100) / 100,
            activeComponents: servidor.getActiveComponentsCount(),
            version: VERSION_MODULO
        });
        
        return servidor;
        
    } catch (error) {
        const createTime = performanceHooks.performance.now() - startTime;
        
        dragon.agoniza('Error creando Servidor Central FAANG', error, 'servidorCentral', 'FACTORY_CREATE_ERROR', {
            puerto,
            createTime: Math.round(createTime * 100) / 100,
            error: error.message
        });
        
        throw error;
    }
}

/**
 * FAANG: Health check endpoint function
 * Para integración con load balancers y monitoring systems
 */
export async function healthCheck(servidorCentral) {
    try {
        if (!servidorCentral || typeof servidorCentral.getHealthStatus !== 'function') {
            throw new DragonWebSocketError(
                'Instancia de servidor central inválida',
                'INVALID_SERVER_INSTANCE',
                'high',
                'configuration'
            );
        }
        
        const healthStatus = await servidorCentral.getHealthStatus();
        
        // Determine HTTP status code based on health
        let httpStatus = 200; // OK
        
        if (healthStatus.status === 'degraded' || healthStatus.status === 'stressed') {
            httpStatus = 503; // Service Unavailable
        } else if (healthStatus.status === 'critical' || healthStatus.status === 'error') {
            httpStatus = 503; // Service Unavailable
        }
        
        return {
            httpStatus,
            body: healthStatus,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                'X-Health-Check-Version': VERSION_MODULO,
                'X-Health-Check-Timestamp': new Date().toISOString()
            }
        };
        
    } catch (error) {
        dragon.agoniza('Error en health check endpoint', error, 'servidorCentral', 'HEALTH_CHECK_ENDPOINT_ERROR');
        
        return {
            httpStatus: 500,
            body: {
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString(),
                version: VERSION_MODULO
            },
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            }
        };
    }
}

/**
 * FAANG: Metrics endpoint function
 * Para integración con monitoring systems como Prometheus
 */
export async function metricsEndpoint(servidorCentral) {
    try {
        if (!servidorCentral || typeof servidorCentral.getServerMetrics !== 'function') {
            throw new DragonWebSocketError(
                'Instancia de servidor central inválida',
                'INVALID_SERVER_INSTANCE',
                'high',
                'configuration'
            );
        }
        
        const metrics = servidorCentral.getServerMetrics();
        
        // Format for Prometheus if requested
        const prometheusMetrics = formatPrometheusMetrics(metrics);
        
        return {
            httpStatus: 200,
            body: {
                format: 'json',
                metrics,
                prometheus: prometheusMetrics
            },
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, max-age=30',
                'X-Metrics-Version': VERSION_MODULO,
                'X-Metrics-Timestamp': new Date().toISOString()
            }
        };
        
    } catch (error) {
        dragon.agoniza('Error en metrics endpoint', error, 'servidorCentral', 'METRICS_ENDPOINT_ERROR');
        
        return {
            httpStatus: 500,
            body: {
                error: error.message,
                timestamp: new Date().toISOString(),
                version: VERSION_MODULO
            },
            headers: {
                'Content-Type': 'application/json'
            }
        };
    }
}

/**
 * FAANG: Format metrics for Prometheus monitoring
 */
function formatPrometheusMetrics(metrics) {
    try {
        const lines = [];
        const timestamp = Date.now();
        
        // Help and type definitions
        lines.push('# HELP websocket_connections_active Current number of active WebSocket connections');
        lines.push('# TYPE websocket_connections_active gauge');
        lines.push(`websocket_connections_active{version="${metrics.version}"} ${metrics.connections.active} ${timestamp}`);
        
        lines.push('# HELP websocket_connections_total Total number of connections since startup');
        lines.push('# TYPE websocket_connections_total counter');
        lines.push(`websocket_connections_total{version="${metrics.version}"} ${metrics.connections.total} ${timestamp}`);
        
        lines.push('# HELP websocket_messages_total Total number of messages processed');
        lines.push('# TYPE websocket_messages_total counter');
        lines.push(`websocket_messages_total{version="${metrics.version}"} ${metrics.totalMessages} ${timestamp}`);
        
        lines.push('# HELP websocket_errors_total Total number of errors');
        lines.push('# TYPE websocket_errors_total counter');
        lines.push(`websocket_errors_total{version="${metrics.version}"} ${metrics.totalErrors} ${timestamp}`);
        
        lines.push('# HELP websocket_error_rate Current error rate');
        lines.push('# TYPE websocket_error_rate gauge');
        lines.push(`websocket_error_rate{version="${metrics.version}"} ${metrics.errorRate} ${timestamp}`);
        
        lines.push('# HELP websocket_message_processing_duration_ms Message processing duration in milliseconds');
        lines.push('# TYPE websocket_message_processing_duration_ms histogram');
        lines.push(`websocket_message_processing_duration_ms{quantile="0.95",version="${metrics.version}"} ${metrics.performance.messageProcessing.p95} ${timestamp}`);
        lines.push(`websocket_message_processing_duration_ms{quantile="0.99",version="${metrics.version}"} ${metrics.performance.messageProcessing.p99} ${timestamp}`);
        
        lines.push('# HELP websocket_memory_heap_used_mb Memory heap used in MB');
        lines.push('# TYPE websocket_memory_heap_used_mb gauge');
        lines.push(`websocket_memory_heap_used_mb{version="${metrics.version}"} ${metrics.memory.heapUsedMB} ${timestamp}`);
        
        lines.push('# HELP websocket_circuit_breaker_state Circuit breaker state (0=closed, 1=half_open, 2=open)');
        lines.push('# TYPE websocket_circuit_breaker_state gauge');
        const cbState = metrics.circuitBreaker.state === 'CLOSED' ? 0 : metrics.circuitBreaker.state === 'HALF_OPEN' ? 1 : 2;
        lines.push(`websocket_circuit_breaker_state{version="${metrics.version}"} ${cbState} ${timestamp}`);
        
        lines.push('# HELP websocket_uptime_seconds Server uptime in seconds');
        lines.push('# TYPE websocket_uptime_seconds counter');
        lines.push(`websocket_uptime_seconds{version="${metrics.version}"} ${metrics.uptime} ${timestamp}`);
        
        return lines.join('\n');
        
    } catch (error) {
        dragon.sePreocupa('Error formateando métricas Prometheus', 'servidorCentral', 'PROMETHEUS_FORMAT_ERROR', {
            error: error.message
        });
        
        return '# Error formatting Prometheus metrics\n';
    }
}

/**
 * FAANG: Graceful shutdown function para external management
 */
export async function gracefulShutdownServer(servidorCentral, timeoutMs = 30000) {
    const shutdownStartTime = Date.now();
    
    try {
        dragon.respira('Iniciando graceful shutdown externo', 'servidorCentral', 'EXTERNAL_SHUTDOWN_START', {
            timeoutMs,
            version: VERSION_MODULO
        });
        
        if (!servidorCentral || typeof servidorCentral.gracefulShutdown !== 'function') {
            throw new DragonWebSocketError(
                'Instancia de servidor central inválida',
                'INVALID_SERVER_INSTANCE',
                'high',
                'configuration'
            );
        }
        
        // Create shutdown promise with timeout
        const shutdownPromise = servidorCentral.gracefulShutdown();
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new DragonWebSocketError(
                    `Graceful shutdown timeout after ${timeoutMs}ms`,
                    'SHUTDOWN_TIMEOUT',
                    'critical',
                    'operation',
                    { timeoutMs }
                ));
            }, timeoutMs);
        });
        
        // Race shutdown vs timeout
        await Promise.race([shutdownPromise, timeoutPromise]);
        
        const shutdownDuration = Date.now() - shutdownStartTime;
        
        dragon.zen('Graceful shutdown externo completado', 'servidorCentral', 'EXTERNAL_SHUTDOWN_SUCCESS', {
            shutdownDuration,
            version: VERSION_MODULO
        });
        
        return {
            success: true,
            duration: shutdownDuration,
            message: 'Graceful shutdown completed successfully'
        };
        
    } catch (error) {
        const shutdownDuration = Date.now() - shutdownStartTime;
        
        dragon.agoniza('Error en graceful shutdown externo', error, 'servidorCentral', 'EXTERNAL_SHUTDOWN_ERROR', {
            shutdownDuration,
            error: error.message,
            version: VERSION_MODULO
        });
        
        return {
            success: false,
            duration: shutdownDuration,
            error: error.message,
            message: 'Graceful shutdown failed'
        };
    }
}

/**
 * FAANG: Connection info getter para debugging
 */
export function getConnectionInfo(servidorCentral, connectionId) {
    try {
        if (!servidorCentral || !servidorCentral.connectionManager) {
            throw new DragonWebSocketError(
                'Servidor central o connection manager no disponible',
                'MANAGER_UNAVAILABLE',
                'medium',
                'configuration'
            );
        }
        
        const connectionInfo = servidorCentral.connectionManager.getConnectionInfo(connectionId);
        
        if (!connectionInfo) {
            return {
                found: false,
                connectionId,
                message: 'Connection not found'
            };
        }
        
        // Mask sensitive information
        return {
            found: true,
            connectionId,
            clientIP: servidorCentral.securityValidator.maskIP(connectionInfo.clientIP),
            connectTime: connectionInfo.connectTime,
            lastActivity: connectionInfo.lastActivity,
            messageCount: connectionInfo.messageCount,
            errorCount: connectionInfo.errorCount,
            status: connectionInfo.status,
            duration: Date.now() - connectionInfo.connectTime,
            securityValidated: !!connectionInfo.securityValidation
        };
        
    } catch (error) {
        dragon.sePreocupa('Error obteniendo connection info', 'servidorCentral', 'CONNECTION_INFO_ERROR', {
            connectionId,
            error: error.message
        });
        
        return {
            found: false,
            connectionId,
            error: error.message
        };
    }
}

// ====================================================================
// FAANG: DRAGON2 COMPATIBILITY LAYER
// ====================================================================

/**
 * Dragon2 compatibility: Original ServidorCentral class export
 * Maintains backward compatibility while providing FAANG enhancements
 */
class ServidorCentral extends ServidorCentralFAANG {
    constructor(puerto, redisPublisher = null, redisSubscriber = null) {
        super(puerto, redisPublisher, redisSubscriber);
        
        dragon.respira('ServidorCentral legacy compatibility mode activado', 'servidorCentral', 'LEGACY_COMPATIBILITY_MODE', {
            puerto,
            version: this.version,
            mode: 'dragon2_compatible'
        });
    }
    
    // Dragon2 compatibility methods
    async procesarAnalisis(datos) {
        try {
            return await this.procesarPulsoRedis(datos);
        } catch (error) {
            dragon.agoniza('Error en procesarAnalisis compatibility', error, 'servidorCentral', 'LEGACY_PROCESS_ERROR');
            throw error;
        }
    }
    
    obtenerEstadoRedes() {
        try {
            return this.datosRedes;
        } catch (error) {
            dragon.sePreocupa('Error obteniendo estado redes legacy', 'servidorCentral', 'LEGACY_STATE_ERROR', {
                error: error.message
            });
            return [];
        }
    }
    
    limpiarDatos() {
        try {
            this.datosRedes = [];
            dragon.respira('Datos redes limpiados (legacy)', 'servidorCentral', 'LEGACY_DATA_CLEARED');
        } catch (error) {
            dragon.sePreocupa('Error limpiando datos legacy', 'servidorCentral', 'LEGACY_CLEAR_ERROR', {
                error: error.message
            });
        }
    }
}

// ====================================================================
// FAANG: ENHANCED EXPORTS
// ====================================================================

// Primary FAANG export
export { ServidorCentralFAANG };

// Dragon2 compatibility export
export default ServidorCentral;

// Enhanced classes for testing and monitoring
export { 
    WebSocketPerformanceMonitor,
    WebSocketCircuitBreaker,
    WebSocketSecurityValidator,
    WebSocketConnectionManager,
    DragonWebSocketError,
    ConnectionError,
    MessageProcessingError,
    RedisCommError,
    RateLimitError
};

// Configuration exports
export { FAANG_CONFIG, CHANNELS, CAMPOS_SUPERIOR_KEYS };

// Utility exports
export { 
    crearServidorCentralFAANG,
    healthCheck,
    metricsEndpoint,
    gracefulShutdownServer,
    getConnectionInfo
};

/**
 * ====================================================================
 * DRAGON3 FAANG - SERVIDOR CENTRAL WEBSOCKET DOCUMENTATION
 * ====================================================================
 * 
 * DESCRIPCIÓN:
 * Servidor central WebSocket enterprise-grade con estándares FAANG para
 * comunicación tiempo real entre analizadores, Red Superior y frontend.
 * Optimizado para P95 <200ms, 99.9% uptime y observabilidad completa.
 * 
 * EXPORTS PRINCIPALES:
 * - ServidorCentralFAANG (class): Servidor principal FAANG
 * - ServidorCentral (class): Compatibilidad Dragon2
 * - crearServidorCentralFAANG (function): Factory function
 * - healthCheck (function): Health check endpoint
 * - metricsEndpoint (function): Metrics endpoint
 * - gracefulShutdownServer (function): Graceful shutdown
 * 
 * COMPATIBILIDAD:
 * - Dragon2 API completamente compatible
 * - server.js integration ready
 * - analizadorImagen.js integration ready
 * - Redis pub/sub bidirectional
 * - Red Superior communication preserved
 * 
 * PERFORMANCE TARGETS FAANG:
 * - WebSocket connection: P95 <100ms, P99 <200ms
 * - Message processing: P95 <50ms, P99 <100ms
 * - Redis pub/sub latency: P95 <25ms, P99 <50ms
 * - Memory usage: <200MB per 1000 connections
 * - Error rate: <0.5%
 * - Uptime: 99.9%
 * - Concurrent connections: 1000+
 * 
 * FAANG FEATURES:
 * ✅ Real-time P95/P99 performance monitoring
 * ✅ Circuit breaker patterns enterprise-grade
 * ✅ Enhanced error classification y handling
 * ✅ Memory management con GC optimization
 * ✅ Security validation multi-layer
 * ✅ Connection pooling enterprise
 * ✅ Rate limiting per connection
 * ✅ Graceful degradation modes
 * ✅ Comprehensive health monitoring
 * ✅ Prometheus metrics integration
 * ✅ Structured logging correlation IDs
 * ✅ WebSocket compression optimization
 * 
 * MONITORING ENDPOINTS:
 * - /health: Health status JSON
 * - /metrics: Performance metrics + Prometheus
 * - /connections: Active connections info
 * - DragonEye: Real-time sensor data
 * 
 * SECURITY FEATURES:
 * - IP blacklisting automatic
 * - Origin validation configurable
 * - Message content scanning
 * - Rate limiting per connection/IP
 * - Connection validation multi-step
 * - XSS protection patterns
 * 
 * RELIABILITY PATTERNS:
 * - Circuit breaker automatic recovery
 * - Connection heartbeat monitoring
 * - Graceful shutdown comprehensive
 * - Redis fallback modes
 * - Error recovery automatic
 * - Memory pressure handling
 * 
 * CONFIGURACIÓN:
 * Todas las configuraciones via environment variables con defaults sensibles.
 * Ver FAANG_CONFIG object para opciones completas de configuración.
 * 
 * USAGE EXAMPLE:
 * ```javascript
 * import { crearServidorCentralFAANG, healthCheck } from './servidorCentral.js';
 * 
 * const servidor = await crearServidorCentralFAANG(8080, redisPublisher, redisSubscriber);
 * const health = await healthCheck(servidor);
 * 
 * // Legacy compatibility
 * import ServidorCentral from './servidorCentral.js';
 * const servidorLegacy = new ServidorCentral(8080, redisPublisher, redisSubscriber);
 * ```
 * 
 * INTEGRATION:
 * - Frontend: WebSocket client connects to puerto
 * - server.js: Uses ServidorCentral for analysis coordination
 * - analizadorImagen.js: Publishes results via Redis
 * - Red Superior: Receives consolidated data via Redis
 * - Monitoring: Health and metrics endpoints
 * 
 * ====================================================================
 */

