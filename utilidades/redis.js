import Redis from 'ioredis';
import dragon from './logger.js';

// --- Configuración Redis Dragon3 ---
const redis = new Redis({
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000); // Incremento exponencial con límite
        dragon.sePreocupa(`Redis retry intento ${times}, delay ${delay}ms`, 'REDIS', 'RETRY_STRATEGY');
        return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    autoResubscribe: true,
    autoResendUnfulfilledCommands: true,
    lazyConnect: true,
    connectTimeout: 10000, // Timeout de conexión
    keepAlive: 30000, // Mantener conexión viva  
    noDelay: true, // Deshabilitar algoritmo de Nagle
    commandTimeout: 5000 // Timeout para comandos individuales
});

// --- Estados Dragon Redis ---
redis.on('ready', () => {
    dragon.sonrie('Redis conexión establecida Dragon3', 'REDIS', 'READY');
});

redis.on('error', (err) => {
    dragon.agoniza(`Redis error conexión Dragon3: ${err.message}`, err, 'REDIS', 'ERROR');
});

redis.on('close', () => {
    dragon.sePreocupa('Redis conexión cerrada Dragon3', 'REDIS', 'CLOSE');
});

redis.on('reconnecting', (delay) => {
    dragon.respira(`Redis reconectando en ${delay}ms Dragon3`, 'REDIS', 'RECONNECTING');
});

redis.on('end', () => {
    dragon.seEnfada('Redis conexión finalizada Dragon3', 'REDIS', 'END');
});

redis.on('connect', () => {
    dragon.respira('Redis conectado Dragon3', 'REDIS', 'CONNECT');
});

// --- Monitoreo Performance Redis ---
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
                dragon.agoniza(`Redis ${command.name} falló ${tiempo}ms`, err, 'REDIS', command.name);
                throw err;
            }
        );
    }
    
    return resultado;
};

// --- Export Dragon Redis ---
export { redis };
export default redis;