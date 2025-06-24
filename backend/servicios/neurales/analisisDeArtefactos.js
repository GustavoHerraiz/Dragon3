/**
 * DRAGON3 - Analizador de Artefactos FAANG (Contrato Completo)
 * ------------------------------------------------------------
 * Analiza artefactos en imágenes usando lógica ponderada y red neuronal Synaptic.
 * Cumple 100% el contrato Dragon3: logging, errores, campos obligatorios, KISS.
 *
 * Parámetros esperados: array de 10 features normalizados [0..1], en orden:
 *   ["Ancho", "Alto", "Densidad", "Resolución Horizontal", "Resolución Vertical",
 *    "Proporción de Dimensiones", "Complejidad", "Uniformidad", "Gradiente Promedio", "Artefactos Detectados"]
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
  { nombre: "Ancho", peso: 0.1, esHumano: v => v > 0.3 && v < 0.7 },
  { nombre: "Alto", peso: 0.1, esHumano: v => v > 0.3 && v < 0.7 },
  { nombre: "Densidad", peso: 0.15, esHumano: v => v < 0.5 },
  { nombre: "Resolución Horizontal", peso: 0.1, esHumano: v => v < 0.6 },
  { nombre: "Resolución Vertical", peso: 0.1, esHumano: v => v < 0.6 },
  { nombre: "Proporción de Dimensiones", peso: 0.1, esHumano: v => v > 0.4 && v < 0.8 },
  { nombre: "Complejidad", peso: 0.15, esHumano: v => v > 0.6 },
  { nombre: "Uniformidad", peso: 0.1, esHumano: v => v < 0.5 },
  { nombre: "Gradiente Promedio", peso: 0.1, esHumano: v => v < 0.4 },
  { nombre: "Artefactos Detectados", peso: 0.1, esHumano: v => v <= 0.2 }
];
const SUMA_TOTAL_PESOS = parametros.reduce((sum, p) => sum + p.peso, 0);

// --- Metadatos estáticos ---
const VERSION = "3.0.0";
const DESCRIPCION = "Analizador FAANG de artefactos Dragon3: lógica ponderada + red neuronal Synaptic. Devuelve score humano/IA.";
const NOMBRE_ANALIZADOR = "artefactos";

/**
 * Analizador FAANG de artefactos: combina reglas y red neuronal.
 */
class AnalisisDeArtefactos {
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
      const rutaModelo = join(__dirname, "RedDeArtefactos_Entrenada.json");
      const datosModelo = JSON.parse(fs.readFileSync(rutaModelo, "utf8"));
      this.network = synaptic.Network.fromJSON(datosModelo);
      this.modeloCargado = true;
      dragon.zen("[Artefactos] Modelo neuronal cargado FAANG", NOMBRE_ANALIZADOR, "LOAD_MODEL_OK", { rutaModelo });
    } catch (e) {
      this.network = new synaptic.Architect.Perceptron(parametros.length, 5, 1);
      this.modeloCargado = false;
      dragon.sePreocupa("[Artefactos] Modelo no disponible, usando red dummy", NOMBRE_ANALIZADOR, "LOAD_MODEL_FAIL", { error: e.message });
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
        logs.push(`[Artefactos] Error red neuronal: ${e.message}`);
        dragon.sePreocupa("[Artefactos] Error red neuronal", NOMBRE_ANALIZADOR, "NN_FAIL", { error: e.message });
      }

      // --- Score final FAANG ---
      scoreFinal = +(scoreLogica * 0.7 + scoreRed * 0.3).toFixed(4);

      logs.push(`[Artefactos] Score lógico: ${scoreLogica.toFixed(4)}`);
      logs.push(`[Artefactos] Score red: ${scoreRed.toFixed(4)}`);
      logs.push(`[Artefactos] Score final: ${scoreFinal}`);

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
              ? "Imagen probablemente HUMANA"
              : scoreFinal <= 0.3
              ? "Probablemente IA"
              : "Indeterminado"
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

      dragon.respira("[Artefactos] Análisis completado", NOMBRE_ANALIZADOR, "ANALISIS_OK", { scoreFinal, correlationId, imagenId });
      return resp;
    } catch (e) {
      exito = false;
      logs.push(`[Artefactos] Error crítico: ${e.message}`);
      dragon.agoniza("[Artefactos] Error crítico", e, NOMBRE_ANALIZADOR, "ANALISIS_ERROR");
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
const analizador = new AnalisisDeArtefactos();

/**
 * act: Export FAANG para Dragon3.
 * @param {number[]} entrada
 * @param {object} opts
 * @returns {object} resultado Dragon3
 */
export function act(entrada, opts) { return analizador.act(entrada, opts); }

// Export default para testing/manual
export default AnalisisDeArtefactos;

// EOF