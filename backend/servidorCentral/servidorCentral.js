/**
 * DRAGON3 - SERVIDOR CENTRAL (FAANG, KISS)
 * Orquesta el flujo entre analizadores y la red superior.
 * Consolida SOLO los 8 mejores features y delega la decisión a Dragon3.
 * Logging y resiliencia empresarial.
 * Arquitecto: Gustavo Herraiz
 * Fecha: 2025-06-17
 */

import redSuperior from '../redSuperior.js'; // Ajusta si cambia el path real
import logger from '../../utilidades/logger.js';
import { redisPublisher, redisSubscriber } from '../server.js';

// Canales Redis
const ANALIZADOR_IMAGEN_CHANNEL = 'dragon:analizadorImagen';
const RED_SUPERIOR_DECISION_CHANNEL = 'redSuperior:decision';

// Orden y significado de los 8 features clave
const FEATURES_SUPERIORES = [
  'RedExif_score',         // 0 - Coherencia y autenticidad EXIF
  'RedSignatures_score',   // 1 - Firmas digitales/hardware
  'RedTexture_score',      // 2 - Textura natural, patrones IA/edición
  'RedArtefactos_score',   // 3 - Artefactos de manipulación
  'RedColor_score',        // 4 - Coherencia color
  'MBH_score',             // 5 - Movimiento de bordes
  'IVM_Final',             // 6 - Integridad visual global
  'ECHT_score'             // 7 - Heurística edición/collage
];

class ServidorCentral {
  constructor() {
    logger.info('🟢 [ServidorCentral] Inicializando...');
    this.inicializarSuscriptorRedis();
    this.verificarEstadoServidor();
  }

  inicializarSuscriptorRedis() {
    try {
      redisSubscriber.subscribe(ANALIZADOR_IMAGEN_CHANNEL, (error) => {
        if (error) {
          logger.error(`🛑 [ServidorCentral] Error al suscribirse a ${ANALIZADOR_IMAGEN_CHANNEL}: ${error.message}`);
        } else {
          logger.info(`🟢 [ServidorCentral] Suscrito a canal Redis: ${ANALIZADOR_IMAGEN_CHANNEL}`);
        }
      });

      redisSubscriber.on("message", async (channel, message) => {
        if (channel === ANALIZADOR_IMAGEN_CHANNEL) {
          try {
            const pulso = JSON.parse(message);
            await this.procesarPulsoAnalizador(pulso);
          } catch (error) {
            logger.error(`🛑 [ServidorCentral] Error al procesar mensaje: ${error.message}`);
          }
        }
      });

      redisSubscriber.on("error", (error) => {
        logger.error(`🛑 [ServidorCentral] RedisSubscriber error: ${error.message}`);
      });
    } catch (error) {
      logger.error(`🛑 [ServidorCentral] Error crítico al inicializar suscriptor Redis: ${error.message}`);
    }
  }

  async procesarPulsoAnalizador(pulso) {
    const inicio = Date.now();
    let imagenId = null;
    try {
      imagenId = pulso?.datos?.imagenId || pulso?.imagenId || pulso?.resultado?.imagenId;
      if (!imagenId) throw new Error("Pulso recibido sin imagenId.");

      const datos = pulso.datos || pulso.resultado || pulso;
      const features = this.extraerFeaturesBuenos(datos);

      logger.info(`[ServidorCentral] Features consolidados para Red Superior: imagenId=${imagenId}, features=${JSON.stringify(features)}`);

      const metadatos = { imagenId, timestamp: new Date().toISOString() };
      const resultado = await redSuperior.predecir(features, metadatos);

      logger.info(`[ServidorCentral] Decisión Red Superior: imagenId=${imagenId}, resultado=${JSON.stringify(resultado)}`);

      const payload = { imagenId, resultado };
      redisPublisher.publish(RED_SUPERIOR_DECISION_CHANNEL, JSON.stringify(payload));

      const duracion = Date.now() - inicio;
      logger.info(`[ServidorCentral] 🔄 Proceso completo para ${imagenId} en ${duracion}ms (P95<200ms)`);

    } catch (error) {
      logger.error(`🛑 [ServidorCentral] Error en procesarPulsoAnalizador (imagenId=${imagenId}): ${error.message}`);
    }
  }

  /**
   * Extrae y ordena SOLO los 8 features “buenos” para la Red Superior
   * Si falta algún score, lo rellena con 0.
   * @param {Object} datos
   * @returns {Array<number>} Array de 8 features
   */
  extraerFeaturesBuenos(datos) {
    let scores = {};

    // Caso 1: resultado.resultadosDetallados (array de {analizador, puntuacion})
    if (datos?.resultado?.resultadosDetallados) {
      const mapAnalizadorToKey = {
        "ANALIZADOREXIF": "RedExif_score",
        "ANALIZADORFIRMAS": "RedSignatures_score",
        "ANALIZADORTEXTURA": "RedTexture_score",
        "ANALIZADORARTEFACTOS": "RedArtefactos_score",
        "ANALIZADORCOLOR": "RedColor_score",
        "MBH": "MBH_score",
        "IVM": "IVM_Final",
        "ECHT": "ECHT_score"
      };
      for (const r of datos.resultado.resultadosDetallados) {
        if (mapAnalizadorToKey[r.analizador]) {
          scores[mapAnalizadorToKey[r.analizador]] = r.puntuacion ?? 0;
        }
      }
      scores["MBH_score"] = datos.resultado.MBH_score ?? 0;
      scores["IVM_Final"] = datos.resultado.IVM_Final ?? 0;
      scores["ECHT_score"] = datos.resultado.ECHT_score ?? 0;
    } else if (datos?.resultadosRedes) {
      for (const [name, obj] of Object.entries(datos.resultadosRedes)) {
        scores[`${name}_score`] = obj.score ?? 0;
      }
      scores["IVM_Final"] = datos.IVM_Final ?? 0;
      scores["ECHT_score"] = datos.ECHT_score ?? 0;
    } else if (Object.keys(datos).some(key => key.endsWith('_score'))) {
      for (const key of FEATURES_SUPERIORES) {
        scores[key] = datos[key] ?? 0;
      }
    } else {
      logger.warn('[ServidorCentral] Datos de entrada no reconocidos. Rellenando features con 0.');
    }

    return FEATURES_SUPERIORES.map(key => Number(scores[key] ?? 0));
  }

  verificarEstadoServidor() {
    setInterval(() => {
      logger.info("💓 [ServidorCentral] Heartbeat: operativo.");
    }, 60000);
  }
}

// Inicializa el singleton
const servidorCentral = new ServidorCentral();
export default servidorCentral;

/**
 * DRAGON3 - SERVIDOR CENTRAL
 * - SOLO 8 features, robusto, escalable.
 * - Logging, resiliencia, consolidación y publicación de decisiones.
 * - Listo para integración con microservicios, frontend, auditoría.
 * - KISS, FAANG, Enterprise Ready.
 */
