/**
 * DRAGON3 - Analizador de Resolución FAANG (Contrato Completo)
 * ------------------------------------------------------------
 * Analiza la resolución y proporción de una imagen usando lógica ponderada y red neuronal Synaptic.
 * Cumple 100% el contrato Dragon3: logging, errores, campos obligatorios, KISS.
 *
 * Parámetros esperados: array de 5 features, en orden:
 *   [
 *    "Dimensiones", "Resolución Horizontal", "Resolución Vertical",
 *    "Proporción", "Clasificación Proporción"
 *   ]
 *
 * Ejemplo de uso:
 *    import { act } from "./analisisDeResolucion.js";
 *    const resultado = act([4000, 450, 450, 1.5, "16:9"]);
 */

import synaptic from "synaptic";
import dragon from "../../../utilidades/logger.js";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const VERSION = "3.0.0";
const DESCRIPCION = "Analizador FAANG de resolución Dragon3: lógica ponderada + red neuronal Synaptic. Devuelve score humano/IA.";
const NOMBRE_ANALIZADOR = "resolucion";

const parametros = [
  { nombre: "Dimensiones", grupo: "ValoresBajosIA", peso: 0.2, esHumano: v => v > 3000 },
  { nombre: "Resolución Horizontal", grupo: "ValoresAltosIA", peso: 0.15, esHumano: v => v >= 300 && v <= 600 },
  { nombre: "Resolución Vertical", grupo: "ValoresAltosIA", peso: 0.15, esHumano: v => v >= 300 && v <= 600 },
  { nombre: "Proporción", grupo: "ValoresAltosIA", peso: 0.3, esHumano: v => v > 1.3 && v < 1.8 },
  { nombre: "Clasificación Proporción", grupo: "ValoresAltosHumanos", peso: 0.2, esHumano: v => v === "16:9" || v === "4:3" }
];
const SUMA_TOTAL_PESOS = parametros.reduce((sum, p) => sum + p.peso, 0);

const tratarDato = (valor, grupo) => {
  try {
    if (valor === null || typeof valor === "undefined" || (typeof valor === "number" && isNaN(valor))) {
      switch (grupo) {
        case "ValoresAltosHumanos":
        case "ValoresAltosIA":
          dragon.sePreocupa(`Dato nulo en grupo ${grupo}: Penalizando con 0.`, NOMBRE_ANALIZADOR, "NULL_DATA", { grupo });
          return 0;
        case "ValoresBajosHumanos":
        case "ValoresBajosIA":
          dragon.sePreocupa(`Dato nulo en grupo ${grupo}: Favoreciendo con 1.`, NOMBRE_ANALIZADOR, "NULL_DATA", { grupo });
          return 1;
        default:
          dragon.agoniza(`Grupo lógico desconocido: ${grupo}`, new Error("Grupo desconocido"), NOMBRE_ANALIZADOR, "UNKNOWN_GROUP", { grupo });
          return 0;
      }
    }
    return valor;
  } catch (error) {
    dragon.agoniza("Error en tratarDato", error, NOMBRE_ANALIZADOR, "TRATAR_DATO_ERROR");
    return 0;
  }
};

class AnalisisDeResolucion {
  constructor() {
    this.network = null;
    this.modeloCargado = false;
    this._cargarModelo();
  }

  _cargarModelo() {
    try {
      const rutaModelo = join(__dirname, "RedDeResolucion_Entrenada.json");
      const datosModelo = JSON.parse(fs.readFileSync(rutaModelo, "utf8"));
      this.network = synaptic.Network.fromJSON(datosModelo);
      this.modeloCargado = true;
      dragon.zen("[Resolucion] Modelo neuronal cargado FAANG", NOMBRE_ANALIZADOR, "LOAD_MODEL_OK", { rutaModelo });
    } catch (e) {
      this.network = new synaptic.Architect.Perceptron(parametros.length, 3, 1);
      this.modeloCargado = false;
      dragon.sePreocupa("[Resolucion] Modelo no disponible, usando red dummy", NOMBRE_ANALIZADOR, "LOAD_MODEL_FAIL", { error: e.message });
    }
  }

  /**
   * act: Ejecuta el análisis FAANG sobre un array de features.
   * @param {Array} entrada - Array de 5 valores (ver parámetros).
   * @param {object} opts - Opcionales: { correlationId, imagenId }
   * @returns {object} Contrato Dragon3 completo
   */
  act(entrada, opts = {}) {
    const t0 = Date.now();
    const logs = [];
    let correlationId = opts.correlationId || null;
    let imagenId = opts.imagenId || null;
    let scoreLogica = 0, scoreRed = 0, scoreFinal = 0;
    try {
      if (!Array.isArray(entrada) || entrada.length !== parametros.length)
        throw new Error(`Entrada inválida: se esperan ${parametros.length} valores: ${parametros.map(p=>p.nombre).join(", ")}`);

      // Tratar cada dato según grupo y tipo
      const datosTratados = entrada.map((dato, index) => {
        const parametro = parametros[index];
        if (!parametro) return 0;
        if (parametro.nombre === "Clasificación Proporción") return dato;
        return tratarDato(typeof dato === "string" ? parseFloat(dato) : dato, parametro.grupo);
      });

      // --- Score por lógica de parámetros ---
      parametros.forEach((p, i) => {
        let valor = datosTratados[i];
        scoreLogica += (p.esHumano(valor) ? 1 : 0) * p.peso;
      });
      scoreLogica = SUMA_TOTAL_PESOS > 0 ? scoreLogica / SUMA_TOTAL_PESOS : 0;

      // --- Red neuronal (solo valores numéricos, string como 0) ---
      const datosRed = datosTratados.map((v, i) => typeof v === "number" ? v : 0);
      try {
        scoreRed = this.network.activate(datosRed)[0];
        scoreRed = Math.max(0, Math.min(1, scoreRed));
      } catch (e) {
        logs.push(`[Resolucion] Error red neuronal: ${e.message}`);
        dragon.sePreocupa("[Resolucion] Error red neuronal", NOMBRE_ANALIZADOR, "NN_FAIL", { error: e.message });
      }

      // --- Score final FAANG ---
      scoreFinal = +(scoreLogica * 0.7 + scoreRed * 0.3).toFixed(4);

      let mensajeFinal =
        scoreFinal >= 0.7
          ? "La imagen tiene una resolución excelente o típico de humano."
          : scoreFinal <= 0.3
          ? "Resolución baja o patrón típico de IA."
          : "Resolución intermedia.";

      logs.push(`[Resolucion] Score lógico: ${scoreLogica.toFixed(4)}`);
      logs.push(`[Resolucion] Score red: ${scoreRed.toFixed(4)}`);
      logs.push(`[Resolucion] Score final: ${scoreFinal}`);

      return {
        score: scoreFinal,
        nombreAnalizador: NOMBRE_ANALIZADOR,
        version: VERSION,
        descripcion: DESCRIPCION,
        detalles: {
          scoreLogica: +scoreLogica.toFixed(4),
          scoreRed: +scoreRed.toFixed(4),
          interpretacion: mensajeFinal
        },
        metadatos: {
          modeloCargado: this.modeloCargado,
          parametros: parametros.map(p=>p.nombre)
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
    } catch (e) {
      logs.push(`[Resolucion] Error crítico: ${e.message}`);
      dragon.agoniza("[Resolucion] Error crítico", e, NOMBRE_ANALIZADOR, "ANALISIS_ERROR");
      return {
        score: null,
        nombreAnalizador: NOMBRE_ANALIZADOR,
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
const analizador = new AnalisisDeResolucion();

/**
 * act: Export FAANG para Dragon3.
 * @param {Array} entrada
 * @param {object} opts
 * @returns {object} resultado Dragon3
 */
export function act(entrada, opts) { return analizador.act(entrada, opts); }

// Export default para testing/manual
export default AnalisisDeResolucion;
export function act(entrada, opts) { return analizador.act(entrada, opts); }

// EOF
