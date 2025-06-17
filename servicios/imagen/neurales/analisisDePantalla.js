/**
 * DRAGON3 - Analizador de Pantalla FAANG
 * --------------------------------------
 * Analiza si una imagen es una captura de pantalla basándose en 10 indicadores normalizados,
 * usando una red neuronal Synaptic entrenada. Adaptado a FAANG: logging, errores, KISS,
 * sin dependencias de red, formato Dragon3.
 *
 * Espera: array de 10 features normalizados [0..1], según tu pipeline.
 * Retorna: { score, nombreAnalizador, detalles:{...}, act:"EOF" }
 *
 * Ejemplo de uso:
 *    import { act } from "./analisisDePantalla.js";
 *    const resultado = act([0.5, 0.2, ...]);
 */

import synaptic from "synaptic";
import dragon from "../../../utilidades/logger.js";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// --- Resolución de ruta para ESM ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MODULE_NAME = 'pantalla';

/**
 * Analizador FAANG de Pantalla: red neuronal pura, sin reglas.
 */
class AnalisisDePantalla {
  constructor() {
    this.network = null;
    this.modeloCargado = false;
    this._cargarModelo();
  }

  /**
   * _cargarModelo: Intenta cargar la red entrenada desde JSON, o crea una red dummy si falla.
   */
  _cargarModelo() {
    try {
      const rutaModelo = join(__dirname, "RedDePantalla_Entrenada.json");
      const datosModelo = JSON.parse(fs.readFileSync(rutaModelo, "utf8"));
      this.network = synaptic.Network.fromJSON(datosModelo);
      this.modeloCargado = true;
      dragon.zen("[Pantalla] Modelo neuronal cargado FAANG", "analisisDePantalla", "LOAD_MODEL_OK", { rutaModelo });
    } catch (e) {
      this.network = new synaptic.Architect.Perceptron(10, 7, 1);
      this.modeloCargado = false;
      dragon.sePreocupa("[Pantalla] Modelo no disponible, usando red dummy", "analisisDePantalla", "LOAD_MODEL_FAIL", { error: e.message });
    }
  }

  /**
   * act: Ejecuta el análisis FAANG sobre un array de features normalizados.
   * @param {number[]} entrada - Array de 10 valores entre 0 y 1.
   * @returns {object} Resultado FAANG {score, nombreAnalizador, detalles, act:"EOF"}
   */
  act(entrada) {
    const baseMeta = { mod: MODULE_NAME, func: "act" };
    try {
      if (!Array.isArray(entrada) || entrada.length !== 10)
        throw new Error(`Entrada inválida: se esperan 10 valores normalizados (array de 10).`);

      // Normaliza valores
      const datos = entrada.map(x => isNaN(parseFloat(x)) ? 0.5 : Math.max(0, Math.min(1, parseFloat(x))));

      let prediccionRed = 0;
      try {
        prediccionRed = this.network.activate(datos)[0];
        prediccionRed = Math.max(0, Math.min(1, prediccionRed));
      } catch (e) {
        dragon.sePreocupa("[Pantalla] Error red neuronal", "analisisDePantalla", "NN_FAIL", { error: e.message });
      }

      // Escalar la salida de la red (0-1) a 0-10 (score alto = no-captura, score bajo = captura)
      const scoreFinal = +(prediccionRed * 10).toFixed(2);

      let mensajeDetalles = "Características mixtas según la red neuronal.";
      if (scoreFinal >= 7) {
        mensajeDetalles = "No hay evidencia clara de captura de pantalla.";
      } else if (scoreFinal <= 3) {
        mensajeDetalles = "Fuertes indicios de captura de pantalla.";
      }

      const resp = {
        score: scoreFinal,
        nombreAnalizador: MODULE_NAME,
        detalles: {
          interpretacion: mensajeDetalles,
          raw_output_synaptic: +prediccionRed.toFixed(4)
        },
        act: "EOF"
      };

      dragon.respira("[Pantalla] Análisis completado", "analisisDePantalla", "ANALISIS_OK", { scoreFinal });
      return resp;
    } catch (e) {
      dragon.agoniza("[Pantalla] Error crítico", e, "analisisDePantalla", "ANALISIS_ERROR");
      return {
        score: 0,
        nombreAnalizador: MODULE_NAME,
        error: e.message,
        act: "EOF"
      };
    }
  }
}

// --- Instancia única para performance ---
const analizador = new AnalisisDePantalla();

/**
 * act: Export FAANG para Dragon3.
 * @param {number[]} entrada
 * @returns {object} resultado
 */
export function act(entrada) { return analizador.act(entrada); }

// Export default para testing/manual
export default AnalisisDePantalla;

// EOF
