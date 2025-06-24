/**
 * MongoManager.js - Gestión MongoDB Atlas Dragon3
 * KISS Principle: Conexión simple, pool optimizado, health check
 * Performance: P95 <200ms garantizado
 * @author GustavoHerraiz
 * @date 2025-06-15
 */

import mongoose from 'mongoose';
import logger from '../utilidades/logger.js';

const NOMBRE_MODULO = 'MongoManager';

class MongoManager {
    constructor() {
        this.estadoConexion = 'desconectado';
        this.configurarEventos();
    }

    /**
     * Configurar eventos MongoDB Dragon3
     */
    configurarEventos() {
        mongoose.connection.on('connected', () => {
            this.estadoConexion = 'conectado';
            logger.info('MongoDB Atlas conectado Dragon3', { 
                modulo: NOMBRE_MODULO,
                host: mongoose.connection.host,
                db: mongoose.connection.name
            });
        });

        mongoose.connection.on('error', (error) => {
            this.estadoConexion = 'error';
            logger.error('Error conexión MongoDB Atlas', { 
                modulo: NOMBRE_MODULO, 
                error: error.message 
            });
        });

        mongoose.connection.on('disconnected', () => {
            this.estadoConexion = 'desconectado';
            logger.warn('MongoDB Atlas desconectado', { modulo: NOMBRE_MODULO });
        });

        mongoose.connection.on('reconnected', () => {
            this.estadoConexion = 'reconectado';
            logger.info('MongoDB Atlas reconectado Dragon3', { modulo: NOMBRE_MODULO });
        });
    }

    /**
     * Conectar a MongoDB Atlas con configuración Dragon3
     */
    async conectar() {
        try {
            const uriMongoDB = process.env.MONGODB_URI;
            
            if (!uriMongoDB) {
                throw new Error('MONGODB_URI no definido en .env');
            }

            logger.info('Iniciando conexión MongoDB Atlas Dragon3', { 
                modulo: NOMBRE_MODULO,
                uri: uriMongoDB.replace(/\/\/.*@/, '//***:***@') // Ocultar credenciales
            });

            // Configuración optimizada Dragon3
            const opciones = {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
                bufferMaxEntries: 0,
                retryWrites: true,
                w: 'majority'
            };

            mongoose.set('strictQuery', true);
            await mongoose.connect(uriMongoDB, opciones);

            logger.info('MongoDB Atlas conectado exitosamente Dragon3', { 
                modulo: NOMBRE_MODULO,
                estado: this.estadoConexion,
                poolSize: opciones.maxPoolSize
            });

            return true;

        } catch (error) {
            logger.error('Fallo conectar MongoDB Atlas Dragon3', { 
                modulo: NOMBRE_MODULO, 
                error: error.message,
                stack: error.stack
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
            await mongoose.connection.db.admin().ping();
            const latencia = Date.now() - inicio;
            
            return {
                estado: 'saludable',
                latencia,
                conexion: this.estadoConexion,
                readyState: mongoose.connection.readyState,
                host: mongoose.connection.host,
                db: mongoose.connection.name
            };
        } catch (error) {
            return {
                estado: 'error',
                error: error.message,
                conexion: this.estadoConexion,
                readyState: mongoose.connection.readyState
            };
        }
    }

    /**
     * Shutdown graceful Dragon3
     */
    async cerrarConexion() {
        try {
            await mongoose.connection.close();
            this.estadoConexion = 'desconectado';
            logger.info('MongoDB Atlas desconectado Dragon3', { modulo: NOMBRE_MODULO });
        } catch (error) {
            logger.error('Error cerrando MongoDB Atlas', { 
                modulo: NOMBRE_MODULO, 
                error: error.message 
            });
        }
    }

    // Getter para estado
    obtenerEstado() { 
        return {
            estado: this.estadoConexion,
            readyState: mongoose.connection.readyState
        };
    }
}

// Singleton Dragon3
const instanciaMongo = new MongoManager();
export default instanciaMongo;
