/**
 * scripts/analizador.js - Dragon3 Frontend (FAANG-KISS)
 * Frontend desacoplado para análisis de imagen/PDF/video.
 * Cumple KISS, logging profesional, accesibilidad, y máxima compatibilidad con server.js Dragon3.
 * 
 * Arquitecto: Gustavo Herráiz
 * 
 * Flujo: Formulario -> fetch -> backend (/analizar-imagen-publico) -> respuesta (HTML+JS o JSON) -> UX
 * 
 * Requisitos:
 * - Sin console.log (usar logging controlado)
 * - Sin frameworks
 * - Accesibilidad y UX robustas
 * - Compatible con server.js Dragon3 (POST /analizar-imagen-publico)
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
    // Ejemplo: Enviar logs a backend para Sentry/Winston
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
   * Procesa la respuesta del backend, que puede ser HTML (legacy) o JSON (FAANG).
   */
  async function procesarRespuesta(res) {
    const contentType = res.headers.get("content-type") || "";
    // Caso 1: Respuesta JSON moderna
    if (contentType.includes("application/json")) {
      const data = await res.json();
      if (data.resultado) {
        localStorage.setItem("resultadoAnalisis", JSON.stringify(data.resultado));
        localStorage.setItem("correlationId", data.correlationId || "");
        localStorage.setItem("analysisTimestamp", data.analysisTimestamp || new Date().toISOString());
        window.location.href = "analizar-imagen-publico.html";
      } else {
        mostrarError("El análisis no devolvió datos válidos.", data);
      }
    } else {
      // Caso 2: Respuesta HTML+script (compatibilidad Dragon2/3)
      const texto = await res.text();
      // Ejecutar el script devuelto (solo seguro si confías en tu backend)
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = texto;
      const script = tempDiv.querySelector('script');
      if (script) {
        // Evalúa el script inline: esto solo se permite porque el backend es de confianza (Dragon3)
        // Si tienes CSP estricta, tendrás que adaptar el backend a JSON.
        // eslint-disable-next-line no-eval
        eval(script.textContent);
      } else {
        mostrarError("Respuesta inesperada del servidor (sin script).", { texto });
      }
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
          "X-Requested-With": "XMLHttpRequest" // Por si adaptas el backend a JSON en el futuro
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
