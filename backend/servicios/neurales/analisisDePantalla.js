/**
 * DRAGON3 - Analizador de Pantalla FAANG (Dragon3 Full Contract)
 * --------------------------------------------------------------
 * Analiza si una imagen es una captura de pantalla basándose en 10 indicadores normalizados,
 * usando una red neuronal Synaptic entrenada. Adaptado a FAANG: logging, errores, KISS,
 * sin dependencias de red, formato Dragon3.
 *
 * Espera: array de 10 features normalizados [0..1], según tu pipeline.
 * Retorna: {
 *   score, nombreAnalizador, version, descripcion, detalles, metadatos,
 *   performance, logs, correlationId, imagenId, timestamp, act: "EOF"
 * }
 */

import synaptic from "synaptic";
import dragon from "../../../utilidades/logger.js";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MODULE_NAME = "pantalla";
const VERSION = "3.0.0";
const DESCRIPCION = "Analizador FAANG de pantalla Dragon3: red neuronal Synaptic entrenada para detectar capturas de pantalla. Devuelve score y detalles para pipeline Dragon3.";

/**
 * Analizador FAANG de Pantalla: red neuronal pura, sin reglas.
 */
class AnalisisDePantalla {
  constructor() {
    this.network = null;
    this.modeloCargado = false;
    this._cargarModelo();
  }

  _cargarModelo() {
    try {
      const rutaModelo = join(__dirname, "RedDePantalla_Entrenada.json");
      const datosModelo = JSON.parse(fs.readFileSync(rutaModelo, "utf8"));
      this.network = synaptic.Network.fromJSON(datosModelo);
      this.modeloCargado = true;
      dragon.zen("[Pantalla] Modelo neuronal cargado FAANG", MODULE_NAME, "LOAD_MODEL_OK", { rutaModelo });
    } catch (e) {
      this.network = new synaptic.Architect.Perceptron(10, 7, 1);
      this.modeloCargado = false;
      dragon.sePreocupa("[Pantalla] Modelo no disponible, usando red dummy", MODULE_NAME, "LOAD_MODEL_FAIL", { error: e.message });
    }
  }

  /**
   * act: Ejecuta el análisis FAANG sobre un array de features normalizados.
   * @param {number[]} entrada - Array de 10 valores entre 0 y 1.
   * @param {object} opts - Opcionales: { correlationId, imagenId }
   * @returns {object} Contrato Dragon3 completo
   */
  act(entrada, opts = {}) {
    const t0 = Date.now();
    const logs = [];
    let correlationId = opts.correlationId || null;
    let imagenId = opts.imagenId || null;
    let prediccionRed = 0;
    let scoreFinal = 0;
    let exito = true;
    try {
      if (!Array.isArray(entrada) || entrada.length !== 10)
        throw new Error(`Entrada inválida: se esperan 10 valores normalizados (array de 10).`);

      // Normaliza valores
      const datos = entrada.map(x => isNaN(parseFloat(x)) ? 0.5 : Math.max(0, Math.min(1, parseFloat(x))));

      try {
        prediccionRed = this.network.activate(datos)[0];
        prediccionRed = Math.max(0, Math.min(1, prediccionRed));
      } catch (e) {
        exito = false;
        logs.push(`[Pantalla] Error red neuronal: ${e.message}`);
        dragon.sePreocupa("[Pantalla] Error red neuronal", MODULE_NAME, "NN_FAIL", { error: e.message });
      }

      // Escalar la salida de la red (0-1) a 0-10 (score alto = no-captura, score bajo = captura)
      scoreFinal = +(prediccionRed * 10).toFixed(2);

      let mensajeDetalles = "Características mixtas según la red neuronal.";
      if (scoreFinal >= 7) {
        mensajeDetalles = "No hay evidencia clara de captura de pantalla.";
      } else if (scoreFinal <= 3) {
        mensajeDetalles = "Fuertes indicios de captura de pantalla.";
      }

      logs.push(`[Pantalla] Score final: ${scoreFinal} (raw=${prediccionRed.toFixed(4)})`);

      const resp = {
        score: scoreFinal,
        nombreAnalizador: MODULE_NAME,
        version: VERSION,
        descripcion: DESCRIPCION,
        detalles: {
          interpretacion: mensajeDetalles,
          raw_output_synaptic: +prediccionRed.toFixed(4)
        },
        metadatos: {
          modeloCargado: this.modeloCargado
        },
        performance: {
          duracionMs: Date.now() - t0
        },
        logs,
        correlationId,
        imagenId,
        timestamp: new Date().toISOString(),
        act: "EOF"
      };

      dragon.respira("[Pantalla] Análisis completado", MODULE_NAME, "ANALISIS_OK", { scoreFinal, correlationId, imagenId });
      return resp;
    } catch (e) {
      exito = false;
      logs.push(`[Pantalla] Error crítico: ${e.message}`);
      dragon.agoniza("[Pantalla] Error crítico", e, MODULE_NAME, "ANALISIS_ERROR");
      return {
        score: null,
        nombreAnalizador: MODULE_NAME,
        version: VERSION,
        descripcion: DESCRIPCION,
        detalles: {},
        metadatos: { modeloCargado: this.modeloCargado },
        performance: { duracionMs: Date.now() - t0 },
        logs,
        correlationId,
        imagenId,
        timestamp: new Date().toISOString(),
        act: "EOF",
        error: e.message
      };
    }
  }
}

// --- Instancia única para performance ---
const analizador = new AnalisisDePantalla();

/**
 * act: Export FAANG para Dragon3.
 * @param {number[]} entrada
 * @param {object} opts
 * @returns {object} resultado Dragon3
 */
export function act(entrada, opts) { return analizador.act(entrada, opts); }

// Export default para testing/manual
export default AnalisisDePantalla;
export function act(entrada, opts) { return analizador.act(entrada, opts); }

// EOF
