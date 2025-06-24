import winston from "winston";
import path from "path";
import fs from "fs";

// --- Configuración Esencial ---
const logsDir = path.join(process.cwd(), "logs"); // Usar process.cwd() es común, pero asegúrese de que sea consistente con su ejecución.
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Niveles de Log Personalizados y Emojis (Estilo Dragón)
// Sigue el estándar npm: 'silly' es el más verboso.
const customLevels = {
  levels: {
    error: 0,   // 🔥 Crisis, fallo crítico que requiere atención inmediata.
    warn: 1,    // ⚠️ Alerta, posible problema o condición anómala.
    info: 2,    // ✅ Información general, hitos importantes, inicio/fin de procesos.
    http: 3,    // 🌐 Logs de solicitudes HTTP (entrantes/salientes).
    verbose: 4, // 🗣️ Información más detallada que 'info', útil para trazar flujos.
    debug: 5,   // 🔬 Logs de depuración detallados, estado interno, variables.
    silly: 6    // 🤪 Logs extremadamente detallados, "trace" o "spammy" debug.
  },
  colors: { // Colores para la consola
    error: 'redBG white bold',
    warn: 'yellowBG black bold',
    info: 'green',
    http: 'magenta',
    verbose: 'cyan',
    debug: 'blue',
    silly: 'grey'
  }
};

const levelEmojis = {
  error: '🔥',
  warn: '⚠️',
  info: '✅',
  http: '🌐',
  verbose: '🗣️',
  debug: '🔬',
  silly: '🤪'
};

winston.addColors(customLevels.colors);

// --- Formatos Reutilizables ---
const errorStackFormat = winston.format.errors({ stack: true });
const consoleTimestampFormat = winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }); // Más precisión
const fileTimestampFormat = winston.format.timestamp(); // ISO8601 para archivos

// --- Logger Base: El Corazón del Sistema de Logging ---
const baseLogger = winston.createLogger({
  levels: customLevels.levels, // Usar nuestros niveles personalizados
  level: process.env.LOG_LEVEL || "debug", // Nivel por defecto, ajustable por entorno
  format: winston.format.combine(
    fileTimestampFormat,  // Timestamp para todos por defecto
    errorStackFormat,     // Procesar objetos Error para obtener stack trace
    winston.format.splat(),       // Para interpolación estilo printf (ej. %s, %d)
    winston.format.metadata()     // Agrupa metadatos en un campo 'metadata'
  ),
  transports: [
    // === Transport de Consola: El Rostro Vivo del Log ===
    new winston.transports.Console({
      format: winston.format.combine(
        errorStackFormat, // Asegurar que los errores se manejen bien aquí también
        consoleTimestampFormat,
        winston.format.colorize({ all: true }), // Aplicar colores a todo el mensaje basado en nivel
        winston.format.splat(),
        // Excluimos los campos que ya manejamos explícitamente en printf.
        // 'stack' se maneja por errorStackFormat y se imprime explícitamente.
        winston.format.metadata({ fillExcept: ['timestamp', 'level', 'message', 'stack', 'splat'] }),
        winston.format.printf(({ timestamp, level, message, stack, metadata }) => {
          const emoji = levelEmojis[level.replace(/\u001b\[[0-9;]*m/g, '')] || '➡️'; // Quitar códigos de color para lookup
          const modulePart = metadata.module ? `[${metadata.module}]` : '';
          const cidPart = metadata.cid ? `(CID: ${metadata.cid})` : ''; // Usar 'cid' como nombre estándar

          let logLine = `${timestamp} ${level} ${emoji} ${modulePart}${cidPart} :: ${message}`;

          // Mostrar metadatos adicionales si existen y el nivel es suficientemente detallado
          const otherMeta = { ...metadata };
          delete otherMeta.module; delete otherMeta.cid; // Ya impresos
          // fillExcept debería haber quitado estos, pero por seguridad:
          delete otherMeta.timestamp; delete otherMeta.level; delete otherMeta.message; delete otherMeta.stack; delete otherMeta.splat;


          // Mostrar metadatos para verbose, debug, silly
          const currentLevelValue = customLevels.levels[level.replace(/\u001b\[[0-9;]*m/g, '')];
          if (currentLevelValue >= customLevels.levels.verbose && Object.keys(otherMeta).length > 0) {
             try {
                // Usar inspect para mejor visualización de objetos complejos
                const util = require('util'); // Carga perezosa
                logLine += `\n  └─ Meta: ${util.inspect(otherMeta, { depth: null, colors: true })}`;
             } catch (e) {
                try { logLine += `\n  └─ Meta (raw): ${JSON.stringify(otherMeta)}`; }
                catch (jsonError) { /* No hacer nada si no se puede serializar */ }
             }
          }

          if (stack) {
            logLine += `\n  └─ Stack: ${stack}`;
          }
          return logLine;
        })
      ),
    }),

    // === Transport de Archivo General (server.log): La Memoria Persistente ===
    new winston.transports.File({
      filename: path.join(logsDir, "server.log"),
      format: winston.format.combine( // format.json() es bueno para máquinas
        winston.format.json()
      ),
      maxsize: 1024 * 1024 * 10, // 10MB por archivo
      maxFiles: 5, // Mantener hasta 5 archivos rotados
      tailable: true,
    }),

    // === Transport de Archivo de Errores (error.log): El Sistema Inmunológico ===
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: 'error',
      format: winston.format.json(),
      maxsize: 1024 * 1024 * 10,
      maxFiles: 3,
      tailable: true,
    }),
  ],
  // Manejo robusto de excepciones no capturadas y rechazos de promesas
  exceptionHandlers: [
    new winston.transports.File({ filename: path.join(logsDir, 'exceptions.log'), format: winston.format.json() }),
    new winston.transports.Console({ format: winston.format.combine(winston.format.colorize({all:true}), consoleTimestampFormat, winston.format.printf(info => `${info.timestamp} ${info.level} 🔥 FATAL EXCEPTION :: ${info.message}\n  └─ Stack: ${info.stack}`)) })
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: path.join(logsDir, 'rejections.log'), format: winston.format.json() }),
    new winston.transports.Console({ format: winston.format.combine(winston.format.colorize({all:true}), consoleTimestampFormat, winston.format.printf(info => `${info.timestamp} ${info.level} 🔥 UNHANDLED REJECTION :: ${info.message}\n  └─ Stack: ${info.reason?.stack || info.stack || 'No stack available'}`)) })
  ],
  exitOnError: false, // Winston no debe salir por errores manejados por los transports (true es default y puede ser peligroso)
});

// --- Wrapper `log`: La Interfaz Expresiva con el Sistema de Logging ---
// Genera dinámicamente los métodos de log (error, warn, info, http, verbose, debug, silly)
export const log = {};
Object.keys(customLevels.levels).forEach(level => {
  const emoji = levelEmojis[level] || '➡️';
  log[level] = (message, ...args) => {
    // Si el último argumento es un objeto y no es un Error, se considera metadatos.
    // Winston con format.metadata() lo manejará. Si es un Error, format.errors() lo manejará.
    // Si hay un objeto Error y metadatos, Winston los combina bien.
    baseLogger[level](`${emoji} ${message}`, ...args);
  };
});

// Exportar la instancia baseLogger por si se necesita acceso directo (debería ser raro)
export default baseLogger;

/*
--- EJEMPLO DE USO AVANZADO ---
import { log } from './path/to/winston.js'; // Ajustar ruta
import path from 'path'; // Para obtener el nombre del módulo

const MODULE_NAME = path.basename(__filename, '.js'); // Nombre del archivo sin extensión
const generateCID = () => `CID-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

// En un middleware de solicitud HTTP
function handleRequest(req, res) {
  const cid = req.headers['x-correlation-id'] || generateCID();
  log.http(`Solicitud entrante: ${req.method} ${req.url}`, { module: MODULE_NAME, cid, ip: req.ip });

  try {
    // ... lógica de la solicitud ...
    if (Math.random() < 0.1) throw new Error("Fallo aleatorio procesando solicitud");
    log.info("Solicitud procesada exitosamente.", { module: MODULE_NAME, cid, userId: req.user?.id });
    res.send("OK");
  } catch (err) {
    log.error(`Error procesando solicitud ${req.method} ${req.url}`, err, { module: MODULE_NAME, cid });
    res.status(500).send("Error interno");
  }
}

// En una tarea de fondo
async function backgroundTask() {
  const cid = generateCID();
  const taskName = "SincronizaciónDeDatos";
  log.info(`Iniciando tarea de fondo: ${taskName}`, { module: MODULE_NAME, cid, task: taskName });

  for (let i = 0; i < 5; i++) {
    log.debug(`Progreso de ${taskName}: item ${i+1}/5`, { module: MODULE_NAME, cid, task: taskName, progress: (i+1)/5 });
    await new Promise(resolve => setTimeout(resolve, 200)); // Simular trabajo
  }

  log.verbose("Detalles intermedios de la tarea", { module: MODULE_NAME, cid, task: taskName, someData: {key: "value", nested: {num:123}}});

  if (Math.random() < 0.2) {
    log.warn(`Condición inesperada en ${taskName}, continuando...`, { module: MODULE_NAME, cid, task: taskName, issue: "Datos externos no disponibles" });
  }

  log.silly("Estado interno ultra-detallado de la tarea", { module: MODULE_NAME, cid, task: taskName, internalState: { a:1,b:2,c:3,d:Date.now()}});
  log.info(`Tarea de fondo ${taskName} completada.`, { module: MODULE_NAME, cid, task: taskName });
}

// Ejemplo de pulso del sistema (podría ir en un intervalo)
// log.debug("💓 System Pulse", { module: "HEARTBEAT", pid: process.pid, uptime: process.uptime(), memoryUsage: process.memoryUsage() });

// Para probar exception/rejection handlers (NO USAR EN PRODUCCIÓN DIRECTAMENTE ASÍ):
// setTimeout(() => { throw new Error("Excepción no capturada de prueba!"); }, 1000);
// setTimeout(() => { Promise.reject(new Error("Rechazo de Promesa de prueba!")); }, 2000);
*/
