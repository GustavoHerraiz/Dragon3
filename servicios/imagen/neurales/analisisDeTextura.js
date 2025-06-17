/**
 * DRAGON3 - Analizador de Textura FAANG
 * -------------------------------------
 * Red neuronal para análisis de texturas en imágenes.
 * Arquitectura: 10 -> 7 -> 1. Carga modelo JSON sin clave "layers" raíz.
 * Adaptado para logging FAANG, seguridad, KISS y robustez Dragon3.
 *
 * Parámetros esperados: array de 10 features normalizados [0..1]
 *   [
 *    "ComplejidadTextura", "UniformidadTextura", "PatronesRepetitivos",
 *    "VariacionesLocales", "DensidadBordes", "ContrasteMicro",
 *    "EscalaTextural", "AnisotropiaTextural", "RugosidadEstadistica", "EntropiaGlobal"
 *   ]
 *
 * Retorna: { score, nombreAnalizador, detalles:{...}, act:"EOF" }
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

class AnalisisDeTextura {
  constructor() {
    this.network = null;
    this.modelPath = join(__dirname, "RedDeTextura_v2_Entrenada.json");
    this.nombreRed = "textura";
    this.version = "2.0.3";
    dragon.info(`[Textura] Constructor v${this.version} iniciado.`, "analisisDeTextura");
    this._cargarModelo();
  }

  _cargarModelo() {
    try {
      dragon.info(`[Textura] Intentando cargar modelo desde: ${this.modelPath}`, "analisisDeTextura");
      if (!fs.existsSync(this.modelPath)) {
        dragon.sePreocupa(`[Textura] Archivo modelo no encontrado: ${this.modelPath}. Red dummy.`, "analisisDeTextura", "MODEL_NOT_FOUND");
        this.network = new synaptic.Architect.Perceptron(10, 7, 1);
        return;
      }
      const rawData = fs.readFileSync(this.modelPath, "utf8");
      if (!rawData || rawData.trim() === "") {
        dragon.agoniza(`[Textura] Archivo modelo ${this.modelPath} vacío.`, new Error("Modelo vacío"), "analisisDeTextura", "MODEL_EMPTY");
        this.network = new synaptic.Architect.Perceptron(10, 7, 1);
        return;
      }
      const modelJSON = JSON.parse(rawData);
      this.network = synaptic.Network.fromJSON(modelJSON);
      if (this.network && typeof this.network.activate === "function") {
        dragon.zen("[Textura] Modelo neuronal cargado FAANG", "analisisDeTextura", "LOAD_MODEL_OK", { modelPath: this.modelPath });
      } else {
        dragon.agoniza(`[Textura] fromJSON devolvió un modelo inválido.`, new Error("Modelo inválido"), "analisisDeTextura", "MODEL_INVALID");
        this.network = new synaptic.Architect.Perceptron(10, 7, 1);
      }
    } catch (e) {
      dragon.agoniza(`[Textura] Error crítico cargando modelo: ${e.message}`, e, "analisisDeTextura", "MODEL_LOAD_FAIL");
      this.network = new synaptic.Architect.Perceptron(10, 7, 1);
    }
  }

  /**
   * act: Análisis principal; recibe un array de 10 features normalizados.
   * @param {number[]} entrada
   * @returns {object} resultado FAANG {score, nombreAnalizador, detalles, act:"EOF"}
   */
  async act(entrada) {
    const t0 = Date.now();
    try {
      if (!this.network) throw new Error("Red neuronal no disponible.");
      if (!Array.isArray(entrada) || entrada.length !== 10)
        throw new Error(`Entrada inválida: esperados 10 parámetros, recibidos ${Array.isArray(entrada) ? entrada.length : typeof entrada}`);
      const datos = entrada.map((d, i) => {
        const vN = parseFloat(d);
        if (isNaN(vN)) {
          dragon.sePreocupa(`[Textura] Valor no numérico en entrada[${i}] (${parametrosEntradaDef[i]?.nombre || "?"}): '${d}'. Usando 0.5.`, "analisisDeTextura", "BAD_INPUT");
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

      const resp = {
        score: scoreFinal,
        nombreAnalizador: "textura",
        detalles: {
          confianzaRed: +confianzaHumanaRed.toFixed(4),
          interpretacion: this._mensajeInterpretacion(confianzaHumanaRed)
        },
        act: "EOF"
      };

      dragon.respira("[Textura] Análisis completado", "analisisDeTextura", "ANALISIS_OK", { scoreFinal, duracionMs });
      return resp;
    } catch (e) {
      dragon.agoniza("[Textura] Error crítico", e, "analisisDeTextura", "ANALISIS_ERROR");
      return {
        score: 0,
        nombreAnalizador: "textura",
        error: e.message,
        act: "EOF"
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
 * @returns {object} resultado
 */
export async function act(entrada) { return analizador.act(entrada); }

// Export default para testing/manual
export default AnalisisDeTextura;

// EOF
