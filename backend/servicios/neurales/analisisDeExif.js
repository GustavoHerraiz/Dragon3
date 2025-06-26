/**
 * DRAGON3 - Analizador de EXIF FAANG (Contrato Completo)
 * ------------------------------------------------------
 * Analiza los metadatos EXIF de una imagen usando lógica ponderada y red neuronal Synaptic.
 * Cumple 100% el contrato Dragon3: logging, errores, campos obligatorios, KISS.
 *
 * Parámetros esperados: array de 10 features normalizados [0..1], en orden:
 *   [
 *    "DimensionesExif", "Software", "FechaOriginal", "FechaModificacion",
 *    "ResoluciónHorizontal", "ResoluciónVertical", "ProporciónDimensiones",
 *    "Complejidad", "Uniformidad", "ArtefactosDetectados"
 *   ]
 *
 * Ejemplo de uso:
 *    import { act } from "./analisisDeExif.js";
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
  { nombre: "DimensionesExif", peso: 0.1, esHumano: v => v > 0.3 && v < 0.7 },
  { nombre: "Software", peso: 0.1, esHumano: v => v === 0.5 },
  { nombre: "FechaOriginal", peso: 0.15, esHumano: v => v < 0.6 },
  { nombre: "FechaModificacion", peso: 0.1, esHumano: v => v < 0.6 },
  { nombre: "ResoluciónHorizontal", peso: 0.1, esHumano: v => v > 0.4 && v < 0.8 },
  { nombre: "ResoluciónVertical", peso: 0.1, esHumano: v => v > 0.4 && v < 0.8 },
  { nombre: "ProporciónDimensiones", peso: 0.1, esHumano: v => v > 0.3 && v < 0.7 },
  { nombre: "Complejidad", peso: 0.15, esHumano: v => v > 0.6 },
  { nombre: "Uniformidad", peso: 0.1, esHumano: v => v < 0.5 },
  { nombre: "ArtefactosDetectados", peso: 0.1, esHumano: v => v > 0.5 }
];
const SUMA_TOTAL_PESOS = parametros.reduce((sum, p) => sum + p.peso, 0);

// --- Metadatos estáticos ---
const VERSION = "3.0.0";
const DESCRIPCION = "Analizador FAANG de EXIF Dragon3: lógica ponderada + red neuronal Synaptic. Devuelve score humano/IA.";
const NOMBRE_ANALIZADOR = "exif";

/**
 * Analizador FAANG de EXIF: combina reglas y red neuronal.
 */
class AnalisisDeExif {
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
      const rutaModelo = join(__dirname, "RedDeExif_Entrenada.json");
      const datosModelo = JSON.parse(fs.readFileSync(rutaModelo, "utf8"));
      this.network = synaptic.Network.fromJSON(datosModelo);
      this.modeloCargado = true;
      dragon.zen("[EXIF] Modelo neuronal cargado FAANG", NOMBRE_ANALIZADOR, "LOAD_MODEL_OK", { rutaModelo });
    } catch (e) {
      this.network = new synaptic.Architect.Perceptron(parametros.length, 5, 1);
      this.modeloCargado = false;
      dragon.sePreocupa("[EXIF] Modelo no disponible, usando red dummy", NOMBRE_ANALIZADOR, "LOAD_MODEL_FAIL", { error: e.message });
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
        logs.push(`[EXIF] Error red neuronal: ${e.message}`);
        dragon.sePreocupa("[EXIF] Error red neuronal", NOMBRE_ANALIZADOR, "NN_FAIL", { error: e.message });
      }

      // --- Score final FAANG ---
      scoreFinal = +(scoreLogica * 0.7 + scoreRed * 0.3).toFixed(4);

      logs.push(`[EXIF] Score lógico: ${scoreLogica.toFixed(4)}`);
      logs.push(`[EXIF] Score red: ${scoreRed.toFixed(4)}`);
      logs.push(`[EXIF] Score final: ${scoreFinal}`);

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
              ? "Metadatos EXIF consistentes con imagen humana"
              : scoreFinal <= 0.3
              ? "EXIF típico de imagen IA o inconsistente"
              : "EXIF con patrón intermedio o dudoso"
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

      dragon.respira("[EXIF] Análisis completado", NOMBRE_ANALIZADOR, "ANALISIS_OK", { scoreFinal, correlationId, imagenId });
      return resp;
    } catch (e) {
      exito = false;
      logs.push(`[EXIF] Error crítico: ${e.message}`);
      dragon.agoniza("[EXIF] Error crítico", e, NOMBRE_ANALIZADOR, "ANALISIS_ERROR");
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
const analizador = new AnalisisDeExif();

/**
 * act: Export FAANG para Dragon3.
 * @param {number[]} entrada
 * @param {object} opts
 * @returns {object} resultado Dragon3
 */
export function act(entrada, opts) { return analizador.act(entrada, opts); }

// Export default para testing/manual
export default AnalisisDeExif;
export function act(entrada, opts) { return analizador.act(entrada, opts); }

// EOF
