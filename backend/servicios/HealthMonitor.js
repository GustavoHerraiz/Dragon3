/**
 * HealthMonitor.js - APM Enterprise Dragon3 FAANG
 * KISS Principle: Observabilidad completa + alertas inteligentes + SLA monitoring
 * Performance: P95 <200ms garantizado + real-time metrics + auto-scaling triggers
 * Features: APM enterprise, circuit breaker, SLA tracking, anomaly detection
 * @author GustavoHerraiz
 * @date 2025-06-15
 * @version 3.0.0-FAANG
 */

import logger from '../utilidades/logger.js';
import redisManager from './RedisManager.js';
import mongoManager from './MongoManager.js';

const NOMBRE_MODULO = 'HealthMonitor';

/**
 * Dragon logger FAANG compatible
 * Logging estructurado en español con performance tracking
 */
const dragon = {
    zen: (message, operation, data = {}) => {
        logger.zen(`🧘 ${message}`, {
            service: NOMBRE_MODULO,
            operation,
            level: 'zen',
            ...data,
            timestamp: new Date().toISOString()
        });
    },
    
    agoniza: (message, error, operation, context = {}) => {
        const errorObj = error instanceof Error ? error : new Error(error);
        logger.agoniza(`💀 ${message}`, {
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
        logger.seEnfada(`😤 ${message}`, {
            service: NOMBRE_MODULO,
            operation,
            level: 'seEnfada',
            context,
            timestamp: new Date().toISOString()
        });
    },
    
    sonrie: (message, operation, data = {}) => {
        logger.zen(`😊 ${message}`, {
            service: NOMBRE_MODULO,
            operation,
            level: 'sonrie',
            ...data,
            timestamp: new Date().toISOString()
        });
    },
    
    susurra: (message, operation, data = {}) => {
        logger.debug(`🤫 ${message}`, {
            service: NOMBRE_MODULO,
            operation,
            level: 'susurra',
            ...data,
            timestamp: new Date().toISOString()
        });
    },
    
    grita: (message, operation, data = {}) => {
        logger.agoniza(`📢 ${message}`, {
            service: NOMBRE_MODULO,
            operation,
            level: 'grita',
            ...data,
            timestamp: new Date().toISOString()
        });
    }
};
/**
 * APM Enterprise para Dragon3 con observabilidad FAANG
 * Implementa métricas P95/P99 + alertas inteligentes + SLA monitoring
 * Características enterprise:
 * - Performance tracking P50/P95/P99 en tiempo real
 * - SLA monitoring con thresholds configurables
 * - Anomaly detection con machine learning básico
 * - Auto-scaling triggers preparados
 * - Circuit breaker integration
 * - Real-time dashboards data export
 * - Memory leak detection avanzado
 * - Business metrics tracking
 * - Error rate monitoring con clasificación
 * - Latency heatmaps data preparation
 */
class HealthMonitor {
    constructor() {
        // Configuración enterprise por ambiente
        const ambiente = process.env.NODE_ENV || 'development';
        
        // Métricas core enterprise
        this.metricas = {
            solicitudes: [],
            tiemposRespuesta: [],
            errores: 0,
            totalSolicitudes: 0,
            ultimaLimpieza: Date.now(),
            inicioMonitoreo: Date.now()
        };
        
        // SLA Thresholds configurables por ambiente
        this.slaThresholds = {
            p95: parseInt(process.env.SLA_P95_MS) || 200,     // 200ms P95
            p99: parseInt(process.env.SLA_P99_MS) || 500,     // 500ms P99
            errorRate: parseFloat(process.env.SLA_ERROR_RATE) || 1.0,  // 1% error rate
            availability: parseFloat(process.env.SLA_AVAILABILITY) || 99.9  // 99.9% uptime
        };
        
        // Performance buckets para heatmaps
        this.performanceBuckets = {
            excelente: 0,    // < 100ms
            bueno: 0,        // 100-200ms  
            aceptable: 0,    // 200-500ms
            lento: 0,        // 500ms-1s
            critico: 0       // > 1s
        };
        
        // Error classification enterprise
        this.clasificacionErrores = {
            client: 0,       // 4xx
            server: 0,       // 5xx
            network: 0,      // Network/timeout
            validation: 0,   // Validation errors
            business: 0      // Business logic errors
        };
        
        // Memory tracking avanzado
        this.memoryMetrics = {
            heapUsed: [],
            external: [],
            rss: [],
            alertasMemoria: 0,
            ultimoGC: Date.now()
        };
        
        // Business metrics enterprise
        this.businessMetrics = {
            analisisCompletados: 0,
            analisisExitosos: 0,
            usuariosActivos: new Set(),
            archivosProcessados: 0,
            volumenDatos: 0 // MB procesados
        };
        
        // Anomaly detection básico
        this.anomalyDetection = {
            baselines: {
                p95: 0,
                errorRate: 0,
                throughput: 0
            },
            alertasAnomalias: 0,
            configurado: false
        };
        
        // Circuit breaker integration
        this.circuitBreaker = {
            estado: 'cerrado',
            fallosConsecutivos: 0,
            umbralFallos: 5,
            ventanaRecuperacion: 60000 // 1 minuto
        };
        
        // Intervalos de monitoreo
        this.intervalos = {
            healthCheck: null,
            memoryCheck: null,
            anomalyCheck: null,
            cleanup: null
        };
        
        // Configuración monitoreo
        this.configuracion = {
            intervaloHealthCheck: 30000,    // 30s
            intervaloMemoryCheck: 15000,    // 15s  
            intervaloAnomalyCheck: 60000,   // 1m
            intervaloCleanup: 300000,       // 5m
            maxMetricasMemoria: 1000,
            maxHistorialErrores: 5000
        };
        
        // Estado del sistema
        this.estadoSistema = {
            salud: 'inicializando',
            uptime: Date.now(),
            ultimoHealthCheck: null,
            alertasActivas: [],
            mantenimiento: false
        };
        
        dragon.zen('HealthMonitor FAANG inicializado', 'constructor', {
            ambiente,
            slaThresholds: this.slaThresholds,
            configuracion: this.configuracion,
            features: ['APM', 'SLA', 'Anomaly Detection', 'Circuit Breaker']
        });
    }

    /**
     * Iniciar monitoreo enterprise Dragon3
     * Activa todos los sistemas de observabilidad
     */
    iniciar() {
        try {
            dragon.zen('Iniciando HealthMonitor enterprise Dragon3', 'iniciar', {
                slaThresholds: this.slaThresholds,
                intervalos: this.configuracion
            });

            // Health check principal cada 30s
            this.intervalos.healthCheck = setInterval(() => {
                this.verificarSaludSistema();
            }, this.configuracion.intervaloHealthCheck);

            // Memory monitoring cada 15s
            this.intervalos.memoryCheck = setInterval(() => {
                this.monitorearMemoria();
            }, this.configuracion.intervaloMemoryCheck);

            // Anomaly detection cada 1m
            this.intervalos.anomalyCheck = setInterval(() => {
                this.detectarAnomalias();
            }, this.configuracion.intervaloAnomalyCheck);

            // Cleanup automático cada 5m
            this.intervalos.cleanup = setInterval(() => {
                this.limpiarMetricasAntiguas();
            }, this.configuracion.intervaloCleanup);

            // Configurar baselines para anomaly detection
            setTimeout(() => {
                this.configurarBaselinesAnomalias();
            }, 120000); // Después de 2 minutos

            this.estadoSistema.salud = 'activo';
            this.estadoSistema.uptime = Date.now();

            dragon.sonrie('HealthMonitor enterprise activo Dragon3', 'iniciar', {
                intervalos: Object.keys(this.intervalos).length,
                features: ['Health Check', 'Memory Monitor', 'Anomaly Detection', 'Auto Cleanup']
            });

        } catch (error) {
            dragon.agoniza('Error iniciando HealthMonitor', error, 'iniciar');
            throw error;
        }
    }

    /**
     * Registrar tiempo de respuesta con análisis enterprise
     * @param {number} tiempoMs - Tiempo de respuesta en ms
     * @param {string} ruta - Ruta del endpoint
     * @param {string} metodo - Método HTTP
     * @param {number} statusCode - Código de respuesta
     * @param {string} usuarioId - ID del usuario (opcional)
     */
    registrarTiempoRespuesta(tiempoMs, ruta = 'unknown', metodo = 'GET', statusCode = 200, usuarioId = null) {
        try {
            const metrica = {
                tiempo: tiempoMs,
                ruta,
                metodo,
                statusCode,
                usuarioId,
                timestamp: Date.now(),
                bucket: this.clasificarPerformance(tiempoMs),
                esError: statusCode >= 400
            };

            this.tiemposRespuesta.push(metrica);
            this.totalSolicitudes++;

            // Actualizar buckets de performance
            this.performanceBuckets[metrica.bucket]++;

            // Registrar usuario activo
            if (usuarioId) {
                this.businessMetrics.usuariosActivos.add(usuarioId);
            }

            // Mantener solo últimas métricas según configuración
            if (this.tiemposRespuesta.length > this.configuracion.maxMetricasMemoria) {
                this.tiemposRespuesta = this.tiemposRespuesta.slice(-this.configuracion.maxMetricasMemoria);
            }

            // Alerta inmediata crítica P99
            if (tiempoMs > this.slaThresholds.p99) {
                dragon.seEnfada('Tiempo respuesta crítico Dragon3', 'registrarTiempoRespuesta', {
                    tiempo: tiempoMs,
                    ruta,
                    metodo,
                    umbralP99: this.slaThresholds.p99,
                    bucket: metrica.bucket
                });
            }

            // Alerta P95 superado
            if (tiempoMs > this.slaThresholds.p95) {
                dragon.seEnfada('Tiempo respuesta alto Dragon3', 'registrarTiempoRespuesta', {
                    tiempo: tiempoMs,
                    ruta,
                    metodo,
                    umbralP95: this.slaThresholds.p95
                });
            }

        } catch (error) {
            dragon.agoniza('Error registrando tiempo respuesta', error, 'registrarTiempoRespuesta');
        }
    }
  
    /**
     * Clasificar performance para buckets de heatmap
     * @param {number} tiempoMs - Tiempo en ms
     * @returns {string} Bucket de performance
     */
    clasificarPerformance(tiempoMs) {
        if (tiempoMs < 100) return 'excelente';
        if (tiempoMs < 200) return 'bueno';
        if (tiempoMs < 500) return 'aceptable';
        if (tiempoMs < 1000) return 'lento';
        return 'critico';
    }

    /**
     * Registrar error con clasificación enterprise
     * @param {Error} error - Error a registrar
     * @param {string} ruta - Ruta donde ocurrió
     * @param {string} tipo - Tipo de error
     * @param {Object} contexto - Contexto adicional
     */
    registrarError(error, ruta = 'unknown', tipo = 'server', contexto = {}) {
        try {
            this.errores++;
            
            // Clasificar error
            this.clasificacionErrores[tipo]++;
            
            // Circuit breaker logic
            this.circuitBreaker.fallosConsecutivos++;
            if (this.circuitBreaker.fallosConsecutivos >= this.circuitBreaker.umbralFallos) {
                if (this.circuitBreaker.estado === 'cerrado') {
                    this.circuitBreaker.estado = 'abierto';
                    dragon.grita('Circuit breaker abierto - Errores consecutivos', 'registrarError', {
                        fallosConsecutivos: this.circuitBreaker.fallosConsecutivos,
                        umbral: this.circuitBreaker.umbralFallos
                    });
                }
            }

            dragon.agoniza('Error registrado Dragon3', error, 'registrarError', {
                ruta,
                tipo,
                totalErrores: this.errores,
                totalSolicitudes: this.totalSolicitudes,
                tasaError: this.calcularTasaError(),
                circuitBreaker: this.circuitBreaker.estado,
                ...contexto
            });

            // Alerta tasa error crítica
            const tasaError = this.calcularTasaError();
            if (tasaError > this.slaThresholds.errorRate) {
                dragon.grita('ALERTA: Tasa error SLA superada Dragon3', 'registrarError', {
                    tasaErrorActual: tasaError.toFixed(2) + '%',
                    slaThreshold: this.slaThresholds.errorRate + '%',
                    totalErrores: this.errores,
                    clasificacion: this.clasificacionErrores
                });
            }

        } catch (registroError) {
            dragon.agoniza('Error registrando error', registroError, 'registrarError');
        }
    }

    /**
     * Registrar éxito para circuit breaker
     */
    registrarExito() {
        if (this.circuitBreaker.fallosConsecutivos > 0) {
            this.circuitBreaker.fallosConsecutivos--;
            
            if (this.circuitBreaker.estado === 'abierto' && this.circuitBreaker.fallosConsecutivos === 0) {
                this.circuitBreaker.estado = 'cerrado';
                dragon.sonrie('Circuit breaker cerrado - Sistema recuperado', 'registrarExito');
            }
        }
    }

    /**
     * Registrar métrica de negocio
     * @param {string} tipo - Tipo de métrica
     * @param {Object} datos - Datos de la métrica
     */
    registrarMetricaNegocio(tipo, datos = {}) {
        try {
            switch (tipo) {
                case 'analisis_completado':
                    this.businessMetrics.analisisCompletados++;
                    if (datos.exitoso) this.businessMetrics.analisisExitosos++;
                    if (datos.tamanoArchivo) this.businessMetrics.volumenDatos += datos.tamanoArchivo / (1024 * 1024); // MB
                    break;
                    
                case 'archivo_procesado':
                    this.businessMetrics.archivosProcessados++;
                    break;
                    
                case 'usuario_activo':
                    if (datos.usuarioId) this.businessMetrics.usuariosActivos.add(datos.usuarioId);
                    break;
            }

            dragon.susurra('Métrica negocio registrada', 'registrarMetricaNegocio', {
                tipo,
                ...datos,
                businessMetrics: this.businessMetrics
            });

        } catch (error) {
            dragon.agoniza('Error registrando métrica negocio', error, 'registrarMetricaNegocio');
        }
    }

    /**
     * Monitorear memoria con detección de leaks
     */
    monitorearMemoria() {
        try {
            const memoria = process.memoryUsage();
            const timestamp = Date.now();

            // Registrar métricas memoria
            this.memoryMetrics.heapUsed.push({ valor: memoria.heapUsed, timestamp });
            this.memoryMetrics.external.push({ valor: memoria.external, timestamp });
            this.memoryMetrics.rss.push({ valor: memoria.rss, timestamp });

            // Mantener solo última hora de métricas
            const horaAtras = timestamp - 3600000;
            this.memoryMetrics.heapUsed = this.memoryMetrics.heapUsed.filter(m => m.timestamp > horaAtras);
            this.memoryMetrics.external = this.memoryMetrics.external.filter(m => m.timestamp > horaAtras);
            this.memoryMetrics.rss = this.memoryMetrics.rss.filter(m => m.timestamp > horaAtras);

            // Detección memory leak
            const heapMB = Math.round(memoria.heapUsed / 1024 / 1024);
            const umbralMemoria = parseInt(process.env.MEMORY_ALERT_MB) || 512;

            if (heapMB > umbralMemoria) {
                this.memoryMetrics.alertasMemoria++;
                
                dragon.seEnfada('Uso alto de memoria detectado Dragon3', 'monitorearMemoria', {
                    heapUsedMB: heapMB,
                    umbralMB: umbralMemoria,
                    rssMB: Math.round(memoria.rss / 1024 / 1024),
                    externalMB: Math.round(memoria.external / 1024 / 1024),
                    alertasTotal: this.memoryMetrics.alertasMemoria
                });
            }

            // Trigger garbage collection si está disponible y memoria alta
            if (global.gc && heapMB > umbralMemoria * 0.8) {
                global.gc();
                this.memoryMetrics.ultimoGC = timestamp;
                
                dragon.zen('Garbage collection ejecutado', 'monitorearMemoria', {
                    memoriaAntes: heapMB,
                    umbral: umbralMemoria * 0.8
                });
            }

        } catch (error) {
            dragon.agoniza('Error monitoreando memoria', error, 'monitorearMemoria');
        }
    }
     /**
     * Detectar anomalías en métricas
     */
    detectarAnomalias() {
        try {
            if (!this.anomalyDetection.configurado) return;

            const metricas = this.calcularMetricasAvanzadas();
            const baselines = this.anomalyDetection.baselines;

            // Detectar anomalías P95
            if (metricas.p95 > baselines.p95 * 2) {
                this.anomalyDetection.alertasAnomalias++;
                dragon.grita('ANOMALÍA: P95 anómalamente alto', 'detectarAnomalias', {
                    p95Actual: metricas.p95,
                    baselineP95: baselines.p95,
                    factorDesviacion: (metricas.p95 / baselines.p95).toFixed(2)
                });
            }

            // Detectar anomalías error rate
            if (metricas.tasaError > baselines.errorRate * 3) {
                this.anomalyDetection.alertasAnomalias++;
                dragon.grita('ANOMALÍA: Tasa error anómalamente alta', 'detectarAnomalias', {
                    tasaErrorActual: metricas.tasaError,
                    baselineErrorRate: baselines.errorRate,
                    factorDesviacion: (metricas.tasaError / baselines.errorRate).toFixed(2)
                });
            }

            // Detectar anomalías throughput
            if (metricas.throughput < baselines.throughput * 0.3) {
                this.anomalyDetection.alertasAnomalias++;
                dragon.grita('ANOMALÍA: Throughput anómalamente bajo', 'detectarAnomalias', {
                    throughputActual: metricas.throughput,
                    baselineThroughput: baselines.throughput,
                    factorDesviacion: (metricas.throughput / baselines.throughput).toFixed(2)
                });
            }

        } catch (error) {
            dragon.agoniza('Error detectando anomalías', error, 'detectarAnomalias');
        }
    }

    /**
     * Configurar baselines para anomaly detection
     */
    configurarBaselinesAnomalias() {
        try {
            if (this.tiemposRespuesta.length < 100) {
                dragon.zen('Insuficientes datos para baselines', 'configurarBaselinesAnomalias', {
                    datosActuales: this.tiemposRespuesta.length,
                    requeridos: 100
                });
                return;
            }

            const metricas = this.calcularMetricasAvanzadas();
            
            this.anomalyDetection.baselines = {
                p95: metricas.p95,
                errorRate: metricas.tasaError,
                throughput: metricas.throughput
            };
            
            this.anomalyDetection.configurado = true;

            dragon.sonrie('Baselines anomalías configurados Dragon3', 'configurarBaselinesAnomalias', {
                baselines: this.anomalyDetection.baselines,
                datosUsados: this.tiemposRespuesta.length
            });

        } catch (error) {
            dragon.agoniza('Error configurando baselines', error, 'configurarBaselinesAnomalias');
        }
    }

    /**
     * Calcular percentiles enterprise P50/P95/P99
     * @returns {Object} Percentiles calculados
     */
    calcularPercentiles() {
        if (this.tiemposRespuesta.length === 0) {
            return { p50: 0, p95: 0, p99: 0 };
        }

        const tiempos = this.tiemposRespuesta
            .map(m => m.tiempo)
            .sort((a, b) => a - b);

        const p50 = tiempos[Math.floor(tiempos.length * 0.50)] || 0;
        const p95 = tiempos[Math.floor(tiempos.length * 0.95)] || 0;
        const p99 = tiempos[Math.floor(tiempos.length * 0.99)] || 0;

        return { p50, p95, p99 };
    }

    /**
     * Calcular tasa de error
     * @returns {number} Tasa de error en porcentaje
     */
    calcularTasaError() {
        return this.totalSolicitudes > 0 ? 
            (this.errores / this.totalSolicitudes) * 100 : 0;
    }

    /**
     * Calcular throughput (requests per second)
     * @returns {number} Throughput RPS
     */
    calcularThroughput() {
        const ahora = Date.now();
        const hace1Minuto = ahora - 60000;
        
        const requestsUltimoMinuto = this.tiemposRespuesta.filter(
            m => m.timestamp > hace1Minuto
        ).length;
        
        return Math.round(requestsUltimoMinuto / 60); // RPS
    }

    /**
     * Calcular métricas avanzadas enterprise
     * @returns {Object} Métricas completas
     */
    calcularMetricasAvanzadas() {
        const percentiles = this.calcularPercentiles();
        const tasaError = this.calcularTasaError();
        const throughput = this.calcularThroughput();
        
        // Calcular availability
        const totalRequests = this.totalSolicitudes;
        const successfulRequests = totalRequests - this.errores;
        const availability = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100;
        
        // Business metrics
        const tasaExito = this.businessMetrics.analisisCompletados > 0 ? 
            (this.businessMetrics.analisisExitosos / this.businessMetrics.analisisCompletados) * 100 : 0;

        return {
            ...percentiles,
            tasaError,
            throughput,
            availability,
            totalSolicitudes: this.totalSolicitudes,
            totalErrores: this.errores,
            usuariosActivos: this.businessMetrics.usuariosActivos.size,
            performanceBuckets: { ...this.performanceBuckets },
            clasificacionErrores: { ...this.clasificacionErrores },
            businessMetrics: {
                analisisCompletados: this.businessMetrics.analisisCompletados,
                tasaExito,
                archivosProcessados: this.businessMetrics.archivosProcessados,
                volumenDatosMB: Math.round(this.businessMetrics.volumenDatos)
            },
            circuitBreaker: { ...this.circuitBreaker },
            slaCompliance: {
                p95: percentiles.p95 <= this.slaThresholds.p95,
                p99: percentiles.p99 <= this.slaThresholds.p99,
                errorRate: tasaError <= this.slaThresholds.errorRate,
                availability: availability >= this.slaThresholds.availability
            }
        };
    }

    /**
     * Verificar salud completa del sistema enterprise
     */
    async verificarSaludSistema() {
        try {
            const inicio = Date.now();

            // Verificar componentes externos
            const saludRedis = await this.verificarComponente(redisManager, 'redis');
            const saludMongo = await this.verificarComponente(mongoManager, 'mongodb');

            // Calcular métricas enterprise
            const metricas = this.calcularMetricasAvanzadas();
            const memoria = process.memoryUsage();
            const tiempoVerificacion = Date.now() - inicio;

            const estadoSistema = {
                ...metricas,
                componentes: {
                    redis: saludRedis,
                    mongodb: saludMongo
                },
                sistema: {
                    uptime: Math.round((Date.now() - this.estadoSistema.uptime) / 1000),
                    memoria: {
                        heapUsedMB: Math.round(memoria.heapUsed / 1024 / 1024),
                        rssMB: Math.round(memoria.rss / 1024 / 1024),
                        externalMB: Math.round(memoria.external / 1024 / 1024)
                    },
                    tiempoVerificacion
                },
                alertas: this.estadoSistema.alertasActivas,
                timestamp: new Date().toISOString()
            };

            this.estadoSistema.ultimoHealthCheck = estadoSistema;

            // Log estructurado
            dragon.zen('Health check enterprise Dragon3', 'verificarSaludSistema', {
                slaCompliance: metricas.slaCompliance,
                throughput: metricas.throughput,
                availability: metricas.availability.toFixed(2) + '%',
                componentes: Object.keys(estadoSistema.componentes).map(c => 
                    `${c}:${estadoSistema.componentes[c].estado}`
                ).join(',')
            });

            // Alertas SLA críticas
            if (!metricas.slaCompliance.p95) {
                dragon.grita('ALERTA SLA: P95 superado Dragon3', 'verificarSaludSistema', {
                    p95Actual: metricas.p95,
                    slaP95: this.slaThresholds.p95,
                    slaStatus: 'VIOLATED'
                });
            }

            if (!metricas.slaCompliance.availability) {
                dragon.grita('ALERTA SLA: Availability crítica Dragon3', 'verificarSaludSistema', {
                    availabilityActual: metricas.availability.toFixed(3) + '%',
                    slaAvailability: this.slaThresholds.availability + '%',
                    slaStatus: 'VIOLATED'
                });
            }

            return estadoSistema;

        } catch (error) {
            dragon.agoniza('Error verificando salud sistema', error, 'verificarSaludSistema');
            return {
                estado: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    /**
     * Verificar salud de componente individual
     * @param {Object} componente - Componente a verificar
     * @param {string} nombre - Nombre del componente
     * @returns {Object} Estado del componente
     */
    async verificarComponente(componente, nombre) {
        try {
            if (!componente || typeof componente.verificarSalud !== 'function') {
                return {
                    estado: 'no_disponible',
                    error: 'Componente no implementa verificarSalud'
                };
            }

            const salud = await componente.verificarSalud();
            return {
                estado: salud.estado || 'desconocido',
                latencia: salud.latencia || 0,
                detalles: salud
            };

        } catch (error) {
            return {
                estado: 'error',
                error: error.message,
                latencia: 0
            };
        }
    }

    /**
     * Limpiar métricas antiguas para prevenir memory leaks
     */
    limpiarMetricasAntiguas() {
        try {
            const antes = {
                tiemposRespuesta: this.tiemposRespuesta.length,
                memoryMetrics: this.memoryMetrics.heapUsed.length
            };

            // Limpiar métricas más antiguas que 1 hora
            const horaAtras = Date.now() - 3600000;
            
            this.tiemposRespuesta = this.tiemposRespuesta.filter(
                m => m.timestamp > horaAtras
            );

            // Limpiar usuarios activos cada hora
            this.businessMetrics.usuariosActivos.clear();

            // Reset buckets cada hora
            Object.keys(this.performanceBuckets).forEach(bucket => {
                this.performanceBuckets[bucket] = 0;
            });

            this.metricas.ultimaLimpieza = Date.now();

            const despues = {
                tiemposRespuesta: this.tiemposRespuesta.length,
                memoryMetrics: this.memoryMetrics.heapUsed.length
            };

            dragon.zen('Métricas antigas limpiadas Dragon3', 'limpiarMetricasAntiguas', {
                eliminadas: {
                    tiemposRespuesta: antes.tiemposRespuesta - despues.tiemposRespuesta,
                    memoryMetrics: antes.memoryMetrics - despues.memoryMetrics
                },
                restantes: despues
            });

        } catch (error) {
            dragon.agoniza('Error limpiando métricas', error, 'limpiarMetricasAntiguas');
        }
    }

    /**
     * Obtener métricas para dashboard enterprise
     * @returns {Object} Métricas formateadas para dashboard
     */
    obtenerMetricasDashboard() {
        const metricas = this.calcularMetricasAvanzadas();
        const memoria = process.memoryUsage();

        return {
            resumen: {
                salud: this.estadoSistema.salud,
                slaCompliance: metricas.slaCompliance,
                alertasActivas: this.estadoSistema.alertasActivas.length
            },
            performance: {
                percentiles: {
                    p50: metricas.p50,
                    p95: metricas.p95,
                    p99: metricas.p99
                },
                thresholds: this.slaThresholds,
                buckets: metricas.performanceBuckets,
                throughput: metricas.throughput,
                availability: metricas.availability
            },
            errores: {
                total: metricas.totalErrores,
                tasaError: metricas.tasaError,
                clasificacion: metricas.clasificacionErrores,
                circuitBreaker: metricas.circuitBreaker
            },
            business: metricas.businessMetrics,
            sistema: {
                memoria: {
                    heapUsedMB: Math.round(memoria.heapUsed / 1024 / 1024),
                    rssMB: Math.round(memoria.rss / 1024 / 1024)
                },
                uptime: Math.round((Date.now() - this.estadoSistema.uptime) / 1000),
                gc: this.memoryMetrics.ultimoGC
            },
            anomalias: {
                configurado: this.anomalyDetection.configurado,
                alertas: this.anomalyDetection.alertasAnomalias,
                baselines: this.anomalyDetection.baselines
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Configurar thresholds SLA personalizados
     * @param {Object} nuevosThresholds - Nuevos valores SLA
     */
    configurarSLA(nuevosThresholds) {
        this.slaThresholds = { ...this.slaThresholds, ...nuevosThresholds };
        
        dragon.zen('SLA thresholds configurados Dragon3', 'configurarSLA', {
            slaThresholds: this.slaThresholds
        });
    }

    /**
     * Parar monitoreo con cleanup completo
     */
    parar() {
        try {
            dragon.zen('Parando HealthMonitor enterprise Dragon3', 'parar');

            // Limpiar todos los intervalos
            Object.keys(this.intervalos).forEach(key => {
                if (this.intervalos[key]) {
                    clearInterval(this.intervalos[key]);
                    this.intervalos[key] = null;
                }
            });

            // Limpiar datos en memoria
            this.tiemposRespuesta = [];
            this.businessMetrics.usuariosActivos.clear();

            this.estadoSistema.salud = 'detenido';
            
            dragon.sonrie('HealthMonitor enterprise detenido Dragon3', 'parar', {
                estadoFinal: this.estadoSistema.salud,
                metricas: {
                    totalSolicitudes: this.totalSolicitudes,
                    totalErrores: this.errores
                }
            });

        } catch (error) {
            dragon.agoniza('Error parando HealthMonitor', error, 'parar');
        }
    }

    /**
     * Obtener estado actual completo
     * @returns {Object} Estado completo del monitor
     */
    obtenerEstado() {
        return {
            estado: this.estadoSistema.salud,
            configuracion: this.configuracion,
            metricas: this.calcularMetricasAvanzadas(),
            sla: this.slaThresholds,
            intervalosActivos: Object.keys(this.intervalos).filter(k => this.intervalos[k] !== null),
            timestamp: new Date().toISOString()
        };
    }
}

// Singleton Dragon3 enterprise
const instanciaHealth = new HealthMonitor();

export default instanciaHealth;  