/**
 * DRAGON3 - Analizador de Textura FAANG (Contrato Completo)
 * ---------------------------------------------------------
 * Red neuronal para análisis de texturas en imágenes.
 * Arquitectura: 10 -> 7 -> 1. Carga modelo JSON sin clave "layers" raíz.
 * Cumple 100% el contrato Dragon3: logging, errores, campos obligatorios, KISS.
 *
 * Parámetros esperados: array de 10 features normalizados [0..1]
 *   [
 *    "ComplejidadTextura", "UniformidadTextura", "PatronesRepetitivos",
 *    "VariacionesLocales", "DensidadBordes", "ContrasteMicro",
 *    "EscalaTextural", "AnisotropiaTextural", "RugosidadEstadistica", "EntropiaGlobal"
 *   ]
 *
 * Retorna: {
 *   score, nombreAnalizador, version, descripcion, detalles, metadatos,
 *   performance, logs, correlationId, imagenId, timestamp, act: "EOF"
 * }
 *
 * Ejemplo de uso:
 *    import { act } from "./analisisDeTextura.js";
 *    const resultado = await act([0.5, 0.7, ...]);
 */

import synaptic from "synaptic";
import dragon from "../../../utilidades/logger.js";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// --- Resolución de ruta para ESM ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const parametrosEntradaDef = [
  { nombre: "ComplejidadTextura" },
  { nombre: "UniformidadTextura" },
  { nombre: "PatronesRepetitivos" },
  { nombre: "VariacionesLocales" },
  { nombre: "DensidadBordes" },
  { nombre: "ContrasteMicro" },
  { nombre: "EscalaTextural" },
  { nombre: "AnisotropiaTextural" },
  { nombre: "RugosidadEstadistica" },
  { nombre: "EntropiaGlobal" }
];

const VERSION = "2.0.3";
const DESCRIPCION = "Analizador FAANG de textura Dragon3: red neuronal Synaptic. Devuelve score humano/IA y detalles interpretativos.";
const NOMBRE_ANALIZADOR = "textura";

/**
 * Analizador FAANG de Textura: red neuronal pura.
 */
class AnalisisDeTextura {
  constructor() {
    this.network = null;
    this.modelPath = join(__dirname, "RedDeTextura_v2_Entrenada.json");
    this.nombreRed = NOMBRE_ANALIZADOR;
    this.version = VERSION;
    dragon.info(`[Textura] Constructor v${this.version} iniciado.`, "analisisDeTextura");
    this._cargarModelo();
  }

  _cargarModelo() {
    try {
      dragon.info(`[Textura] Intentando cargar modelo desde: ${this.modelPath}`, "analisisDeTextura");
      if (!fs.existsSync(this.modelPath)) {
        dragon.sePreocupa(`[Textura] Archivo modelo no encontrado: ${this.modelPath}. Red dummy.`, "analisisDeTextura", "MODEL_NOT_FOUND");
        this.network = new synaptic.Architect.Perceptron(10, 7, 1);
        this.modeloCargado = false;
        return;
      }
      const rawData = fs.readFileSync(this.modelPath, "utf8");
      if (!rawData || rawData.trim() === "") {
        dragon.agoniza(`[Textura] Archivo modelo ${this.modelPath} vacío.`, new Error("Modelo vacío"), "analisisDeTextura", "MODEL_EMPTY");
        this.network = new synaptic.Architect.Perceptron(10, 7, 1);
        this.modeloCargado = false;
        return;
      }
      const modelJSON = JSON.parse(rawData);
      this.network = synaptic.Network.fromJSON(modelJSON);
      this.modeloCargado = true;
      if (this.network && typeof this.network.activate === "function") {
        dragon.zen("[Textura] Modelo neuronal cargado FAANG", "analisisDeTextura", "LOAD_MODEL_OK", { modelPath: this.modelPath });
      } else {
        dragon.agoniza(`[Textura] fromJSON devolvió un modelo inválido.`, new Error("Modelo inválido"), "analisisDeTextura", "MODEL_INVALID");
        this.network = new synaptic.Architect.Perceptron(10, 7, 1);
        this.modeloCargado = false;
      }
    } catch (e) {
      dragon.agoniza(`[Textura] Error crítico cargando modelo: ${e.message}`, e, "analisisDeTextura", "MODEL_LOAD_FAIL");
      this.network = new synaptic.Architect.Perceptron(10, 7, 1);
      this.modeloCargado = false;
    }
  }

  /**
   * act: Análisis principal; recibe un array de 10 features normalizados.
   * @param {number[]} entrada
   * @param {object} opts - Opcionales: { correlationId, imagenId }
   * @returns {object} resultado Dragon3 completo
   */
  async act(entrada, opts = {}) {
    const t0 = Date.now();
    const logs = [];
    let correlationId = opts.correlationId || null;
    let imagenId = opts.imagenId || null;
    try {
      if (!this.network) throw new Error("Red neuronal no disponible.");
      if (!Array.isArray(entrada) || entrada.length !== 10)
        throw new Error(`Entrada inválida: esperados 10 parámetros, recibidos ${Array.isArray(entrada) ? entrada.length : typeof entrada}`);
      const datos = entrada.map((d, i) => {
        const vN = parseFloat(d);
        if (isNaN(vN)) {
          const msg = `[Textura] Valor no numérico en entrada[${i}] (${parametrosEntradaDef[i]?.nombre || "?"}): '${d}'. Usando 0.5.`;
          logs.push(msg);
          dragon.sePreocupa(msg, "analisisDeTextura", "BAD_INPUT");
          return 0.5;
        }
        return Math.max(0, Math.min(1, vN));
      });
      const resultadoRed = this.network.activate(datos);
      if (!Array.isArray(resultadoRed) || resultadoRed.length !== 1 || typeof resultadoRed[0] !== "number" || isNaN(resultadoRed[0]))
        throw new Error("Salida de red inválida.");
      const confianzaHumanaRed = Math.max(0, Math.min(1, resultadoRed[0]));
      const scoreFinal = parseFloat((confianzaHumanaRed * 10).toFixed(2));
      const duracionMs = Date.now() - t0;

      logs.push(`[Textura] Score final: ${scoreFinal} (confianzaRed=${confianzaHumanaRed.toFixed(4)})`);

      const resp = {
        score: scoreFinal,
        nombreAnalizador: NOMBRE_ANALIZADOR,
        version: VERSION,
        descripcion: DESCRIPCION,
        detalles: {
          confianzaRed: +confianzaHumanaRed.toFixed(4),
          interpretacion: this._mensajeInterpretacion(confianzaHumanaRed)
        },
        metadatos: {
          modeloCargado: this.modeloCargado,
          parametros: parametrosEntradaDef.map(p => p.nombre)
        },
        performance: {
          duracionMs
        },
        logs,
        correlationId,
        imagenId,
        timestamp: new Date().toISOString(),
        act: "EOF"
      };

      dragon.respira("[Textura] Análisis completado", "analisisDeTextura", "ANALISIS_OK", { scoreFinal, duracionMs, correlationId, imagenId });
      return resp;
    } catch (e) {
      logs.push(`[Textura] Error crítico: ${e.message}`);
      dragon.agoniza("[Textura] Error crítico", e, "analisisDeTextura", "ANALISIS_ERROR");
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

  _mensajeInterpretacion(confianza) {
    if (confianza >= 0.8) return "Textura: Alta probabilidad de origen natural (humano).";
    if (confianza >= 0.6) return "Textura: Probablemente natural, con ambigüedad.";
    if (confianza >= 0.4) return "Textura: Características ambiguas, posible origen mixto.";
    if (confianza >= 0.2) return "Textura: Probabilidad considerable de origen sintético (IA).";
    return "Textura: Alta probabilidad de origen artificial (IA).";
  }
}

// --- Instancia única para performance ---
const analizador = new AnalisisDeTextura();

/**
 * act: Export FAANG para Dragon3.
 * @param {number[]} entrada
 * @param {object} opts
 * @returns {object} resultado Dragon3
 */
export async function act(entrada, opts) { return analizador.act(entrada, opts); }

// Export default para testing/manual
export default AnalisisDeTextura;
export async function act(entrada, opts) { return analizador.act(entrada, opts); }

// EOF
