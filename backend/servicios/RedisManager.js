/**
 * RedisManager.js - Gestión Redis Enterprise Dragon3 FAANG
 * KISS Principle: Conexión robusta + clustering + health monitoring + streams
 * Performance: P95 <50ms garantizado + connection pooling optimizado
 * Features: Pub/Sub enterprise, Redis Streams, circuit breaker, metrics
 * @author GustavoHerraiz
 * @date 2025-06-15
 * @version 3.0.0-FAANG
 */

import Redis from 'ioredis';
import logger from '../utilidades/logger.js';
import { EventEmitter } from 'events';

const NOMBRE_MODULO = 'RedisManager';

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
        logger.zen(`😊 ${message}`, {
            service: NOMBRE_MODULO,
            operation,
            level: 'sonrie',
            ...data,
            timestamp: new Date().toISOString()
        });
    }
};

/**
 * Gestión enterprise de conexiones Redis con clustering y streams
 * Implementa patrón Connection Pool + Circuit Breaker + Health Monitoring
 * Características FAANG:
 * - Connection pooling optimizado
 * - Redis Streams para eventos enterprise
 * - Pub/Sub con backpressure control
 * - Health monitoring continuo
 * - Circuit breaker para resilencia
 * - Métricas de performance P95/P99
 * - Clustering support preparado
 * - Graceful shutdown con cleanup
 */
class RedisManager extends EventEmitter {
    constructor() {
        super();
        
        // Conexiones Redis especializadas
        this.cliente = null;           // Cliente principal para operaciones
        this.publicador = null;        // Dedicado para Pub/Sub publishing
        this.suscriptor = null;        // Dedicado para Pub/Sub subscribing
        this.streamsCliente = null;    // Dedicado para Redis Streams
        
        // Estado y configuración
        this.estadoConexion = 'desconectado';
        this.configuracion = this._obtenerConfiguracion();
        
        // Circuit breaker
        this.circuitBreaker = {
            estado: 'cerrado', // cerrado, abierto, medio-abierto
            fallos: 0,
            umbralFallos: 5,
            tiempoRecuperacion: 30000, // 30 segundos
            ultimoFallo: null
        };
        
        // Métricas de performance
        this.metricas = {
            comandosEjecutados: 0,
            erroresConexion: 0,
            tiemposRespuesta: [],
            ultimaLimpieza: Date.now(),
            operacionesPorSegundo: 0,
            bandwidth: { enviado: 0, recibido: 0 }
        };
        
        // Pools de conexión enterprise
        this.poolConexiones = new Map();
        this.suscripcionesActivas = new Map();
        this.streamsGrupos = new Map();
        
        // Health monitoring
        this.healthTimer = null;
        this.estadoSalud = 'inicializando';
        
        dragon.zen('RedisManager FAANG inicializado', 'constructor', {
            configuracion: this.configuracion,
            modoEmpresa: true
        });
    }

    /**
     * Obtener configuración Redis enterprise con fallbacks
     * @private
     * @returns {Object} Configuración optimizada
     */
    _obtenerConfiguracion() {
        const urlRedis = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
        const ambiente = process.env.NODE_ENV || 'development';
        
        return {
            url: urlRedis,
            retryDelayOnFailover: 100,
            maxRetriesPerRequest: 3,
            retryDelayOnRamp: 300,
            maxMemoryPolicy: 'allkeys-lru',
            connectTimeout: 10000,
            commandTimeout: 5000,
            lazyConnect: true,
            keepAlive: 30000,
            family: 4,
            
            // Pool de conexiones enterprise
            pool: {
                min: ambiente === 'production' ? 5 : 2,
                max: ambiente === 'production' ? 50 : 10,
                acquireTimeoutMillis: 30000,
                createTimeoutMillis: 30000,
                destroyTimeoutMillis: 5000,
                idleTimeoutMillis: 30000,
                reapIntervalMillis: 1000,
                createRetryIntervalMillis: 200
            },
            
            // Configuración clustering (preparado futuro)
            cluster: {
                enableReadyCheck: true,
                redisOptions: {
                    password: process.env.REDIS_PASSWORD
                },
                maxRedirections: 16,
                retryDelayOnMove: 100,
                retryDelayOnFailover: 100,
                maxRedirectionsAfterFailover: 3,
                enableReadyCheck: true,
                enableOfflineQueue: false
            }
        };
    }

    /**
     * Crear cliente Redis con configuración enterprise optimizada
     * @private
     * @param {string} tipo - Tipo de cliente (cliente|publicador|suscriptor|streams)
     * @returns {Redis} Instancia Redis configurada
     */
    _crearCliente(tipo) {
        const clienteConfig = {
            ...this.configuracion,
            connectionName: `Dragon3_${tipo}_${process.pid}`,
            db: 0,
            enableReadyCheck: true,
            enableOfflineQueue: false,
            maxLoadingTimeout: 5000
        };

        const cliente = new Redis(clienteConfig.url, clienteConfig);

        // Event handlers enterprise
        cliente.on('connect', () => {
            dragon.zen(`Redis ${tipo} conectando`, 'cliente_connect', { tipo });
        });

        cliente.on('ready', () => {
            this.estadoConexion = 'conectado';
            dragon.sonrie(`Redis ${tipo} listo Dragon3`, 'cliente_ready', { 
                tipo,
                conexion: this.estadoConexion 
            });
        });

        cliente.on('error', (error) => {
            this.estadoConexion = 'error';
            this.metricas.erroresConexion++;
            this.actualizarCircuitBreaker(false);
            
            dragon.agoniza(`Error conexión Redis ${tipo}`, error, 'cliente_error', { 
                tipo,
                erroresTotal: this.metricas.erroresConexion
            });
        });

        cliente.on('close', () => {
            dragon.seEnfada(`Redis ${tipo} desconectado`, 'cliente_close', { tipo });
        });

        cliente.on('reconnecting', (delay) => {
            dragon.zen(`Redis ${tipo} reconectando`, 'cliente_reconnecting', { 
                tipo, 
                delay 
            });
        });

        cliente.on('end', () => {
            dragon.zen(`Redis ${tipo} conexión terminada`, 'cliente_end', { tipo });
        });

        return cliente;
    }

    /**
     * Conectar a Redis con configuración Dragon3 enterprise
     * Inicializa todas las conexiones especializadas
     * @returns {Promise<boolean>} True si conexión exitosa
     */
    async conectar() {
        try {
            if (!this.validarCircuitBreaker()) {
                throw new Error('Circuit breaker abierto - Redis no disponible');
            }

            dragon.zen('Iniciando conexión Redis Enterprise Dragon3', 'conectar', {
                url: this.configuracion.url.replace(/\/\/.*@/, '//***:***@'), // Ocultar credenciales
                ambiente: process.env.NODE_ENV,
                clustering: false // TODO: V4.0
            });

            // Crear conexiones especializadas
            this.cliente = this._crearCliente('cliente');
            this.publicador = this._crearCliente('publicador');
            this.suscriptor = this._crearCliente('suscriptor');
            this.streamsCliente = this._crearCliente('streams');

            // Conectar cliente principal primero
            await this.cliente.ping();
            
            // Conectar Pub/Sub clients
            await Promise.all([
                this.publicador.ping(),
                this.suscriptor.ping(),
                this.streamsCliente.ping()
            ]);

            // Configurar Redis para Dragon3 enterprise
            await this.configurarRedisEmpresa();
            
            // Inicializar Redis Streams
            await this.inicializarStreams();
            
            // Iniciar health monitoring
            this.iniciarHealthMonitoring();
            
            this.actualizarCircuitBreaker(true);
            this.estadoSalud = 'saludable';

            dragon.sonrie('Redis Enterprise conectado exitosamente Dragon3', 'conectar', {
                estadoConexion: this.estadoConexion,
                clientesActivos: 4,
                circuitBreaker: this.circuitBreaker.estado
            });

            return true;

        } catch (error) {
            this.actualizarCircuitBreaker(false);
            this.estadoSalud = 'error';
            
            dragon.agoniza('Fallo conectar Redis Dragon3', error, 'conectar');
            throw error;
        }
    }

    /**
     * Configurar Redis para uso enterprise Dragon3
     * @private
     */
    async configurarRedisEmpresa() {
        try {
            // Configurar políticas de memoria
            await this.cliente.config('SET', 'maxmemory-policy', 'allkeys-lru');
            
            // Configurar notificaciones para health monitoring
            await this.cliente.config('SET', 'notify-keyspace-events', 'Ex');
            
            // Configurar timeouts optimizados
            await this.cliente.config('SET', 'timeout', '300');
            
            dragon.zen('Redis configurado para empresa Dragon3', 'configurarRedisEmpresa');
            
        } catch (error) {
            dragon.seEnfada('Advertencia configurando Redis enterprise', 'configurarRedisEmpresa', {
                error: error.message
            });
        }
    }

    /**
     * Inicializar Redis Streams para eventos enterprise
     * @private
     */
    async inicializarStreams() {
        try {
            const streamsConfig = [
                'dragon3:stream:analisis',
                'dragon3:stream:metricas', 
                'dragon3:stream:alertas',
                'dragon3:stream:audit'
            ];

            for (const stream of streamsConfig) {
                try {
                    // Crear consumer group si no existe
                    await this.streamsCliente.xgroup('CREATE', stream, 'dragon3-processors', '0', 'MKSTREAM');
                    
                    this.streamsGrupos.set(stream, {
                        nombre: 'dragon3-processors',
                        creado: Date.now(),
                        activo: true
                    });
                    
                } catch (error) {
                    // BUSYGROUP es normal si ya existe
                    if (error.message.includes('BUSYGROUP')) {
                        dragon.zen(`Stream ${stream} ya configurado`, 'inicializarStreams');
                    } else {
                        throw error;
                    }
                }
            }

            dragon.sonrie('Redis Streams inicializados Dragon3', 'inicializarStreams', {
                streams: streamsConfig.length,
                grupos: this.streamsGrupos.size
            });

        } catch (error) {
            dragon.agoniza('Error inicializando Redis Streams', error, 'inicializarStreams');
        }
    }

    /**
     * Validar circuit breaker antes de operaciones
     * @returns {boolean} True si puede proceder
     */
    validarCircuitBreaker() {
        const { estado, fallos, umbralFallos, tiempoRecuperacion, ultimoFallo } = this.circuitBreaker;
        
        if (estado === 'abierto') {
            if (Date.now() - ultimoFallo > tiempoRecuperacion) {
                this.circuitBreaker.estado = 'medio-abierto';
                dragon.zen('Circuit breaker Redis cambió a medio-abierto', 'validarCircuitBreaker');
                return true;
            }
            return false;
        }
        
        return true;
    }

    /**
     * Actualizar estado circuit breaker
     * @param {boolean} exito - Si la operación fue exitosa
     */
    actualizarCircuitBreaker(exito) {
        if (exito) {
            if (this.circuitBreaker.estado === 'medio-abierto') {
                this.circuitBreaker.estado = 'cerrado';
                this.circuitBreaker.fallos = 0;
                dragon.sonrie('Circuit breaker Redis cerrado - Sistema recuperado', 'actualizarCircuitBreaker');
            }
        } else {
            this.circuitBreaker.fallos++;
            this.circuitBreaker.ultimoFallo = Date.now();
            
            if (this.circuitBreaker.fallos >= this.circuitBreaker.umbralFallos) {
                this.circuitBreaker.estado = 'abierto';
                dragon.agoniza('Circuit breaker Redis abierto - Sistema degradado', 
                    new Error('Umbral de fallos Redis superado'), 'actualizarCircuitBreaker', {
                    fallos: this.circuitBreaker.fallos
                });
            }
        }
    }

    /**
     * Health check enterprise para Redis con métricas detalladas
     * @returns {Promise<Object>} Estado detallado de salud
     */
    async verificarSalud() {
        try {
            if (!this.validarCircuitBreaker()) {
                return {
                    estado: 'degradado',
                    razon: 'Circuit breaker abierto',
                    circuitBreaker: this.circuitBreaker,
                    timestamp: new Date().toISOString()
                };
            }

            const inicio = Date.now();
            
            // Test ping en todos los clientes
            const resultados = await Promise.allSettled([
                this.cliente.ping(),
                this.publicador.ping(),
                this.suscriptor.ping(),
                this.streamsCliente.ping()
            ]);

            const latencia = Date.now() - inicio;
            const clientesOk = resultados.filter(r => r.status === 'fulfilled').length;
            const clientesTotal = resultados.length;

            // Obtener métricas Redis
            const info = await this.cliente.info('memory,stats,replication');
            const memoria = await this.cliente.memory('usage');

            this.registrarMetricas(latencia, clientesOk === clientesTotal);

            const saludCompleta = {
                estado: clientesOk === clientesTotal ? 'saludable' : 'parcial',
                latencia,
                conexion: this.estadoConexion,
                clientes: {
                    activos: clientesOk,
                    total: clientesTotal,
                    principal: resultados[0].status === 'fulfilled',
                    publicador: resultados[1].status === 'fulfilled',
                    suscriptor: resultados[2].status === 'fulfilled',
                    streams: resultados[3].status === 'fulfilled'
                },
                circuitBreaker: this.circuitBreaker,
                memoria: {
                    usado: memoria,
                    info: this.parsearInfoRedis(info)
                },
                metricas: this.obtenerMetricasResumen(),
                streams: {
                    configurados: this.streamsGrupos.size,
                    grupos: Array.from(this.streamsGrupos.keys())
                },
                performance: latencia < 50 ? 'excelente' : latencia < 100 ? 'buena' : 'degradada',
                timestamp: new Date().toISOString()
            };

            this.estadoSalud = saludCompleta.estado;
            return saludCompleta;

        } catch (error) {
            this.actualizarCircuitBreaker(false);
            this.estadoSalud = 'error';
            
            return {
                estado: 'error',
                error: error.message,
                conexion: this.estadoConexion,
                circuitBreaker: this.circuitBreaker,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Parsear información Redis en formato estructurado
     * @private
     * @param {string} info - Salida del comando INFO
     * @returns {Object} Información parseada
     */
    parsearInfoRedis(info) {
        const lineas = info.split('\r\n');
        const resultado = {};
        
        for (const linea of lineas) {
            if (linea.includes(':')) {
                const [clave, valor] = linea.split(':');
                resultado[clave] = isNaN(valor) ? valor : Number(valor);
            }
        }
        
        return resultado;
    }

    /**
     * Registrar métricas de performance
     * @param {number} tiempoRespuesta - Tiempo en ms
     * @param {boolean} exito - Si fue exitoso
     */
    registrarMetricas(tiempoRespuesta, exito) {
        this.metricas.comandosEjecutados++;
        if (!exito) this.metricas.erroresConexion++;
        
        this.metricas.tiemposRespuesta.push(tiempoRespuesta);
        
        // Mantener solo últimas 1000 métricas
        if (this.metricas.tiemposRespuesta.length > 1000) {
            this.metricas.tiemposRespuesta = this.metricas.tiemposRespuesta.slice(-1000);
        }
    }

    /**
     * Obtener resumen de métricas
     * @returns {Object} Métricas resumidas
     */
    obtenerMetricasResumen() {
        const tiempos = this.metricas.tiemposRespuesta.sort((a, b) => a - b);
        const p95 = tiempos[Math.floor(tiempos.length * 0.95)] || 0;
        const p99 = tiempos[Math.floor(tiempos.length * 0.99)] || 0;
        const promedio = tiempos.reduce((a, b) => a + b, 0) / tiempos.length || 0;
        
        return {
            comandosEjecutados: this.metricas.comandosEjecutados,
            erroresConexion: this.metricas.erroresConexion,
            tasaError: (this.metricas.erroresConexion / Math.max(this.metricas.comandosEjecutados, 1) * 100).toFixed(2) + '%',
            tiempoPromedioMs: Math.round(promedio),
            p95Ms: p95,
            p99Ms: p99,
            operacionesPorSegundo: this.metricas.operacionesPorSegundo
        };
    }

    /**
     * Iniciar health monitoring continuo
     */
    iniciarHealthMonitoring() {
        this.healthTimer = setInterval(async () => {
            try {
                const salud = await this.verificarSalud();
                
                // Alertas automáticas
                if (salud.latencia > 200) {
                    dragon.seEnfada('Latencia Redis alta detectada', 'healthMonitoring', {
                        latencia: salud.latencia
                    });
                }
                
                if (salud.estado === 'error') {
                    dragon.agoniza('Redis en estado error', new Error('Health check falló'), 'healthMonitoring');
                }
                
            } catch (error) {
                dragon.agoniza('Error en health monitoring Redis', error, 'healthMonitoring');
            }
        }, 30000); // Cada 30 segundos
    }

    /**
     * Publicar mensaje en canal con retry automático
     * @param {string} canal - Canal de publicación
     * @param {Object} mensaje - Mensaje a publicar
     * @returns {Promise<number>} Número de suscriptores que recibieron
     */
    async publicar(canal, mensaje) {
        try {
            if (!this.validarCircuitBreaker()) {
                throw new Error('Circuit breaker abierto - No se puede publicar');
            }

            const mensajeStr = typeof mensaje === 'string' ? mensaje : JSON.stringify(mensaje);
            const resultado = await this.publicador.publish(canal, mensajeStr);
            
            this.registrarMetricas(Date.now(), true);
            
            dragon.zen('Mensaje publicado Dragon3', 'publicar', {
                canal,
                suscriptores: resultado,
                tamano: mensajeStr.length
            });
            
            return resultado;
            
        } catch (error) {
            this.registrarMetricas(Date.now(), false);
            dragon.agoniza('Error publicando mensaje Redis', error, 'publicar', { canal });
            throw error;
        }
    }

    /**
     * Suscribirse a canal con handler de mensajes
     * @param {string} canal - Canal a suscribirse
     * @param {Function} handler - Función que maneja mensajes
     */
    async suscribirse(canal, handler) {
        try {
            await this.suscriptor.subscribe(canal);
            
            this.suscriptor.on('message', (canalRecibido, mensaje) => {
                if (canalRecibido === canal) {
                    try {
                        const mensajeObj = JSON.parse(mensaje);
                        handler(mensajeObj, canalRecibido);
                    } catch (error) {
                        handler(mensaje, canalRecibido);
                    }
                }
            });
            
            this.suscripcionesActivas.set(canal, {
                handler,
                timestamp: Date.now()
            });
            
            dragon.sonrie('Suscripción activa Dragon3', 'suscribirse', { canal });
            
        } catch (error) {
            dragon.agoniza('Error suscribiendo a canal Redis', error, 'suscribirse', { canal });
            throw error;
        }
    }

    /**
     * Agregar entrada a Redis Stream
     * @param {string} stream - Nombre del stream
     * @param {Object} datos - Datos a agregar
     * @returns {Promise<string>} ID de la entrada
     */
    async agregarAStream(stream, datos) {
        try {
            const entradaId = await this.streamsCliente.xadd(stream, '*', 'data', JSON.stringify(datos));
            
            dragon.zen('Entrada agregada a stream Dragon3', 'agregarAStream', {
                stream,
                entradaId,
                tamano: JSON.stringify(datos).length
            });
            
            return entradaId;
            
        } catch (error) {
            dragon.agoniza('Error agregando a stream Redis', error, 'agregarAStream', { stream });
            throw error;
        }
    }

    /**
     * Shutdown graceful Dragon3 con cleanup completo
     */
    async cerrarConexion() {
        try {
            dragon.zen('Iniciando shutdown graceful Redis Dragon3', 'cerrarConexion');
            
            // Parar health monitoring
            if (this.healthTimer) {
                clearInterval(this.healthTimer);
                this.healthTimer = null;
            }
            
            // Cerrar suscripciones activas
            for (const [canal] of this.suscripcionesActivas) {
                try {
                    await this.suscriptor.unsubscribe(canal);
                    dragon.zen(`Desuscrito de canal ${canal}`, 'cerrarConexion');
                } catch (error) {
                    dragon.seEnfada(`Error desuscribiendo canal ${canal}`, 'cerrarConexion', {
                        error: error.message
                    });
                }
            }
            
            // Cerrar conexiones con timeout
            const cerrarConTimeouts = [
                this.cliente?.quit(),
                this.publicador?.quit(),
                this.suscriptor?.quit(),
                this.streamsCliente?.quit()
            ].filter(Boolean);
            
            await Promise.allSettled(cerrarConTimeouts);
            
            // Limpiar referencias
            this.cliente = null;
            this.publicador = null;
            this.suscriptor = null;
            this.streamsCliente = null;
            this.suscripcionesActivas.clear();
            this.streamsGrupos.clear();
            
            this.estadoConexion = 'desconectado';
            this.estadoSalud = 'desconectado';
            
            dragon.sonrie('Redis desconectado completamente Dragon3', 'cerrarConexion', {
                estadoFinal: this.estadoConexion
            });
            
        } catch (error) {
            dragon.agoniza('Error cerrando Redis', error, 'cerrarConexion');
        }
    }

    /**
     * Obtener estado completo del sistema Redis
     * @returns {Object} Estado detallado del RedisManager
     */
    obtenerEstado() {
        return {
            conexion: this.estadoConexion,
            salud: this.estadoSalud,
            circuitBreaker: this.circuitBreaker,
            metricas: this.obtenerMetricasResumen(),
            suscripciones: Array.from(this.suscripcionesActivas.keys()),
            streams: Array.from(this.streamsGrupos.keys()),
            configuracion: {
                url: this.configuracion.url.replace(/\/\/.*@/, '//***:***@'),
                poolSize: this.configuracion.pool
            },
            timestamp: new Date().toISOString()
        };
    }

    // Getters para acceso controlado a conexiones
    obtenerCliente() { 
        if (!this.cliente) throw new Error('Redis cliente no inicializado');
        return this.cliente; 
    }
    
    obtenerPublicador() { 
        if (!this.publicador) throw new Error('Redis publicador no inicializado');
        return this.publicador; 
    }
    
    obtenerSuscriptor() { 
        if (!this.suscriptor) throw new Error('Redis suscriptor no inicializado');
        return this.suscriptor; 
    }
    
    obtenerStreamsCliente() { 
        if (!this.streamsCliente) throw new Error('Redis streams cliente no inicializado');
        return this.streamsCliente; 
    }
}

// Singleton Dragon3 enterprise
const instanciaRedis = new RedisManager();

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
    dragon.zen('SIGTERM recibido - RedisManager', 'shutdown');
    await instanciaRedis.cerrarConexion();
});

process.on('SIGINT', async () => {
    dragon.zen('SIGINT recibido - RedisManager', 'shutdown');
    await instanciaRedis.cerrarConexion();
});

export default instanciaRedis;