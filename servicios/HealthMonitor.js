/**
 * HealthMonitor.js - Monitor P95 <200ms Dragon3
 * KISS Principle: Métricas centralizadas, alertas automáticas
 * Performance: P95 tracking garantizado
 * @author GustavoHerraiz
 * @date 2025-06-15
 */

import logger from '../utilidades/logger.js';
import redisManager from './RedisManager.js';
import mongoManager from './MongoManager.js';

const NOMBRE_MODULO = 'HealthMonitor';

class HealthMonitor {
    constructor() {
        this.metricas = {
            solicitudes: [],
            tiemposRespuesta: [],
            errores: 0,
            totalSolicitudes: 0
        };
        this.umbralP95 = 200; // ms
        this.intervalVerificacion = null;
    }

    /**
     * Iniciar monitoreo Dragon3
     */
    iniciar() {
        logger.info('Iniciando HealthMonitor Dragon3', { 
            modulo: NOMBRE_MODULO,
            umbralP95: this.umbralP95
        });

        // Verificación cada 30 segundos
        this.intervalVerificacion = setInterval(() => {
            this.verificarSaludSistema();
        }, 30000);

        logger.info('HealthMonitor activo Dragon3', { 
            modulo: NOMBRE_MODULO,
            intervalo: '30s'
        });
    }

    /**
     * Registrar tiempo de respuesta
     */
    registrarTiempoRespuesta(tiempoMs, ruta) {
        this.tiemposRespuesta.push({
            tiempo: tiempoMs,
            ruta,
            timestamp: Date.now()
        });

        this.totalSolicitudes++;

        // Mantener solo últimas 1000 métricas
        if (this.tiemposRespuesta.length > 1000) {
            this.tiemposRespuesta.shift();
        }

        // Alerta inmediata si supera umbral
        if (tiempoMs > this.umbralP95) {
            logger.warn('Tiempo respuesta alto Dragon3', {
                modulo: NOMBRE_MODULO,
                tiempo: tiempoMs,
                ruta,
                umbral: this.umbralP95
            });
        }
    }

    /**
     * Registrar error
     */
    registrarError(error, ruta) {
        this.errores++;
        
        logger.error('Error registrado Dragon3', {
            modulo: NOMBRE_MODULO,
            error: error.message,
            ruta,
            totalErrores: this.errores,
            totalSolicitudes: this.totalSolicitudes
        });
    }

    /**
     * Calcular P95
     */
    calcularP95() {
        if (this.tiemposRespuesta.length === 0) return 0;

        const tiempos = this.tiemposRespuesta
            .map(m => m.tiempo)
            .sort((a, b) => a - b);

        const indiceP95 = Math.floor(tiempos.length * 0.95);
        return tiempos[indiceP95] || 0;
    }

    /**
     * Verificar salud completa del sistema
     */
    async verificarSaludSistema() {
        try {
            const inicio = Date.now();

            // Verificar Redis
            const saludRedis = await redisManager.verificarSalud();
            
            // Verificar MongoDB
            const saludMongo = await mongoManager.verificarSalud();

            // Calcular métricas
            const p95 = this.calcularP95();
            const tasaError = this.totalSolicitudes > 0 ? 
                (this.errores / this.totalSolicitudes) * 100 : 0;

            const tiempoVerificacion = Date.now() - inicio;

            const estadoSistema = {
                p95,
                tasaError,
                redis: saludRedis,
                mongodb: saludMongo,
                tiempoVerificacion,
                totalSolicitudes: this.totalSolicitudes,
                totalErrores: this.errores,
                timestamp: new Date().toISOString()
            };

            // Log del estado
            logger.info('Health check Dragon3', {
                modulo: NOMBRE_MODULO,
                ...estadoSistema
            });

            // Alertas críticas
            if (p95 > this.umbralP95) {
                logger.error('ALERTA: P95 superado Dragon3', {
                    modulo: NOMBRE_MODULO,
                    p95Actual: p95,
                    umbral: this.umbralP95
                });
            }

            if (tasaError > 1) {
                logger.error('ALERTA: Tasa error alta Dragon3', {
                    modulo: NOMBRE_MODULO,
                    tasaError,
                    umbral: 1
                });
            }

            return estadoSistema;

        } catch (error) {
            logger.error('Error verificando salud sistema', {
                modulo: NOMBRE_MODULO,
                error: error.message,
                stack: error.stack
            });
        }
    }

    /**
     * Obtener métricas actuales
     */
    obtenerMetricas() {
        return {
            p95: this.calcularP95(),
            tasaError: this.totalSolicitudes > 0 ? 
                (this.errores / this.totalSolicitudes) * 100 : 0,
            totalSolicitudes: this.totalSolicitudes,
            totalErrores: this.errores,
            ultimasMetricas: this.tiemposRespuesta.slice(-10)
        };
    }

    /**
     * Parar monitoreo
     */
    parar() {
        if (this.intervalVerificacion) {
            clearInterval(this.intervalVerificacion);
            this.intervalVerificacion = null;
        }
        
        logger.info('HealthMonitor detenido Dragon3', { modulo: NOMBRE_MODULO });
    }
}

// Singleton Dragon3
const instanciaHealth = new HealthMonitor();
export default instanciaHealth;
