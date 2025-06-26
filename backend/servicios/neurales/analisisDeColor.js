/**
 * DRAGON3 - Analizador de Color FAANG (Contrato Completo)
 * -------------------------------------------------------
 * Analiza la composición cromática de imágenes usando lógica ponderada y red neuronal Synaptic.
 * Cumple 100% el contrato Dragon3: logging, errores, campos obligatorios, KISS.
 *
 * Parámetros esperados: array de 10 features normalizados [0..1], en orden:
 *   [
 *    "Rojo Dominante", "Verde Dominante", "Azul Dominante", "Balance Cromático",
 *    "Espacio de Color Válido", "Rango del Espacio de Color", "Balance de Blancos",
 *    "Saturación", "Contraste", "Presencia de Software"
 *   ]
 *
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

// --- Metadatos estáticos ---
const VERSION = "3.0.0";
const DESCRIPCION = "Analizador FAANG de color Dragon3: lógica ponderada + red neuronal Synaptic. Devuelve score humano/IA.";
const NOMBRE_ANALIZADOR = "color";

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
      dragon.zen("[Color] Modelo neuronal cargado FAANG", NOMBRE_ANALIZADOR, "LOAD_MODEL_OK", { rutaModelo });
    } catch (e) {
      this.network = new synaptic.Architect.Perceptron(parametros.length, 5, 1);
      this.modeloCargado = false;
      dragon.sePreocupa("[Color] Modelo no disponible, usando red dummy", NOMBRE_ANALIZADOR, "LOAD_MODEL_FAIL", { error: e.message });
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
    let scoreLogica = 0, scoreRed = 0, scoreFinal = 0;
    let exito = true;
    try {
      if (!Array.isArray(entrada) || entrada.length !== parametros.length)
        throw new Error(`Entrada inválida: se esperan ${parametros.length} valores [${parametros.map(p=>p.nombre).join(", ")}]`);

      const datos = entrada.map(x => isNaN(parseFloat(x)) ? 0 : parseFloat(x));

      // --- Score por lógica de parámetros ---
      parametros.forEach((p, i) => { scoreLogica += (p.esHumano(datos[i]) ? 1 : 0) * p.peso; });
      scoreLogica = SUMA_TOTAL_PESOS > 0 ? scoreLogica / SUMA_TOTAL_PESOS : 0;

      // --- Score por red neuronal ---
      try {
        scoreRed = this.network.activate(datos)[0];
        scoreRed = Math.max(0, Math.min(1, scoreRed));
      } catch (e) {
        exito = false;
        logs.push(`[Color] Error red neuronal: ${e.message}`);
        dragon.sePreocupa("[Color] Error red neuronal", NOMBRE_ANALIZADOR, "NN_FAIL", { error: e.message });
      }

      // --- Score final FAANG ---
      scoreFinal = +(scoreLogica * 0.7 + scoreRed * 0.3).toFixed(4);

      logs.push(`[Color] Score lógico: ${scoreLogica.toFixed(4)}`);
      logs.push(`[Color] Score red: ${scoreRed.toFixed(4)}`);
      logs.push(`[Color] Score final: ${scoreFinal}`);

      const resp = {
        score: scoreFinal,
        nombreAnalizador: NOMBRE_ANALIZADOR,
        version: VERSION,
        descripcion: DESCRIPCION,
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

      dragon.respira("[Color] Análisis completado", NOMBRE_ANALIZADOR, "ANALISIS_OK", { scoreFinal, correlationId, imagenId });
      return resp;
    } catch (e) {
      exito = false;
      logs.push(`[Color] Error crítico: ${e.message}`);
      dragon.agoniza("[Color] Error crítico", e, NOMBRE_ANALIZADOR, "ANALISIS_ERROR");
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
const analizador = new AnalisisDeColor();

/**
 * act: Export FAANG para Dragon3.
 * @param {number[]} entrada
 * @param {object} opts
 * @returns {object} resultado Dragon3
 */
export function act(entrada, opts) { return analizador.act(entrada, opts); }

// Export default para testing/manual
export default AnalisisDeColor;
export function act(entrada, opts) { return analizador.act(entrada, opts); }

// EOF
