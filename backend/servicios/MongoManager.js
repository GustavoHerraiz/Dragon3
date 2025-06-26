/**
 * MongoManager.js - Gestión MongoDB Atlas Dragon3
 * KISS Principle: Conexión simple, pool optimizado, health check
 * Performance: P95 <200ms garantizado
 * @author GustavoHerraiz
 * @date 2025-06-15
 * @version 3.0.0-FAANG
 */

import mongoose from 'mongoose';
import logger from '../utilidades/logger.js';

const NOMBRE_MODULO = 'MongoManager';

/**
 * Gestión enterprise de conexiones MongoDB Atlas
 * Implementa patrón Singleton con pool optimizado y health checks
 * Características FAANG:
 * - Reconexión automática
 * - Health monitoring continuo  
 * - Logging estructurado
 * - Pool de conexiones optimizado
 * - Shutdown graceful
 */
class MongoManager {
    constructor() {
        this.estadoConexion = 'desconectado';
        this.configurarEventos();
    }

    /**
     * Configura eventos de conexión MongoDB Dragon3
     * Maneja reconexiones automáticas y logging enterprise
     */
    configurarEventos() {
        mongoose.connection.on('connected', () => {
            this.estadoConexion = 'conectado';
            logger.info('MongoDB Atlas conectado Dragon3', { 
                modulo: NOMBRE_MODULO,
                host: mongoose.connection.host,
                db: mongoose.connection.name,
                timestamp: new Date().toISOString()
            });
        });

        mongoose.connection.on('error', (error) => {
            this.estadoConexion = 'error';
            logger.error('Error conexión MongoDB Atlas', { 
                modulo: NOMBRE_MODULO, 
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
        });

        mongoose.connection.on('disconnected', () => {
            this.estadoConexion = 'desconectado';
            logger.warn('MongoDB Atlas desconectado', { 
                modulo: NOMBRE_MODULO,
                timestamp: new Date().toISOString()
            });
        });

        mongoose.connection.on('reconnected', () => {
            this.estadoConexion = 'reconectado';
            logger.info('MongoDB Atlas reconectado Dragon3', { 
                modulo: NOMBRE_MODULO,
                timestamp: new Date().toISOString()
            });
        });
    }

    /**
     * Conecta a MongoDB Atlas con configuración Dragon3 enterprise
     * @returns {Promise<boolean>} True si conexión exitosa
     * @throws {Error} Error de conexión con detalles
     */
    async conectar() {
        try {
            const uriMongoDB = process.env.MONGODB_URI;
            
            if (!uriMongoDB) {
                throw new Error('MONGODB_URI no definido en .env');
            }

            logger.info('Iniciando conexión MongoDB Atlas Dragon3', { 
                modulo: NOMBRE_MODULO,
                uri: uriMongoDB.replace(/\/\/.*@/, '//***:***@'), // Ocultar credenciales
                timestamp: new Date().toISOString()
            });

            // Configuración optimizada Dragon3 enterprise
            const opciones = {
                maxPoolSize: 10,                    // Pool máximo para carga
                serverSelectionTimeoutMS: 5000,    // Timeout selección servidor
                socketTimeoutMS: 45000,             // Timeout socket
                bufferMaxEntries: 0,                // Sin buffer infinito
                retryWrites: true,                  // Retry automático escrituras
                w: 'majority',                      // Write concern seguro
                readPreference: 'primary',          // Lectura desde primario
                heartbeatFrequencyMS: 10000,        // Heartbeat cada 10s
                maxIdleTimeMS: 300000              // Timeout idle 5min
            };

            mongoose.set('strictQuery', true);
            await mongoose.connect(uriMongoDB, opciones);

            logger.info('MongoDB Atlas conectado exitosamente Dragon3', { 
                modulo: NOMBRE_MODULO,
                estado: this.estadoConexion,
                poolSize: opciones.maxPoolSize,
                readyState: mongoose.connection.readyState,
                timestamp: new Date().toISOString()
            });

            return true;

        } catch (error) {
            logger.error('Fallo conectar MongoDB Atlas Dragon3', { 
                modulo: NOMBRE_MODULO, 
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    /**
     * Health check enterprise para MongoDB Atlas
     * Realiza ping de latencia y verifica estado de conexión
     * @returns {Promise<Object>} Estado detallado de salud
     */
    async verificarSalud() {
        try {
            const inicio = Date.now();
            await mongoose.connection.db.admin().ping();
            const latencia = Date.now() - inicio;
            
            return {
                estado: 'saludable',
                latencia,
                conexion: this.estadoConexion,
                readyState: mongoose.connection.readyState,
                host: mongoose.connection.host,
                db: mongoose.connection.name,
                timestamp: new Date().toISOString(),
                performance: latencia < 200 ? 'excelente' : latencia < 500 ? 'buena' : 'degradada'
            };
        } catch (error) {
            return {
                estado: 'error',
                error: error.message,
                conexion: this.estadoConexion,
                readyState: mongoose.connection.readyState,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Cierre graceful de conexión MongoDB Atlas
     * Implementa shutdown seguro para container/K8s
     */
    async cerrarConexion() {
        try {
            await mongoose.connection.close();
            this.estadoConexion = 'desconectado';
            logger.info('MongoDB Atlas desconectado Dragon3', { 
                modulo: NOMBRE_MODULO,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Error cerrando MongoDB Atlas', { 
                modulo: NOMBRE_MODULO, 
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Obtener estado actual de conexión MongoDB
     * @returns {Object} Estado detallado de conexión
     */
    obtenerEstado() { 
        return {
            estado: this.estadoConexion,
            readyState: mongoose.connection.readyState,
            readyStateDescripcion: this._obtenerDescripcionReadyState(mongoose.connection.readyState),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Convierte código readyState a descripción legible
     * @private
     * @param {number} readyState - Código de estado mongoose
     * @returns {string} Descripción del estado
     */
    _obtenerDescripcionReadyState(readyState) {
        const estados = {
            0: 'desconectado',
            1: 'conectado',
            2: 'conectando',
            3: 'desconectando',
            4: 'invalido'
        };
        return estados[readyState] || 'desconocido';
    }

    /**
     * Obtener métricas de performance MongoDB
     * @returns {Object} Métricas detalladas de performance
     */
    obtenerMetricas() {
        const connection = mongoose.connection;
        return {
            readyState: connection.readyState,
            host: connection.host,
            port: connection.port,
            name: connection.name,
            collections: connection.collections ? Object.keys(connection.collections).length : 0,
            models: connection.models ? Object.keys(connection.models).length : 0,
            timestamp: new Date().toISOString()
        };
    }
}

// Singleton Dragon3 - Una instancia global
const instanciaMongo = new MongoManager();

// Graceful shutdown handler
process.on('SIGTERM', async () => {
    logger.info('SIGTERM recibido, cerrando MongoDB...', { modulo: NOMBRE_MODULO });
    await instanciaMongo.cerrarConexion();
});

process.on('SIGINT', async () => {
    logger.info('SIGINT recibido, cerrando MongoDB...', { modulo: NOMBRE_MODULO });
    await instanciaMongo.cerrarConexion();
});

export default instanciaMongo;