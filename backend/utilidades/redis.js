/**
 * ====================================================================
 * DRAGON3 FAANG - REDIS CLIENT ENTERPRISE
 * ====================================================================
 *
 * Archivo: utilidades/redis.js
 * Proyecto: Dragon3 - Infraestructura Redis Enterprise para Streams
 * Versión: 3.0.0-FAANG
 * Fecha: 2025-06-24
 * Autor: Gustavo Herráiz - Lead Architect
 *
 * DESCRIPCIÓN:
 * Cliente Redis robusto (ioredis) con integración de logging FAANG,
 * métricas de rendimiento, reintentos inteligentes y manejo avanzado
 * de errores para operaciones críticas y streaming.
 *
 * Características:
 * - Retry con backoff progresivo y logging de intentos
 * - Timeouts y reconexión automática
 * - Logging estructurado (dragon) para todos los eventos críticos
 * - Distinción entre errores críticos y timeouts esperados
 * - Medición de latencias por comando
 * - Eventos de conexión/desconexión documentados
 *
 * ====================================================================
 */

import Redis from 'ioredis';
import dragon from './logger.js';

// =================== CONFIGURACIÓN REDIS FAANG =======================

/**
 * Configuración avanzada para el cliente Redis Dragon3.
 * Todos los parámetros pueden ser sobreescritos por variables de entorno.
 */
const redis = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASS || undefined,
    db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB) : 0,

    // Retry inteligente con backoff y logging
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000); // Exponencial, máx 2s
        dragon.sePreocupa(`Redis retry intento ${times}, delay ${delay}ms`, 'REDIS', 'RETRY_STRATEGY');
        return delay;
    },

    maxRetriesPerRequest: 3,           // Máx reintentos por petición
    enableReadyCheck: true,            // Espera a que Redis esté listo
    autoResubscribe: true,             // Resuscripción auto a eventos
    autoResendUnfulfilledCommands: true, // Reenvía comandos pendientes
    lazyConnect: true,                 // Conexión bajo demanda
    connectTimeout: 10000,             // Timeout conexión (ms)
    keepAlive: 30000,                  // TCP keep-alive (ms)
    noDelay: true,                     // Desactiva Nagle para latencia
    commandTimeout: 5000               // Timeout por comando (ms)
});

// =================== EVENTOS DE CONEXIÓN REDIS ========================

/**
 * Logging de eventos de conexión/desconexión y errores.
 * Proporciona visibilidad total del estado del cliente Redis.
 */
redis.on('ready', () => {
    dragon.sonrie('Redis conexión establecida Dragon3', 'REDIS', 'READY');
});

redis.on('connect', () => {
    dragon.respira('Redis conectado Dragon3', 'REDIS', 'CONNECT');
});

redis.on('close', () => {
    dragon.sePreocupa('Redis conexión cerrada Dragon3', 'REDIS', 'CLOSE');
});

redis.on('end', () => {
    dragon.seEnfada('Redis conexión finalizada Dragon3', 'REDIS', 'END');
});

redis.on('reconnecting', (delay) => {
    dragon.respira(`Redis reconectando en ${delay}ms Dragon3`, 'REDIS', 'RECONNECTING');
});

// Errores de conexión críticos
redis.on('error', (err) => {
    dragon.agoniza(`Redis error conexión Dragon3: ${err.message}`, err, 'REDIS', 'ERROR');
});

// =================== INSTRUMENTACIÓN DE COMANDOS REDIS ========================

/**
 * Instrumenta todos los comandos Redis para:
 * - Medir latencia por operación
 * - Clasificar errores (timeout esperado vs error crítico)
 * - Logging estructurado con contexto
 */
const originalSendCommand = redis.sendCommand;

redis.sendCommand = function(command) {
    const inicio = Date.now();
    const resultado = originalSendCommand.call(this, command);

    if (resultado && typeof resultado.then === 'function') {
        return resultado.then(
            (res) => {
                const tiempo = Date.now() - inicio;
                dragon.mideRendimiento(`Redis ${command.name}`, tiempo, 'REDIS');
                return res;
            },
            (err) => {
                const tiempo = Date.now() - inicio;
                // ----- Distinción FAANG: Timeout esperado vs error crítico -----
                if (err && err.message && err.message.includes('Command timed out')) {
                    // Los timeouts son habituales en XREADGROUP con BLOCK, solo se marcan como preocupación
                    dragon.sePreocupa(`Redis ${command.name} timeout ${tiempo}ms`, 'REDIS', command.name, {
                        detalle: err.message,
                        argumentos: command.args
                    });
                } else if (err && err.message && err.message.includes('BUSYGROUP')) {
                    // El grupo de consumidores ya existe, no es crítico
                    dragon.seEnfada(`Redis BUSYGROUP: grupo ya existe`, 'REDIS', command.name, {
                        detalle: err.message,
                        argumentos: command.args
                    });
                } else {
                    // Errores críticos, estos sí son 💀
                    dragon.agoniza(`Redis ${command.name} falló ${tiempo}ms`, err, 'REDIS', command.name, {
                        argumentos: command.args
                    });
                }
                throw err;
            }
        );
    }

    return resultado;
};

// =================== EXPORTACIÓN FAANG ========================

/**
 * Exporta el cliente Redis para uso en toda la arquitectura Dragon3.
 * Se recomienda importar SIEMPRE desde este archivo y no crear instancias sueltas.
 */
export { redis };
export default redis;

/**
 * ====================================================================
 * USO RECOMENDADO:
 * import redis from './utilidades/redis.js';
 *
 * // Ejemplo de consumo robusto:
 * try {
 *   const res = await redis.xreadgroup(
 *     'GROUP', group, consumer,
 *     'BLOCK', 5000,
 *     'COUNT', 10,
 *     'STREAMS', stream, '>'
 *   );
 *   // Procesar mensajes
 * } catch (err) {
 *   // El logger Dragon ya gestiona el error y lo clasifica según gravedad
 * }
 * ====================================================================
 */
