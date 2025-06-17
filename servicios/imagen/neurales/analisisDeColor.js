/**
 * DRAGON3 - Analizador de Color FAANG
 * ------------------------------------
 * Analiza la composición cromática de imágenes usando lógica ponderada y red neuronal Synaptic.
 * Adaptado a FAANG: logging, errores, KISS, sin dependencias de red, formato Dragon3.
 *
 * Parámetros esperados: array de 10 features normalizados [0..1], en orden:
 *   [
 *    "Rojo Dominante", "Verde Dominante", "Azul Dominante", "Balance Cromático",
 *    "Espacio de Color Válido", "Rango del Espacio de Color", "Balance de Blancos",
 *    "Saturación", "Contraste", "Presencia de Software"
 *   ]
 *
 * Retorna: { score, nombreAnalizador, detalles:{...}, act:"EOF" }
 *
 * Ejemplo de uso:
 *    import { act } from "./analisisDeColor.js";
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
  { nombre: "Rojo Dominante", peso: 0.1, esHumano: v => v > 0.2 && v < 0.8 },
  { nombre: "Verde Dominante", peso: 0.1, esHumano: v => v > 0.2 && v < 0.8 },
  { nombre: "Azul Dominante", peso: 0.1, esHumano: v => v > 0.2 && v < 0.8 },
  { nombre: "Balance Cromático", peso: 0.15, esHumano: v => v > 0.4 && v < 0.7 },
  { nombre: "Espacio de Color Válido", peso: 0.1, esHumano: v => v === 1 },
  { nombre: "Rango del Espacio de Color", peso: 0.1, esHumano: v => v === 1 },
  { nombre: "Balance de Blancos", peso: 0.1, esHumano: v => v === 1 },
  { nombre: "Saturación", peso: 0.1, esHumano: v => v > 0.3 && v < 0.8 },
  { nombre: "Contraste", peso: 0.1, esHumano: v => v > 0.3 && v < 0.8 },
  { nombre: "Presencia de Software", peso: 0.05, esHumano: v => v === 1 }
];
const SUMA_TOTAL_PESOS = parametros.reduce((sum, p) => sum + p.peso, 0);

/**
 * Analizador FAANG de color: combina reglas y red neuronal.
 */
class AnalisisDeColor {
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
      const rutaModelo = join(__dirname, "RedDeColor_Entrenada.json");
      const datosModelo = JSON.parse(fs.readFileSync(rutaModelo, "utf8"));
      this.network = synaptic.Network.fromJSON(datosModelo);
      this.modeloCargado = true;
      dragon.zen("[Color] Modelo neuronal cargado FAANG", "analisisDeColor", "LOAD_MODEL_OK", { rutaModelo });
    } catch (e) {
      this.network = new synaptic.Architect.Perceptron(parametros.length, 5, 1);
      this.modeloCargado = false;
      dragon.sePreocupa("[Color] Modelo no disponible, usando red dummy", "analisisDeColor", "LOAD_MODEL_FAIL", { error: e.message });
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
        dragon.sePreocupa("[Color] Error red neuronal", "analisisDeColor", "NN_FAIL", { error: e.message });
      }

      // --- Score final FAANG ---
      const scoreFinal = +(scoreLogica * 0.7 + scoreRed * 0.3).toFixed(4);

      const resp = {
        score: scoreFinal,
        nombreAnalizador: "color",
        detalles: {
          scoreLogica: +scoreLogica.toFixed(4),
          scoreRed: +scoreRed.toFixed(4),
          interpretacion:
            scoreFinal >= 0.7
              ? "Composición cromática consistente con imagen humana"
              : scoreFinal <= 0.3
              ? "Características cromáticas anómalas o IA"
              : "Patrón cromático intermedio"
        },
        act: "EOF"
      };

      dragon.respira("[Color] Análisis completado", "analisisDeColor", "ANALISIS_OK", { scoreFinal });
      return resp;
    } catch (e) {
      dragon.agoniza("[Color] Error crítico", e, "analisisDeColor", "ANALISIS_ERROR");
      return { score: 0, nombreAnalizador: "color", error: e.message, act: "EOF" };
    }
  }
}

// --- Instancia única para performance ---
const analizador = new AnalisisDeColor();

/**
 * act: Export FAANG para Dragon3.
 * @param {number[]} entrada
 * @returns {object} resultado
 */
export function act(entrada) { return analizador.act(entrada); }

// Export default para testing/manual
export default AnalisisDeColor;

// EOF
