/**
 * DRAGON3 - Analizador de Resolución FAANG
 * ----------------------------------------
 * Analiza la resolución y proporción de una imagen usando lógica ponderada y red neuronal Synaptic.
 * Adaptado a FAANG: logging, errores, KISS, sin dependencias de red, formato Dragon3.
 *
 * Parámetros esperados: array de 5 features, en orden:
 *   [
 *    "Dimensiones", "Resolución Horizontal", "Resolución Vertical",
 *    "Proporción", "Clasificación Proporción"
 *   ]
 *
 * Retorna: { score, nombreAnalizador, detalles:{...}, act:"EOF" }
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

// --- Resolución de ruta para ESM ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Definición de parámetros y lógica de interpretación ---
const parametros = [
  { nombre: "Dimensiones", grupo: "ValoresBajosIA", peso: 0.2, esHumano: v => v > 3000 },
  { nombre: "Resolución Horizontal", grupo: "ValoresAltosIA", peso: 0.15, esHumano: v => v >= 300 && v <= 600 },
  { nombre: "Resolución Vertical", grupo: "ValoresAltosIA", peso: 0.15, esHumano: v => v >= 300 && v <= 600 },
  { nombre: "Proporción", grupo: "ValoresAltosIA", peso: 0.3, esHumano: v => v > 1.3 && v < 1.8 },
  { nombre: "Clasificación Proporción", grupo: "ValoresAltosHumanos", peso: 0.2, esHumano: v => v === "16:9" || v === "4:3" }
];

const SUMA_TOTAL_PESOS = parametros.reduce((sum, p) => sum + p.peso, 0);

// --- Utilidad para tratar el dato según grupo lógico ---
const tratarDato = (valor, grupo) => {
  try {
    if (valor === null || typeof valor === "undefined" || (typeof valor === "number" && isNaN(valor))) {
      switch (grupo) {
        case "ValoresAltosHumanos":
        case "ValoresAltosIA":
          dragon.sePreocupa(`Dato nulo en grupo ${grupo}: Penalizando con 0.`, "analisisDeResolucion", "NULL_DATA", { grupo });
          return 0;
        case "ValoresBajosHumanos":
        case "ValoresBajosIA":
          dragon.sePreocupa(`Dato nulo en grupo ${grupo}: Favoreciendo con 1.`, "analisisDeResolucion", "NULL_DATA", { grupo });
          return 1;
        default:
          dragon.agoniza(`Grupo lógico desconocido: ${grupo}`, new Error("Grupo desconocido"), "analisisDeResolucion", "UNKNOWN_GROUP", { grupo });
          return 0;
      }
    }
    return valor;
  } catch (error) {
    dragon.agoniza("Error en tratarDato", error, "analisisDeResolucion", "TRATAR_DATO_ERROR");
    return 0;
  }
};

/**
 * Analizador FAANG de resolución: combina lógica y red neuronal.
 */
class AnalisisDeResolucion {
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
      const rutaModelo = join(__dirname, "RedDeResolucion_Entrenada.json");
      const datosModelo = JSON.parse(fs.readFileSync(rutaModelo, "utf8"));
      this.network = synaptic.Network.fromJSON(datosModelo);
      this.modeloCargado = true;
      dragon.zen("[Resolucion] Modelo neuronal cargado FAANG", "analisisDeResolucion", "LOAD_MODEL_OK", { rutaModelo });
    } catch (e) {
      this.network = new synaptic.Architect.Perceptron(parametros.length, 3, 1);
      this.modeloCargado = false;
      dragon.sePreocupa("[Resolucion] Modelo no disponible, usando red dummy", "analisisDeResolucion", "LOAD_MODEL_FAIL", { error: e.message });
    }
  }

  /**
   * act: Ejecuta el análisis FAANG sobre un array de features.
   * @param {Array} entrada - Array de 5 valores (ver parámetros).
   * @returns {object} Resultado FAANG {score, nombreAnalizador, detalles, act:"EOF"}
   */
  act(entrada) {
    try {
      if (!Array.isArray(entrada) || entrada.length !== parametros.length)
        throw new Error(`Entrada inválida: se esperan ${parametros.length} valores: ${parametros.map(p=>p.nombre).join(", ")}`);

      // Tratar cada dato según grupo y tipo
      const datosTratados = entrada.map((dato, index) => {
        const parametro = parametros[index];
        if (!parametro) return 0;
        // Si es la proporción nominal, la pasamos tal cual (string)
        if (parametro.nombre === "Clasificación Proporción") return dato;
        // Para otros, forzamos a número
        return tratarDato(typeof dato === "string" ? parseFloat(dato) : dato, parametro.grupo);
      });

      // --- Score por lógica de parámetros ---
      let scoreLogica = 0;
      parametros.forEach((p, i) => {
        // La lógica especial para la proporción nominal
        let valor = datosTratados[i];
        if (p.nombre === "Clasificación Proporción") {
          scoreLogica += (p.esHumano(valor) ? 1 : 0) * p.peso;
        } else {
          scoreLogica += (p.esHumano(valor) ? 1 : 0) * p.peso;
        }
      });
      scoreLogica = SUMA_TOTAL_PESOS > 0 ? scoreLogica / SUMA_TOTAL_PESOS : 0;

      // --- Red neuronal (sólo valores numéricos, string como 0) ---
      const datosRed = datosTratados.map((v, i) => typeof v === "number" ? v : 0);
      let scoreRed = 0;
      try {
        scoreRed = this.network.activate(datosRed)[0];
        scoreRed = Math.max(0, Math.min(1, scoreRed));
      } catch (e) {
        dragon.sePreocupa("[Resolucion] Error red neuronal", "analisisDeResolucion", "NN_FAIL", { error: e.message });
      }

      // --- Score final FAANG ---
      const scoreFinal = +(scoreLogica * 0.7 + scoreRed * 0.3).toFixed(4);

      let mensajeFinal =
        scoreFinal >= 0.7
          ? "La imagen tiene una resolución excelente o típico de humano."
          : scoreFinal <= 0.3
          ? "Resolución baja o patrón típico de IA."
          : "Resolución intermedia.";

      const resp = {
        score: scoreFinal,
        nombreAnalizador: "resolucion",
        detalles: {
          scoreLogica: +scoreLogica.toFixed(4),
          scoreRed: +scoreRed.toFixed(4),
          interpretacion: mensajeFinal
        },
        act: "EOF"
      };

      dragon.respira("[Resolucion] Análisis completado", "analisisDeResolucion", "ANALISIS_OK", { scoreFinal });
      return resp;
    } catch (e) {
      dragon.agoniza("[Resolucion] Error crítico", e, "analisisDeResolucion", "ANALISIS_ERROR");
      return {
        score: 0,
        nombreAnalizador: "resolucion",
        error: e.message,
        act: "EOF"
      };
    }
  }
}

// --- Instancia única para performance ---
const analizador = new AnalisisDeResolucion();

/**
 * act: Export FAANG para Dragon3.
 * @param {Array} entrada
 * @returns {object} resultado
 */
export function act(entrada) { return analizador.act(entrada); }

// Export default para testing/manual
export default AnalisisDeResolucion;

// EOF
