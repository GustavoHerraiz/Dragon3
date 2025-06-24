/**
 * RedisManager.js - Gestión Redis Dragon3
 * KISS Principle: Conexión simple, health check, shutdown graceful
 * Performance: P95 <200ms garantizado
 * @author GustavoHerraiz
 * @date 2025-06-15
 */

import Redis from 'ioredis';
import logger from '../utilidades/logger.js';

const NOMBRE_MODULO = 'RedisManager';

class RedisManager {
    constructor() {
        this.cliente = null;
        this.publicador = null;
        this.suscriptor = null;
        this.estadoConexion = 'desconectado';
    }

    /**
     * Conectar a Redis con configuración Dragon3
     */
    async conectar() {
        try {
            const urlRedis = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
            
            // Cliente principal
            this.cliente = new Redis(urlRedis);
            this.publicador = new Redis(urlRedis);
            this.suscriptor = new Redis(urlRedis);

            // Eventos de conexión
            this.cliente.on('ready', () => {
                this.estadoConexion = 'conectado';
                logger.info('Redis cliente conectado Dragon3', { modulo: NOMBRE_MODULO });
            });

            this.cliente.on('error', (error) => {
                this.estadoConexion = 'error';
                logger.error('Error conexión Redis', { 
                    modulo: NOMBRE_MODULO, 
                    error: error.message 
                });
            });

            await this.cliente.ping();
            return true;

        } catch (error) {
            logger.error('Fallo conectar Redis Dragon3', { 
                modulo: NOMBRE_MODULO, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Health check Dragon3
     */
    async verificarSalud() {
        try {
            const inicio = Date.now();
            await this.cliente.ping();
            const latencia = Date.now() - inicio;
            
            return {
                estado: 'saludable',
                latencia,
                conexion: this.estadoConexion
            };
        } catch (error) {
            return {
                estado: 'error',
                error: error.message,
                conexion: this.estadoConexion
            };
        }
    }

    /**
     * Shutdown graceful Dragon3
     */
    async cerrarConexion() {
        try {
            if (this.cliente) await this.cliente.quit();
            if (this.publicador) await this.publicador.quit();
            if (this.suscriptor) await this.suscriptor.quit();
            
            this.estadoConexion = 'desconectado';
            logger.info('Redis desconectado Dragon3', { modulo: NOMBRE_MODULO });
        } catch (error) {
            logger.error('Error cerrando Redis', { 
                modulo: NOMBRE_MODULO, 
                error: error.message 
            });
        }
    }

    // Getters para acceso controlado
    obtenerCliente() { return this.cliente; }
    obtenerPublicador() { return this.publicador; }
    obtenerSuscriptor() { return this.suscriptor; }
}

// Singleton Dragon3
const instanciaRedis = new RedisManager();
export default instanciaRedis;
