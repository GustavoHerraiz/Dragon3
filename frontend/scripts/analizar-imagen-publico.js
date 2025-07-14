/**
 * analizar-imagen-publico.js
 * Dragon3 FAANG - Lee y presenta el resultado del análisis almacenado por server.js en localStorage.
 * Compatible con formato Dragon3 FAANG enhanced result structure
 * Claves usadas: resultadoAnalisis, correlationId, analysisTimestamp
 * UX: Accesible, robusto, profesional, preparado para logging y errores
 */

// Estado global para evitar múltiples ejecuciones
let procesamientoIniciado = false;

// Función de debug mejorada con fallback
function mostrarEstadoCarga(mensaje) {
  console.log(`🔄 Dragon3: ${mensaje}`);
  
  try {
    const loadingSteps = document.getElementById('loadingSteps');
    if (loadingSteps) {
      const div = document.createElement('div');
      div.textContent = `• ${mensaje}`;
      loadingSteps.appendChild(div);
    }
  } catch (e) {
    console.warn('No se pudo actualizar loadingSteps:', e);
  }
  
  // También actualizar el título de la página para debug
  try {
    document.title = `Dragon3 - ${mensaje}`;
  } catch (e) {
    // Ignorar errores de título
  }
}

// Función de emergencia para mostrar contenido básico
function mostrarEmergencia(mensaje) {
  console.error('🚨 Modo emergencia activado:', mensaje);
  
  try {
    // Crear contenido básico directamente en el body si es necesario
    const body = document.body;
    if (body && body.innerHTML.trim() === '') {
      body.innerHTML = `
        <div style="padding: 20px; font-family: Arial, sans-serif;">
          <h1>Dragon3 - Resultado del Análisis</h1>
          <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 6px; color: #dc2626;">
            <strong>Error:</strong> ${mensaje}
          </div>
          <p><a href="index.html">Volver al inicio</a></p>
        </div>
      `;
    }
  } catch (e) {
    console.error('Error en modo emergencia:', e);
  }
}

// Múltiples estrategias de inicialización para máxima compatibilidad
function inicializar() {
  if (procesamientoIniciado) {
    console.log('⚠️ Procesamiento ya iniciado, evitando duplicación');
    return;
  }
  procesamientoIniciado = true;
  
  mostrarEstadoCarga('Iniciando Dragon3 FAANG...');
  
  // Verificar que tenemos acceso básico al DOM
  if (!document || !document.body) {
    mostrarEmergencia('DOM no disponible');
    return;
  }
  
  // Dar un pequeño delay para asegurar que todo esté listo
  setTimeout(procesarResultado, 150);
}

// Estrategia múltiple de inicialización
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializar);
} else {
  // DOM ya está listo
  inicializar();
}

// Backup por si DOMContentLoaded ya pasó
window.addEventListener('load', function() {
  if (!procesamientoIniciado) {
    console.log('🔄 Inicialización por window.load (backup)');
    inicializar();
  }
});

// Backup adicional con timeout
setTimeout(function() {
  if (!procesamientoIniciado) {
    console.log('🔄 Inicialización por timeout (último recurso)');
    inicializar();
  }
}, 500);

function procesarResultado() {
  try {
    mostrarEstadoCarga('Iniciando procesamiento de resultado...');
    console.log('🔍 Dragon3 FAANG - Iniciando carga de resultados...');
    
    // Verificar que tenemos acceso a localStorage
    if (typeof Storage === "undefined" || !window.localStorage) {
      throw new Error('localStorage no está disponible en este navegador');
    }
    
    // Debug: Mostrar todas las claves de localStorage
    const localStorageKeys = Object.keys(localStorage);
    mostrarEstadoCarga(`localStorage keys: ${localStorageKeys.length} encontradas`);
    console.log('📊 LocalStorage keys:', localStorageKeys);
    
    const resultadoRaw = localStorage.getItem('resultadoAnalisis');
    const correlationId = localStorage.getItem('correlationId') || 'N/A';
    const analysisTimestamp = localStorage.getItem('analysisTimestamp') || new Date().toISOString();

    // Debug detallado
    console.log('📊 localStorage content:', {
      resultadoAnalisis: resultadoRaw ? (resultadoRaw.substring(0, 200) + '...') : 'NULL',
      correlationId: correlationId,
      analysisTimestamp: analysisTimestamp,
      fullKeys: localStorageKeys
    });

    if (!resultadoRaw) {
      mostrarEstadoCarga('❌ No se encontró resultadoAnalisis en localStorage');
      console.warn('⚠️ No se encontró resultadoAnalisis en localStorage');
      console.warn('📋 Claves disponibles:', localStorageKeys);
      mostrarError("No se encontró ningún resultado de análisis. Por favor, realiza un nuevo análisis.");
      return;
    }

    mostrarEstadoCarga('✅ Datos encontrados, parseando JSON...');
    
    let resultadoObj;
    try {
      resultadoObj = JSON.parse(resultadoRaw);
      mostrarEstadoCarga('✅ JSON parseado correctamente');
      console.log('✅ Resultado parseado correctamente:', resultadoObj);
    } catch (e) {
      mostrarEstadoCarga('❌ Error parseando JSON');
      console.error('❌ Error parseando JSON:', e);
      console.error('📄 Raw data que causó el error:', resultadoRaw);
      mostrarError("El resultado del análisis está dañado. Error JSON: " + e.message);
      return;
    }

    // ✅ NUEVO: Verificar si es una respuesta de error del servidor
    if (resultadoObj && resultadoObj.error) {
      mostrarEstadoCarga('🚨 Error del servidor detectado');
      console.error('🚨 Error del servidor detectado:', resultadoObj);
      mostrarErrorServidor(resultadoObj, correlationId);
      return;
    }

    // Validar estructura Dragon3 FAANG
    mostrarEstadoCarga('🔍 Validando estructura...');
    if (!validarEstructuraDragon3(resultadoObj)) {
      mostrarEstadoCarga('⚠️ Estructura no válida');
      console.warn('⚠️ Estructura no válida para Dragon3 FAANG:', resultadoObj);
      console.warn('📋 Tipo de objeto recibido:', typeof resultadoObj);
      console.warn('📋 Claves del objeto:', Object.keys(resultadoObj || {}));
      mostrarError("Estructura de resultado no reconocida. Puede ser un formato legacy o corrupto.");
      return;
    }

    // Mostrar resultado procesado para Dragon3 FAANG
    mostrarEstadoCarga('✅ Mostrando resultado...');
    mostrarResultadoDragon3(resultadoObj, correlationId, analysisTimestamp);

  } catch (err) {
    mostrarEstadoCarga('❌ Error crítico en procesamiento');
    console.error('❌ Error crítico en analizar-imagen-publico.js:', err);
    console.error('📋 Stack trace:', err.stack);
    mostrarError("Error inesperado al procesar el resultado: " + err.message);
  }
}

  /**
   * Valida si el resultado tiene estructura Dragon3 FAANG
   */
  function validarEstructuraDragon3(resultado) {
    if (!resultado || typeof resultado !== 'object') {
      return false;
    }

    // Verificar estructura Dragon3 FAANG
    if (resultado.resultado && resultado.resultado.basico) {
      return true;
    }

    // Verificar compatibilidad Dragon2 legacy
    if (resultado.scoreHumano !== undefined || resultado.decision !== undefined) {
      return true;
    }

    // Verificar si es un resultado directo de analizador
    if (resultado.esAutentico !== undefined || resultado.confianza !== undefined) {
      return true;
    }

    return false;
  }

  function mostrarResultadoDragon3(resultado, correlationId, analysisTimestamp) {
  try {
    console.log('🎨 Iniciando visualización del resultado Dragon3');
    
    const loadingSection = document.getElementById('loadingSection');
    const resultadoSection = document.getElementById('resultadoSection');
    const correlationIdSpan = document.getElementById('correlationId');
    const analysisTimestampSpan = document.getElementById('analysisTimestamp');
    const extraInfo = document.getElementById('extraInfo');

    if (!resultadoSection) {
      throw new Error('No se encontró la sección de resultados en el DOM');
    }

    // Extraer información principal
    const informacionPrincipal = extraerInformacionPrincipal(resultado);
    
    // Crear visualización mejorada
    const contenidoHTML = crearVisualizacionMejorada(informacionPrincipal, resultado);
    
    // Actualizar DOM de forma robusta
    resultadoSection.innerHTML = contenidoHTML;
    
    if (correlationIdSpan) {
      correlationIdSpan.textContent = correlationId;
    }
    if (analysisTimestampSpan) {
      analysisTimestampSpan.textContent = new Date(analysisTimestamp).toLocaleString('es-ES');
    }
    
    // Ocultar loading y mostrar resultado
    if (loadingSection) loadingSection.style.display = "none";
    resultadoSection.style.display = "block";
    if (extraInfo) extraInfo.style.display = "block";

    // Mostrar debug en desarrollo
    mostrarDebugInfo(resultado);

    console.log('✅ Resultado mostrado correctamente');

    // === LÍNEAS AÑADIDAS: Limpieza de localStorage tras mostrar el resultado ===
    try {
      localStorage.removeItem('resultadoAnalisis');
      localStorage.removeItem('correlationId');
      localStorage.removeItem('analysisTimestamp');
      console.debug('🧹 Limpieza de localStorage tras mostrar el resultado');
    } catch (e) {
      console.warn('No se pudo limpiar localStorage:', e);
    }
    // ==========================================================================

  } catch (error) {
    console.error('❌ Error mostrando resultado Dragon3:', error);
    mostrarError('Error mostrando el resultado: ' + error.message);
  }
}
  /**
   * Extrae información principal del resultado Dragon3 FAANG
   */
  function extraerInformacionPrincipal(resultado) {
    let info = {
      esAutentico: false,
      confianza: 'desconocida',
      decision: 'No determinado',
      tipoArchivo: 'Desconocido',
      procesadoPor: 'Dragon3',
      tiempoAnalisis: 0,
      performanceClass: 'unknown',
      version: 'unknown'
    };

    try {
      // Estructura Dragon3 FAANG
      if (resultado.resultado && resultado.resultado.basico) {
        const basico = resultado.resultado.basico;
        info.esAutentico = basico.esAutentico;
        info.confianza = basico.confianza;
        info.decision = basico.esAutentico ? "Humano" : "Artificial";
        info.tipoArchivo = basico.tipoArchivo || 'IMAGEN';
        info.procesadoPor = basico.procesadoPor || 'Dragon3';
        info.tiempoAnalisis = basico.tiempoAnalisis || 0;
        info.performanceClass = basico.performanceClass || 'unknown';
        info.version = basico.version || 'unknown';
      }
      // Compatibilidad Dragon2 legacy
      else if (resultado.scoreHumano !== undefined) {
        info.esAutentico = resultado.decision === "Humano";
        info.confianza = resultado.confianza || 'media';
        info.decision = resultado.decision || 'No determinado';
        info.tipoArchivo = 'IMAGEN';
        info.procesadoPor = 'Dragon2 Legacy';
      }
      // Resultado directo de analizador
      else if (resultado.esAutentico !== undefined) {
        info.esAutentico = resultado.esAutentico;
        info.confianza = resultado.confianza || 'media';
        info.decision = resultado.esAutentico ? "Humano" : "Artificial";
      }

    } catch (error) {
      console.error('❌ Error extrayendo información:', error);
    }

    return info;
  }

  /**
   * Crea visualización mejorada para Dragon3 FAANG
   */
  function crearVisualizacionMejorada(info, resultadoCompleto) {
    const estadoClase = info.esAutentico ? 'autentico' : 'artificial';
    const iconoEstado = info.esAutentico ? '✅' : '🤖';
    const colorEstado = info.esAutentico ? '#10b981' : '#f59e0b';

    return `
      <h2>Resultado del Análisis Dragon3 FAANG</h2>
      
      <div style="border: 2px solid ${colorEstado}; border-radius: 8px; padding: 1.5em; margin: 1em 0; background: ${info.esAutentico ? '#f0fdf4' : '#fffbeb'};">
        <div style="display: flex; align-items: center; gap: 0.5em; margin-bottom: 1em;">
          <span style="font-size: 1.5em;">${iconoEstado}</span>
          <h3 style="margin: 0; color: ${colorEstado};">Resultado: ${info.decision}</h3>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1em;">
          <div><strong>Confianza:</strong> ${info.confianza}</div>
          <div><strong>Tipo:</strong> ${info.tipoArchivo}</div>
          <div><strong>Tiempo:</strong> ${info.tiempoAnalisis}ms</div>
          <div><strong>Performance:</strong> ${info.performanceClass}</div>
        </div>
        
        <div style="margin-top: 1em; font-size: 0.9em; color: #666;">
          <strong>Procesado por:</strong> ${info.procesadoPor} v${info.version}
        </div>
      </div>

      <details style="margin: 1em 0;">
        <summary style="cursor: pointer; font-weight: bold; padding: 0.5em; background: #f3f4f6; border-radius: 4px;">
          📊 Ver datos técnicos completos
        </summary>
        <pre style="background: #1f2937; color: #e5e7eb; padding: 1em; border-radius: 6px; overflow-x: auto; margin-top: 0.5em; font-size: 0.85em;">${JSON.stringify(resultadoCompleto, null, 2)}</pre>
      </details>
    `;
  }

  /**
   * Muestra información de debug en desarrollo
   */
  function mostrarDebugInfo(resultado) {
    // Solo mostrar debug si estamos en localhost o desarrollo
    const isDebug = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.search.includes('debug=true');
    
    if (!isDebug) return;

    const debugSection = document.getElementById('debugSection');
    const debugKeys = document.getElementById('debugKeys');
    const debugStructure = document.getElementById('debugStructure');
    const debugErrors = document.getElementById('debugErrors');

    if (debugSection && debugKeys && debugStructure && debugErrors) {
      debugKeys.textContent = Object.keys(localStorage).join(', ');
      debugStructure.textContent = detectarEstructura(resultado);
      debugErrors.textContent = 'Ninguno detectado';
      debugSection.style.display = 'block';
    }
  }

  /**
   * Detecta el tipo de estructura del resultado
   */
  function detectarEstructura(resultado) {
    if (!resultado) return 'Resultado vacío';
    
    if (resultado.resultado && resultado.resultado.basico) {
      return 'Dragon3 FAANG Enhanced';
    }
    if (resultado.scoreHumano !== undefined) {
      return 'Dragon2 Legacy Compatible';
    }
    if (resultado.esAutentico !== undefined) {
      return 'Resultado directo de analizador';
    }
    return 'Estructura desconocida';
  }

  function mostrarError(mensaje) {
    console.error('❌ Error mostrado al usuario:', mensaje);
    
    try {
      // Intentar usar los elementos del DOM normal
      const loadingSection = document.getElementById('loadingSection');
      const errorMsg = document.getElementById('errorMsg');
      const resultadoSection = document.getElementById('resultadoSection');
      const extraInfo = document.getElementById('extraInfo');
      
      if (errorMsg) {
        // Crear mensaje de error más informativo
        const timestamp = new Date().toLocaleString('es-ES');
        const errorHTML = `
          <div>
            <strong>⚠️ Error en Dragon3 FAANG:</strong><br>
            ${mensaje}
          </div>
          <div style="margin-top: 0.5em; font-size: 0.9em; opacity: 0.8;">
            <strong>Timestamp:</strong> ${timestamp}<br>
            <strong>Acción recomendada:</strong> Intenta realizar un nuevo análisis o contacta con soporte si persiste.
          </div>
        `;
        errorMsg.innerHTML = errorHTML;
        errorMsg.style.display = "block";
      } else {
        // Fallback: crear elemento de error si no existe
        console.warn('⚠️ Elemento errorMsg no encontrado, creando fallback');
        const errorDiv = document.createElement('div');
        errorDiv.innerHTML = `
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 1em; margin: 1em; color: #dc2626;">
            <strong>⚠️ Error en Dragon3 FAANG:</strong><br>
            ${mensaje}
          </div>
        `;
        
        // Intentar añadir al main o al body
        const main = document.querySelector('main') || document.body;
        if (main) {
          main.appendChild(errorDiv);
        }
      }
      
      // Ocultar secciones de loading y resultado
      if (loadingSection) loadingSection.style.display = "none";
      if (resultadoSection) resultadoSection.style.display = "none";
      if (extraInfo) extraInfo.style.display = "none";

      // Mostrar información de debug en caso de error
      mostrarDebugEnError();
      
    } catch (domError) {
      console.error('❌ Error manipulando DOM, usando modo emergencia:', domError);
      
      // Modo emergencia: reemplazar todo el contenido del body
      try {
        const body = document.body;
        if (body) {
          body.innerHTML = `
            <div style="padding: 20px; font-family: Arial, sans-serif; background: #f9f9f9; min-height: 100vh;">
              <header style="background: #192137; color: white; padding: 1rem; text-align: center; margin: -20px -20px 20px -20px;">
                <h1>Dragon3 - Error en el Análisis</h1>
              </header>
              <main style="max-width: 800px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 6px; color: #dc2626; margin-bottom: 20px;">
                  <strong>⚠️ Error en Dragon3 FAANG:</strong><br>
                  ${mensaje}
                </div>
                <div style="background: #f0f9ff; border: 1px solid #bae6fd; padding: 15px; border-radius: 6px; color: #0369a1; margin-bottom: 20px;">
                  <strong>💡 Qué puedes hacer:</strong><br>
                  • Realiza un nuevo análisis<br>
                  • Verifica que el archivo sea una imagen válida<br>
                  • Contacta con soporte si el problema persiste
                </div>
                <nav style="text-align: center;">
                  <a href="index.html" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 5px;">🏠 Volver al inicio</a>
                  <a href="analizador.html" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 5px;">🔍 Nuevo análisis</a>
                </nav>
              </main>
            </div>
          `;
        }
      } catch (emergencyError) {
        console.error('❌ Error crítico en modo emergencia:', emergencyError);
        // Último recurso: alert
        alert('Dragon3 Error: ' + mensaje + '\n\nPor favor, recarga la página o vuelve al inicio.');
      }
    }
  }

  /**
   * Muestra información de debug cuando hay errores
   */
  function mostrarDebugEnError() {
    const isDebug = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.search.includes('debug=true');
    
    if (!isDebug) return;

    const debugSection = document.getElementById('debugSection');
    const debugErrors = document.getElementById('debugErrors');
    
    if (debugSection && debugErrors) {
      const errorInfo = [];
      
      // Verificar localStorage
      const storageKeys = Object.keys(localStorage);
      if (storageKeys.length === 0) {
        errorInfo.push('localStorage vacío');
      }
      
      const resultadoRaw = localStorage.getItem('resultadoAnalisis');
      if (!resultadoRaw) {
        errorInfo.push('resultadoAnalisis no encontrado en localStorage');
      } else {
        try {
          JSON.parse(resultadoRaw);
          errorInfo.push('JSON parseado correctamente, error en estructura');
        } catch (e) {
          errorInfo.push(`Error de parseo JSON: ${e.message}`);
        }
      }

      debugErrors.textContent = errorInfo.join('; ');
      debugSection.style.display = 'block';
    }
  }

  /**
   * Maneja errores específicos del servidor Dragon3 FAANG
   */
  function mostrarErrorServidor(errorObj, correlationId) {
    console.error('🚨 Error del servidor Dragon3:', errorObj);
    
    const errorMsg = document.getElementById('errorMsg');
    const resultadoSection = document.getElementById('resultadoSection');
    const extraInfo = document.getElementById('extraInfo');
    
    if (errorMsg) {
      const timestamp = new Date(errorObj.timestamp || new Date()).toLocaleString('es-ES');
      const errorTecnico = errorObj.details || errorObj.error || 'Error desconocido';
      
      // Mapear errores técnicos a mensajes user-friendly
      let mensajeUsuario = "Error en el servidor durante el análisis.";
      let solucion = "Intenta realizar un nuevo análisis.";
      
      if (errorTecnico.includes('xadd')) {
        mensajeUsuario = "Error de comunicación con el sistema de análisis.";
        solucion = "El servidor está experimentando problemas temporales. Intenta de nuevo en unos minutos.";
      } else if (errorTecnico.includes('Redis')) {
        mensajeUsuario = "Error de conectividad del sistema.";
        solucion = "Problemas de conectividad interna. Contacta con soporte si persiste.";
      } else if (errorTecnico.includes('timeout')) {
        mensajeUsuario = "El análisis tardó demasiado tiempo.";
        solucion = "Intenta con una imagen más pequeña o inténtalo de nuevo.";
      }
      
      const errorHTML = `
        <div style="margin-bottom: 1em;">
          <h3 style="color: #dc2626; margin: 0 0 0.5em 0;">🚨 Error en Dragon3 FAANG</h3>
          <p style="margin: 0.5em 0;"><strong>Mensaje:</strong> ${mensajeUsuario}</p>
          <p style="margin: 0.5em 0;"><strong>Solución:</strong> ${solucion}</p>
        </div>
        
        <details style="margin: 1em 0;">
          <summary style="cursor: pointer; font-weight: bold; color: #6b7280;">
            🔧 Información técnica (para soporte)
          </summary>
          <div style="background: #f9fafb; padding: 1em; margin-top: 0.5em; border-radius: 4px; font-size: 0.9em;">
            <div><strong>ID de correlación:</strong> ${correlationId}</div>
            <div><strong>Timestamp:</strong> ${timestamp}</div>
            <div><strong>Error técnico:</strong> ${errorTecnico}</div>
            <div><strong>Código de error:</strong> ${errorObj.statusCode || 'N/A'}</div>
          </div>
        </details>
        
        <div style="margin-top: 1.5em; padding: 1em; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px;">
          <p style="margin: 0; font-size: 0.9em; color: #1e40af;">
            <strong>💡 Tip:</strong> Si el error persiste, proporciona el <strong>ID de correlación</strong> al equipo de soporte.
          </p>
        </div>
      `;
      
      errorMsg.innerHTML = errorHTML;
      errorMsg.style.display = "block";
    }
    
    // Ocultar secciones de resultado
    if (resultadoSection) resultadoSection.style.display = "none";
    if (extraInfo) extraInfo.style.display = "none";

    // Mostrar debug técnico si está habilitado
    mostrarDebugError(errorObj);
  }

  /**
   * Muestra información de debug para errores del servidor
   */
  function mostrarDebugError(errorObj) {
    const isDebug = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.search.includes('debug=true');
    
    if (!isDebug) return;

    const debugSection = document.getElementById('debugSection');
    const debugErrors = document.getElementById('debugErrors');
    
    if (debugSection && debugErrors) {
      const debugInfo = [
        `Tipo: Error del servidor`,
        `Error: ${errorObj.error}`,
        `Details: ${errorObj.details || 'N/A'}`,
        `Status: ${errorObj.statusCode || 'N/A'}`,
        `Timestamp: ${errorObj.timestamp}`,
        `CorrelationId: ${errorObj.correlationId}`
      ];

      debugErrors.textContent = debugInfo.join(' | ');
      debugSection.style.display = 'block';
    }
  }

  // ...existing code...
