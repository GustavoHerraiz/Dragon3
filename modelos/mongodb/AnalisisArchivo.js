/**
 * ====================================================================
 * DRAGON3 - MODELO MONGODB ANÁLISIS ARCHIVO (ADAPTADO DRAGON2)
 * ====================================================================
 * 
 * Archivo: modelos/mongodb/AnalisisArchivo.js
 * Proyecto: Dragon3 - Sistema de Autentificación de Imágenes con IA
 * Versión: 3.0.0
 * Fecha: 2025-04-15
 * Autor: Gustavo Herráiz - Lead Architect
 * 
 * DESCRIPCIÓN:
 * Modelo Mongoose para análisis de archivos adaptado desde Dragon2.
 * Mantiene compatibilidad con estructura existente pero añade
 * características Dragon3: correlation tracking, performance metrics,
 * soporte video, y logging mejorado.
 * 
 * COMPATIBILIDAD DRAGON2:
 * ✅ BasicoSchema preservado
 * ✅ ResultadoSchema mejorado con nuevos campos
 * ✅ AnalisisArchivoSchema extendido con Dragon3 features
 * ✅ Índices optimizados para performance P95 <200ms
 * 
 * NUEVAS CARACTERÍSTICAS DRAGON3:
 * - Correlation ID tracking completo
 * - Soporte para video analysis
 * - Performance metrics integradas
 * - Error handling mejorado
 * - Logging Dragon ZEN API compatible
 * - Network mirroring support
 * 
 * MÉTRICAS OBJETIVO:
 * - Insert time: <50ms P95
 * - Query time: <100ms P95
 * - Uptime: 99.9%
 * - Error rate: <1%
 * 
 * ====================================================================
 */

import mongoose from "mongoose";
import dragon from "../../utilidades/logger.js";

/**
 * Schema para información básica del archivo
 * Preservado desde Dragon2 con extensiones Dragon3
 */
const BasicoSchema = new mongoose.Schema({
    // =================== CAMPOS DRAGON2 (PRESERVADOS) ===================
    formato: { 
        type: String,
        description: "Formato del archivo (JPEG, PNG, PDF, MP4, etc.)"
    },
    dimensiones: { 
        type: String,
        description: "Dimensiones del archivo (ej: 1920x1080)"
    },
    resolucion: { 
        type: String,
        description: "Resolución del archivo"
    },
    exif: { 
        type: mongoose.Schema.Types.Mixed,
        description: "Metadatos EXIF del archivo"
    },
    
    // =================== NUEVOS CAMPOS DRAGON3 ===================
    tamañoBytes: {
        type: Number,
        description: "Tamaño del archivo en bytes"
    },
    mimeType: {
        type: String,
        description: "MIME type completo del archivo"
    },
    checksumSHA256: {
        type: String,
        description: "Checksum SHA-256 para integridad"
    },
    
    // Campos específicos para video (Dragon3)
    duracionSegundos: {
        type: Number,
        description: "Duración del video en segundos"
    },
    fps: {
        type: Number,
        description: "Frames por segundo (para video)"
    },
    codec: {
        type: String,
        description: "Codec utilizado (para video)"
    },
    
    // Metadatos extendidos
    metadatosExtendidos: {
        type: mongoose.Schema.Types.Mixed,
        description: "Metadatos adicionales específicos del tipo"
    }
}, { _id: false });

/**
 * Schema para resultados de análisis
 * Extendido desde Dragon2 con mejoras Dragon3
 */
const ResultadoSchema = new mongoose.Schema({
    // =================== CAMPOS DRAGON2 (PRESERVADOS) ===================
    scoreHumano: { 
        type: mongoose.Schema.Types.Mixed, 
        default: "N/A",
        description: "Score de detección humana (0-1 o N/A)"
    },
    confianza: { 
        type: Number, 
        default: 0,
        min: 0,
        max: 1,
        description: "Nivel de confianza del análisis (0-1)"
    },
    decision: { 
        type: String, 
        default: "Indeterminado",
        enum: ["Humano", "Artificial", "Indeterminado", "Error"],
        description: "Decisión final del análisis"
    },
    resultadosDetallados: { 
        type: mongoose.Schema.Types.Mixed,
        description: "Resultados detallados del análisis IA"
    },
    basico: { 
        type: BasicoSchema, 
        required: true,
        description: "Información básica del archivo"
    },
    explicacionesConsolidadas: { 
        type: [mongoose.Schema.Types.Mixed], 
        default: [],
        description: "Explicaciones del análisis consolidadas"
    },
    
    // =================== NUEVOS CAMPOS DRAGON3 ===================
    analisisIA: {
        // Resultados específicos por modelo
        modelosPrincipales: [{
            nombre: String,
            version: String,
            score: Number,
            confianza: Number,
            tiempo_ms: Number
        }],
        
        // Análisis de red neuronal
        redNeuronal: {
            activaciones: [Number],
            capasIntermediarias: mongoose.Schema.Types.Mixed,
            vectorCaracteristicas: [Number]
        },
        
        // Detección de patrones
        patronesDetectados: [{
            tipo: String,
            coordenadas: mongoose.Schema.Types.Mixed,
            confianza: Number
        }]
    },
    
    // Performance del análisis
    metricas: {
        tiempoAnalisisMs: Number,
        memoriaUsadaMB: Number,
        cpuUsagePercent: Number,
        gpuUsagePercent: Number,
        throughputMBps: Number
    },
    
    // Estado del análisis
    estado: {
        type: String,
        enum: ["procesando", "completado", "error", "timeout", "cancelado"],
        default: "procesando",
        description: "Estado actual del análisis"
    },
    
    // Error details si aplica
    errorDetails: {
        codigo: String,
        mensaje: String,
        stack: String,
        timestamp: Date
    }
}, { _id: false });

/**
 * Schema principal para análisis de archivos Dragon3
 * Basado en Dragon2 con extensiones completas
 */
const AnalisisArchivoSchema = new mongoose.Schema({
    // =================== CAMPOS DRAGON2 (PRESERVADOS) ===================
    usuarioId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Usuario", 
        required: false, // Cambiado: permite análisis públicos
        index: true,
        description: "ID del usuario (null para análisis públicos)"
    },
    nombreArchivo: { 
        type: String, 
        required: true,
        maxlength: 255,
        description: "Nombre del archivo almacenado"
    },
    nombreOriginal: { 
        type: String, 
        required: true,
        maxlength: 255,
        description: "Nombre original del archivo subido"
    },
    tipo: { 
        type: String, 
        enum: ["imagen", "pdf", "video"], // Añadido video
        required: true,
        index: true,
        description: "Tipo de archivo analizado"
    },
    resultado: { 
        type: ResultadoSchema, 
        required: true,
        description: "Resultados completos del análisis"
    },
    hashArchivo: { 
        type: String, 
        required: true, 
        index: true,
        description: "Hash único del archivo"
    },
    imagenId: { 
        type: String,
        description: "ID único de la imagen/archivo"
    },
    mensaje: { 
        type: String,
        maxlength: 1000,
        description: "Mensaje descriptivo del análisis"
    },
    timestamp: { 
        type: Date, 
        default: Date.now,
        index: true,
        description: "Timestamp del análisis"
    },
    informePDF: { 
        type: String,
        description: "Ruta del informe PDF generado"
    },
    
    // =================== NUEVOS CAMPOS DRAGON3 ===================
    
    // Tracking y correlation
    correlationId: {
        type: String,
        required: true,
        index: true,
        description: "ID único para tracking de request"
    },
    
    // Información de la sesión
    sesionInfo: {
        ipCliente: String,
        userAgent: String,
        origen: String,
        referrer: String,
        timestamp: { type: Date, default: Date.now }
    },
    
    // Rutas de archivos
    rutas: {
        archivoOriginal: {
            type: String,
            required: true,
            description: "Ruta del archivo original"
        },
        archivoOptimizado: String,
        archivoThumbnail: String,
        informeJSON: String,
        informePDF: String
    },
    
    // Red Superior tracking (Mirror Network)
    redSuperior: {
        procesadoEnRed: {
            type: Boolean,
            default: false,
            description: "Si fue procesado en Red Superior"
        },
        nodosProcesamiento: [String],
        tiempoRedMs: Number,
        consensoNodes: Number,
        resultadosDistribuidos: mongoose.Schema.Types.Mixed
    },
    
    // Servidor Central tracking
    servidorCentral: {
        instanciaId: String,
        procesoId: String,
        workerThread: String,
        loadBalancerId: String
    },
    
    // Auditoría y compliance
    auditoria: {
        fechaCreacion: { type: Date, default: Date.now },
        fechaModificacion: Date,
        usuarioModificacion: String,
        razonModificacion: String,
        retencionHasta: Date,
        politicaPrivacidad: String
    },
    
    // Performance completa
    performance: {
        faseUpload: {
            inicioMs: Number,
            finMs: Number,
            tamañoOriginalMB: Number
        },
        faseAnalisis: {
            inicioMs: Number,
            finMs: Number,
            modelosUtilizados: [String],
            recursosConsumidos: mongoose.Schema.Types.Mixed
        },
        faseRespuesta: {
            inicioMs: Number,
            finMs: Number,
            tamañoRespuestaKB: Number
        },
        metricas: {
            tiempoTotalMs: Number,
            p95TargetMet: Boolean,
            errorOccurred: Boolean,
            retryCount: Number
        }
    }
}, {
    // =================== CONFIGURACIÓN SCHEMA ===================
    timestamps: true, // Añade createdAt y updatedAt
    collection: "analisis_archivos", // Mantiene compatibilidad Dragon2
    versionKey: "__v"
});

// =================== ÍNDICES OPTIMIZADOS DRAGON3 ===================

// Índice compuesto principal para búsquedas rápidas
AnalisisArchivoSchema.index({ 
    correlationId: 1, 
    timestamp: -1 
}, { 
    name: "correlation_timestamp_idx",
    background: true 
});

// Índice para historial usuario (preservado Dragon2)
AnalisisArchivoSchema.index({ 
    usuarioId: 1, 
    timestamp: -1 
}, { 
    name: "user_history_idx",
    background: true,
    partialFilterExpression: { usuarioId: { $ne: null } }
});

// Índice para deduplicación por hash (preservado Dragon2)
AnalisisArchivoSchema.index({ 
    hashArchivo: 1 
}, { 
    name: "hash_dedup_idx",
    background: true
});

// Índice para filtros por tipo y estado
AnalisisArchivoSchema.index({ 
    tipo: 1, 
    "resultado.estado": 1,
    timestamp: -1 
}, { 
    name: "type_status_date_idx",
    background: true
});

// Índice para Red Superior queries
AnalisisArchivoSchema.index({ 
    "redSuperior.procesadoEnRed": 1,
    timestamp: -1 
}, { 
    name: "red_superior_idx",
    background: true
});

// Índice para performance monitoring
AnalisisArchivoSchema.index({ 
    "performance.metricas.p95TargetMet": 1,
    "performance.metricas.errorOccurred": 1,
    timestamp: -1 
}, { 
    name: "performance_monitoring_idx",
    background: true
});

// =================== MÉTODOS DE INSTANCIA DRAGON3 ===================

/**
 * Marcar análisis como completado con métricas
 */
AnalisisArchivoSchema.methods.marcarCompletado = function(resultadoFinal, metricas = {}) {
    const tiempoTotal = Date.now() - this.timestamp.getTime();
    
    this.resultado.estado = "completado";
    this.resultado = { ...this.resultado, ...resultadoFinal };
    this.performance.metricas.tiempoTotalMs = tiempoTotal;
    this.performance.metricas.p95TargetMet = tiempoTotal < 200; // Target P95 <200ms
    this.auditoria.fechaModificacion = new Date();
    
    dragon.sonrie("Análisis marcado como completado", "AnalisisArchivo.js", "ANALYSIS_COMPLETED", {
        correlationId: this.correlationId,
        tiempoTotalMs: tiempoTotal,
        p95Target: this.performance.metricas.p95TargetMet
    });
    
    return this.save();
};

/**
 * Marcar análisis con error
 */
AnalisisArchivoSchema.methods.marcarError = function(error, codigo = "UNKNOWN_ERROR") {
    this.resultado.estado = "error";
    this.resultado.errorDetails = {
        codigo: codigo,
        mensaje: error.message || error,
        stack: error.stack || "",
        timestamp: new Date()
    };
    this.performance.metricas.errorOccurred = true;
    this.auditoria.fechaModificacion = new Date();
    
    dragon.agoniza("Análisis marcado con error", error, "AnalisisArchivo.js", "ANALYSIS_ERROR", {
        correlationId: this.correlationId,
        errorCode: codigo
    });
    
    return this.save();
};

/**
 * Actualizar métricas de performance
 */
AnalisisArchivoSchema.methods.actualizarPerformance = function(fase, metricas) {
    if (!this.performance[fase]) {
        this.performance[fase] = {};
    }
    this.performance[fase] = { ...this.performance[fase], ...metricas };
    
    return this.save();
};

/**
 * Marcar procesamiento en Red Superior
 */
AnalisisArchivoSchema.methods.marcarRedSuperior = function(nodos, tiempoMs, consenso) {
    this.redSuperior.procesadoEnRed = true;
    this.redSuperior.nodosProcesamiento = nodos;
    this.redSuperior.tiempoRedMs = tiempoMs;
    this.redSuperior.consensoNodes = consenso;
    
    dragon.zen("Análisis procesado en Red Superior", "AnalisisArchivo.js", "RED_SUPERIOR_PROCESSED", {
        correlationId: this.correlationId,
        nodos: nodos.length,
        consenso: consenso
    });
    
    return this.save();
};

// =================== MÉTODOS ESTÁTICOS DRAGON3 ===================

/**
 * Buscar por correlation ID (método principal Dragon3)
 */
AnalisisArchivoSchema.statics.buscarPorCorrelationId = function(correlationId) {
    return this.findOne({ correlationId }).sort({ timestamp: -1 });
};

/**
 * Historial de usuario con paginación
 */
AnalisisArchivoSchema.statics.historialUsuario = function(usuarioId, limite = 50, offset = 0) {
    return this.find({ usuarioId })
               .sort({ timestamp: -1 })
               .limit(limite)
               .skip(offset)
               .select("-resultado.resultadosDetallados -resultado.analisisIA.redNeuronal");
};

/**
 * Estadísticas de performance para monitoring
 */
AnalisisArchivoSchema.statics.estadisticasPerformance = function(fechaInicio = null, fechaFin = null) {
    const match = {};
    if (fechaInicio) match.timestamp = { $gte: fechaInicio };
    if (fechaFin) match.timestamp = { ...match.timestamp, $lte: fechaFin };
    
    return this.aggregate([
        { $match: match },
        {
            $group: {
                _id: "$tipo",
                totalAnalisis: { $sum: 1 },
                completados: { 
                    $sum: { $cond: [{ $eq: ["$resultado.estado", "completado"] }, 1, 0] }
                },
                errores: { 
                    $sum: { $cond: [{ $eq: ["$resultado.estado", "error"] }, 1, 0] }
                },
                tiempoPromedioMs: { $avg: "$performance.metricas.tiempoTotalMs" },
                p95Compliance: { 
                    $avg: { $cond: ["$performance.metricas.p95TargetMet", 1, 0] }
                },
                redSuperiorUsage: { 
                    $avg: { $cond: ["$redSuperior.procesadoEnRed", 1, 0] }
                }
            }
        }
    ]);
};

/**
 * Análisis con errores para debugging
 */
AnalisisArchivoSchema.statics.analisisConErrores = function(limite = 100) {
    return this.find({ "resultado.estado": "error" })
               .sort({ timestamp: -1 })
               .limit(limite)
               .select("correlationId nombreOriginal resultado.errorDetails timestamp");
};

// =================== HOOKS (MIDDLEWARE) ===================

// Pre-save: Validaciones y logging
AnalisisArchivoSchema.pre("save", function(next) {
    // Generar correlation ID si no existe
    if (!this.correlationId) {
        this.correlationId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Generar imagenId si no existe (compatibilidad Dragon2)
    if (!this.imagenId) {
        this.imagenId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Actualizar timestamp de modificación
    if (this.isModified() && !this.isNew) {
        this.auditoria.fechaModificacion = new Date();
    }
    
    next();
});

// Post-save: Logging de métricas
AnalisisArchivoSchema.post("save", function(doc) {
    const tiempoTotal = doc.performance?.metricas?.tiempoTotalMs;
    
    if (tiempoTotal) {
        dragon.mideRendimiento("analisis_completo", tiempoTotal, "AnalisisArchivo.js", {
            correlationId: doc.correlationId,
            tipo: doc.tipo,
            estado: doc.resultado.estado
        });
    }
    
    dragon.respira("Análisis guardado en base de datos", "AnalisisArchivo.js", "ANALYSIS_SAVED", {
        correlationId: doc.correlationId,
        tipo: doc.tipo,
        estado: doc.resultado.estado
    });
});

// =================== CONFIGURACIÓN FINAL ===================

const AnalisisArchivo = mongoose.model("AnalisisArchivo", AnalisisArchivoSchema);

export default AnalisisArchivo;

/**
 * ====================================================================
 * EJEMPLOS DE USO DRAGON3:
 * 
 * // Crear análisis (compatibilidad Dragon2)
 * const analisis = new AnalisisArchivo({
 *     usuarioId: userId,
 *     nombreArchivo: "imagen_001.jpg",
 *     nombreOriginal: "foto.jpg", 
 *     tipo: "imagen",
 *     resultado: {
 *         basico: { formato: "JPEG", dimensiones: "1920x1080" }
 *     },
 *     hashArchivo: hashSHA256,
 *     correlationId: "req_123456789"
 * });
 * 
 * // Buscar por correlation ID (Dragon3)
 * const resultado = await AnalisisArchivo.buscarPorCorrelationId("req_123456789");
 * 
 * // Marcar completado con métricas
 * await analisis.marcarCompletado({
 *     scoreHumano: 0.95,
 *     confianza: 0.98,
 *     decision: "Humano"
 * });
 * 
 * // Estadísticas de performance
 * const stats = await AnalisisArchivo.estadisticasPerformance();
 * 
 * ====================================================================
 */
