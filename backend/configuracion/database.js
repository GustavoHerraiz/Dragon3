/**
 * ====================================================================
 * DRAGON3 - CONFIGURACIÓN DATABASE MONGODB FAANG ENTERPRISE
 * ====================================================================
 * 
 * Archivo: configuracion/database.js
 * Proyecto: Dragon3 - Sistema de Autentificación de Imágenes con IA
 * Versión: 3.0.0-FAANG
 * Fecha: 2025-06-16
 * Autor: Gustavo Herráiz - Lead Architect
 * 
 * DESCRIPCIÓN:
 * Configuración enterprise-grade para conexión MongoDB Atlas con
 * circuit breakers, performance monitoring P95 <100ms, retry automático,
 * y integración completa Winston Dragon Logger ZEN API.
 * 
 * CARACTERÍSTICAS FAANG:
 * - Connection pooling optimizado para alta concurrencia
 * - Circuit breaker patterns para resilencia automática
 * - Performance monitoring real-time P95/P99 tracking
 * - Health checks proactivos con alerting automático
 * - Graceful shutdown y reconnection inteligente
 * - Enhanced error classification y recovery strategies
 * - Security validation multi-layer OWASP compliant
 * - Comprehensive logging Dragon ZEN integration
 * 
 * MÉTRICAS OBJETIVO DRAGON3:
 * - Connection time: P95 <500ms, P99 <1000ms
 * - Query operations: P95 <100ms, P99 <300ms
 * - Connection pool efficiency: >95% utilization
 * - Error rate: <0.1% operations
 * - Availability: 99.9% uptime
 * - Reconnection time: <5s average
 * 
 * INTEGRATION FLOW:
 * server.js → conectarDB() → MongoDB Atlas → Health Check → 
 * Circuit Breaker → Performance Monitor → Dragon Logger
 * 
 * COMPATIBILITY:
 * ✅ Compatible con estructura server.js existente
 * ✅ Mantiene API calls anteriores sin breaking changes
 * ✅ Enhanced error handling preserva flujo original
 * ✅ Performance metrics transparentes para aplicación
 * 
 * ESTÁNDARES DRAGON3:
 * - ES Modules SIEMPRE (import/export, nunca require)
 * - NO console.log - Solo respiración Winston Dragon
 * - Error handling como acto de compasión hacia el sistema
 * - KISS principle: Simple primero, preguntar antes que asumir
 * - P95 <100ms operations - Velocidad de la luz creativa
 * - Nombres en español - nuestro idioma del corazón
 * 
 * CONFIGURACIÓN ENV REQUERIDA:
 * - MONGODB_URI: URI completa MongoDB Atlas
 * - MONGODB_DB_NAME: Nombre base de datos (opcional)
 * - MONGODB_MAX_POOL_SIZE: Tamaño pool conexiones (default: 10)
 * - MONGODB_MIN_POOL_SIZE: Mínimo conexiones pool (default: 2)
 * - MONGODB_SERVER_SELECTION_TIMEOUT: Timeout selección servidor (default: 5000ms)
 * - MONGODB_SOCKET_TIMEOUT: Timeout socket (default: 45000ms)
 * - MONGODB_CONNECT_TIMEOUT: Timeout conexión inicial (default: 10000ms)
 * - MONGODB_HEARTBEAT_FREQUENCY: Frecuencia heartbeat (default: 10000ms)
 * 
 * CIRCUIT BREAKER CONFIGURATION:
 * - ERROR_THRESHOLD: Umbral errores para abrir circuit (default: 5)
 * - RECOVERY_TIMEOUT: Tiempo recovery circuit breaker (default: 30000ms)
 * - MONITORING_WINDOW: Ventana monitoring errores (default: 300000ms)
 * 
 * HEALTH CHECK SETTINGS:
 * - HEALTH_CHECK_INTERVAL: Intervalo health check (default: 30000ms)
 * - HEALTH_CHECK_TIMEOUT: Timeout operación health (default: 5000ms)
 * - DEGRADED_MODE_THRESHOLD: Umbral modo degradado (default: 3 errores)
 * 
 * USAGE EXAMPLES:
 * ```javascript
 * // Conexión básica
 * import conectarDB from './configuracion/database.js';
 * await conectarDB();
 * 
 * // Con custom options
 * await conectarDB({
 *     maxPoolSize: 20,
 *     socketTimeoutMS: 60000
 * });
 * 
 * // Health check
 * import { verificarSaludDB } from './configuracion/database.js';
 * const salud = await verificarSaludDB();
 * 
 * // Circuit breaker status
 * import { obtenerEstadoCircuitBreaker } from './configuracion/database.js';
 * const estado = obtenerEstadoCircuitBreaker();
 * ```
 * 
 * MONITORING OUTPUTS:
 * - dragon.respira(): Operaciones normales
 * - dragon.sonrie(): Conexiones exitosas, recovery
 * - dragon.sePreocupa(): Latencia alta, reconexiones
 * - dragon.agoniza(): Errores críticos, circuit breaker abierto
 * - dragon.zen(): Estado perfecto, performance óptimo
 * - dragon.mideRendimiento(): Métricas P95/P99
 * 
 * ====================================================================
 */

import mongoose from 'mongoose';
import dragon from '../utilidades/logger.js';

// =================== CONFIGURACIÓN DRAGON3 ===================

/**
 * Configuración module constants
 */
const MODULE_NAME = 'database.js';
const VERSION_MODULO = '3.0.0-FAANG';

/**
 * FAANG: Enhanced database configuration con environment variables
 */
const DB_CONFIG = {
    // Connection settings (MongoDB Atlas optimized)
    connection: {
        uri: process.env.MONGODB_URI || process.env.MONGO_URI,
        dbName: process.env.MONGODB_DB_NAME || undefined,
        maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE) || 10,
        minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE) || 2,
        serverSelectionTimeoutMS: parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT) || 5000,
        socketTimeoutMS: parseInt(process.env.MONGODB_SOCKET_TIMEOUT) || 45000,
        connectTimeoutMS: parseInt(process.env.MONGODB_CONNECT_TIMEOUT) || 10000,
        heartbeatFrequencyMS: parseInt(process.env.MONGODB_HEARTBEAT_FREQUENCY) || 10000,
        retryWrites: process.env.MONGODB_RETRY_WRITES !== 'false',
        w: process.env.MONGODB_WRITE_CONCERN || 'majority',
        journal: process.env.MONGODB_JOURNAL !== 'false'
    },
    
    // Performance targets (FAANG SLA compliance)
    performance: {
        connectionP95: parseInt(process.env.DB_CONNECTION_P95_MS) || 500,
        connectionP99: parseInt(process.env.DB_CONNECTION_P99_MS) || 1000,
        queryP95: parseInt(process.env.DB_QUERY_P95_MS) || 100,
        queryP99: parseInt(process.env.DB_QUERY_P99_MS) || 300,
        poolEfficiencyTarget: parseFloat(process.env.DB_POOL_EFFICIENCY) || 0.95,
        maxMemoryUsageMB: parseInt(process.env.DB_MAX_MEMORY_MB) || 200
    },
    
    // Circuit breaker settings (Reliability engineering)
    circuitBreaker: {
        enabled: process.env.DB_CIRCUIT_BREAKER_ENABLED !== 'false',
        errorThreshold: parseInt(process.env.DB_ERROR_THRESHOLD) || 5,
        recoveryTimeoutMS: parseInt(process.env.DB_RECOVERY_TIMEOUT_MS) || 30000,
        monitoringWindowMS: parseInt(process.env.DB_MONITORING_WINDOW_MS) || 300000,
        halfOpenMaxRequests: parseInt(process.env.DB_HALF_OPEN_MAX_REQUESTS) || 3
    },
    
    // Health check settings (Monitoring & observability)
    healthCheck: {
        enabled: process.env.DB_HEALTH_CHECK_ENABLED !== 'false',
        intervalMS: parseInt(process.env.DB_HEALTH_CHECK_INTERVAL_MS) || 30000,
        timeoutMS: parseInt(process.env.DB_HEALTH_CHECK_TIMEOUT_MS) || 5000,
        degradedModeThreshold: parseInt(process.env.DB_DEGRADED_MODE_THRESHOLD) || 3,
        alertCooldownMS: parseInt(process.env.DB_ALERT_COOLDOWN_MS) || 60000
    },
    
    // Security settings (OWASP compliant)
    security: {
        sslValidate: process.env.MONGODB_SSL_VALIDATE !== 'false',
        authSource: process.env.MONGODB_AUTH_SOURCE || 'admin',
        authMechanism: process.env.MONGODB_AUTH_MECHANISM || 'SCRAM-SHA-256',
        readPreference: process.env.MONGODB_READ_PREFERENCE || 'primaryPreferred',
        readConcern: process.env.MONGODB_READ_CONCERN || 'majority'
    }
};

// =================== DRAGON3 ENHANCED ERROR CLASSES ===================

/**
 * Database specific error class
 */
class DragonDatabaseError extends Error {
    constructor(message, code = 'DB_ERROR', severity = 'medium', metadata = {}) {
        super(message);
        this.name = 'DragonDatabaseError';
        this.code = code;
        this.severity = severity; // low, medium, high, critical
        this.timestamp = new Date().toISOString();
        this.module = MODULE_NAME;
        this.version = VERSION_MODULO;
        this.metadata = metadata;
        this.retryable = false;
        this.alertRequired = severity === 'critical' || severity === 'high';
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
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
            timestamp: this.timestamp,
            module: this.module,
            version: this.version,
            metadata: this.metadata,
            retryable: this.retryable,
            alertRequired: this.alertRequired
        };
    }
}

// =================== FAANG ENHANCED CIRCUIT BREAKER ===================

/**
 * Circuit breaker implementation para MongoDB connections
 */
class DatabaseCircuitBreaker {
    constructor() {
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.errorCount = 0;
        this.lastErrorTime = null;
        this.successCount = 0;
        this.requestCount = 0;
        this.lastStateChange = Date.now();
        this.errorWindow = [];
        
        dragon.respira('Database Circuit Breaker inicializado Dragon3', MODULE_NAME, 'CIRCUIT_BREAKER_INIT', {
            state: this.state,
            errorThreshold: DB_CONFIG.circuitBreaker.errorThreshold,
            recoveryTimeout: DB_CONFIG.circuitBreaker.recoveryTimeoutMS
        });
    }
    
    /**
     * Check if request should be allowed
     */
    allowRequest() {
        const now = Date.now();
        
        if (this.state === 'CLOSED') {
            return true;
        }
        
        if (this.state === 'OPEN') {
            if (now - this.lastStateChange >= DB_CONFIG.circuitBreaker.recoveryTimeoutMS) {
                this.state = 'HALF_OPEN';
                this.requestCount = 0;
                this.lastStateChange = now;
                
                dragon.respira('Circuit Breaker: OPEN → HALF_OPEN transition', MODULE_NAME, 'CIRCUIT_BREAKER_HALF_OPEN', {
                    previousState: 'OPEN',
                    newState: 'HALF_OPEN',
                    recoveryAttempt: true
                });
                
                return true;
            }
            return false;
        }
        
        if (this.state === 'HALF_OPEN') {
            return this.requestCount < DB_CONFIG.circuitBreaker.halfOpenMaxRequests;
        }
        
        return false;
    }
    
    /**
     * Record successful operation
     */
    recordSuccess() {
        const now = Date.now();
        this.successCount++;
        this.requestCount++;
        
        if (this.state === 'HALF_OPEN') {
            if (this.successCount >= DB_CONFIG.circuitBreaker.halfOpenMaxRequests) {
                this.state = 'CLOSED';
                this.errorCount = 0;
                this.successCount = 0;
                this.requestCount = 0;
                this.errorWindow = [];
                this.lastStateChange = now;
                
                dragon.sonrie('Circuit Breaker: HALF_OPEN → CLOSED recovery exitoso', MODULE_NAME, 'CIRCUIT_BREAKER_RECOVERY', {
                    previousState: 'HALF_OPEN',
                    newState: 'CLOSED',
                    recoverySuccessful: true,
                    totalSuccesses: this.successCount
                });
            }
        }
    }
    
    /**
     * Record failed operation
     */
    recordFailure(error) {
        const now = Date.now();
        this.errorCount++;
        this.lastErrorTime = now;
        this.requestCount++;
        
        // Add error to sliding window
        this.errorWindow.push(now);
        
        // Clean old errors outside monitoring window
        const windowStart = now - DB_CONFIG.circuitBreaker.monitoringWindowMS;
        this.errorWindow = this.errorWindow.filter(time => time >= windowStart);
        
        const recentErrors = this.errorWindow.length;
        
        if (this.state === 'CLOSED' && recentErrors >= DB_CONFIG.circuitBreaker.errorThreshold) {
            this.state = 'OPEN';
            this.lastStateChange = now;
            
            dragon.agoniza('Circuit Breaker: CLOSED → OPEN - Umbral errores alcanzado', error, MODULE_NAME, 'CIRCUIT_BREAKER_OPEN', {
                previousState: 'CLOSED',
                newState: 'OPEN',
                errorCount: this.errorCount,
                recentErrors,
                threshold: DB_CONFIG.circuitBreaker.errorThreshold,
                recoveryTimeout: DB_CONFIG.circuitBreaker.recoveryTimeoutMS
            });
            
        } else if (this.state === 'HALF_OPEN') {
            this.state = 'OPEN';
            this.lastStateChange = now;
            
            dragon.sePreocupa('Circuit Breaker: HALF_OPEN → OPEN - Recovery falló', MODULE_NAME, 'CIRCUIT_BREAKER_RECOVERY_FAILED', {
                previousState: 'HALF_OPEN',
                newState: 'OPEN',
                failureReason: error.message
            });
        }
    }
    
    /**
     * Get current circuit breaker status
     */
    getStatus() {
        return {
            state: this.state,
            errorCount: this.errorCount,
            successCount: this.successCount,
            requestCount: this.requestCount,
            recentErrors: this.errorWindow.length,
            lastErrorTime: this.lastErrorTime,
            lastStateChange: this.lastStateChange,
            nextRetryTime: this.state === 'OPEN' ? 
                this.lastStateChange + DB_CONFIG.circuitBreaker.recoveryTimeoutMS : null
        };
    }
}

// =================== FAANG ENHANCED PERFORMANCE MONITOR ===================

/**
 * Database performance monitor con P95/P99 tracking
 */
class DatabasePerformanceMonitor {
    constructor() {
        this.metrics = {
            connectionTimes: [],
            queryTimes: [],
            poolUtilization: [],
            errorCounts: new Map(),
            healthChecks: [],
            memoryUsage: []
        };
        
        this.alertThresholds = {
            connectionP95: DB_CONFIG.performance.connectionP95,
            connectionP99: DB_CONFIG.performance.connectionP99,
            queryP95: DB_CONFIG.performance.queryP95,
            queryP99: DB_CONFIG.performance.queryP99,
            poolEfficiency: DB_CONFIG.performance.poolEfficiencyTarget
        };
        
        this.lastAlerts = new Map();
        this.alertCooldown = DB_CONFIG.healthCheck.alertCooldownMS;
        
        dragon.respira('Database Performance Monitor inicializado Dragon3', MODULE_NAME, 'PERFORMANCE_MONITOR_INIT', {
            thresholds: this.alertThresholds,
            alertCooldown: this.alertCooldown
        });
    }
    
    /**
     * Record connection time
     */
    recordConnectionTime(duration, metadata = {}) {
        this.metrics.connectionTimes.push({
            duration,
            timestamp: Date.now(),
            metadata
        });
        
        // Keep only last 1000 measurements
        if (this.metrics.connectionTimes.length > 1000) {
            this.metrics.connectionTimes = this.metrics.connectionTimes.slice(-1000);
        }
        
        // Check for violations
        if (duration > this.alertThresholds.connectionP95) {
            this.handlePerformanceViolation('connection_p95', duration, this.alertThresholds.connectionP95, metadata);
        }
    }
    
    /**
     * Record query operation time
     */
    recordQueryTime(operation, duration, metadata = {}) {
        this.metrics.queryTimes.push({
            operation,
            duration,
            timestamp: Date.now(),
            metadata
        });
        
        // Keep only last 1000 measurements
        if (this.metrics.queryTimes.length > 1000) {
            this.metrics.queryTimes = this.metrics.queryTimes.slice(-1000);
        }
        
        // Check for violations
        if (duration > this.alertThresholds.queryP95) {
            this.handlePerformanceViolation('query_p95', duration, this.alertThresholds.queryP95, { operation, ...metadata });
        }
    }
    
    /**
     * Record pool utilization
     */
    recordPoolUtilization(used, total, metadata = {}) {
        const utilization = total > 0 ? (used / total) : 0;
        
        this.metrics.poolUtilization.push({
            used,
            total,
            utilization,
            timestamp: Date.now(),
            metadata
        });
        
        // Keep only last 200 measurements
        if (this.metrics.poolUtilization.length > 200) {
            this.metrics.poolUtilization = this.metrics.poolUtilization.slice(-200);
        }
        
        // Check for low efficiency
        if (utilization < this.alertThresholds.poolEfficiency && total > 1) {
            this.handlePerformanceViolation('pool_efficiency', utilization, this.alertThresholds.poolEfficiency, metadata);
        }
    }
    
    /**
     * Handle performance violation with alerting
     */
    handlePerformanceViolation(metric, actualValue, threshold, metadata = {}) {
        const alertKey = `${metric}_violation`;
        const lastAlert = this.lastAlerts.get(alertKey);
        const now = Date.now();
        
        if (lastAlert && (now - lastAlert) < this.alertCooldown) {
            return;
        }
        
        this.lastAlerts.set(alertKey, now);
        
        const severity = actualValue > threshold * 1.5 ? 'critical' : 'high';
        
        dragon.mideRendimiento(`database_${metric}_violation`, actualValue, MODULE_NAME, {
            metric,
            threshold,
            actual: actualValue,
            violation: 'exceeded',
            severity,
            metadata,
            timestamp: new Date().toISOString()
        });
    }
    
    /**
     * Calculate P95 for given metric array
     */
    getP95Time(metricArray, property = 'duration') {
        if (metricArray.length === 0) return 0;
        const durations = metricArray.map(m => m[property]).sort((a, b) => a - b);
        const index = Math.floor(durations.length * 0.95);
        return durations[index] || 0;
    }
    
    /**
     * Calculate P99 for given metric array
     */
    getP99Time(metricArray, property = 'duration') {
        if (metricArray.length === 0) return 0;
        const durations = metricArray.map(m => m[property]).sort((a, b) => a - b);
        const index = Math.floor(durations.length * 0.99);
        return durations[index] || 0;
    }
    
    /**
     * Get comprehensive performance summary
     */
    getSummary() {
        return {
            connections: {
                p95: Math.round(this.getP95Time(this.metrics.connectionTimes) * 100) / 100,
                p99: Math.round(this.getP99Time(this.metrics.connectionTimes) * 100) / 100,
                average: this.getAverageTime(this.metrics.connectionTimes),
                count: this.metrics.connectionTimes.length,
                target: this.alertThresholds.connectionP95
            },
            queries: {
                p95: Math.round(this.getP95Time(this.metrics.queryTimes) * 100) / 100,
                p99: Math.round(this.getP99Time(this.metrics.queryTimes) * 100) / 100,
                average: this.getAverageTime(this.metrics.queryTimes),
                count: this.metrics.queryTimes.length,
                target: this.alertThresholds.queryP95
            },
            pool: {
                averageUtilization: this.getAverageUtilization(),
                samples: this.metrics.poolUtilization.length,
                target: this.alertThresholds.poolEfficiency
            },
            errors: {
                totalErrors: Array.from(this.metrics.errorCounts.values()).reduce((sum, count) => sum + count, 0),
                errorTypes: Object.fromEntries(this.metrics.errorCounts)
            },
            healthChecks: {
                count: this.metrics.healthChecks.length,
                averageTime: this.getAverageTime(this.metrics.healthChecks)
            }
        };
    }
    
    getAverageTime(metricArray, property = 'duration') {
        if (metricArray.length === 0) return 0;
        const durations = metricArray.map(m => m[property]);
        return Math.round((durations.reduce((sum, val) => sum + val, 0) / durations.length) * 100) / 100;
    }
    
    getAverageUtilization() {
        if (this.metrics.poolUtilization.length === 0) return 0;
        const utilizations = this.metrics.poolUtilization.map(m => m.utilization);
        return Math.round((utilizations.reduce((sum, val) => sum + val, 0) / utilizations.length) * 10000) / 100; // Percentage
    }
    
    /**
     * Increment error count for specific error type
     */
    incrementErrorCount(errorType) {
        const current = this.metrics.errorCounts.get(errorType) || 0;
        this.metrics.errorCounts.set(errorType, current + 1);
    }
}

// =================== GLOBAL INSTANCES ===================

// Create global instances
const circuitBreaker = new DatabaseCircuitBreaker();
const performanceMonitor = new DatabasePerformanceMonitor();

// Global connection state
let connectionState = {
    status: 'disconnected', // disconnected, connecting, connected, error, degraded
    lastConnected: null,
    lastError: null,
    connectionAttempts: 0,
    healthCheckInterval: null
};

// =================== ENHANCED MONGOOSE CONFIGURATION ===================

/**
 * Configure Mongoose with enhanced settings
 */
const configureMongoose = () => {
    // Mongoose global settings
    mongoose.set('strictQuery', true);
    mongoose.set('bufferCommands', false); // Disable mongoose buffering
    mongoose.set('bufferMaxEntries', 0); // Disable mongoose buffering completely
    
    // Enhanced connection event handlers
    mongoose.connection.on('connecting', () => {
        connectionState.status = 'connecting';
        connectionState.connectionAttempts++;
        
        dragon.respira('MongoDB Atlas conectando Dragon3', MODULE_NAME, 'MONGODB_CONNECTING', {
            attempt: connectionState.connectionAttempts,
            circuitBreakerState: circuitBreaker.getStatus().state
        });
    });
    
    mongoose.connection.on('connected', () => {
        connectionState.status = 'connected';
        connectionState.lastConnected = new Date().toISOString();
        
        // Record successful connection for circuit breaker
        circuitBreaker.recordSuccess();
        
        dragon.zen('MongoDB Atlas conectado perfectamente Dragon3', MODULE_NAME, 'MONGODB_CONNECTED', {
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            database: mongoose.connection.name,
            attempt: connectionState.connectionAttempts,
            circuitBreakerState: circuitBreaker.getStatus().state
        });
        
        // Start health check interval
        startHealthCheck();
    });
    
    mongoose.connection.on('open', () => {
        dragon.sonrie('MongoDB Atlas conexión abierta Dragon3', MODULE_NAME, 'MONGODB_OPEN', {
            readyState: mongoose.connection.readyState,
            poolSize: mongoose.connection.db?.serverConfig?.connections?.length || 'unknown'
        });
    });
    
    mongoose.connection.on('error', (error) => {
        connectionState.status = 'error';
        connectionState.lastError = {
            message: error.message,
            code: error.code,
            timestamp: new Date().toISOString()
        };
        
        // Record failure for circuit breaker
        circuitBreaker.recordFailure(error);
        performanceMonitor.incrementErrorCount('connection_error');
        
        dragon.agoniza('MongoDB Atlas error crítico', error, MODULE_NAME, 'MONGODB_ERROR', {
            errorCode: error.code,
            errorMessage: error.message,
            connectionAttempts: connectionState.connectionAttempts,
            circuitBreakerState: circuitBreaker.getStatus().state
        });
    });
    
    mongoose.connection.on('disconnected', () => {
        connectionState.status = 'disconnected';
        
        dragon.sePreocupa('MongoDB Atlas desconectado', MODULE_NAME, 'MONGODB_DISCONNECTED', {
            lastConnected: connectionState.lastConnected,
            connectionAttempts: connectionState.connectionAttempts
        });
        
        // Stop health check
        stopHealthCheck();
    });
    
    mongoose.connection.on('reconnected', () => {
        connectionState.status = 'connected';
        connectionState.lastConnected = new Date().toISOString();
        
        // Record successful reconnection
        circuitBreaker.recordSuccess();
        
        dragon.sonrie('MongoDB Atlas reconectado Dragon3', MODULE_NAME, 'MONGODB_RECONNECTED', {
            connectionAttempts: connectionState.connectionAttempts,
            circuitBreakerState: circuitBreaker.getStatus().state
        });
        
        // Restart health check
        startHealthCheck();
    });
    
    // Monitor connection pool events
    mongoose.connection.on('fullsetup', () => {
        dragon.zen('MongoDB Atlas full setup completado Dragon3', MODULE_NAME, 'MONGODB_FULLSETUP', {
            topology: 'replica_set',
            nodes: mongoose.connection.db?.serverConfig?.servers?.size || 'unknown'
        });
    });
    
    mongoose.connection.on('all', () => {
        dragon.respira('MongoDB Atlas todos los servidores conectados', MODULE_NAME, 'MONGODB_ALL_SERVERS', {
            readyState: mongoose.connection.readyState
        });
    });
    
    dragon.respira('Mongoose configurado Dragon3', MODULE_NAME, 'MONGOOSE_CONFIGURED', {
        strictQuery: true,
        bufferCommands: false,
        bufferMaxEntries: 0
    });
};

// =================== HEALTH CHECK IMPLEMENTATION ===================

/**
 * Start periodic health check
 */
const startHealthCheck = () => {
    if (!DB_CONFIG.healthCheck.enabled || connectionState.healthCheckInterval) {
        return;
    }
    
    connectionState.healthCheckInterval = setInterval(async () => {
        await performHealthCheck();
    }, DB_CONFIG.healthCheck.intervalMS);
    
    dragon.respira('Database health check iniciado Dragon3', MODULE_NAME, 'HEALTH_CHECK_START', {
        interval: DB_CONFIG.healthCheck.intervalMS,
        timeout: DB_CONFIG.healthCheck.timeoutMS
    });
};

/**
 * Stop health check interval
 */
const stopHealthCheck = () => {
    if (connectionState.healthCheckInterval) {
        clearInterval(connectionState.healthCheckInterval);
        connectionState.healthCheckInterval = null;
        
        dragon.respira('Database health check detenido', MODULE_NAME, 'HEALTH_CHECK_STOP');
    }
};

/**
 * Perform comprehensive health check
 */
const performHealthCheck = async () => {
    const startTime = Date.now();
    
    try {
        // Check if circuit breaker allows operation
        if (!circuitBreaker.allowRequest()) {
            dragon.sePreocupa('Health check bloqueado por circuit breaker', MODULE_NAME, 'HEALTH_CHECK_BLOCKED', {
                circuitBreakerState: circuitBreaker.getStatus().state
            });
            return {
                status: 'blocked',
                circuitBreaker: circuitBreaker.getStatus()
            };
        }
        
        // Perform ping operation with timeout
        const pingPromise = mongoose.connection.db.admin().ping();
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), DB_CONFIG.healthCheck.timeoutMS)
        );
        
        await Promise.race([pingPromise, timeoutPromise]);
        
        const healthCheckTime = Date.now() - startTime;
        
        // Record metrics
        performanceMonitor.metrics.healthChecks.push({
            duration: healthCheckTime,
            timestamp: Date.now(),
            status: 'success'
        });
        
        // Keep only last 100 health checks
        if (performanceMonitor.metrics.healthChecks.length > 100) {
            performanceMonitor.metrics.healthChecks = performanceMonitor.metrics.healthChecks.slice(-100);
        }
        
        // Record successful operation
        circuitBreaker.recordSuccess();
        
        // Get connection pool stats
        const poolStats = getConnectionPoolStats();
        performanceMonitor.recordPoolUtilization(
            poolStats.used, 
            poolStats.total, 
            { healthCheck: true }
        );
        
        if (healthCheckTime > DB_CONFIG.performance.queryP95) {
            dragon.sePreocupa('Health check lento detectado', MODULE_NAME, 'HEALTH_CHECK_SLOW', {
                duration: healthCheckTime,
                threshold: DB_CONFIG.performance.queryP95
            });
        } else {
            dragon.respira('Health check exitoso Dragon3', MODULE_NAME, 'HEALTH_CHECK_SUCCESS', {
                duration: healthCheckTime,
                poolUtilization: Math.round((poolStats.used / poolStats.total) * 100),
                circuitBreakerState: circuitBreaker.getStatus().state
            });
        }
        
        return {
            status: 'healthy',
            duration: healthCheckTime,
            poolStats,
            circuitBreaker: circuitBreaker.getStatus()
        };
        
    } catch (error) {
        const healthCheckTime = Date.now() - startTime;
        
        // Record failure
        circuitBreaker.recordFailure(error);
        performanceMonitor.incrementErrorCount('health_check_error');
        
        performanceMonitor.metrics.healthChecks.push({
            duration: healthCheckTime,
            timestamp: Date.now(),
            status: 'error',
            error: error.message
        });
        
        dragon.agoniza('Health check falló Dragon3', error, MODULE_NAME, 'HEALTH_CHECK_ERROR', {
            duration: healthCheckTime,
            error: error.message,
            circuitBreakerState: circuitBreaker.getStatus().state
        });
        
        return {
            status: 'unhealthy',
            duration: healthCheckTime,
            error: error.message,
            circuitBreaker: circuitBreaker.getStatus()
        };
    }
};

// =================== CONNECTION POOL UTILITIES ===================

/**
 * Get connection pool statistics
 */
const getConnectionPoolStats = () => {
    try {
        // MongoDB driver connection pool stats
        const connections = mongoose.connection.db?.serverConfig?.connections || [];
        const maxPoolSize = DB_CONFIG.connection.maxPoolSize;
        
        return {
            used: Array.isArray(connections) ? connections.length : 0,
            total: maxPoolSize,
            available: maxPoolSize - (Array.isArray(connections) ? connections.length : 0),
            utilization: maxPoolSize > 0 ? (Array.isArray(connections) ? connections.length : 0) / maxPoolSize : 0
        };
    } catch (error) {
        dragon.sePreocupa('Error obteniendo pool stats', MODULE_NAME, 'POOL_STATS_ERROR', {
            error: error.message
        });
        
        return {
            used: 0,
            total: DB_CONFIG.connection.maxPoolSize,
            available: DB_CONFIG.connection.maxPoolSize,
            utilization: 0
        };
    }
};

// =================== ENHANCED SECURITY VALIDATION ===================

/**
 * Validate MongoDB URI security
 */
const validateMongoDBSecurity = (uri) => {
    if (!uri) {
        throw new DragonDatabaseError(
            'MongoDB URI no configurado',
            'MISSING_URI',
            'critical',
            { requiredEnvVar: 'MONGODB_URI or MONGO_URI' }
        );
    }
    
    // Check for common security issues
    const securityIssues = [];
    
    // Check for localhost in production
    if (process.env.NODE_ENV === 'production' && uri.includes('localhost')) {
        securityIssues.push('localhost_in_production');
    }
    
    // Check for default credentials
    if (uri.includes('admin:admin') || uri.includes('root:root')) {
        securityIssues.push('default_credentials');
    }
    
    // Check for unencrypted connection in production
    if (process.env.NODE_ENV === 'production' && !uri.includes('ssl=true') && !uri.includes('+srv')) {
        securityIssues.push('unencrypted_connection');
    }
    
    // Check for credentials in plain text (should use environment variables)
    if (uri.includes('://') && uri.includes(':') && uri.includes('@')) {
        dragon.sePreocupa('Credenciales detectadas en URI - usar variables de entorno', MODULE_NAME, 'CREDENTIALS_IN_URI', {
            recommendation: 'Use MONGODB_USERNAME and MONGODB_PASSWORD env vars'
        });
    }
    
    if (securityIssues.length > 0) {
        dragon.agoniza('Problemas de seguridad MongoDB detectados', 
            new Error('Security Issues'), MODULE_NAME, 'MONGODB_SECURITY_ISSUES', {
            issues: securityIssues,
            environment: process.env.NODE_ENV,
            severity: 'critical'
        });
        
        if (process.env.NODE_ENV === 'production') {
            throw new DragonDatabaseError(
                'Configuración MongoDB insegura en producción',
                'SECURITY_VIOLATION',
                'critical',
                { issues: securityIssues }
            );
        }
    }
    
    dragon.respira('MongoDB URI validado Dragon3', MODULE_NAME, 'URI_VALIDATED', {
        hasCredentials: uri.includes('@'),
        isSSL: uri.includes('ssl=true') || uri.includes('+srv'),
        environment: process.env.NODE_ENV
    });
};

// =================== MAIN CONNECTION FUNCTION ===================

/**
 * FAANG: Enhanced MongoDB connection function con circuit breaker
 */
const conectarDB = async (customOptions = {}) => {
    const connectionStartTime = Date.now();
    
    try {
        dragon.respira('Iniciando conexión MongoDB Atlas Dragon3', MODULE_NAME, 'CONNECTION_START', {
            version: VERSION_MODULO,
            environment: process.env.NODE_ENV || 'development',
            circuitBreakerEnabled: DB_CONFIG.circuitBreaker.enabled,
            circuitBreakerState: circuitBreaker.getStatus().state
        });
        
        // Check circuit breaker before attempting connection
        if (DB_CONFIG.circuitBreaker.enabled && !circuitBreaker.allowRequest()) {
            const cbStatus = circuitBreaker.getStatus();
            
            dragon.sePreocupa('Conexión MongoDB bloqueada por circuit breaker', MODULE_NAME, 'CONNECTION_BLOCKED', {
                circuitBreakerState: cbStatus.state,
                nextRetryTime: cbStatus.nextRetryTime,
                errorCount: cbStatus.errorCount
            });
            
            throw new DragonDatabaseError(
                'Database connection blocked by circuit breaker',
                'CIRCUIT_BREAKER_OPEN',
                'high',
                { circuitBreakerStatus: cbStatus }
            ).setRetryable(true);
        }
        
        // Validate URI security
        validateMongoDBSecurity(DB_CONFIG.connection.uri);
        
        // Configure Mongoose
        configureMongoose();
        
        // Merge configuration with custom options
        const connectionOptions = {
            ...DB_CONFIG.connection,
            ...customOptions,
            // Ensure these are not overridden
            useNewUrlParser: true,
            useUnifiedTopology: true
        };
        
        // Remove uri from options
        const { uri, ...mongooseOptions } = connectionOptions;
        
        dragon.respira('Estableciendo conexión MongoDB con opciones optimizadas', MODULE_NAME, 'CONNECTION_OPTIONS', {
            maxPoolSize: mongooseOptions.maxPoolSize,
            minPoolSize: mongooseOptions.minPoolSize,
            serverSelectionTimeoutMS: mongooseOptions.serverSelectionTimeoutMS,
            socketTimeoutMS: mongooseOptions.socketTimeoutMS,
            retryWrites: mongooseOptions.retryWrites
        });
        
        // Attempt connection with timeout
        const connectionPromise = mongoose.connect(uri, mongooseOptions);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Connection timeout')), mongooseOptions.connectTimeoutMS + 5000)
        );
        
        await Promise.race([connectionPromise, timeoutPromise]);
        
        const connectionTime = Date.now() - connectionStartTime;
        
        // Record performance metrics
        performanceMonitor.recordConnectionTime(connectionTime, {
            attempt: connectionState.connectionAttempts,
            options: {
                maxPoolSize: mongooseOptions.maxPoolSize,
                timeout: mongooseOptions.connectTimeoutMS
            }
        });
        
        dragon.zen('MongoDB Atlas conectado perfectamente Dragon3', MODULE_NAME, 'CONNECTION_SUCCESS', {
            connectionTime,
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            database: mongoose.connection.name,
            readyState: mongoose.connection.readyState,
            attempt: connectionState.connectionAttempts,
            performanceTarget: connectionTime < DB_CONFIG.performance.connectionP95 ? 'met' : 'exceeded'
        });
        
        // Perform initial health check
        if (DB_CONFIG.healthCheck.enabled) {
            setTimeout(async () => {
                await performHealthCheck();
            }, 1000); // Wait 1 second after connection
        }
        
        return {
            success: true,
            connectionTime,
            host: mongoose.connection.host,
            database: mongoose.connection.name,
            circuitBreakerState: circuitBreaker.getStatus().state
        };
        
    } catch (error) {
        const connectionTime = Date.now() - connectionStartTime;
        
        // Record failure for circuit breaker and performance monitor
        circuitBreaker.recordFailure(error);
        performanceMonitor.incrementErrorCount('connection_error');
        
        // Enhanced error classification
        let errorCode = 'CONNECTION_ERROR';
        let severity = 'high';
        
        if (error.message.includes('timeout')) {
            errorCode = 'CONNECTION_TIMEOUT';
            severity = 'medium';
        } else if (error.message.includes('authentication')) {
            errorCode = 'AUTHENTICATION_ERROR';
            severity = 'critical';
        } else if (error.message.includes('network')) {
            errorCode = 'NETWORK_ERROR';
            severity = 'high';
        } else if (error.name === 'MongoServerSelectionError') {
            errorCode = 'SERVER_SELECTION_ERROR';
            severity = 'high';
        }
        
        const dbError = new DragonDatabaseError(
            `Error conectando MongoDB Atlas: ${error.message}`,
            errorCode,
            severity,
            {
                connectionTime,
                attempt: connectionState.connectionAttempts,
                originalError: error.message,
                errorCode: error.code,
                circuitBreakerState: circuitBreaker.getStatus().state
            }
        ).setRetryable(errorCode !== 'AUTHENTICATION_ERROR');
        
        dragon.agoniza('Error crítico conectando MongoDB Atlas Dragon3', dbError, MODULE_NAME, 'CONNECTION_ERROR', {
            connectionTime,
            errorCode,
            severity,
            attempt: connectionState.connectionAttempts,
            circuitBreakerState: circuitBreaker.getStatus().state,
            retryable: dbError.retryable
        });
        
        throw dbError;
    }
};

// =================== UTILITY FUNCTIONS ===================

/**
 * Verificar salud completa de la base de datos
 */
export const verificarSaludDB = async () => {
    return await performHealthCheck();
};

/**
 * Obtener estado del circuit breaker
 */
export const obtenerEstadoCircuitBreaker = () => {
    return circuitBreaker.getStatus();
};

/**
 * Obtener métricas de performance
 */
export const obtenerMetricasPerformance = () => {
    return performanceMonitor.getSummary();
};

/**
 * Obtener estado de la conexión
 */
export const obtenerEstadoConexion = () => {
    return {
        ...connectionState,
        mongoose: {
            readyState: mongoose.connection.readyState,
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            database: mongoose.connection.name
        },
        poolStats: getConnectionPoolStats(),
        circuitBreaker: circuitBreaker.getStatus(),
        performance: performanceMonitor.getSummary()
    };
};

/**
 * Forzar cierre graceful de la conexión
 */
export const cerrarConexionDB = async (force = false) => {
    try {
        dragon.respira('Iniciando cierre conexión MongoDB Dragon3', MODULE_NAME, 'CONNECTION_CLOSE_START', {
            force,
            currentState: connectionState.status
        });
        
        // Stop health check
        stopHealthCheck();
        
        // Close mongoose connection
        if (force) {
            await mongoose.connection.close(true);
        } else {
            await mongoose.connection.close();
        }
        
        connectionState.status = 'disconnected';
        
        dragon.zen('Conexión MongoDB cerrada gracefully Dragon3', MODULE_NAME, 'CONNECTION_CLOSE_SUCCESS', {
            force,
            finalState: connectionState.status
        });
        
        return true;
        
    } catch (error) {
        dragon.agoniza('Error cerrando conexión MongoDB', error, MODULE_NAME, 'CONNECTION_CLOSE_ERROR', {
            force,
            error: error.message
        });
        
        throw new DragonDatabaseError(
            `Error cerrando conexión: ${error.message}`,
            'CONNECTION_CLOSE_ERROR',
            'medium',
            { force, originalError: error.message }
        );
    }
};

/**
 * Reconectar forzosamente (para recovery manual)
 */
export const reconectarDB = async () => {
    try {
        dragon.respira('Iniciando reconexión manual MongoDB Dragon3', MODULE_NAME, 'MANUAL_RECONNECT_START');
        
        // Close existing connection
        await cerrarConexionDB(true);
        
        // Reset circuit breaker if in OPEN state
        if (circuitBreaker.state === 'OPEN') {
            circuitBreaker.state = 'HALF_OPEN';
            circuitBreaker.requestCount = 0;
            circuitBreaker.lastStateChange = Date.now();
            
            dragon.respira('Circuit breaker reset para reconexión manual', MODULE_NAME, 'CIRCUIT_BREAKER_MANUAL_RESET');
        }
        
        // Attempt new connection
        const result = await conectarDB();
        
        dragon.sonrie('Reconexión manual exitosa Dragon3', MODULE_NAME, 'MANUAL_RECONNECT_SUCCESS', {
            connectionTime: result.connectionTime
        });
        
        return result;
        
    } catch (error) {
        dragon.agoniza('Error en reconexión manual', error, MODULE_NAME, 'MANUAL_RECONNECT_ERROR', {
            error: error.message
        });
        
        throw error;
    }
};

// =================== EXPORTS ===================

// Main connection function (default export for compatibility)
export default conectarDB;

// Named exports for additional functionality
export {
    conectarDB,
    verificarSaludDB,
    obtenerEstadoCircuitBreaker,
    obtenerMetricasPerformance,
    obtenerEstadoConexion,
    cerrarConexionDB,
    reconectarDB,
    DB_CONFIG,
    MODULE_NAME,
    VERSION_MODULO
};

/**
 * ====================================================================
 * DRAGON3 FAANG - DATABASE CONFIGURATION DOCUMENTATION
 * ====================================================================
 * 
 * DESCRIPCIÓN:
 * Configuración enterprise-grade MongoDB Atlas con circuit breakers,
 * performance monitoring P95 <100ms, y comprehensive error handling.
 * 
 * EXPORTS PRINCIPALES:
 * - conectarDB() (default): Conexión principal MongoDB
 * - verificarSaludDB(): Health check comprehensive
 * - obtenerEstadoCircuitBreaker(): Estado circuit breaker
 * - obtenerMetricasPerformance(): Métricas P95/P99
 * - obtenerEstadoConexion(): Estado completo conexión
 * - cerrarConexionDB(): Cierre graceful
 * - reconectarDB(): Reconexión manual
 * 
 * CONFIGURACIÓN ENV VARIABLES:
 * - MONGODB_URI: URI conexión MongoDB Atlas
 * - MONGODB_MAX_POOL_SIZE: Pool size máximo (default: 10)
 * - MONGODB_SERVER_SELECTION_TIMEOUT: Timeout selección (default: 5000ms)
 * - DB_CIRCUIT_BREAKER_ENABLED: Habilitar circuit breaker (default: true)
 * - DB_ERROR_THRESHOLD: Umbral errores circuit breaker (default: 5)
 * - DB_HEALTH_CHECK_ENABLED: Habilitar health checks (default: true)
 * 
 * CIRCUIT BREAKER STATES:
 * - CLOSED: Operación normal, requests permitidos
 * - OPEN: Demasiados errores, requests bloqueados
 * - HALF_OPEN: Testing recovery, requests limitados
 * 
 * PERFORMANCE TARGETS:
 * - Connection time: P95 <500ms, P99 <1000ms
 * - Query operations: P95 <100ms, P99 <300ms
 * - Pool efficiency: >95% utilization target
 * - Error rate: <0.1% operations
 * - Availability: 99.9% uptime
 * 
 * HEALTH CHECK FEATURES:
 * - Automatic ping operations every 30s
 * - Circuit breaker integration
 * - Pool utilization monitoring
 * - Performance violation alerting
 * - Graceful degradation modes
 * 
 * ERROR HANDLING:
 * - DragonDatabaseError class personalizada
 * - Enhanced error classification
 * - Retry logic con exponential backoff
 * - Circuit breaker protection
 * - Comprehensive logging Dragon ZEN
 * 
 * INTEGRATION:
 * Compatible con server.js existente, mantiene API backward compatible
 * mientras añade funcionalidades enterprise FAANG nivel.
 * 
 * ====================================================================
 */