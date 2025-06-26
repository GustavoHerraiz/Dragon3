import winston from "winston";
import path from "path";
import fs from "fs";

// --- Configuración Esencial ---
const logsDir = process.env.LOG_DIR || path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Niveles de Log Personalizados y Emojis (Estilo Dragón)
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
  colors: {
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
const consoleTimestampFormat = winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' });
const fileTimestampFormat = winston.format.timestamp();

// --- Logger Base: El Corazón del Sistema de Logging ---
const logLevel = (process.env.LOG_LEVEL || "info").toLowerCase();

const baseLogger = winston.createLogger({
  levels: customLevels.levels,
  level: logLevel,
  format: winston.format.combine(
    fileTimestampFormat,
    errorStackFormat,
    winston.format.splat(),
    winston.format.metadata()
  ),
  transports: [
    // Consola
    new winston.transports.Console({
      format: winston.format.combine(
        errorStackFormat,
        consoleTimestampFormat,
        winston.format.colorize({ all: true }),
        winston.format.splat(),
        winston.format.metadata({ fillExcept: ['timestamp', 'level', 'message', 'stack', 'splat'] }),
        winston.format.printf(({ timestamp, level, message, stack, metadata }) => {
          const cleanLevel = level.replace(/\u001b\[[0-9;]*m/g, '');
          const emoji = levelEmojis[cleanLevel] || '➡️';
          const modulePart = metadata.module ? `[${metadata.module}]` : '';
          const cidPart = metadata.cid ? `(CID: ${metadata.cid})` : '';

          let logLine = `${timestamp} ${level} ${emoji} ${modulePart}${cidPart} :: ${message}`;

          const otherMeta = { ...metadata };
          delete otherMeta.module; delete otherMeta.cid;
          delete otherMeta.timestamp; delete otherMeta.level; delete otherMeta.message; delete otherMeta.stack; delete otherMeta.splat;

          const currentLevelValue = customLevels.levels[cleanLevel];
          if (currentLevelValue >= customLevels.levels.verbose && Object.keys(otherMeta).length > 0) {
            try {
              const util = require('util');
              logLine += `\n  └─ Meta: ${util.inspect(otherMeta, { depth: null, colors: true })}`;
            } catch (e) {
              try { logLine += `\n  └─ Meta (raw): ${JSON.stringify(otherMeta)}`; }
              catch { /* ignorar */ }
            }
          }

          if (stack) {
            logLine += `\n  └─ Stack: ${stack.toString()}`;
          }
          return logLine;
        })
      ),
    }),
    // Archivo general
    new winston.transports.File({
      filename: path.join(logsDir, "server.log"),
      format: winston.format.combine(
        winston.format.json()
      ),
      maxsize: 1024 * 1024 * 10,
      maxFiles: 5,
      tailable: true,
    }),
    // Archivo de errores
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
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        consoleTimestampFormat,
        winston.format.printf(info => `${info.timestamp} ${info.level} ${info.message}`)
      )
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: path.join(logsDir, 'rejections.log'), format: winston.format.json() }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        consoleTimestampFormat,
        winston.format.printf(info => `${info.timestamp} ${info.level} ${info.message}`)
      )
    })
  ],
  exitOnError: false,
});

// --- Wrapper `log`: La Interfaz Expresiva con el Sistema de Logging ---
export const log = {};
Object.keys(customLevels.levels).forEach(level => {
  const emoji = levelEmojis[level] || '➡️';
  log[level] = (message, ...args) => {
    baseLogger[level](`${emoji} ${message}`, ...args);
  };
});

// Métodos Dragon personalizados (mapeo seguro)
log.agoniza    = (...args) => log.error(...args);
log.sePreocupa = (...args) => log.warn(...args);
log.respira    = (...args) => log.info(...args);
log.zen        = (...args) => log.info(...args);
log.sonrie     = (...args) => log.info(...args);
log.mideRendimiento = (...args) => log.debug(...args);

// Exportar la instancia baseLogger por si se necesita acceso avanzado
export default baseLogger;