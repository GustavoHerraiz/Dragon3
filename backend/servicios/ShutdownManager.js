/**
 * ShutdownManager.js - Coordinador Shutdown Graceful Dragon3 FAANG
 * KISS Principle: Cierre ordenado enterprise con zero-downtime capability
 * Performance: Garantizar P95 durante shutdown + resource cleanup optimizado
 * Features: Signal handling robusto, health monitoring, container compatibility
 * @author GustavoHerraiz
 * @date 2025-06-15
 * @version 3.0.0-FAANG
 */

import logger from '../utilidades/logger.js';
import redisManager from './RedisManager.js';
import mongoManager from './MongoManager.js';
import healthMonitor from './HealthMonitor.js';

const NOMBRE_MODULO = 'ShutdownManager';

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
    },
    
    susurra: (message, operation, data = {}) => {
        logger.debug(`🤫 ${message}`, {
            service: NOMBRE_MODULO,
            operation,
            level: 'susurra',
            ...data,
            timestamp: new Date().toISOString()
        });
    }
};

/**
 * Coordinador shutdown graceful enterprise con características FAANG
 * Implementa zero-downtime deployment + resource cleanup + health monitoring
 * Características enterprise:
 * - Shutdown en fases ordenadas con timeouts configurables
 * - Signal handling robusto para container orchestration
 * - Health monitoring durante proceso shutdown
 * - Resource cleanup exhaustivo sin memory leaks
 * - Error handling con recovery automático
 * - Logging estructurado Dragon3 para auditoria
 * - Container/K8s compatibility con SIGTERM graceful
 * - Zero-downtime deployment support
 */
class ShutdownManager {
    constructor() {
        // Configuración shutdown enterprise
        this.servidorExpress = null;
        this.procesandoShutdown = false;
        this.shutdownCompletado = false;
        this.inicioShutdown = null;
        
        // Timeouts configurables por ambiente
        this.timeouts = {
            total: parseInt(process.env.SHUTDOWN_TIMEOUT) || 30000,      // 30s total
            express: parseInt(process.env.EXPRESS_TIMEOUT) || 10000,     // 10s Express
            database: parseInt(process.env.DB_TIMEOUT) || 15000,         // 15s BD
            health: parseInt(process.env.HEALTH_TIMEOUT) || 5000,        // 5s Health
            force: parseInt(process.env.FORCE_TIMEOUT) || 35000          // 35s force exit
        };
        
        // Estado y métricas shutdown
        this.estado = {
            fase: 'inicializando',
            serviciosActivos: [],
            serviciosCerrados: [],
            erroresShutdown: [],
            tiempoInicio: null,
            ultimaActividad: Date.now()
        };
        
        // Contadores de señales para force exit
        this.contadorSenales = {
            SIGTERM: 0,
            SIGINT: 0,
            SIGKILL: 0
        };
        
        // Health monitoring durante shutdown
        this.healthShutdown = {
            intervalo: null,
            metricas: {
                conexionesActivas: 0,
                memoriaUsada: 0,
                recursosLiberados: 0
            }
        };
        
        // Servicios registrados para shutdown ordenado
        this.serviciosRegistrados = new Map();
        this.ordenShutdown = [
            'healthMonitor',
            'fileProcessor', 
            'expressServer',
            'redisManager',
            'mongoManager'
        ];
        
        this.configurarSignales();
        this.registrarServiciosCore();
        
        dragon.zen('ShutdownManager FAANG inicializado', 'constructor', {
            timeouts: this.timeouts,
            ordenShutdown: this.ordenShutdown,
            ambiente: process.env.NODE_ENV || 'development'
        });
    }

    /**
     * Configurar signal handlers enterprise con contadores
     * Maneja múltiples señales y force exit en caso necesario
     */
    configurarSignales() {
        // SIGTERM - Kubernetes/Docker graceful shutdown
        process.on('SIGTERM', () => {
            this.contadorSenales.SIGTERM++;
            dragon.zen('SIGTERM recibido Dragon3', 'configurarSignales', {
                contador: this.contadorSenales.SIGTERM,
                procesandoShutdown: this.procesandoShutdown
            });
            
            if (this.contadorSenales.SIGTERM === 1) {
                this.iniciarShutdown('SIGTERM');
            } else if (this.contadorSenales.SIGTERM >= 3) {
                dragon.agoniza('SIGTERM múltiple - Force exit', new Error('Force shutdown'), 'configurarSignales');
                process.exit(1);
            }
        });

        // SIGINT - Ctrl+C para desarrollo
        process.on('SIGINT', () => {
            this.contadorSenales.SIGINT++;
            dragon.zen('SIGINT recibido Dragon3', 'configurarSignales', {
                contador: this.contadorSenales.SIGINT
            });
            
            if (this.contadorSenales.SIGINT === 1) {
                this.iniciarShutdown('SIGINT');
            } else if (this.contadorSenales.SIGINT >= 2) {
                dragon.agoniza('SIGINT múltiple - Force exit', new Error('Force shutdown'), 'configurarSignales');
                process.exit(1);
            }
        });
        
        // Errores no manejados con contexto enterprise
        process.on('uncaughtException', (error) => {
            dragon.agoniza('Excepción no capturada Dragon3', error, 'uncaughtException', {
                stack: error.stack,
                pid: process.pid,
                memoria: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
            });
            
            // Shutdown de emergencia
            this.iniciarShutdownEmergencia('uncaughtException', error);
        });

        // Promesas rechazadas no manejadas
        process.on('unhandledRejection', (reason, promise) => {
            const error = reason instanceof Error ? reason : new Error(reason);
            dragon.agoniza('Promesa rechazada no manejada Dragon3', error, 'unhandledRejection', {
                reason: reason?.toString(),
                promiseString: promise?.toString()?.substring(0, 200)
            });
            
            // No hacer shutdown automático por unhandledRejection en producción
            if (process.env.NODE_ENV !== 'production') {
                this.iniciarShutdownEmergencia('unhandledRejection', error);
            }
        });

        // Warning handler para detectar memory leaks
        process.on('warning', (warning) => {
            dragon.seEnfada('Warning detectado Dragon3', 'warning', {
                name: warning.name,
                message: warning.message,
                stack: warning.stack
            });
        });

        dragon.sonrie('Signal handlers configurados Dragon3', 'configurarSignales', {
            handlers: ['SIGTERM', 'SIGINT', 'uncaughtException', 'unhandledRejection', 'warning']
        });
    }

    /**
     * Registrar servicios core para shutdown ordenado
     * @private
     */
    registrarServiciosCore() {
        this.registrarServicio('healthMonitor', healthMonitor, 'parar');
        this.registrarServicio('redisManager', redisManager, 'cerrarConexion');
        this.registrarServicio('mongoManager', mongoManager, 'cerrarConexion');
        
        dragon.zen('Servicios core registrados para shutdown', 'registrarServiciosCore', {
            servicios: Array.from(this.serviciosRegistrados.keys())
        });
    }

    /**
     * Registrar servicio para shutdown ordenado
     * @param {string} nombre - Nombre del servicio
     * @param {Object} instancia - Instancia del servicio
     * @param {string} metodoShutdown - Método a llamar para cerrar
     */
    registrarServicio(nombre, instancia, metodoShutdown) {
        this.serviciosRegistrados.set(nombre, {
            instancia,
            metodoShutdown,
            estado: 'activo',
            registrado: Date.now()
        });
        
        this.estado.serviciosActivos.push(nombre);
        
        dragon.zen('Servicio registrado para shutdown', 'registrarServicio', {
            nombre,
            metodo: metodoShutdown,
            totalServicios: this.serviciosRegistrados.size
        });
    }

    /**
     * Registrar servidor Express con configuración enterprise
     * @param {Object} servidor - Instancia servidor Express
     */
    registrarServidor(servidor) {
        this.servidorExpress = servidor;
        this.registrarServicio('expressServer', this, 'cerrarServidorExpress');
        
        dragon.sonrie('Servidor Express registrado Dragon3', 'registrarServidor', {
            puerto: servidor.address()?.port || 'desconocido',
            estado: 'activo'
        });
    }

    /**
     * Iniciar proceso shutdown graceful enterprise
     * @param {string} señal - Señal que activó el shutdown
     */
    async iniciarShutdown(señal) {
        if (this.procesandoShutdown) {
            dragon.seEnfada('Shutdown ya en proceso Dragon3', 'iniciarShutdown', {
                señal,
                faseActual: this.estado.fase,
                tiempoTranscurrido: Date.now() - this.inicioShutdown
            });
            return;
        }

        this.procesandoShutdown = true;
        this.inicioShutdown = Date.now();
        this.estado.tiempoInicio = this.inicioShutdown;
        this.estado.fase = 'iniciando';
        
        dragon.zen('Iniciando shutdown graceful Dragon3', 'iniciarShutdown', {
            señal,
            timeouts: this.timeouts,
            serviciosRegistrados: this.estado.serviciosActivos.length,
            pid: process.pid,
            memoria: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
        });

        // Timeout de seguridad total
        const timeoutTotal = setTimeout(() => {
            dragon.agoniza('Timeout shutdown Dragon3 - Forzando salida', 
                new Error('Shutdown timeout excedido'), 'iniciarShutdown', {
                tiempoTranscurrido: Date.now() - this.inicioShutdown,
                faseActual: this.estado.fase,
                serviciosPendientes: this.estado.serviciosActivos
            });
            
            this.forzarSalida(1);
        }, this.timeouts.force);

        try {
            // Iniciar health monitoring durante shutdown
            this.iniciarHealthMonitoringShutdown();
            
            // Ejecutar shutdown en fases ordenadas
            await this.ejecutarShutdownFases(señal);
            
            // Limpiar timeout
            clearTimeout(timeoutTotal);
            
            // Log final de éxito
            const tiempoTotal = Date.now() - this.inicioShutdown;
            dragon.sonrie('Shutdown graceful completado Dragon3', 'iniciarShutdown', {
                señal,
                tiempoTotal,
                serviciosCerrados: this.estado.serviciosCerrados.length,
                errores: this.estado.erroresShutdown.length
            });
            
            this.shutdownCompletado = true;
            process.exit(0);

        } catch (error) {
            clearTimeout(timeoutTotal);
            
            dragon.agoniza('Error durante shutdown Dragon3', error, 'iniciarShutdown', {
                señal,
                tiempoTranscurrido: Date.now() - this.inicioShutdown,
                faseActual: this.estado.fase,
                serviciosCerrados: this.estado.serviciosCerrados.length
            });
            
            this.forzarSalida(1);
        }
    }

    /**
     * Iniciar shutdown de emergencia por errores críticos
     * @param {string} causa - Causa del shutdown de emergencia
     * @param {Error} error - Error que causó el shutdown
     */
    async iniciarShutdownEmergencia(causa, error) {
        dragon.agoniza('Iniciando shutdown de emergencia Dragon3', error, 'iniciarShutdownEmergencia', {
            causa,
            pid: process.pid
        });
        
        // Timeout muy corto para emergencia
        setTimeout(() => {
            this.forzarSalida(1);
        }, 5000);
        
        try {
            // Solo cerrar conexiones críticas
            await this.cerrarServiciosCriticos();
        } catch (emergencyError) {
            dragon.agoniza('Error en shutdown emergencia', emergencyError, 'iniciarShutdownEmergencia');
        } finally {
            this.forzarSalida(1);
        }
    }

    /**
     * Ejecutar shutdown en fases ordenadas con timeouts individuales
     * @param {string} señal - Señal que activó el shutdown
     */
    async ejecutarShutdownFases(señal) {
        const fases = [
            { nombre: 'health_monitor', handler: () => this.pararHealthMonitor() },
            { nombre: 'file_processor', handler: () => this.pararFileProcessor() },
            { nombre: 'express_server', handler: () => this.cerrarServidorExpress() },
            { nombre: 'database_connections', handler: () => this.cerrarConexionesBD() },
            { nombre: 'cleanup_final', handler: () => this.limpiezaFinal() }
        ];

        for (const fase of fases) {
            this.estado.fase = fase.nombre;
            
            dragon.zen(`Fase shutdown: ${fase.nombre}`, 'ejecutarShutdownFases', {
                señal,
                tiempoTranscurrido: Date.now() - this.inicioShutdown
            });

            try {
                await this.ejecutarConTimeout(fase.handler, this.timeouts.health, fase.nombre);
                
                dragon.sonrie(`Fase completada: ${fase.nombre}`, 'ejecutarShutdownFases');
                
            } catch (error) {
                this.estado.erroresShutdown.push({
                    fase: fase.nombre,
                    error: error.message,
                    timestamp: Date.now()
                });
                
                dragon.seEnfada(`Error en fase ${fase.nombre}`, 'ejecutarShutdownFases', {
                    error: error.message
                });
                
                // Continuar con siguiente fase
            }
        }
    }

    /**
     * Ejecutar función con timeout específico
     * @param {Function} fn - Función a ejecutar
     * @param {number} timeout - Timeout en ms
     * @param {string} operacion - Nombre de la operación
     */
    async ejecutarConTimeout(fn, timeout, operacion) {
        return new Promise(async (resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Timeout en operación: ${operacion}`));
            }, timeout);

            try {
                await fn();
                clearTimeout(timeoutId);
                resolve();
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }

    /**
     * Iniciar health monitoring durante shutdown
     */
    iniciarHealthMonitoringShutdown() {
        this.healthShutdown.intervalo = setInterval(() => {
            const memoria = process.memoryUsage();
            
            this.healthShutdown.metricas = {
                conexionesActivas: this.estado.serviciosActivos.length,
                memoriaUsada: Math.round(memoria.heapUsed / 1024 / 1024),
                recursosLiberados: this.estado.serviciosCerrados.length,
                tiempoTranscurrido: Date.now() - this.inicioShutdown
            };
            
            dragon.susurra('Health check shutdown Dragon3', 'healthShutdown', this.healthShutdown.metricas);
            
        }, 2000); // Cada 2 segundos
    }

    /**
     * Parar HealthMonitor con error handling
     */
    async pararHealthMonitor() {
        try {
            if (this.healthShutdown.intervalo) {
                clearInterval(this.healthShutdown.intervalo);
                this.healthShutdown.intervalo = null;
            }
            
            const servicio = this.serviciosRegistrados.get('healthMonitor');
            if (servicio && servicio.instancia) {
                if (typeof servicio.instancia[servicio.metodoShutdown] === 'function') {
                    await servicio.instancia[servicio.metodoShutdown]();
                }
                
                this.marcarServicioCerrado('healthMonitor');
                dragon.sonrie('HealthMonitor detenido Dragon3', 'pararHealthMonitor');
            }
            
        } catch (error) {
            dragon.agoniza('Error parando HealthMonitor', error, 'pararHealthMonitor');
            throw error;
        }
    }

    /**
     * Parar FileProcessor con cleanup
     */
    async pararFileProcessor() {
        try {
            const servicio = this.serviciosRegistrados.get('fileProcessor');
            if (servicio && servicio.instancia) {
                if (typeof servicio.instancia[servicio.metodoShutdown] === 'function') {
                    await servicio.instancia[servicio.metodoShutdown]();
                }
                
                this.marcarServicioCerrado('fileProcessor');
                dragon.sonrie('FileProcessor detenido Dragon3', 'pararFileProcessor');
            }
            
        } catch (error) {
            dragon.seEnfada('Error parando FileProcessor', 'pararFileProcessor', {
                error: error.message
            });
            // No throw para continuar shutdown
        }
    }

    /**
     * Cerrar servidor Express con conexiones activas
     */
    async cerrarServidorExpress() {
        if (!this.servidorExpress) {
            dragon.zen('Servidor Express no registrado', 'cerrarServidorExpress');
            return;
        }

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                dragon.seEnfada('Timeout cerrando Express - Forzando', 'cerrarServidorExpress');
                resolve();
            }, this.timeouts.express);

            this.servidorExpress.close((error) => {
                clearTimeout(timeout);
                
                if (error) {
                    dragon.agoniza('Error cerrando servidor Express', error, 'cerrarServidorExpress');
                } else {
                    dragon.sonrie('Servidor Express cerrado Dragon3', 'cerrarServidorExpress');
                }
                
                this.marcarServicioCerrado('expressServer');
                resolve();
            });
        });
    }

    /**
     * Cerrar conexiones base de datos en orden optimizado
     */
    async cerrarConexionesBD() {
        const promesasCierre = [];

        try {
            // Cerrar Redis primero (más rápido)
            const servicioRedis = this.serviciosRegistrados.get('redisManager');
            if (servicioRedis && servicioRedis.instancia) {
                promesasCierre.push(
                    this.ejecutarConTimeout(
                        () => servicioRedis.instancia[servicioRedis.metodoShutdown](),
                        this.timeouts.database / 2,
                        'redis'
                    ).then(() => {
                        this.marcarServicioCerrado('redisManager');
                        dragon.sonrie('Redis cerrado Dragon3', 'cerrarConexionesBD');
                    }).catch(error => {
                        dragon.seEnfada('Error cerrando Redis', 'cerrarConexionesBD', {
                            error: error.message
                        });
                    })
                );
            }

            // Cerrar MongoDB después
            const servicioMongo = this.serviciosRegistrados.get('mongoManager');
            if (servicioMongo && servicioMongo.instancia) {
                promesasCierre.push(
                    this.ejecutarConTimeout(
                        () => servicioMongo.instancia[servicioMongo.metodoShutdown](),
                        this.timeouts.database / 2,
                        'mongo'
                    ).then(() => {
                        this.marcarServicioCerrado('mongoManager');
                        dragon.sonrie('MongoDB cerrado Dragon3', 'cerrarConexionesBD');
                    }).catch(error => {
                        dragon.seEnfada('Error cerrando MongoDB', 'cerrarConexionesBD', {
                            error: error.message
                        });
                    })
                );
            }

            // Esperar todas las conexiones con timeout global
            await Promise.allSettled(promesasCierre);
            
            dragon.sonrie('Conexiones BD cerradas Dragon3', 'cerrarConexionesBD', {
                serviciosCerrados: this.estado.serviciosCerrados.length
            });

        } catch (error) {
            dragon.agoniza('Error cerrando conexiones BD', error, 'cerrarConexionesBD');
            throw error;
        }
    }

    /**
     * Cerrar solo servicios críticos en emergencia
     */
    async cerrarServiciosCriticos() {
        try {
            const promesasCriticas = [];
            
            // Solo Redis y MongoDB
            if (redisManager && typeof redisManager.cerrarConexion === 'function') {
                promesasCriticas.push(redisManager.cerrarConexion());
            }
            
            if (mongoManager && typeof mongoManager.cerrarConexion === 'function') {
                promesasCriticas.push(mongoManager.cerrarConexion());
            }
            
            await Promise.race([
                Promise.allSettled(promesasCriticas),
                new Promise(resolve => setTimeout(resolve, 3000)) // Max 3s
            ]);
            
        } catch (error) {
            dragon.agoniza('Error cerrando servicios críticos', error, 'cerrarServiciosCriticos');
        }
    }

    /**
     * Limpieza final de recursos y memoria
     */
    async limpiezaFinal() {
        try {
            // Limpiar intervalos y timeouts
            if (this.healthShutdown.intervalo) {
                clearInterval(this.healthShutdown.intervalo);
            }
            
            // Limpiar listeners de eventos
            process.removeAllListeners('SIGTERM');
            process.removeAllListeners('SIGINT');
            process.removeAllListeners('uncaughtException');
            process.removeAllListeners('unhandledRejection');
            
            // Limpiar mapas y arrays
            this.serviciosRegistrados.clear();
            this.estado.serviciosActivos = [];
            
            // Force garbage collection si está disponible
            if (global.gc) {
                global.gc();
            }
            
            dragon.zen('Limpieza final completada Dragon3', 'limpiezaFinal', {
                memoriaFinal: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
            });
            
        } catch (error) {
            dragon.seEnfada('Error en limpieza final', 'limpiezaFinal', {
                error: error.message
            });
        }
    }

    /**
     * Marcar servicio como cerrado
     * @param {string} nombre - Nombre del servicio
     */
    marcarServicioCerrado(nombre) {
        const index = this.estado.serviciosActivos.indexOf(nombre);
        if (index > -1) {
            this.estado.serviciosActivos.splice(index, 1);
            this.estado.serviciosCerrados.push(nombre);
            
            const servicio = this.serviciosRegistrados.get(nombre);
            if (servicio) {
                servicio.estado = 'cerrado';
            }
        }
    }

    /**
     * Forzar salida del proceso
     * @param {number} codigo - Código de salida
     */
    forzarSalida(codigo) {
        dragon.zen('Forzando salida del proceso Dragon3', 'forzarSalida', {
            codigo,
            tiempoTotal: this.inicioShutdown ? Date.now() - this.inicioShutdown : 0
        });
        
        process.exit(codigo);
    }

    /**
     * Verificar estado shutdown
     * @returns {boolean} True si shutdown en proceso
     */
    estaShutdownEnProceso() {
        return this.procesandoShutdown;
    }

    /**
     * Obtener estado detallado del shutdown
     * @returns {Object} Estado completo
     */
    obtenerEstado() {
        return {
            procesandoShutdown: this.procesandoShutdown,
            shutdownCompletado: this.shutdownCompletado,
            fase: this.estado.fase,
            serviciosActivos: this.estado.serviciosActivos.length,
            serviciosCerrados: this.estado.serviciosCerrados.length,
            errores: this.estado.erroresShutdown.length,
            tiempoTranscurrido: this.inicioShutdown ? Date.now() - this.inicioShutdown : 0,
            healthMetricas: this.healthShutdown.metricas,
            contadorSenales: this.contadorSenales,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Configurar timeouts personalizados
     * @param {Object} nuevosTimeouts - Nuevos valores de timeout
     */
    configurarTimeouts(nuevosTimeouts) {
        this.timeouts = { ...this.timeouts, ...nuevosTimeouts };
        
        dragon.zen('Timeouts configurados Dragon3', 'configurarTimeouts', {
            timeouts: this.timeouts
        });
    }
}

// Singleton Dragon3 enterprise
const instanciaShutdown = new ShutdownManager();

export default instanciaShutdown;