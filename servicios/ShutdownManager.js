/**
 * ShutdownManager.js - Coordinador shutdown graceful Dragon3
 * KISS Principle: Cierre ordenado de todos los servicios
 * Performance: Garantizar P95 durante shutdown
 * @author GustavoHerraiz
 * @date 2025-04-15
 */

import logger from '../utilidades/logger.js';
import redisManager from './RedisManager.js';
import mongoManager from './MongoManager.js';
import healthMonitor from './HealthMonitor.js';

const NOMBRE_MODULO = 'ShutdownManager';

class ShutdownManager {
    constructor() {
        this.servidorExpress = null;
        this.procesandoShutdown = false;
        this.timeoutShutdown = 15000; // 15 segundos máximo
        this.configurarSignales();
    }

    /**
     * Configurar señales de sistema Dragon3
     */
    configurarSignales() {
        // Señales graceful shutdown
        process.on('SIGTERM', () => this.iniciarShutdown('SIGTERM'));
        process.on('SIGINT', () => this.iniciarShutdown('SIGINT'));
        
        // Errores no manejados
        process.on('uncaughtException', (error) => {
            logger.error('Excepción no capturada Dragon3', {
                modulo: NOMBRE_MODULO,
                error: error.message,
                stack: error.stack
            });
            this.iniciarShutdown('uncaughtException');
        });

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Promesa rechazada no manejada Dragon3', {
                modulo: NOMBRE_MODULO,
                reason: reason.toString(),
                promise: promise.toString()
            });
            this.iniciarShutdown('unhandledRejection');
        });

        logger.info('Señales shutdown configuradas Dragon3', { 
            modulo: NOMBRE_MODULO,
            timeout: this.timeoutShutdown
        });
    }

    /**
     * Registrar servidor Express
     */
    registrarServidor(servidor) {
        this.servidorExpress = servidor;
        logger.info('Servidor Express registrado Dragon3', { 
            modulo: NOMBRE_MODULO 
        });
    }

    /**
     * Iniciar proceso shutdown graceful
     */
    async iniciarShutdown(señal) {
        if (this.procesandoShutdown) {
            logger.warn('Shutdown ya en proceso Dragon3', { 
                modulo: NOMBRE_MODULO,
                señal 
            });
            return;
        }

        this.procesandoShutdown = true;
        
        logger.info('Iniciando shutdown graceful Dragon3', { 
            modulo: NOMBRE_MODULO,
            señal,
            timeout: this.timeoutShutdown
        });

        // Timeout de seguridad
        const timeoutId = setTimeout(() => {
            logger.error('Timeout shutdown Dragon3 - Forzando salida', { 
                modulo: NOMBRE_MODULO 
            });
            process.exit(1);
        }, this.timeoutShutdown);

        try {
            // 1. Parar HealthMonitor
            await this.pararHealthMonitor();
            
            // 2. Cerrar servidor Express
            await this.cerrarServidorExpress();
            
            // 3. Cerrar conexiones base de datos
            await this.cerrarConexionesBD();
            
            // 4. Log final
            logger.info('Shutdown graceful completado Dragon3', { 
                modulo: NOMBRE_MODULO,
                señal 
            });

            clearTimeout(timeoutId);
            process.exit(0);

        } catch (error) {
            logger.error('Error durante shutdown Dragon3', {
                modulo: NOMBRE_MODULO,
                error: error.message,
                stack: error.stack
            });
            
            clearTimeout(timeoutId);
            process.exit(1);
        }
    }

    /**
     * Parar HealthMonitor
     */
    async pararHealthMonitor() {
        try {
            healthMonitor.parar();
            logger.info('HealthMonitor detenido Dragon3', { 
                modulo: NOMBRE_MODULO 
            });
        } catch (error) {
            logger.error('Error parando HealthMonitor', {
                modulo: NOMBRE_MODULO,
                error: error.message
            });
        }
    }

    /**
     * Cerrar servidor Express
     */
    async cerrarServidorExpress() {
        if (!this.servidorExpress) return;

        return new Promise((resolve) => {
            this.servidorExpress.close((error) => {
                if (error) {
                    logger.error('Error cerrando servidor Express', {
                        modulo: NOMBRE_MODULO,
                        error: error.message
                    });
                } else {
                    logger.info('Servidor Express cerrado Dragon3', { 
                        modulo: NOMBRE_MODULO 
                    });
                }
                resolve();
            });
        });
    }

    /**
     * Cerrar conexiones base de datos
     */
    async cerrarConexionesBD() {
        try {
            // Cerrar Redis
            await redisManager.cerrarConexion();
            
            // Cerrar MongoDB
            await mongoManager.cerrarConexion();
            
            logger.info('Conexiones BD cerradas Dragon3', { 
                modulo: NOMBRE_MODULO 
            });

        } catch (error) {
            logger.error('Error cerrando conexiones BD', {
                modulo: NOMBRE_MODULO,
                error: error.message
            });
        }
    }

    /**
     * Verificar estado shutdown
     */
    estaShutdownEnProceso() {
        return this.procesandoShutdown;
    }
}

// Singleton Dragon3
const instanciaShutdown = new ShutdownManager();
export default instanciaShutdown;
