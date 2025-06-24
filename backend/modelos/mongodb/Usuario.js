/**
 * ====================================================================
 * DRAGON3 - MODELO MONGODB USUARIO (ADAPTADO DRAGON2)
 * ====================================================================
 * 
 * Archivo: modelos/mongodb/Usuario.js
 * Proyecto: Dragon3 - Sistema de Autentificación de Imágenes con IA
 * Versión: 3.0.0
 * Fecha: 2025-04-15
 * Autor: Gustavo Herráiz - Lead Architect
 * 
 * DESCRIPCIÓN:
 * Modelo Mongoose para usuarios adaptado desde Dragon2 con extensiones
 * Dragon3. Mantiene compatibilidad total con estructura existente pero
 * añade características avanzadas: correlation tracking, performance
 * metrics, auditoría completa, y integración Dragon ZEN API.
 * 
 * COMPATIBILIDAD DRAGON2:
 * ✅ UsuarioSchema base preservado completamente
 * ✅ Campos originales: name, email, password, role, credits, createdAt
 * ✅ Validaciones y constraints mantenidas
 * ✅ Enum roles extendido con nuevos niveles
 * ✅ Índices optimizados para performance P95 <100ms
 * 
 * NUEVAS CARACTERÍSTICAS DRAGON3:
 * - Sistema de créditos avanzado con recarga automática
 * - Tracking completo de actividad y performance
 * - Auditoría y compliance (GDPR ready)
 * - Integración Red Superior para distribución
 * - Métricas de uso detalladas por tipo análisis
 * - Security features: 2FA, session management, IP tracking
 * - Configuraciones personalizadas avanzadas
 * 
 * MÉTRICAS OBJETIVO:
 * - User lookup: <50ms P95
 * - Authentication: <100ms P95
 * - Credit operations: <25ms P95
 * - Uptime: 99.9%
 * - Error rate: <0.5%
 * 
 * FLOW INTEGRATION:
 * Frontend → server.js → authMiddleware → Usuario.js → Dragon Logger
 * 
 * ====================================================================
 */

import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import dragon from "../../utilidades/logger.js";

/**
 * Schema principal para usuarios Dragon3
 * Basado en Dragon2 con extensiones completas Dragon3
 */
const UsuarioSchema = new mongoose.Schema({
    // =================== CAMPOS DRAGON2 (PRESERVADOS) ===================
    
    /**
     * Nombre completo del usuario
     * Campo principal de identificación humana
     */
    name: { 
        type: String, 
        required: true, 
        trim: true,
        minlength: [2, "Nombre debe tener al menos 2 caracteres"],
        maxlength: [100, "Nombre no puede exceder 100 caracteres"],
        description: "Nombre completo del usuario"
    },
    
    /**
     * Email único del usuario
     * Campo de autentificación principal
     */
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/.+\@.+\..+/, "Email inválido"],
        index: true, // Índice para lookups rápidos
        description: "Email único del usuario para autentificación"
    },
    
    /**
     * Hash de la contraseña
     * Almacenado con bcrypt para seguridad
     */
    password: { 
        type: String, 
        required: true,
        minlength: [60, "Hash password inválido"], // bcrypt produce ~60 chars
        description: "Hash bcrypt de la contraseña del usuario"
    },
    
    /**
     * Rol del usuario en el sistema
     * Extendido con nuevos niveles Dragon3
     */
    role: { 
        type: String, 
        enum: [
            "express",      // Dragon2 - Usuarios trial rápido
            "normal",       // Dragon2 - Usuario estándar
            "premium",      // Dragon2 - Usuario premium
            "admin",        // Dragon2 - Administrador
            "superadmin",   // Dragon3 - Super administrador
            "developer",    // Dragon3 - Desarrollador con acceso API
            "enterprise"    // Dragon3 - Cliente empresarial
        ], 
        default: "normal",
        index: true, // Para filtros por rol
        description: "Rol del usuario en el sistema Dragon3"
    },
    
    /**
     * Créditos para análisis
     * Sistema de créditos mejorado Dragon3
     */
    credits: { 
        type: Number, 
        default: 5,
        min: [0, "Los créditos no pueden ser negativos"],
        description: "Créditos disponibles para análisis"
    },
    
    /**
     * Fecha de creación de la cuenta
     * Preservado de Dragon2
     */
    createdAt: { 
        type: Date, 
        default: Date.now,
        index: true, // Para ordenamiento y filtros temporales
        description: "Fecha de creación de la cuenta"
    },
    
    // =================== NUEVOS CAMPOS DRAGON3 ===================
    
    /**
     * Username único para identificación rápida
     * Alternativa al email para autentificación
     */
    username: {
        type: String,
        unique: true,
        sparse: true, // Permite null pero único si existe
        trim: true,
        minlength: [3, "Username debe tener al menos 3 caracteres"],
        maxlength: [30, "Username no puede exceder 30 caracteres"],
        match: [/^[a-zA-Z0-9_]+$/, "Username solo puede contener letras, números y guiones bajos"],
        description: "Username único para identificación rápida"
    },
    
    /**
     * Estado de la cuenta
     * Control avanzado de estados Dragon3
     */
    accountStatus: {
        type: String,
        enum: ["active", "suspended", "pending_verification", "deleted", "locked"],
        default: "pending_verification",
        index: true,
        description: "Estado actual de la cuenta"
    },
    
    /**
     * Verificación de email
     * Sistema de verificación Dragon3
     */
    emailVerified: {
        type: Boolean,
        default: false,
        index: true,
        description: "Si el email ha sido verificado"
    },
    
    emailVerificationToken: {
        type: String,
        description: "Token para verificación de email"
    },
    
    emailVerifiedAt: {
        type: Date,
        description: "Fecha de verificación del email"
    },
    
    /**
     * Sistema de créditos avanzado Dragon3
     */
    creditSystem: {
        // Créditos por tipo de análisis
        creditsImagen: {
            type: Number,
            default: 5,
            min: 0,
            description: "Créditos específicos para análisis de imágenes"
        },
        creditsPDF: {
            type: Number,
            default: 3,
            min: 0,
            description: "Créditos específicos para análisis de PDF"
        },
        creditsVideo: {
            type: Number,
            default: 1,
            min: 0,
            description: "Créditos específicos para análisis de video"
        },
        
        // Recarga automática
        autoRecharge: {
            enabled: { type: Boolean, default: false },
            amount: { type: Number, default: 10 },
            threshold: { type: Number, default: 2 },
            lastRecharge: Date,
            description: { type: String, default: "Configuración de recarga automática de créditos" }
        },
        
        // Historial de transacciones
        transactionHistory: [{
            type: { type: String, enum: ["usage", "purchase", "refund", "bonus", "auto_recharge"] },
            amount: Number,
            balance: Number,
            description: String,
            timestamp: { type: Date, default: Date.now },
            correlationId: String
        }],
        
        // Límites por periodo
        dailyLimit: { type: Number, default: 50 },
        weeklyLimit: { type: Number, default: 200 },
        monthlyLimit: { type: Number, default: 1000 }
    },
    
    /**
     * Métricas de uso detalladas Dragon3
     */
    usageMetrics: {
        // Contadores por tipo
        totalAnalysis: { type: Number, default: 0 },
        imageAnalysis: { type: Number, default: 0 },
        pdfAnalysis: { type: Number, default: 0 },
        videoAnalysis: { type: Number, default: 0 },
        
        // Métricas temporales
        lastAnalysis: Date,
        firstAnalysis: Date,
        
        // Performance del usuario
        averageAnalysisTime: { type: Number, default: 0 },
        totalProcessingTime: { type: Number, default: 0 },
        
        // Uso por periodo
        dailyUsage: { type: Number, default: 0 },
        weeklyUsage: { type: Number, default: 0 },
        monthlyUsage: { type: Number, default: 0 },
        lastResetDaily: Date,
        lastResetWeekly: Date,
        lastResetMonthly: Date,
        
        // Calidad de análisis
        averageConfidence: { type: Number, default: 0 },
        successRate: { type: Number, default: 1.0 }
    },
    
    /**
     * Configuraciones personalizadas del usuario
     */
    preferences: {
        // Configuración de interfaz
        language: { type: String, default: "es", enum: ["es", "en", "fr", "pt"] },
        timezone: { type: String, default: "UTC" },
        theme: { type: String, default: "auto", enum: ["light", "dark", "auto"] },
        
        // Configuraciones de análisis
        defaultAnalysisType: { type: String, default: "auto", enum: ["auto", "quick", "detailed"] },
        autoDownloadReports: { type: Boolean, default: false },
        receiveAnalysisEmails: { type: Boolean, default: true },
        
        // Configuraciones de privacidad
        shareAnonymousData: { type: Boolean, default: true },
        allowMarketingEmails: { type: Boolean, default: false },
        retentionPeriod: { type: Number, default: 90 } // días
    },
    
    /**
     * Seguridad avanzada Dragon3
     */
    security: {
        // Autentificación de dos factores
        twoFactorEnabled: { type: Boolean, default: false },
        twoFactorSecret: String,
        backupCodes: [String],
        
        // Tracking de sesiones
        activeSessions: [{
            sessionId: String,
            ipAddress: String,
            userAgent: String,
            loginTime: Date,
            lastActivity: Date,
            device: String,
            location: String
        }],
        
        // Security log
        loginAttempts: { type: Number, default: 0 },
        lastLoginAttempt: Date,
        lastSuccessfulLogin: Date,
        accountLockedUntil: Date,
        
        // IP tracking
        allowedIPs: [String],
        suspiciousIPs: [String],
        lastKnownIP: String
    },
    
    /**
     * Auditoría y compliance Dragon3
     */
    audit: {
        createdBy: { type: String, default: "system" },
        modifiedAt: Date,
        modifiedBy: String,
        deletedAt: Date,
        deletedBy: String,
        
        // GDPR compliance
        gdprConsent: {
            given: { type: Boolean, default: false },
            timestamp: Date,
            version: String,
            ipAddress: String
        },
        
        // Data retention
        dataRetentionUntil: Date,
        markedForDeletion: { type: Boolean, default: false },
        
        // Compliance notes
        complianceNotes: [String]
    },
    
    /**
     * Red Superior integration
     */
    redSuperior: {
        nodeId: String,
        participatesInNetwork: { type: Boolean, default: false },
        contributionScore: { type: Number, default: 0 },
        rewardsEarned: { type: Number, default: 0 },
        lastNetworkActivity: Date
    },
    
    /**
     * API access para usuarios developer/enterprise
     */
    apiAccess: {
        apiKey: String,
        apiSecret: String,
        rateLimitTier: { type: String, enum: ["basic", "premium", "enterprise"], default: "basic" },
        requestsPerMinute: { type: Number, default: 10 },
        requestsPerDay: { type: Number, default: 1000 },
        totalRequests: { type: Number, default: 0 },
        lastApiUse: Date
    }
    
}, {
    // =================== CONFIGURACIÓN SCHEMA ===================
    timestamps: true, // Añade createdAt y updatedAt automáticamente
    collection: "usuarios", // Nombre de colección en MongoDB
    versionKey: "__v", // Control de versiones de documentos
    
    // Configuración de queries
    read: "secondaryPreferred", // Leer de secundarios cuando sea posible
    
    // Transformaciones JSON
    toJSON: {
        transform: function(doc, ret) {
            // Remover campos sensibles en respuestas JSON
            delete ret.password;
            delete ret.emailVerificationToken;
            delete ret.security.twoFactorSecret;
            delete ret.apiAccess.apiSecret;
            return ret;
        }
    }
});

// =================== ÍNDICES OPTIMIZADOS DRAGON3 ===================

// Índice único para email (preservado Dragon2)
UsuarioSchema.index({ email: 1 }, { 
    unique: true, 
    name: "email_unique_idx" 
});

// Índice único para username (nuevo Dragon3)
UsuarioSchema.index({ username: 1 }, { 
    unique: true, 
    sparse: true, 
    name: "username_unique_idx" 
});

// Índice compuesto para autentificación rápida
UsuarioSchema.index({ 
    email: 1, 
    accountStatus: 1 
}, { 
    name: "auth_lookup_idx",
    background: true 
});

// Índice para filtros administrativos
UsuarioSchema.index({ 
    role: 1, 
    accountStatus: 1, 
    createdAt: -1 
}, { 
    name: "admin_filters_idx",
    background: true 
});

// Índice para métricas de uso
UsuarioSchema.index({ 
    "usageMetrics.lastAnalysis": -1,
    role: 1 
}, { 
    name: "usage_metrics_idx",
    background: true 
});

// Índice para Red Superior
UsuarioSchema.index({ 
    "redSuperior.participatesInNetwork": 1,
    "redSuperior.contributionScore": -1 
}, { 
    name: "red_superior_idx",
    background: true 
});

// =================== MÉTODOS DE INSTANCIA DRAGON3 ===================

/**
 * Comparar contraseña con hash almacenado
 * Método de autentificación principal
 */
UsuarioSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        const isMatch = await bcryptjs.compare(candidatePassword, this.password);
        
        dragon.respira(`Password comparison para usuario ${this.username}`, "Usuario.js", "PASSWORD_COMPARE", {
            userId: this._id,
            success: isMatch
        });
        
        return isMatch;
    } catch (error) {
        dragon.agoniza("Error comparando password", error, "Usuario.js", "PASSWORD_COMPARE_ERROR", {
            userId: this._id
        });
        throw error;
    }
};

/**
 * Consumir créditos por tipo de análisis
 * Sistema de créditos mejorado Dragon3
 */
UsuarioSchema.methods.consumeCredits = async function(analysisType, amount = 1, correlationId = null) {
    const startTime = Date.now();
    
    try {
        let creditField;
        switch(analysisType) {
            case 'imagen':
                creditField = 'creditSystem.creditsImagen';
                break;
            case 'pdf':
                creditField = 'creditSystem.creditsPDF';
                break;
            case 'video':
                creditField = 'creditSystem.creditsVideo';
                break;
            default:
                throw new Error(`Tipo de análisis desconocido: ${analysisType}`);
        }
        
        // Verificar créditos disponibles
        const availableCredits = this.get(creditField);
        if (availableCredits < amount) {
            dragon.sePreocupa(`Créditos insuficientes para ${analysisType}`, "Usuario.js", "INSUFFICIENT_CREDITS", {
                userId: this._id,
                available: availableCredits,
                required: amount,
                correlationId
            });
            return false;
        }
        
        // Consumir créditos
        this.set(creditField, availableCredits - amount);
        this.credits = Math.max(0, this.credits - amount); // Mantener compatibilidad Dragon2
        
        // Actualizar métricas
        this.usageMetrics.totalAnalysis += 1;
        this.usageMetrics[`${analysisType}Analysis`] += 1;
        this.usageMetrics.lastAnalysis = new Date();
        this.usageMetrics.dailyUsage += 1;
        this.usageMetrics.weeklyUsage += 1;
        this.usageMetrics.monthlyUsage += 1;
        
        // Registrar transacción
        this.creditSystem.transactionHistory.push({
            type: 'usage',
            amount: -amount,
            balance: this.get(creditField),
            description: `Análisis ${analysisType}`,
            correlationId,
            timestamp: new Date()
        });
        
        await this.save();
        
        const duration = Date.now() - startTime;
        dragon.mideRendimiento('credit_consumption', duration, 'Usuario.js');
        
        dragon.respira(`Créditos consumidos: ${amount} ${analysisType}`, "Usuario.js", "CREDITS_CONSUMED", {
            userId: this._id,
            analysisType,
            amount,
            remaining: this.get(creditField),
            correlationId
        });
        
        return true;
        
    } catch (error) {
        dragon.agoniza("Error consumiendo créditos", error, "Usuario.js", "CREDIT_CONSUMPTION_ERROR", {
            userId: this._id,
            analysisType,
            amount,
            correlationId
        });
        throw error;
    }
};

/**
 * Recargar créditos (compra, bonus, etc.)
 */
UsuarioSchema.methods.addCredits = async function(analysisType, amount, transactionType = 'purchase', description = '') {
    try {
        let creditField;
        switch(analysisType) {
            case 'imagen':
                creditField = 'creditSystem.creditsImagen';
                break;
            case 'pdf':
                creditField = 'creditSystem.creditsPDF';
                break;
            case 'video':
                creditField = 'creditSystem.creditsVideo';
                break;
            case 'general':
                creditField = 'credits'; // Compatibilidad Dragon2
                break;
            default:
                throw new Error(`Tipo de análisis desconocido: ${analysisType}`);
        }
        
        const currentCredits = this.get(creditField);
        this.set(creditField, currentCredits + amount);
        
        if (analysisType !== 'general') {
            this.credits += amount; // Mantener total general
        }
        
        // Registrar transacción
        this.creditSystem.transactionHistory.push({
            type: transactionType,
            amount: amount,
            balance: this.get(creditField),
            description: description || `Recarga ${analysisType}`,
            timestamp: new Date()
        });
        
        await this.save();
        
        dragon.sonrie(`Créditos añadidos: ${amount} ${analysisType}`, "Usuario.js", "CREDITS_ADDED", {
            userId: this._id,
            analysisType,
            amount,
            newBalance: this.get(creditField)
        });
        
        return true;
        
    } catch (error) {
        dragon.agoniza("Error añadiendo créditos", error, "Usuario.js", "CREDIT_ADD_ERROR", {
            userId: this._id,
            analysisType,
            amount
        });
        throw error;
    }
};

/**
 * Actualizar métricas de análisis completado
 */
UsuarioSchema.methods.updateAnalysisMetrics = async function(analysisTime, confidence, success = true) {
    try {
        // Actualizar tiempo promedio
        const totalTime = this.usageMetrics.totalProcessingTime + analysisTime;
        const totalAnalysis = this.usageMetrics.totalAnalysis;
        this.usageMetrics.averageAnalysisTime = totalTime / totalAnalysis;
        this.usageMetrics.totalProcessingTime = totalTime;
        
        // Actualizar confianza promedio
        if (confidence !== null && confidence !== undefined) {
            const currentAvgConf = this.usageMetrics.averageConfidence || 0;
            this.usageMetrics.averageConfidence = 
                ((currentAvgConf * (totalAnalysis - 1)) + confidence) / totalAnalysis;
        }
        
        // Actualizar tasa de éxito
        if (success) {
            const successCount = Math.floor(this.usageMetrics.successRate * (totalAnalysis - 1)) + 1;
            this.usageMetrics.successRate = successCount / totalAnalysis;
        } else {
            const successCount = Math.floor(this.usageMetrics.successRate * (totalAnalysis - 1));
            this.usageMetrics.successRate = successCount / totalAnalysis;
        }
        
        await this.save();
        
        dragon.respira("Métricas de análisis actualizadas", "Usuario.js", "METRICS_UPDATED", {
            userId: this._id,
            analysisTime,
            confidence,
            success
        });
        
    } catch (error) {
        dragon.agoniza("Error actualizando métricas", error, "Usuario.js", "METRICS_UPDATE_ERROR", {
            userId: this._id
        });
        throw error;
    }
};

/**
 * Verificar límites de uso diario/semanal/mensual
 */
UsuarioSchema.methods.checkUsageLimits = function() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Reset contadores si es necesario
    if (!this.usageMetrics.lastResetDaily || this.usageMetrics.lastResetDaily < today) {
        this.usageMetrics.dailyUsage = 0;
        this.usageMetrics.lastResetDaily = today;
    }
    
    const limits = {
        daily: this.creditSystem.dailyLimit,
        weekly: this.creditSystem.weeklyLimit,
        monthly: this.creditSystem.monthlyLimit
    };
    
    const usage = {
        daily: this.usageMetrics.dailyUsage,
        weekly: this.usageMetrics.weeklyUsage,
        monthly: this.usageMetrics.monthlyUsage
    };
    
    return {
        withinLimits: usage.daily < limits.daily && 
                     usage.weekly < limits.weekly && 
                     usage.monthly < limits.monthly,
        limits,
        usage
    };
};

// =================== MÉTODOS ESTÁTICOS DRAGON3 ===================

/**
 * Hash de contraseña con bcrypt
 * Método estático para registro de usuarios
 */
UsuarioSchema.statics.hashPassword = async function(password) {
    try {
        const saltRounds = 12; // Incrementado para Dragon3 security
        const hash = await bcryptjs.hash(password, saltRounds);
        
        dragon.respira("Password hasheada correctamente", "Usuario.js", "PASSWORD_HASHED");
        
        return hash;
    } catch (error) {
        dragon.agoniza("Error hasheando password", error, "Usuario.js", "PASSWORD_HASH_ERROR");
        throw error;
    }
};

/**
 * Buscar usuario por email (método principal Dragon2)
 */
UsuarioSchema.statics.findByEmail = function(email) {
    return this.findOne({ 
        email: email.toLowerCase(),
        accountStatus: { $ne: 'deleted' }
    });
};

/**
 * Buscar usuario por username o email (Dragon3)
 */
UsuarioSchema.statics.findByCredentials = function(credential) {
    return this.findOne({
        $or: [
            { email: credential.toLowerCase() },
            { username: credential }
        ],
        accountStatus: { $ne: 'deleted' }
    });
};

/**
 * Estadísticas de usuarios por rol
 */
UsuarioSchema.statics.getUserStats = function() {
    return this.aggregate([
        { $match: { accountStatus: { $ne: 'deleted' } } },
        {
            $group: {
                _id: '$role',
                count: { $sum: 1 },
                totalCredits: { $sum: '$credits' },
                averageAnalysis: { $avg: '$usageMetrics.totalAnalysis' },
                activeUsers: {
                    $sum: {
                        $cond: [
                            { $gte: ['$usageMetrics.lastAnalysis', new Date(Date.now() - 30*24*60*60*1000)] },
                            1, 0
                        ]
                    }
                }
            }
        }
    ]);
};

/**
 * Usuarios que necesitan recarga automática
 */
UsuarioSchema.statics.findUsersForAutoRecharge = function() {
    return this.find({
        'creditSystem.autoRecharge.enabled': true,
        $expr: {
            $lt: [
                { $add: ['$creditSystem.creditsImagen', '$creditSystem.creditsPDF', '$creditSystem.creditsVideo'] },
                '$creditSystem.autoRecharge.threshold'
            ]
        },
        accountStatus: 'active'
    });
};

// =================== HOOKS (MIDDLEWARE) ===================

// Pre-save: Validaciones y preparación
UsuarioSchema.pre('save', async function(next) {
    try {
        // Hash password si ha sido modificada
        if (this.isModified('password') && !this.password.startsWith('$2')) {
            this.password = await UsuarioSchema.statics.hashPassword(this.password);
        }
        
        // Generar username si no existe
        if (!this.username && this.email) {
            const baseUsername = this.email.split('@')[0];
            let username = baseUsername;
            let counter = 1;
            
            while (await this.constructor.findOne({ username: username })) {
                username = `${baseUsername}${counter}`;
                counter++;
            }
            
            this.username = username;
        }
        
        // Inicializar métricas si es nuevo usuario
        if (this.isNew) {
            this.usageMetrics.firstAnalysis = null;
            this.usageMetrics.lastResetDaily = new Date();
            this.usageMetrics.lastResetWeekly = new Date();
            this.usageMetrics.lastResetMonthly = new Date();
        }
        
        // Actualizar timestamp de modificación
        if (this.isModified() && !this.isNew) {
            this.audit.modifiedAt = new Date();
        }
        
        next();
        
    } catch (error) {
        dragon.agoniza("Error en pre-save Usuario", error, "Usuario.js", "PRE_SAVE_ERROR");
        next(error);
    }
});

// Post-save: Logging y notificaciones
UsuarioSchema.post('save', function(doc, next) {
    if (doc.isNew) {
        dragon.sonrie(`Nuevo usuario registrado: ${doc.username}`, "Usuario.js", "USER_REGISTERED", {
            userId: doc._id,
            username: doc.username,
            email: doc.email,
            role: doc.role
        });
    } else {
        dragon.respira(`Usuario actualizado: ${doc.username}`, "Usuario.js", "USER_UPDATED", {
            userId: doc._id,
            username: doc.username
        });
    }
    
    next();
});

// Post-findOne: Logging de accesos
UsuarioSchema.post('findOne', function(doc) {
    if (doc) {
        dragon.respira(`Usuario consultado: ${doc.username}`, "Usuario.js", "USER_ACCESSED", {
            userId: doc._id,
            username: doc.username
        });
    }
});

// =================== CONFIGURACIÓN FINAL ===================

const Usuario = mongoose.model("Usuario", UsuarioSchema);

export default Usuario;

/**
 * ====================================================================
 * EJEMPLOS DE USO DRAGON3:
 * 
 * // Registro de usuario (compatibilidad Dragon2)
 * const usuario = new Usuario({
 *     name: "Gustavo Herráiz",
 *     email: "gustavo@bladecorporation.net",
 *     password: "password_plain", // Se hashea automáticamente
 *     role: "admin"
 * });
 * await usuario.save();
 * 
 * // Autentificación
 * const user = await Usuario.findByEmail("gustavo@bladecorporation.net");
 * const isValid = await user.comparePassword("password_plain");
 * 
 * // Consumir créditos (Dragon3)
 * const success = await user.consumeCredits("imagen", 1, "req_123456");
 * 
 * // Añadir créditos
 * await user.addCredits("imagen", 10, "purchase", "Compra de créditos");
 * 
 * // Verificar límites
 * const limits = user.checkUsageLimits();
 * 
 * // Estadísticas administrativas
 * const stats = await Usuario.getUserStats();
 * 
 * ====================================================================
 */
