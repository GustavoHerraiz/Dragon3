/**
 * DRAGON3 - Analizador de Definición FAANG
 * ----------------------------------------
 * Analiza la definición de una imagen usando lógica ponderada y red neuronal Synaptic.
 * Adaptado a FAANG: logging, errores, KISS, sin dependencias de red, formato Dragon3.
 *
 * Parámetros esperados: array de 10 features normalizados [0..1], en orden:
 *   [
 *    "Ancho", "Alto", "Densidad", "Resolución Horizontal", "Resolución Vertical",
 *    "Proporción de Dimensiones", "Complejidad", "Uniformidad", "Gradiente Promedio", "Artefactos Detectados"
 *   ]
 *
 * Retorna: { score, nombreAnalizador, detalles:{...}, act:"EOF" }
 *
 * Ejemplo de uso:
 *    import { act } from "./analisisDeDefinicion.js";
 *    const resultado = act([0.5, 0.5, ...]);
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
  { nombre: "Ancho", peso: 0.1, esHumano: v => v > 0.3 && v < 0.7 },
  { nombre: "Alto", peso: 0.1, esHumano: v => v > 0.3 && v < 0.7 },
  { nombre: "Densidad", peso: 0.15, esHumano: v => v < 0.5 },
  { nombre: "Resolución Horizontal", peso: 0.1, esHumano: v => v < 0.6 },
  { nombre: "Resolución Vertical", peso: 0.1, esHumano: v => v < 0.6 },
  { nombre: "Proporción de Dimensiones", peso: 0.1, esHumano: v => v > 0.4 && v < 0.8 },
  { nombre: "Complejidad", peso: 0.15, esHumano: v => v > 0.6 },
  { nombre: "Uniformidad", peso: 0.1, esHumano: v => v < 0.5 },
  { nombre: "Gradiente Promedio", peso: 0.1, esHumano: v => v < 0.4 },
  { nombre: "Artefactos Detectados", peso: 0.1, esHumano: v => v > 0.5 }
];

const SUMA_TOTAL_PESOS = parametros.reduce((sum, p) => sum + p.peso, 0);

/**
 * Analizador FAANG de definición: combina reglas y red neuronal.
 */
class AnalisisDeDefinicion {
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
      const rutaModelo = join(__dirname, "RedDeDefinicion_Entrenada.json");
      const datosModelo = JSON.parse(fs.readFileSync(rutaModelo, "utf8"));
      this.network = synaptic.Network.fromJSON(datosModelo);
      this.modeloCargado = true;
      dragon.zen("[Definicion] Modelo neuronal cargado FAANG", "analisisDeDefinicion", "LOAD_MODEL_OK", { rutaModelo });
    } catch (e) {
      this.network = new synaptic.Architect.Perceptron(parametros.length, 5, 1);
      this.modeloCargado = false;
      dragon.sePreocupa("[Definicion] Modelo no disponible, usando red dummy", "analisisDeDefinicion", "LOAD_MODEL_FAIL", { error: e.message });
    }
  }

  /**
   * act: Ejecuta el análisis FAANG sobre un array de features normalizados.
   * @param {number[]} entrada - Array de 10 valores entre 0 y 1.
   * @returns {object} Resultado FAANG {score, nombreAnalizador, detalles, act:"EOF"}
   */
  act(entrada) {
    try {
      if (!Array.isArray(entrada) || entrada.length !== parametros.length)
        throw new Error(`Entrada inválida: se esperan ${parametros.length} valores [${parametros.map(p=>p.nombre).join(", ")}]`);

      const datos = entrada.map(x => isNaN(parseFloat(x)) ? 0 : parseFloat(x));

      // --- Score por lógica de parámetros ---
      let scoreLogica = 0;
      parametros.forEach((p, i) => { scoreLogica += (p.esHumano(datos[i]) ? 1 : 0) * p.peso; });
      scoreLogica = SUMA_TOTAL_PESOS > 0 ? scoreLogica / SUMA_TOTAL_PESOS : 0;

      // --- Score por red neuronal ---
      let scoreRed = 0;
      try {
        scoreRed = this.network.activate(datos)[0];
        scoreRed = Math.max(0, Math.min(1, scoreRed));
      } catch (e) {
        dragon.sePreocupa("[Definicion] Error red neuronal", "analisisDeDefinicion", "NN_FAIL", { error: e.message });
      }

      // --- Score final FAANG ---
      const scoreFinal = +(scoreLogica * 0.7 + scoreRed * 0.3).toFixed(4);

      const resp = {
        score: scoreFinal,
        nombreAnalizador: "definicion",
        detalles: {
          scoreLogica: +scoreLogica.toFixed(4),
          scoreRed: +scoreRed.toFixed(4),
          interpretacion:
            scoreFinal >= 0.7
              ? "Definición consistente con imagen humana"
              : scoreFinal <= 0.3
              ? "Definición típica de imagen IA"
              : "Definición intermedia o dudosa"
        },
        act: "EOF"
      };

      dragon.respira("[Definicion] Análisis completado", "analisisDeDefinicion", "ANALISIS_OK", { scoreFinal });
      return resp;
    } catch (e) {
      dragon.agoniza("[Definicion] Error crítico", e, "analisisDeDefinicion", "ANALISIS_ERROR");
      return { score: 0, nombreAnalizador: "definicion", error: e.message, act: "EOF" };
    }
  }
}

// --- Instancia única para performance ---
const analizador = new AnalisisDeDefinicion();

/**
 * act: Export FAANG para Dragon3.
 * @param {number[]} entrada
 * @returns {object} resultado
 */
export function act(entrada) { return analizador.act(entrada); }

// Export default para testing/manual
export default AnalisisDeDefinicion;

// EOF
