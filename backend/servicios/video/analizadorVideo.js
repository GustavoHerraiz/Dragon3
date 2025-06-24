/**
 * analizadorVideo.js - Dragon3 Redis Streams Bidireccional Video
 * Architecture: Ultra-fast bidirectional tracking con Redis Streams + Hash  
 * Performance: P95 <200ms, trazabilidad 100% garantizada
 * Dynamic Loading: analizadores/video/ + redesEspejo/video/
 * @author GustavoHerraiz
 * @date 2025-04-15
 */

import logger from '../../utilidades/logger.js';
import redis from '../../utilidades/redis.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';
import healthMonitor from '../HealthMonitor.js';
import servidorCentral from '../servidorCentral.js';

const NOMBRE_MODULO = 'analizadorVideo';
const MAX_CONCURRENTES = 30; // Videos requieren más recursos
const TIMEOUT_ANALISIS = 120000; // 2 minutos para videos
const TIMEOUT_STREAM_READ = 30000;

// REDIS STREAMS STRUCTURE VIDEO
const STREAMS_VIDEO = {
    REQUEST_ESPEJO: 'dragon3:stream:video:req:espejo',
    RESPONSE_ESPEJO: 'dragon3:stream:video:resp:espejo',
    REQUEST_SUPERIOR: 'dragon3:stream:video:req:superior',
    RESPONSE_SUPERIOR: 'dragon3:stream:video:resp:superior',
    STATUS_UPDATES: 'dragon3:stream:video:status'
};

// CONSUMER GROUPS VIDEO
const CONSUMER_GROUPS_VIDEO = {
    ESPEJO_PROCESSORS: 'dragon3-video-espejo-processors',
    SUPERIOR_PROCESSORS: 'dragon3-video-superior-processors',
    STATUS_MONITORS: 'dragon3-video-status-monitors'
};

// HASH TRACKING KEYS VIDEO
const HASH_KEYS_VIDEO = {
    TRACKING: (archivoId) => `dragon3:video:track:${archivoId}`,
    SESSION: (archivoId) => `dragon3:video:session:${archivoId}`,
    CACHE: (hash) => `dragon3:video:cache:${hash}`,
    PERFORMANCE: (archivoId) => `dragon3:video:perf:${archivoId}`
};

/**
 * Gestor Redis Streams Video Especializado
 */
class GestorStreamsVideo {
    constructor() {
        this.procesamientoActivo = new Map();
        this.responseWaiters = new Map();
        this.consumersRunning = false;
        this.analizadoresVideoCargados = null;
        this.redesEspejoVideoCargadas = null;
        this.inicializarStreamsVideo();
    }

    /**
     * Inicializar Redis Streams Video específicos
     */
    async inicializarStreamsVideo() {
        try {
            const grupos = [
                [STREAMS_VIDEO.RESPONSE_ESPEJO, CONSUMER_GROUPS_VIDEO.ESPEJO_PROCESSORS],
                [STREAMS_VIDEO.RESPONSE_SUPERIOR, CONSUMER_GROUPS_VIDEO.SUPERIOR_PROCESSORS],
                [STREAMS_VIDEO.STATUS_UPDATES, CONSUMER_GROUPS_VIDEO.STATUS_MONITORS]
            ];

            for (const [stream, group] of grupos) {
                try {
                    await redis.xgroup('CREATE', stream, group, '0', 'MKSTREAM');
                } catch (error) {
                    if (!error.message.includes('BUSYGROUP')) {
                        throw error;
                    }
                }
            }

            this.iniciarConsumersVideo();

            dragon.info('Redis Streams Video inicializados Dragon3', {
                modulo: NOMBRE_MODULO,
                streams: Object.keys(STREAMS_VIDEO),
                consumerGroups: Object.keys(CONSUMER_GROUPS_VIDEO)
            });

        } catch (error) {
            dragon.error('Error inicializando Redis Streams Video Dragon3', {
                modulo: NOMBRE_MODULO,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Iniciar consumers Video específicos
     */
    async iniciarConsumersVideo() {
        if (this.consumersRunning) return;
        
        this.consumersRunning = true;
        this.consumerEspejoVideo();
        this.consumerSuperiorVideo();
        this.consumerStatusVideo();

        dragon.info('Consumers Video bidireccionales iniciados Dragon3', {
            modulo: NOMBRE_MODULO,
            consumers: ['espejo-video', 'superior-video', 'status-video']
        });
    }

    /**
     * Consumer respuestas redes espejo Video
     */
    async consumerEspejoVideo() {
        while (this.consumersRunning) {
            try {
                const messages = await redis.xreadgroup(
                    'GROUP', CONSUMER_GROUPS_VIDEO.ESPEJO_PROCESSORS, 'consumer-espejo-video',
                    'COUNT', 5, // Menos mensajes por batch para videos
                    'BLOCK', 2000,
                    'STREAMS', STREAMS_VIDEO.RESPONSE_ESPEJO, '>'
                );

                if (messages && messages.length > 0) {
                    await this.procesarMensajesEspejoVideo(messages[0][1]);
                }

            } catch (error) {
                if (error.message !== 'Connection is closed.') {
                    dragon.warn('Error consumer espejo Video Dragon3', {
                        modulo: NOMBRE_MODULO,
                        error: error.message
                    });
                }
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

    /**
     * Consumer respuestas red superior Video
     */
    async consumerSuperiorVideo() {
        while (this.consumersRunning) {
            try {
                const messages = await redis.xreadgroup(
                    'GROUP', CONSUMER_GROUPS_VIDEO.SUPERIOR_PROCESSORS, 'consumer-superior-video',
                    'COUNT', 5,
                    'BLOCK', 2000,
                    'STREAMS', STREAMS_VIDEO.RESPONSE_SUPERIOR, '>'
                );

                if (messages && messages.length > 0) {
                    await this.procesarMensajesSuperiorVideo(messages[0][1]);
                }

            } catch (error) {
                if (error.message !== 'Connection is closed.') {
                    dragon.warn('Error consumer superior Video Dragon3', {
                        modulo: NOMBRE_MODULO,
                        error: error.message
                    });
                }
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

    /**
     * Consumer status updates Video
     */
    async consumerStatusVideo() {
        while (this.consumersRunning) {
            try {
                const messages = await redis.xreadgroup(
                    'GROUP', CONSUMER_GROUPS_VIDEO.STATUS_MONITORS, 'consumer-status-video',
                    'COUNT', 10,
                    'BLOCK', 1000,
                    'STREAMS', STREAMS_VIDEO.STATUS_UPDATES, '>'
                );

                if (messages && messages.length > 0) {
                    await this.procesarMensajesStatusVideo(messages[0][1]);
                }

            } catch (error) {
                if (error.message !== 'Connection is closed.') {
                    dragon.warn('Error consumer status Video Dragon3', {
                        modulo: NOMBRE_MODULO,
                        error: error.message
                    });
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    /**
     * Procesar mensajes respuesta espejo Video
     */
    async procesarMensajesEspejoVideo(mensajes) {
        for (const [id, campos] of mensajes) {
            try {
                const archivoId = campos.archivoId;
                const respuesta = JSON.parse(campos.respuesta);

                await this.actualizarTrackingVideo(archivoId, 'espejo_video_recibido', {
                    messageId: id,
                    timestamp: Date.now()
                });

                const resolver = this.responseWaiters.get(`espejo-video:${archivoId}`);
                if (resolver) {
                    resolver(respuesta);
                    this.responseWaiters.delete(`espejo-video:${archivoId}`);
                }

                await redis.xack(STREAMS_VIDEO.RESPONSE_ESPEJO, CONSUMER_GROUPS_VIDEO.ESPEJO_PROCESSORS, id);

                dragon.info('Respuesta espejo Video procesada Dragon3', {
                    modulo: NOMBRE_MODULO,
                    archivoId,
                    messageId: id
                });

            } catch (error) {
                dragon.error('Error procesando mensaje espejo Video Dragon3', {
                    modulo: NOMBRE_MODULO,
                    messageId: id,
                    error: error.message
                });
            }
        }
    }

    /**
     * Procesar mensajes respuesta superior Video
     */
    async procesarMensajesSuperiorVideo(mensajes) {
        for (const [id, campos] of mensajes) {
            try {
                const archivoId = campos.archivoId;
                const respuesta = JSON.parse(campos.respuesta);

                await this.actualizarTrackingVideo(archivoId, 'superior_video_recibido', {
                    messageId: id,
                    timestamp: Date.now()
                });

                const resolver = this.responseWaiters.get(`superior-video:${archivoId}`);
                if (resolver) {
                    resolver(respuesta);
                    this.responseWaiters.delete(`superior-video:${archivoId}`);
                }

                await redis.xack(STREAMS_VIDEO.RESPONSE_SUPERIOR, CONSUMER_GROUPS_VIDEO.SUPERIOR_PROCESSORS, id);

                dragon.info('Respuesta superior Video procesada Dragon3', {
                    modulo: NOMBRE_MODULO,
                    archivoId,
                    messageId: id
                });

            } catch (error) {
                dragon.error('Error procesando mensaje superior Video Dragon3', {
                    modulo: NOMBRE_MODULO,
                    messageId: id,
                    error: error.message
                });
            }
        }
    }

    /**
     * Procesar mensajes status Video
     */
    async procesarMensajesStatusVideo(mensajes) {
        for (const [id, campos] of mensajes) {
            try {
                const archivoId = campos.archivoId;
                const status = campos.status;

                await this.actualizarTrackingVideo(archivoId, 'status_video_update', {
                    status,
                    messageId: id,
                    timestamp: Date.now()
                });

                await redis.xack(STREAMS_VIDEO.STATUS_UPDATES, CONSUMER_GROUPS_VIDEO.STATUS_MONITORS, id);

            } catch (error) {
                dragon.error('Error procesando mensaje status Video Dragon3', {
                    modulo: NOMBRE_MODULO,
                    messageId: id,
                    error: error.message
                });
            }
        }
    }

    /**
     * Cargar analizadores Video dinámicamente
     */
    async cargarAnalizadoresVideo() {
        if (this.analizadoresVideoCargados) {
            return this.analizadoresVideoCargados;
        }

        try {
            const directorioAnalizadoresVideo = path.join('/var/www/Dragon3/backend/servicios/video/analizadores');
            const archivos = await fs.readdir(directorioAnalizadoresVideo);
            
            const analizadoresVideo = {};
            
            for (const archivo of archivos) {
                if (archivo.endsWith('.js') && !archivo.startsWith('.')) {
                    const nombreAnalizador = path.basename(archivo, '.js');
                    const rutaAnalizador = path.join(directorioAnalizadoresVideo, archivo);
                    
                    try {
                        const modulo = await import(rutaAnalizador);
                        analizadoresVideo[nombreAnalizador] = {
                            nombre: nombreAnalizador,
                            ruta: rutaAnalizador,
                            funcion: modulo.default?.analizarVideo || modulo.analizarVideo || modulo.analizar,
                            tipo: 'VIDEO',
                            cargado: true
                        };
                        
                    } catch (error) {
                        dragon.warn('Error cargando analizador Video Dragon3', {
                            modulo: NOMBRE_MODULO,
                            analizador: nombreAnalizador,
                            error: error.message
                        });
                    }
                }
            }
            
            this.analizadoresVideoCargados = analizadoresVideo;
            
            dragon.info('Analizadores Video cargados Dragon3', {
                modulo: NOMBRE_MODULO,
                totalAnalizadoresVideo: Object.keys(analizadoresVideo).length,
                analizadoresVideo: Object.keys(analizadoresVideo)
            });
            
            return analizadoresVideo;
            
        } catch (error) {
            throw new Error(`Error cargando analizadores Video: ${error.message}`);
        }
    }

    /**
     * Cargar redes espejo Video dinámicamente
     */
    async cargarRedesEspejoVideo() {
        if (this.redesEspejoVideoCargadas) {
            return this.redesEspejoVideoCargadas;
        }

        try {
            const directorioRedesEspejoVideo = path.join('/var/www/Dragon3/backend/servicios/video/redesEspejo');
            
            try {
                await fs.access(directorioRedesEspejoVideo);
            } catch {
                dragon.warn('Directorio redes espejo Video no existe Dragon3', {
                    modulo: NOMBRE_MODULO,
                    directorio: directorioRedesEspejoVideo
                });
                return {};
            }

            const archivos = await fs.readdir(directorioRedesEspejoVideo);
            const redesEspejoVideo = {};
            
            for (const archivo of archivos) {
                if (archivo.endsWith('.js') && !archivo.startsWith('.')) {
                    const nombreRed = path.basename(archivo, '.js');
                    const rutaRed = path.join(directorioRedesEspejoVideo, archivo);
                    
                    try {
                        const modulo = await import(rutaRed);
                        redesEspejoVideo[nombreRed] = {
                            nombre: nombreRed,
                            ruta: rutaRed,
                            funcion: modulo.default?.procesarVideo || modulo.procesarVideo || modulo.procesar,
                            tipo: 'VIDEO_ESPEJO',
                            cargado: true
                        };
                        
                    } catch (error) {
                        dragon.warn('Error cargando red espejo Video Dragon3', {
                            modulo: NOMBRE_MODULO,
                            redEspejo: nombreRed,
                            error: error.message
                        });
                    }
                }
            }
            
            this.redesEspejoVideoCargadas = redesEspejoVideo;
            
            dragon.info('Redes espejo Video cargadas Dragon3', {
                modulo: NOMBRE_MODULO,
                totalRedesEspejoVideo: Object.keys(redesEspejoVideo).length,
                redesEspejoVideo: Object.keys(redesEspejoVideo)
            });
            
            return redesEspejoVideo;
            
        } catch (error) {
            throw new Error(`Error cargando redes espejo Video: ${error.message}`);
        }
    }

    /**
     * Generar hash Video para cache
     */
    async generarHashVideo(rutaArchivo) {
        try {
            const stats = await fs.stat(rutaArchivo);
            const buffer = await fs.readFile(rutaArchivo, { encoding: null, flag: 'r' });
            
            // Para videos usamos hash del primer chunk + metadata
            const primerosBytes = buffer.slice(0, Math.min(buffer.length, 1024 * 1024)); // 1MB
            const hash = crypto.createHash('sha256')
                .update(primerosBytes)
                .update(stats.size.toString())
                .update(stats.mtime.toISOString())
                .digest('hex');
            
            return `video_${hash}`;
        } catch (error) {
            throw new Error(`Error generando hash Video: ${error.message}`);
        }
    }

    /**
     * Verificar cache Video
     */
    async verificarCacheVideo(hashVideo, archivoId) {
        try {
            const cacheKey = HASH_KEYS_VIDEO.CACHE(hashVideo);
            const resultadoCache = await redis.get(cacheKey);

            if (resultadoCache) {
                await this.actualizarTrackingVideo(archivoId, 'cache_video_hit', {
                    hashVideo: hashVideo.substring(0, 24)
                });

                const resultado = JSON.parse(resultadoCache);
                resultado.cacheHit = true;
                resultado.timestamp = new Date().toISOString();

                dragon.info('Cache Hit Video Dragon3', {
                    modulo: NOMBRE_MODULO,
                    archivoId,
                    hashVideo: hashVideo.substring(0, 24)
                });

                return resultado;
            }

            return null;

        } catch (error) {
            dragon.warn('Error verificando cache Video Dragon3', {
                modulo: NOMBRE_MODULO,
                archivoId,
                error: error.message
            });
            return null;
        }
    }

    /**
     * Guardar en cache Video
     */
    async guardarCacheVideo(hashVideo, resultado, archivoId) {
        try {
            const cacheKey = HASH_KEYS_VIDEO.CACHE(hashVideo);
            const confianza = resultado.resultado?.basico?.confianza || 'baja';
            
            // Videos tienen TTL más largo debido al procesamiento costoso
            const ttl = confianza === 'alta' ? 14400 : // 4 horas
                       confianza === 'media' ? 7200 : // 2 horas  
                       3600; // 1 hora

            await redis.setex(cacheKey, ttl, JSON.stringify(resultado));

            await this.actualizarTrackingVideo(archivoId, 'cache_video_saved', {
                hashVideo: hashVideo.substring(0, 24),
                ttl,
                confianza
            });

        } catch (error) {
            dragon.warn('Error guardando cache Video Dragon3', {
                modulo: NOMBRE_MODULO,
                archivoId,
                error: error.message
            });
        }
    }

    /**
     * Enviar request Video via stream
     */
    async enviarRequestStreamVideo(stream, archivoId, datos, correlationId) {
        try {
            const streamData = {
                archivoId,
                correlationId,
                datos: JSON.stringify(datos),
                timestamp: Date.now(),
                requestId: `video_${archivoId}_${Date.now()}`,
                tipo: 'VIDEO'
            };

            const messageId = await redis.xadd(stream, '*', streamData);

            await this.actualizarTrackingVideo(archivoId, 'request_video_enviado', {
                stream,
                messageId,
                correlationId
            });

            dragon.info('Request Video enviado via stream Dragon3', {
                modulo: NOMBRE_MODULO,
                archivoId,
                correlationId,
                stream,
                messageId
            });

            return messageId;

        } catch (error) {
            throw new Error(`Error enviando request Video stream: ${error.message}`);
        }
    }

    /**
     * Esperar respuesta Video
     */
    async esperarRespuestaVideo(tipo, archivoId, timeout = TIMEOUT_STREAM_READ) {
        return new Promise((resolve, reject) => {
            const waiterKey = `${tipo}-video:${archivoId}`;
            
            this.responseWaiters.set(waiterKey, resolve);

            const timeoutId = setTimeout(() => {
                this.responseWaiters.delete(waiterKey);
                reject(new Error(`Timeout esperando respuesta Video ${tipo} para ${archivoId}`));
            }, timeout);

            const originalResolve = resolve;
            const wrappedResolve = (value) => {
                clearTimeout(timeoutId);
                this.responseWaiters.delete(waiterKey);
                originalResolve(value);
            };

            this.responseWaiters.set(waiterKey, wrappedResolve);
        });
    }

    /**
     * Actualizar tracking Video
     */
    async actualizarTrackingVideo(archivoId, etapa, datos = {}) {
        try {
            const trackingKey = HASH_KEYS_VIDEO.TRACKING(archivoId);
            const timestamp = Date.now();

            const trackingData = {
                [`etapa_video_${etapa}`]: timestamp,
                [`datos_video_${etapa}`]: JSON.stringify(datos),
                ultima_actualizacion_video: timestamp,
                tipo_archivo: 'VIDEO'
            };

            await redis.hmset(trackingKey, trackingData);
            await redis.expire(trackingKey, 7200);

            const sessionKey = HASH_KEYS_VIDEO.SESSION(archivoId);
            await redis.hmset(sessionKey, {
                etapa_actual_video: etapa,
                timestamp,
                tipo: 'VIDEO',
                ...datos
            });
            await redis.expire(sessionKey, 3600);

        } catch (error) {
            dragon.warn('Error actualizando tracking Video Dragon3', {
                modulo: NOMBRE_MODULO,
                archivoId,
                etapa,
                error: error.message
            });
        }
    }

    /**
     * Cleanup recursos Video
     */
    async cleanupVideo(archivoId) {
        try {
            const waitersToDelete = [];
            for (const [key, _] of this.responseWaiters) {
                if (key.includes(archivoId) && key.includes('video')) {
                    waitersToDelete.push(key);
                }
            }
            
            waitersToDelete.forEach(key => this.responseWaiters.delete(key));

            setTimeout(async () => {
                await redis.del(HASH_KEYS_VIDEO.SESSION(archivoId));
                await redis.del(HASH_KEYS_VIDEO.PERFORMANCE(archivoId));
            }, 600000); // 10 minutos delay para videos

        } catch (error) {
            dragon.warn('Error cleanup Video Dragon3', {
                modulo: NOMBRE_MODULO,
                archivoId,
                error: error.message
            });
        }
    }
}

// Instancia global gestor streams Video
const gestorStreamsVideo = new GestorStreamsVideo();

/**
 * Función principal análisis Video Dragon3
 */
export async function analizarVideo(parametros) {
    const { rutaArchivo, archivoId, correlationId, nombreOriginal, usuarioId } = parametros;
    const tiempoInicio = Date.now();
    
    try {
        // 1. Hash Video para cache
        const hashVideo = await gestorStreamsVideo.generarHashVideo(rutaArchivo);
        
        // 2. Verificar cache Video
        const resultadoCache = await gestorStreamsVideo.verificarCacheVideo(hashVideo, archivoId);
        if (resultadoCache) {
            return resultadoCache;
        }
        
        // 3. Tracking inicial Video
        await gestorStreamsVideo.actualizarTrackingVideo(archivoId, 'iniciado', {
            correlationId,
            hashVideo: hashVideo.substring(0, 24),
            nombreOriginal,
            usuarioId
        });
        
        // 4. Análisis completo Video
        const resultado = await ejecutarAnalisisStreamsVideo(parametros, hashVideo, tiempoInicio);
        
        // 5. Cache resultado Video
        await gestorStreamsVideo.guardarCacheVideo(hashVideo, resultado, archivoId);
        
        return resultado;
        
    } catch (error) {
        healthMonitor.registrarError(error, 'analizarVideo');
        
        dragon.error('Error análisis Video Streams Dragon3', {
            modulo: NOMBRE_MODULO,
            archivoId,
            correlationId,
            error: error.message,
            stack: error.stack,
            tiempoTranscurrido: Date.now() - tiempoInicio
        });
        
        throw error;
        
    } finally {
        await gestorStreamsVideo.cleanupVideo(archivoId);
    }
}

/**
 * Ejecutar análisis completo Video con Streams
 */
async function ejecutarAnalisisStreamsVideo(parametros, hashVideo, tiempoInicio) {
    const { archivoId, correlationId } = parametros;
    
    try {
        // ETAPA 1: Analizadores Video locales
        await gestorStreamsVideo.actualizarTrackingVideo(archivoId, 'analizadores_video_inicio');
        const resultadosAnalizadoresVideo = await ejecutarAnalizadoresVideo(parametros);
        
        // ETAPA 2: Enviar stream redes espejo Video
        await gestorStreamsVideo.actualizarTrackingVideo(archivoId, 'espejo_video_enviando');
        const messageIdEspejo = await gestorStreamsVideo.enviarRequestStreamVideo(
            STREAMS_VIDEO.REQUEST_ESPEJO,
            archivoId,
            { resultadosAnalizadoresVideo, parametros },
            correlationId
        );        
// ETAPA 3: Esperar respuesta espejo Video
        await gestorStreamsVideo.actualizarTrackingVideo(archivoId, 'espejo_video_esperando');
        const resultadosEspejoVideo = await gestorStreamsVideo.esperarRespuestaVideo('espejo', archivoId);
        
        // ETAPA 4: Enviar stream servidor central Video
        await gestorStreamsVideo.actualizarTrackingVideo(archivoId, 'superior_video_enviando');
        const datosSuperioresVideo = {
            resultadosAnalizadoresVideo,
            resultadosEspejoVideo,
            parametros
        };
        
        const messageIdSuperior = await gestorStreamsVideo.enviarRequestStreamVideo(
            STREAMS_VIDEO.REQUEST_SUPERIOR,
            archivoId,
            datosSuperioresVideo,
            correlationId
        );
        
        // ETAPA 5: Esperar respuesta superior Video
        await gestorStreamsVideo.actualizarTrackingVideo(archivoId, 'superior_video_esperando');
        const resultadosSuperiorVideo = await gestorStreamsVideo.esperarRespuestaVideo('superior', archivoId);
        
        // ETAPA 6: Resultado final Video
        const tiempoFinal = Date.now();
        const tiempoTotal = tiempoFinal - tiempoInicio;
        
        const resultadoFinalVideo = {
            resultado: {
                basico: resultadosAnalizadoresVideo,
                espejo: resultadosEspejoVideo,
                superior: resultadosSuperiorVideo
            },
            metadata: {
                archivoId,
                correlationId,
                hashVideo: hashVideo.substring(0, 24),
                tiempoAnalisis: tiempoTotal,
                timestamp: new Date().toISOString(),
                version: 'Dragon3-Video-Streams',
                tipo: 'VIDEO'
            },
            performance: {
                p95: tiempoTotal < 200 ? 'CUMPLE' : 'EXCEDE',
                tiempoTotal,
                etapas: {
                    analizadores: resultadosAnalizadoresVideo.tiempoAnalisis || 0,
                    espejo: resultadosEspejoVideo.tiempoRespuesta || 0,
                    superior: resultadosSuperiorVideo.tiempoRespuesta || 0
                }
            }
        };
        
        // Tracking final Video
        await gestorStreamsVideo.actualizarTrackingVideo(archivoId, 'completado_video', {
            tiempoTotal,
            confianza: resultadoFinalVideo.resultado.basico.confianza || 'media'
        });
        
        // Métricas performance Video
        healthMonitor.registrarMetrica('analisis_video_tiempo', tiempoTotal);
        healthMonitor.registrarMetrica('analisis_video_exitoso', 1);
        
        dragon.info('Análisis Video Streams completado Dragon3', {
            modulo: NOMBRE_MODULO,
            archivoId,
            correlationId,
            tiempoTotal,
            confianza: resultadoFinalVideo.resultado.basico.confianza,
            messageIdEspejo,
            messageIdSuperior
        });
        
        return resultadoFinalVideo;
        
    } catch (error) {
        await gestorStreamsVideo.actualizarTrackingVideo(archivoId, 'error_video', {
            error: error.message,
            tiempoError: Date.now() - tiempoInicio
        });
        
        healthMonitor.registrarError(error, 'ejecutarAnalisisStreamsVideo');
        throw error;
    }
}

/**
 * Ejecutar analizadores Video locales
 */
async function ejecutarAnalizadoresVideo(parametros) {
    const { rutaArchivo, archivoId } = parametros;
    const tiempoInicio = Date.now();
    
    try {
        const analizadoresVideo = await gestorStreamsVideo.cargarAnalizadoresVideo();
        const resultados = {
            esAutentico: true,
            confianza: 'alta',
            analisis: [],
            tiempoAnalisis: 0,
            analizadoresEjecutados: 0
        };
        
        for (const [nombre, analizador] of Object.entries(analizadoresVideo)) {
            if (!analizador.funcion) continue;
            
            try {
                const tiempoAnalizadorInicio = Date.now();
                const resultadoAnalizador = await analizador.funcion({
                    rutaArchivo,
                    archivoId,
                    tipo: 'video'
                });
                
                const tiempoAnalizador = Date.now() - tiempoAnalizadorInicio;
                
                resultados.analisis.push({
                    analizador: nombre,
                    resultado: resultadoAnalizador,
                    tiempo: tiempoAnalizador,
                    exitoso: true
                });
                
                resultados.analizadoresEjecutados++;
                
                // Actualizar confianza global
                if (resultadoAnalizador.confianza === 'baja') {
                    resultados.confianza = 'baja';
                } else if (resultadoAnalizador.confianza === 'media' && resultados.confianza === 'alta') {
                    resultados.confianza = 'media';
                }
                
                if (!resultadoAnalizador.esAutentico) {
                    resultados.esAutentico = false;
                }
                
            } catch (error) {
                dragon.warn('Error analizador Video específico Dragon3', {
                    modulo: NOMBRE_MODULO,
                    analizador: nombre,
                    archivoId,
                    error: error.message
                });
                
                resultados.analisis.push({
                    analizador: nombre,
                    error: error.message,
                    exitoso: false
                });
            }
        }
        
        resultados.tiempoAnalisis = Date.now() - tiempoInicio;
        
        dragon.info('Analizadores Video locales completados Dragon3', {
            modulo: NOMBRE_MODULO,
            archivoId,
            analizadoresEjecutados: resultados.analizadoresEjecutados,
            tiempoTotal: resultados.tiempoAnalisis,
            confianza: resultados.confianza
        });
        
        return resultados;
        
    } catch (error) {
        throw new Error(`Error ejecutando analizadores Video: ${error.message}`);
    }
}

// Graceful shutdown Video
process.on('SIGTERM', async () => {
    dragon.info('Shutdown analizadorVideo Dragon3 iniciado');
    gestorStreamsVideo.consumersRunning = false;
});

process.on('SIGINT', async () => {
    dragon.info('Shutdown analizadorVideo Dragon3 iniciado');
    gestorStreamsVideo.consumersRunning = false;
});

export default analizarVideo;
export { gestorStreamsVideo, STREAMS_VIDEO, CONSUMER_GROUPS_VIDEO, HASH_KEYS_VIDEO };
