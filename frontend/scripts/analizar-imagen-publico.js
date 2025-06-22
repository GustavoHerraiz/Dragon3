/**
 * analizar-imagen-publico.js
 * Dragon3 - Lee y presenta el resultado del análisis almacenado por server.js en localStorage.
 * Claves usadas: resultadoAnalisis, correlationId, analysisTimestamp
 * UX: Accesible, robusto, profesional, preparado para logging y errores
 */

(function() {
  try {
    const resultadoRaw = localStorage.getItem('resultadoAnalisis');
    const correlationId = localStorage.getItem('correlationId') || 'N/A';
    const analysisTimestamp = localStorage.getItem('analysisTimestamp') || 'N/A';

    if (!resultadoRaw) {
      mostrarError("No se encontró ningún resultado de análisis. Por favor, realiza un nuevo análisis.");
      return;
    }

    let resultadoObj;
    try {
      resultadoObj = JSON.parse(resultadoRaw);
    } catch (e) {
      mostrarError("El resultado del análisis está dañado. Por favor, repite el análisis.");
      return;
    }

    // Mostramos el resultado de forma legible y segura
    const prettyJSON = JSON.stringify(resultadoObj, null, 2);
    const resultadoJSON = document.getElementById('resultadoJSON');
    const correlationIdSpan = document.getElementById('correlationId');
    const analysisTimestampSpan = document.getElementById('analysisTimestamp');
    const resultadoSection = document.getElementById('resultadoSection');

    if (!resultadoJSON || !correlationIdSpan || !analysisTimestampSpan || !resultadoSection) {
      mostrarError("Error en la estructura de la página. Contacta con soporte.");
      return;
    }

    resultadoJSON.textContent = prettyJSON;
    correlationIdSpan.textContent = correlationId;
    analysisTimestampSpan.textContent = analysisTimestamp;
    resultadoSection.style.display = "block";

    // Limpieza opcional: descomenta si quieres borrar tras mostrar
    // localStorage.removeItem('resultadoAnalisis');
    // localStorage.removeItem('correlationId');
    // localStorage.removeItem('analysisTimestamp');
  } catch (err) {
    mostrarError("Error inesperado al mostrar el resultado.");
    // Aquí puedes añadir logging profesional si tu backend lo soporta
    // fetch('/api/client-log', { method: 'POST', ... })
  }

  function mostrarError(mensaje) {
    const errorMsg = document.getElementById('errorMsg');
    if (errorMsg) {
      errorMsg.textContent = mensaje;
      errorMsg.style.display = "block";
    }
    const resultadoSection = document.getElementById('resultadoSection');
    if (resultadoSection) {
      resultadoSection.style.display = "none";
    }
  }
})();
