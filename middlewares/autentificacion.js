/**
 * ====================================================================
 * DRAGON3 - MIDDLEWARE DE AUTENTIFICACIÓN JWT
 * ====================================================================
 * 
 * Archivo: middlewares/autentificacion.js
 * Proyecto: Dragon3 - Sistema de Autentificación de Imágenes con IA
 * Versión: 3.0.0
 * Fecha: 2025-06-15
 * Autor: Gustavo Herráiz - Lead Architect
 * 
 * DESCRIPCIÓN:
 * Middleware de autentificación JWT para Dragon3 que valida tokens
 * de autorización Bearer en las cabeceras HTTP. Adaptado desde Dragon2
 * con integración completa del sistema Dragon Logger ZEN API.
 * 
 * FUNCIONALIDADES:
 * - Verificación de tokens JWT Bearer
 * - Logging completo con correlation ID tracking
 * - Error handling con estados Dragon (respira, preocupa, agoniza)
 * - Compatibilidad con estructura Dragon3 (/var/www/Dragon3)
 * - Validación de estructura de token y payload
 * - Inyección de usuario en request para middleware posterior
 * 
 * FLUJO DE AUTENTIFICACIÓN:
 * 1. Extrae token Bearer de Authorization header
 * 2. Verifica token con JWT_SECRET desde .env
 * 3. Valida payload y estructura
 * 4. Inyecta req.usuario para rutas protegidas
 * 5. Logs completos con Dragon ZEN API
 * 
 * ESTADOS DRAGON UTILIZADOS:
 * - dragon.respira(): Autentificación exitosa
 * - dragon.sePreocupa(): Tokens faltantes/inválidos (warnings)
 * - dragon.agoniza(): Errores críticos de verificación
 * 
 * MÉTRICAS OBJETIVO:
 * - Verificación JWT: <10ms P95
 * - Error rate: <0.1%
 * - Disponibilidad: 99.99%
 * 
 * DEPENDENCIES:
 * - jsonwebtoken: Verificación JWT
 * - dragon logger: Sistema logging Dragon3
 * 
 * CONFIGURACIÓN ENV REQUERIDA:
 * - JWT_SECRET: Clave secreta para verificación tokens
 * 
 * EJEMPLOS DE USO:
 * ```javascript
 * // En rutas protegidas:
 * app.post("/analizar-imagen", authMiddleware, (req, res) => {
 *     const userId = req.usuario.id; // Usuario autenticado disponible
 *     const userRole = req.usuario.role; // Rol del usuario
 * });
 * ```
 * 
 * ESTRUCTURA REQUEST INYECTADA:
 * req.usuario = {
 *     id: string,           // ID único del usuario
 *     role: string,         // Rol del usuario ("user", "admin", etc.)
 *     [otros campos payload]
 * }
 * 
 * TESTING:
 * ```bash
 * # Token válido:
 * curl -H "Authorization: Bearer <valid_jwt>" http://localhost:3000/analizar-imagen
 * 
 * # Sin token:
 * curl http://localhost:3000/analizar-imagen
 * # Response: 401 Unauthorized
 * 
 * # Token inválido:
 * curl -H "Authorization: Bearer invalid_token" http://localhost:3000/analizar-imagen  
 * # Response: 403 Forbidden
 * ```
 * 
 * LOGS ESPERADOS:
 * - Success: "💓🌊 [autentificacion.js]{AUTH_SUCCESS} Dragon respira: Usuario autenticado"
 * - No token: "😰⚠️ [autentificacion.js]{AUTH_NO_TOKEN} Dragon se preocupa: Token no proporcionado"
 * - Invalid: "😰⚠️ [autentificacion.js]{AUTH_INVALID} Dragon se preocupa: Token inválido"
 * - Error: "💀🔥 [autentificacion.js]{AUTH_ERROR} Dragon agoniza: Error verificación JWT"
 * 
 * CAMBIOS DRAGON2 → DRAGON3:
 * - winston logger → dragon ZEN API
 * - Estructura paths Dragon3
 * - Correlation ID tracking mejorado
 * - Estados Dragon específicos
 * - Performance monitoring integration
 * - Enhanced error context
 * 
 * SEGURIDAD:
 * - Validación estricta formato Bearer
 * - No exposición de JWT_SECRET en logs
 * - Rate limiting compatible
 * - IP tracking para auditoría
 * - Sanitización de error messages
 * 
 * ====================================================================
 */

import jwt from "jsonwebtoken";
import dragon from "../utilidades/logger.js";

/**
 * Middleware de autentificación JWT para Dragon3
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object  
 * @param {Function} next - Express next middleware function
 * @returns {void|Response} Continúa al siguiente middleware o retorna error
 * 
 * @description
 * Valida tokens JWT Bearer en Authorization header y autentica usuarios.
 * Inyecta información del usuario en req.usuario para uso posterior.
 * 
 * @example
 * // Uso en rutas protegidas
 * app.post("/ruta-protegida", authMiddleware, (req, res) => {
 *     console.log(req.usuario.id); // ID del usuario autenticado
 * });
 * 
 * @logs
 * - AUTH_SUCCESS: Usuario autenticado correctamente
 * - AUTH_NO_TOKEN: Token no proporcionado en headers
 * - AUTH_INVALID_FORMAT: Authorization header mal formateado
 * - AUTH_INVALID_TOKEN: Token JWT inválido o expirado
 * - AUTH_ERROR: Error crítico durante verificación
 * 
 * @security
 * - Requiere JWT_SECRET en environment variables
 * - Valida estructura Bearer token
 * - No expone información sensible en error responses
 * - Tracking completo con correlation ID
 */
export default function authMiddleware(req, res, next) {
    // Obtener correlation ID para tracking (establecido en server.js)
    const correlationId = req.correlationId || "N/A";
    const startTime = Date.now();
    
    // Obtener IP para auditoría de seguridad
    const clientIP = req.ip || req.connection.remoteAddress || "unknown";
    
    // Extraer Authorization header
    const authHeader = req.headers.authorization;

    // Validar presencia del header Authorization
    if (!authHeader) {
        dragon.sePreocupa("JWT: Authorization header no proporcionado", "autentificacion.js", "AUTH_NO_HEADER", {
            correlationId,
            ip: clientIP,
            userAgent: req.headers['user-agent'],
            url: req.originalUrl,
            method: req.method
        });
        return res.status(401).json({ 
            error: "Acceso no autorizado: token requerido",
            correlationId 
        });
    }

    // Validar formato Bearer
    if (!authHeader.startsWith("Bearer ")) {
        dragon.sePreocupa("JWT: Authorization header formato inválido", "autentificacion.js", "AUTH_INVALID_FORMAT", {
            correlationId,
            ip: clientIP,
            authHeaderFormat: authHeader.substring(0, 20), // Solo primeros 20 chars por seguridad
            url: req.originalUrl
        });
        return res.status(401).json({ 
            error: "Acceso no autorizado: formato de token inválido",
            correlationId 
        });
    }

    // Extraer token del header
    const token = authHeader.split(" ")[1];
    
    // Validar que el token no esté vacío
    if (!token || token.trim() === "") {
        dragon.sePreocupa("JWT: Token vacío proporcionado", "autentificacion.js", "AUTH_EMPTY_TOKEN", {
            correlationId,
            ip: clientIP,
            url: req.originalUrl
        });
        return res.status(401).json({ 
            error: "Acceso no autorizado: token vacío",
            correlationId 
        });
    }

    try {
        // Verificar JWT_SECRET está configurado
        if (!process.env.JWT_SECRET) {
            dragon.agoniza("JWT_SECRET no configurado en environment", new Error("Missing JWT_SECRET"), "autentificacion.js", "AUTH_NO_SECRET", {
                correlationId,
                ip: clientIP
            });
            return res.status(500).json({ 
                error: "Error de configuración del servidor",
                correlationId 
            });
        }

        // Verificar token JWT
        dragon.respira("JWT: Verificando token de usuario", "autentificacion.js", "AUTH_VERIFY_START", {
            correlationId,
            ip: clientIP,
            tokenLength: token.length,
            url: req.originalUrl
        });

        const payload = jwt.verify(token, process.env.JWT_SECRET);
        
        // Validar estructura del payload
        if (!payload.id) {
            dragon.sePreocupa("JWT: Payload sin ID de usuario", "autentificacion.js", "AUTH_INVALID_PAYLOAD", {
                correlationId,
                ip: clientIP,
                payloadKeys: Object.keys(payload)
            });
            return res.status(403).json({ 
                error: "Token inválido: estructura incorrecta",
                correlationId 
            });
        }

        // Inyectar información del usuario en request
        req.usuario = {
            id: payload.id,
            role: payload.role || "user",
            username: payload.username || null,
            email: payload.email || null,
            // Preservar otros campos del payload que puedan ser útiles
            ...payload
        };

        // Compatibility: también establecer req.user para compatibility con otros middleware
        req.user = req.usuario;

        // Medir performance del middleware
        dragon.mideRendimiento('auth_verification', Date.now() - startTime, 'autentificacion.js');

        // Log exitoso con información del usuario (sin datos sensibles)
        dragon.respira("JWT: Usuario autenticado exitosamente", "autentificacion.js", "AUTH_SUCCESS", {
            correlationId,
            userId: req.usuario.id,
            userRole: req.usuario.role,
            ip: clientIP,
            url: req.originalUrl,
            authDuration: Date.now() - startTime
        });

        // Continuar al siguiente middleware
        next();

    } catch (err) {
        // Manejar diferentes tipos de errores JWT
        let errorType = "AUTH_ERROR";
        let errorMessage = "Token inválido o expirado";
        
        if (err.name === "TokenExpiredError") {
            errorType = "AUTH_EXPIRED";
            errorMessage = "Token expirado";
        } else if (err.name === "JsonWebTokenError") {
            errorType = "AUTH_MALFORMED";  
            errorMessage = "Token malformado";
        } else if (err.name === "NotBeforeError") {
            errorType = "AUTH_NOT_ACTIVE";
            errorMessage = "Token no activo aún";
        }

        // Log del error con contexto completo
        dragon.sePreocupa(`JWT: ${errorMessage}`, "autentificacion.js", errorType, {
            correlationId,
            ip: clientIP,
            error: err.message,
            errorName: err.name,
            url: req.originalUrl,
            tokenLength: token ? token.length : 0,
            userAgent: req.headers['user-agent']
        });

        // Respuesta de error sin exponer información sensible
        return res.status(403).json({ 
            error: errorMessage,
            correlationId
        });
    }
}

/**
 * ====================================================================
 * NOTAS DE IMPLEMENTACIÓN:
 * 
 * 1. CORRELATION TRACKING:
 *    - Usa req.correlationId establecido en server.js
 *    - Permite tracking completo de requests autenticados
 * 
 * 2. PERFORMANCE:
 *    - Medición con dragon.mideRendimiento()
 *    - Target: <10ms para verificación JWT
 * 
 * 3. SECURITY:
 *    - No logs de tokens completos (solo length)
 *    - IP tracking para auditoría
 *    - Sanitización de error messages
 * 
 * 4. ERROR HANDLING:
 *    - Diferentes tipos de errores JWT manejados específicamente
 *    - Responses consistentes con correlation ID
 * 
 * 5. COMPATIBILITY:
 *    - req.usuario (Dragon3 standard)
 *    - req.user (backwards compatibility)
 * 
 * 6. EXTENSIBILIDAD:
 *    - Fácil agregar validaciones adicionales
 *    - Compatible con rate limiting
 *    - Preparado para múltiples roles/permisos
 * ====================================================================
 */
