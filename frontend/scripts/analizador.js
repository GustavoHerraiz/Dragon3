/**
 * scripts/analizador.js - Dragon3 Frontend (FAANG-KISS)
 * Frontend desacoplado para análisis de imagen/PDF/video.
 * Cumple KISS, logging profesional, accesibilidad, y máxima compatibilidad con server.js Dragon3.
 *
 * Arquitecto: Gustavo Herráiz
 *
 * Flujo: Formulario -> fetch -> backend (/analizar-imagen-publico) -> respuesta (JSON FAANG o legacy HTML+JS) -> UX
 *
 * Requisitos:
 * - Sin console.log (usar logging controlado)
 * - Sin frameworks
 * - Accesibilidad y UX robustas
 * - Compatible con server.js Dragon3 (POST /analizar-imagen-publico)
 * - No guarda errores en localStorage, sólo resultados válidos
 * - Cumple FAANG y estándares de seguridad
 * - Muestra errores en la misma página (FAANG puro), sin redirigir ni tocar localStorage para errores
 */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("uploadForm");
  const spinner = document.getElementById("loadingSpinner");
  const errorMsg = document.getElementById("errorMsg");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const dragonIcon = document.querySelector(".dragon-2-icon.loading");

  /**
   * Muestra un mensaje de error accesible y realiza un log controlado.
   */
  function mostrarError(msg, extra = {}) {
    errorMsg.textContent = msg;
    errorMsg.style.display = "block";
    // Logging controlado para auditoría y análisis
    fetch("/api/client-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level: "error",
        message: msg,
        details: extra,
        timestamp: new Date().toISOString()
      })
    }).catch(() => { /* Silenciar errores de logging */ });
  }

  /**
   * Limpia el mensaje de error.
   */
  function limpiarError() {
    errorMsg.textContent = "";
    errorMsg.style.display = "none";
  }

  /**
   * Determina si un resultado es válido para guardar en localStorage.
   * Un resultado no es válido si contiene la clave 'error'.
   */
  function esResultadoValido(resultado) {
    return resultado && typeof resultado === 'object' && !resultado.error;
  }

  /**
   * Procesa la respuesta del backend, que puede ser HTML (legacy) o JSON (FAANG).
   * Si es error, lo muestra en la misma página y NO redirige ni guarda en localStorage.
   */
  async function procesarRespuesta(res) {
    const contentType = res.headers.get("content-type") || "";
    // Caso 1: Respuesta JSON FAANG
    if (contentType.includes("application/json")) {
      const data = await res.json();
      if (data.resultado && esResultadoValido(data.resultado)) {
        localStorage.setItem("resultadoAnalisis", JSON.stringify(data.resultado));
        localStorage.setItem("correlationId", data.correlationId || "");
        localStorage.setItem("analysisTimestamp", data.analysisTimestamp || new Date().toISOString());
        window.location.href = "analizar-imagen-publico.html";
      } else {
        // Mostrar error en la misma página, NO guardar, NO redirigir
        const msg = (data.resultado && data.resultado.error) || data.error || "El análisis no devolvió datos válidos.";
        mostrarError(msg, data);
      }
    } else {
      // Caso 2: Respuesta legacy HTML+script (ya no debería ocurrir, fallback seguro)
      const texto = await res.text();
      mostrarError("Respuesta inesperada del servidor. Contacta con soporte.", { texto });
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    limpiarError();
    spinner.style.display = "inline";
    analyzeBtn.disabled = true;
    analyzeBtn.setAttribute("aria-busy", "true");
    if (dragonIcon) dragonIcon.style.display = "inline";

    const archivoInput = document.getElementById("archivo");
    if (!archivoInput.files.length) {
      mostrarError("Selecciona un archivo para analizar.");
      spinner.style.display = "none";
      analyzeBtn.disabled = false;
      analyzeBtn.setAttribute("aria-busy", "false");
      if (dragonIcon) dragonIcon.style.display = "none";
      return;
    }

    const formData = new FormData();
    formData.append("archivo", archivoInput.files[0]);

    try {
      const res = await fetch("/analizar-imagen-publico", {
        method: "POST",
        body: formData,
        headers: {
          "X-Requested-With": "XMLHttpRequest"
        },
        credentials: "same-origin"
      });

      if (res.status === 413) {
        mostrarError("El archivo es demasiado grande.");
        return;
      }
      if (!res.ok) {
        let msg = "Error al analizar el archivo.";
        try {
          const err = await res.json();
          msg = err.error || msg;
        } catch (_) { /* Si no es JSON, deja mensaje genérico */ }
        mostrarError(msg);
        return;
      }

      await procesarRespuesta(res);

    } catch (err) {
      mostrarError("No se pudo analizar el archivo: " + (err.message || "Error de red"));
    } finally {
      spinner.style.display = "none";
      analyzeBtn.disabled = false;
      analyzeBtn.setAttribute("aria-busy", "false");
      if (dragonIcon) dragonIcon.style.display = "none";
    }
  });
});