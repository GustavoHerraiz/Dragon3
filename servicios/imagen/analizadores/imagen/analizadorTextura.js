/**
 * @file analizadorTexturas.js
 * @version 3.2.2
 * @author GustavoHerraiz (mejoras por @copilot)
 * @lastModified 2025-05-25 14:43:30 
 * @description Analizador avanzado de texturas: métricas refinadas, pirámide Gaussiana y SSIM para patronesRepetitivos.
 */

import fs from 'fs';
import sharp from 'sharp';
import { log } from "../../utilidades/logger.js";

// Configuración de textura
const TextureConfig = {
    thresholds: {
        patrones: {
            minDesplazamiento: 3,
        }
    },
    piramide: {
        nivelesPatrones: 3
    }
};

// ------------------------ AUXILIARES PIRÁMIDE/SSIM ------------------------

const extraerBloque = (data, dataWidth, startX, startY, blockSize) => {
    const bloque = new Uint8ClampedArray(blockSize * blockSize);
    const dataHeight = Math.floor(data.length / dataWidth);

    if (startX < 0 || startY < 0 || 
        startX + blockSize > dataWidth || 
        startY + blockSize > dataHeight) {
        return null;
    }
    for (let y = 0; y < blockSize; y++) {
        for (let x = 0; x < blockSize; x++) {
            const pixelIndex = (startY + y) * dataWidth + (startX + x);
            bloque[y * blockSize + x] = data[pixelIndex];
        }
    }
    return bloque;
};

const calcularSimilitudEstructural = (bloque1, bloque2, ventanaSize = 5, C1 = (0.01 * 255)**2, C2 = (0.03 * 255)**2) => {
    if (!bloque1 || !bloque2 || bloque1.length !== bloque2.length || bloque1.length !== ventanaSize * ventanaSize) return 0;
    let media1 = 0, media2 = 0, varianza1 = 0, varianza2 = 0, covarianza = 0, n = bloque1.length;
    for (let i = 0; i < n; i++) { media1 += bloque1[i]; media2 += bloque2[i]; }
    media1 /= n; media2 /= n;
    for (let i = 0; i < n; i++) {
        varianza1 += (bloque1[i] - media1) ** 2;
        varianza2 += (bloque2[i] - media2) ** 2;
        covarianza += (bloque1[i] - media1) * (bloque2[i] - media2);
    }
    varianza1 /= n; varianza2 /= n; covarianza /= n;
    const numerador = (2 * media1 * media2 + C1) * (2 * covarianza + C2);
    const denominador = (media1**2 + media2**2 + C1) * (varianza1 + varianza2 + C2);
    if (denominador === 0) return (numerador === 0) ? 1 : 0;
    return Math.max(0, numerador / denominador);
};

const downscaleBy2 = (sourceData, sourceWidth, sourceHeight) => {
    const destWidth = Math.floor(sourceWidth / 2);
    const destHeight = Math.floor(sourceHeight / 2);
    if (destWidth < TextureConfig.thresholds.patrones.minDesplazamiento + 5 || destHeight < 5) return null;
    const destData = new Uint8ClampedArray(destWidth * destHeight);
    for (let y = 0; y < destHeight; y++) {
        for (let x = 0; x < destWidth; x++) {
            const srcY = y * 2, srcX = x * 2;
            let sum = 0, count = 0;
            for (let dy = 0; dy < 2; dy++) {
                for (let dx = 0; dx < 2; dx++) {
                    if ((srcY + dy) < sourceHeight && (srcX + dx) < sourceWidth) {
                        sum += sourceData[(srcY + dy) * sourceWidth + (srcX + dx)];
                        count++;
                    }
                }
            }
            destData[y * destWidth + x] = count > 0 ? Math.round(sum / count) : 0;
        }
    }
    return { data: destData, width: destWidth, height: destHeight };
};

const construirPiramideGaussiana = async (data, width, height, numNivelesSolicitados) => {
    const piramide = [];
    let currentData = data, currentWidth = width, currentHeight = height;
    for (let i = 0; i < numNivelesSolicitados; i++) {
        if (!currentData || currentWidth < 10 || currentHeight < 10) break;
        piramide.push([i, { data: currentData, width: currentWidth, height: currentHeight }]);
        if (i < numNivelesSolicitados - 1) {
            const nextLevel = downscaleBy2(currentData, currentWidth, currentHeight);
            if (!nextLevel) break;
            currentData = nextLevel.data;
            currentWidth = nextLevel.width;
            currentHeight = nextLevel.height;
        }
    }
    if (piramide.length === 0 && data && width >=10 && height >=10) {
         piramide.push([0, { data: data, width: width, height: height }]);
    }
    return piramide;
};

const aplicarFuncionUmbral = (correlationValue) => {
    let result = Math.pow(Math.max(0, correlationValue), 1.5);
    return Math.min(1, Math.max(0.01, result));
};

const calcularCorrelacionEstructural = async (data, width, height, dx) => {
    let sumSSIM = 0, muestrasValidas = 0;
    const pasoY = Math.max(1, Math.floor(height / 30));
    const pasoX = Math.max(1, Math.floor((width - dx) / 50));
    const blockSize = 5;
    for (let y = 0; y < height - blockSize; y += pasoY) {
        for (let x = 0; x < width - dx - blockSize; x += pasoX) {
            const bloqueOriginal = extraerBloque(data, width, x, y, blockSize);
            const bloqueDesplazado = extraerBloque(data, width, x + dx, y, blockSize);
            if (!bloqueOriginal || !bloqueDesplazado) continue;
            sumSSIM += calcularSimilitudEstructural(bloqueOriginal, bloqueDesplazado, blockSize);
            muestrasValidas++;
        }
    }
    return {
        correlacion: muestrasValidas > 0 ? sumSSIM / muestrasValidas : 0,
        muestras: muestrasValidas
    };
};

// ------------------------ MÉTRICA DE PATRONES REPETITIVOS AVANZADA ------------------------

const calcularPatronesRepetitivos = async (data, width, height) => {
    log.info(`[Textura v3.2.2] Iniciando calcularPatronesRepetitivos con SSIM y Pirámide.`);
    const pyramid = await construirPiramideGaussiana(data, width, height, TextureConfig.piramide.nivelesPatrones);
    const configPatrones = TextureConfig.thresholds.patrones;
    let maxWeightedCorrelation = 0;
    if (pyramid.length === 0) {
        log.warn("[Textura v3.2.2] Pirámide Gaussiana vacía, no se pueden calcular patrones repetitivos.");
        return 0.01;
    }
    for (const [nivel, { data: nivelData, width: nivelWidth, height: nivelHeight }] of pyramid) {
        const desplazamientos = [
            Math.max(configPatrones.minDesplazamiento, Math.floor(nivelWidth * 0.05)),
            Math.max(configPatrones.minDesplazamiento, Math.floor(nivelWidth * 0.15))
        ].filter(d => d < nivelWidth / 2 && d >= configPatrones.minDesplazamiento);
        if (desplazamientos.length === 0) continue;
        for (const dx of desplazamientos) {
            if (dx <= 0 || nivelWidth - dx <= 5) continue;
            const { correlacion, muestras } = await calcularCorrelacionEstructural(
                nivelData, 
                nivelWidth, 
                nivelHeight,
                dx
            );
            if (muestras > 20) {
                let weightedCorr = correlacion * (1 - 0.15 * nivel);
                if (correlacion > 0.95) weightedCorr *= 0.8;
                maxWeightedCorrelation = Math.max(maxWeightedCorrelation, weightedCorr);
            }
        }
    }
    log.info(`[Textura v3.2.2] maxWeightedCorrelation para patronesRepetitivos (antes de umbral): ${maxWeightedCorrelation}`);
    return aplicarFuncionUmbral(maxWeightedCorrelation);
};

// ------------------------ ANALIZADOR PRINCIPAL ------------------------

/**
 * Analiza patrones de textura en una imagen.
 * @param {string} rutaArchivo - Ruta de la imagen a analizar.
 * @returns {Promise<Object>} - Resultado del análisis.
 */
export const analizar = async (rutaArchivo) => {
    const resultado = {
        nombreAnalizador: "ANÁLISIS_DE_TEXTURA",
        descripcion: "Evalúa texturas para detectar patrones de generación sintética. `patronesRepetitivos` con SSIM/Pirámide.",
        version: "3.2.2",
        fechaAnalisis: new Date().toISOString(),
        score: null, 
        detalles: {
            mensaje: "Análisis no procesado correctamente."
        },
        metadatos: {} 
    };

    try {
        if (!fs.existsSync(rutaArchivo)) {
            log.warn(`[Textura v3.2.2] El archivo no existe: ${rutaArchivo}`);
            throw new Error("El archivo no existe");
        }
        log.info(`[Textura v3.2.2] Iniciando análisis: ${rutaArchivo}`);
        const image = sharp(rutaArchivo);
        const { data, info } = await image.greyscale().raw().toBuffer({ resolveWithObject: true });
        const { width, height } = info;
        log.debug(`[Textura v3.2.2] Imagen cargada: ${rutaArchivo}, W: ${width}, H: ${height}`);
        const tamañoVentana = Math.max(5, Math.min(25, Math.floor(Math.sqrt((width * height) / 1000000) * 3)));
        log.debug(`[Textura v3.2.2] Usando ventana ${tamañoVentana}x${tamañoVentana}`);
        const parametrosCrudos = await extraerParametros(data, width, height, tamañoVentana); 
        const altaResolucion = width * height > 10000000; 
        if (altaResolucion) {
            log.info("[Textura v3.2.2] Aplicando corrección para imagen de alta resolución");
            ajustarParametrosAltaResolucion(parametrosCrudos);
        }
        resultado.metadatos = {
            complejidadTextura: parametrosCrudos[0],
            uniformidadTextura: parametrosCrudos[1],
            patronesRepetitivos: parametrosCrudos[2],
            variacionLocal: parametrosCrudos[3],
            densidadBordes: parametrosCrudos[4],
            contrasteMicro: parametrosCrudos[5],
            escalaTextural: parametrosCrudos[6],
            anisotropiaTextural: parametrosCrudos[7],
            rugosidadEstadistica: parametrosCrudos[8],
            entropiaGlobal: parametrosCrudos[9]
        };
        const pesos = [
            0.18, // complejidadTextura
            0.12, // uniformidadTextura (invertido)
            0.20, // patronesRepetitivos (invertido)
            0.10, // variacionLocal
            0.04, // densidadBordes
            0.05, // contrasteMicro (invertido)
            0.02, // escalaTextural
            0.08, // anisotropiaTextural (invertido)
            0.06, // rugosidadEstadistica
            0.15  // entropiaGlobal
        ];
        const indicesParametrosInvertidosParaScore = [1, 2, 5, 7];
        let scoreParcial = 0;
        parametrosCrudos.forEach((valorCrudo, i) => {
            let valorParaScore = valorCrudo;
            if (indicesParametrosInvertidosParaScore.includes(i)) valorParaScore = 1 - valorCrudo;
            scoreParcial += valorParaScore * pesos[i];
        });
        resultado.score = parseFloat((scoreParcial * 10).toFixed(2));
        resultado.detalles.mensaje = generarMensaje(resultado.score);
        log.info(`[Textura v3.2.2] Análisis completado. Score: ${resultado.score}/10. Metadatos crudos: ${JSON.stringify(resultado.metadatos)}`);
        return resultado;
    } catch (error) {
        log.error(`[Textura v3.2.2] Error en análisis para ${rutaArchivo}: ${error.message}`, { stack: error.stack });
        resultado.detalles.mensaje = `Error durante el análisis: ${error.message}`;
        resultado.metadatos = { 
            complejidadTextura: 0.0, uniformidadTextura: 0.0, patronesRepetitivos: 0.0,
            variacionLocal: 0.0, densidadBordes: 0.0, contrasteMicro: 0.0,
            escalaTextural: 0.0, anisotropiaTextural: 0.0, rugosidadEstadistica: 0.0, entropiaGlobal: 0.0
        };
        resultado.score = null; 
        return resultado;
    }
};

// ------------------------ EXTRACCIÓN DE PARÁMETROS Y UTILIDADES ------------------------

function ajustarParametrosAltaResolucion(parametros) {
    log.debug('[Textura v3.2.2] Ajustando parámetros para alta resolución (lógica v3.2.0).');
    parametros[0] = Math.max(0.2, parametros[0]); 
    parametros[1] = Math.max(0.1, parametros[1]); 
    parametros[2] = Math.max(0.05, parametros[2]);
    parametros[6] = Math.max(0.15, parametros[6]);
    parametros[7] = Math.min(0.85, parametros[7]);
}

async function extraerParametros(data, width, height, tamañoVentana) {
    const fallbackParams = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
    try {
        const maxMuestras = Math.min(500, Math.floor((width * height) / 2000)); 
        const params = new Array(10).fill(0);
        const iluminacionInfo = detectarIluminacionNoUniforme(data, width, height);
        const tieneIluminacionNoUniforme = iluminacionInfo.desbalance > 2.0; 
        // 0: complejidadTextura
        let complejidadCalculada = await calcularEstadisticaOptimizada(
            data, width, height, tamañoVentana, maxMuestras, 
            (stats) => (stats.desviacionMedia * 0.6 + stats.entropiaLocal * 0.4),
            false, 
            iluminacionInfo
        );
        params[0] = Math.max(0.01, complejidadCalculada); 
        if (tieneIluminacionNoUniforme) params[0] *= Math.min(1.3, 1 + (iluminacionInfo.desbalance - 1) * 0.2); 
        // 1: uniformidadTextura
        let uniformidadCalculada = await calcularUniformidad(data, width, height, tamañoVentana, maxMuestras, iluminacionInfo);
        params[1] = Math.min(0.99, Math.max(0.01, uniformidadCalculada));
        if (tieneIluminacionNoUniforme) params[1] *= Math.max(0.7, 1 - (iluminacionInfo.desbalance - 1) * 0.15);
        // 2: patronesRepetitivos
        params[2] = await calcularPatronesRepetitivos(data, width, height);
        log.debug(`[Textura v3.2.2] patronesRepetitivos (SSIM/Pirámide resultado en extraerParametros): ${params[2]}`);
        // 3: variacionLocal
        let variacionCalculada = await calcularEstadisticaOptimizada(
            data, width, height, Math.max(2, Math.floor(tamañoVentana/3)), maxMuestras,
            (stats) => Math.min(1, stats.desviacionNormalizada * 0.5 + stats.gradienteSobelNormalizado * 0.5),
            false,
            iluminacionInfo
        );
        params[3] = Math.max(0.01, variacionCalculada);
        // 4: densidadBordes
        let densidadCalculada = await calcularDensidadBordes(data, width, height);
        params[4] = Math.max(0.01, densidadCalculada);
        // 5: contrasteMicro
        params[5] = await calcularContrasteMicroRefinado(data, width, height); 
        // 6: escalaTextural
        let escalaCalculada = await calcularEscalaTextural(data, width, height, tamañoVentana, maxMuestras, iluminacionInfo);
        params[6] = Math.max(0.01, escalaCalculada);
        // 7: anisotropiaTextural
        let anisotropiaCalculada = await calcularAnisotropiaTextural(data, width, height);
        params[7] = anisotropiaCalculada; 
        if (tieneIluminacionNoUniforme) params[7] *= Math.max(0.8, 1 - (iluminacionInfo.desbalance - 1) * 0.1);
        // 8: rugosidadEstadistica
        let rugosidadCalculada = await calcularEstadisticaOptimizada(data, width, height, tamañoVentana, maxMuestras/2,
            (stats) => stats.rugosidadSobel, 
            false, 
            iluminacionInfo
        );
        params[8] = Math.max(0.01, rugosidadCalculada);
        // 9: entropiaGlobal
        params[9] = await calcularEntropiaGlobal(data, width, height); 
        return params.map(p => Math.max(0, Math.min(1, parseFloat(p.toFixed(4)))));
    } catch (error) {
        log.error(`[Textura v3.2.2] Error extrayendo parámetros: ${error.message}`, { stack: error.stack });
        return fallbackParams;
    }
}

function detectarIluminacionNoUniforme(data, width, height) {
    const cuadrantes = [
        {x1: 0, y1: 0, x2: Math.floor(width/2), y2: Math.floor(height/2)},
        {x1: Math.floor(width/2), y1: 0, x2: width, y2: Math.floor(height/2)},
        {x1: 0, y1: Math.floor(height/2), x2: Math.floor(width/2), y2: height},
        {x1: Math.floor(width/2), y1: Math.floor(height/2), x2: width, y2: height}
    ];
    const muestrasPorCuadrante = 50;
    const stats = cuadrantes.map(() => ({ suma: 0, count: 0, media: 0 }));
    cuadrantes.forEach((cuadrante, idx) => {
        for (let i = 0; i < muestrasPorCuadrante; i++) {
            const x = Math.floor(cuadrante.x1 + Math.random() * (cuadrante.x2 - cuadrante.x1));
            const y = Math.floor(cuadrante.y1 + Math.random() * (cuadrante.y2 - cuadrante.y1));
            if (x < 0 || y < 0 || x >= width || y >= height) continue;
            const pixelIdx = y * width + x;
            if (pixelIdx >= 0 && pixelIdx < data.length) {
                stats[idx].suma += data[pixelIdx];
                stats[idx].count++;
            }
        }
    });
    stats.forEach(s => { s.media = s.count > 0 ? s.suma / s.count : 0; });
    let maxMedia = 0, minMedia = 255;
    stats.forEach(s => {
        if (s.media > maxMedia) { maxMedia = s.media; }
        if (s.media < minMedia && s.media > 0) { minMedia = s.media; } 
    });
    const minMediaSegura = Math.max(minMedia, 1e-6); 
    const desbalance = minMediaSegura > 0 ? maxMedia / minMediaSegura : 1; 
    const mapaIluminacion = stats.map(s => (maxMedia > 0 ? s.media / maxMedia : (s.media === 0 ? 0 : 1)) ); 
    const dominancia = Math.max(...mapaIluminacion) / (mapaIluminacion.reduce((sum, v) => sum + v, 0) / mapaIluminacion.length || 1); 
    return { desbalance, dominancia, mapa: mapaIluminacion };
}

async function calcularEstadisticaOptimizada(data, width, height, tamañoVentana, maxMuestras, transformador, invertir, iluminacionInfo) {
    let suma = 0;
    const muestras = Math.min(maxMuestras, Math.max(100, Math.floor(width * height / 2000)));
    let muestrasEfectivas = 0;
    const procesarMuestra = (x, y) => {
        if (x >= tamañoVentana && x < width - tamañoVentana && y >= tamañoVentana && y < height - tamañoVentana) {
            const stats = analizarVentanaRefinada(data, width, x, y, tamañoVentana);
            suma += transformador(stats);
            muestrasEfectivas++;
        }
    };
    if (iluminacionInfo && iluminacionInfo.desbalance > 1.4 && iluminacionInfo.mapa && iluminacionInfo.mapa.length === 4) {
        for (let idx = 0; idx < 4; idx++) {
            const factorMuestreo = (iluminacionInfo.mapa[idx] < 0.5 && iluminacionInfo.mapa[idx] > 0) ? 1.5 : (iluminacionInfo.mapa[idx] > 0.8 ? 0.7 : 1.0);
            const muestrasEnCuadrante = Math.max(1, Math.floor(muestras * factorMuestreo / 4)); 
            const esParX = idx % 2 === 1;
            const esParY = idx >= 2;
            const x1 = esParX ? Math.floor(width/2) : 0;
            const x2 = esParX ? width : Math.floor(width/2);
            const y1 = esParY ? Math.floor(height/2) : 0; 
            const y2 = esParY ? height : Math.floor(height/2);
            for (let i = 0; i < muestrasEnCuadrante && muestrasEfectivas < muestras; i++) {
                const randX = Math.floor(x1 + Math.random() * (x2 - x1));
                const randY = Math.floor(y1 + Math.random() * (y2 - y1));
                procesarMuestra(randX, randY);
            }
        }
    } else {
        for (let i = 0; i < muestras && muestrasEfectivas < muestras; i++) {
            const randX = Math.floor(Math.random() * width);
            const randY = Math.floor(Math.random() * height);
            procesarMuestra(randX, randY);
        }
    }
    if (muestrasEfectivas === 0) {
        log.warn('[Textura v3.2.2] No se tomaron muestras efectivas en calcularEstadisticaOptimizada.');
        return invertir ? 1 : 0;
    }
    return invertir ? 1 - (suma / muestrasEfectivas) : (suma / muestrasEfectivas);
}

const sobelXKernel = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
const sobelYKernel = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

function aplicarKernel(data, width, centerX, centerY, kernel) {
    let gx = 0;
    const imageHeight = Math.floor(data.length / width);
    for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
            const px = centerX + kx; 
            const py = centerY + ky;
            if (px >= 0 && px < width && py >= 0 && py < imageHeight) {
                gx += data[py * width + px] * kernel[ky + 1][kx + 1];
            }
        }
    }
    return gx;
}

function analizarVentanaRefinada(data, width, centerX, centerY, radio) {
    let suma = 0, sumaSq = 0, count = 0, gradSobelMagnitudes = [], histLocal = new Array(256).fill(0);
    const imageHeight = Math.floor(data.length / width);
    for (let y = centerY - radio; y <= centerY + radio; y++) {
        for (let x = centerX - radio; x <= centerX + radio; x++) {
            if (x >= 0 && x < width && y >= 0 && y < imageHeight) {
                const idx = y * width + x;
                const val = data[idx];
                suma += val;
                sumaSq += val * val;
                histLocal[val]++;
                count++;
                if (x > 0 && x < width -1 && y > 0 && y < imageHeight -1) { 
                    const gx = aplicarKernel(data, width, x, y, sobelXKernel);
                    const gy = aplicarKernel(data, width, x, y, sobelYKernel);
                    gradSobelMagnitudes.push(Math.sqrt(gx * gx + gy * gy));
                }
            }
        }
    }
    if (count === 0) { 
        return { media: 0, desviacionNormalizada: 0, gradienteSobelNormalizado: 0, rugosidadSobel: 0, entropiaLocal: 0, desviacionMedia: 0 };
    }
    const media = suma / count;
    const varianza = (sumaSq / count) - (media * media);
    const desviacion = Math.sqrt(Math.max(0, varianza)); 
    let entropiaLocal = 0;
    for (let i = 0; i < 256; i++) {
        if (histLocal[i] > 0) entropiaLocal -= (histLocal[i] / count) * Math.log2(histLocal[i] / count);
    }
    entropiaLocal /= 8; 
    let gradienteSobelSuma = 0, gradienteSobelSumaSq = 0;
    if (gradSobelMagnitudes.length > 0) {
        gradSobelMagnitudes.forEach(m => { gradienteSobelSuma += m; gradienteSobelSumaSq += m * m; });
    }
    const gradienteSobelPromedio = gradSobelMagnitudes.length > 0 ? gradienteSobelSuma / gradSobelMagnitudes.length : 0;
    const varianzaGradientes = gradSobelMagnitudes.length > 0 ? (gradienteSobelSumaSq / gradSobelMagnitudes.length) - (gradienteSobelPromedio * gradienteSobelPromedio) : 0;
    const desviacionGradientes = Math.sqrt(Math.max(0, varianzaGradientes));
    return {
        media: media / 255, 
        desviacionNormalizada: desviacion / (media || 1) / 0.5, 
        desviacionMedia: desviacion / (media || 1), 
        gradienteSobelNormalizado: Math.min(1, gradienteSobelPromedio / 100), 
        rugosidadSobel: Math.min(1, desviacionGradientes / 50), 
        entropiaLocal: Math.min(1, entropiaLocal)
    };
}

async function calcularUniformidad(data, width, height, tamañoVentana, maxMuestras, iluminacionInfo) {
    const regiones = Math.min(9, Math.max(4, Math.floor(Math.sqrt(width * height / 40000)))); 
    const desviacionesRegionales = [];
    const factorCorreccionIluminacion = iluminacionInfo && iluminacionInfo.desbalance > 1.4 && iluminacionInfo.mapa && iluminacionInfo.mapa.length === 4;
    const colsRegiones = Math.floor(Math.sqrt(regiones));
    const rowsRegiones = Math.ceil(regiones / colsRegiones);
    for (let r = 0; r < regiones; r++) {
        const colIdx = r % colsRegiones;
        const rowIdx = Math.floor(r / colsRegiones);
        const regionX = Math.floor(colIdx * width / colsRegiones);
        const regionY = Math.floor(rowIdx * height / rowsRegiones);
        const regionWidth = Math.floor(width / colsRegiones);
        const regionHeight = Math.floor(height / rowsRegiones);
        let sumaDesviacionesRegion = 0;
        let countVentanasRegion = 0;
        const muestrasPorRegion = Math.max(3, Math.floor(maxMuestras / regiones / 5)); 
        for(let i=0; i < muestrasPorRegion; i++) {
            const sx = regionX + tamañoVentana + Math.floor(Math.random() * Math.max(0, regionWidth - 2 * tamañoVentana));
            const sy = regionY + tamañoVentana + Math.floor(Math.random() * Math.max(0, regionHeight - 2 * tamañoVentana));
            if (sx >= tamañoVentana && sx < width - tamañoVentana && sy >= tamañoVentana && sy < height - tamañoVentana) {
                const stats = analizarVentanaRefinada(data, width, sx, sy, tamañoVentana);
                let desviacionCorregida = stats.desviacionNormalizada * (stats.media * 255 || 1); 
                if (factorCorreccionIluminacion) {
                    const cuadranteX = sx < width/2 ? 0 : 1;
                    const cuadranteY = sy < height/2 ? 0 : 1;
                    const idxCuadrante = cuadranteY * 2 + cuadranteX;
                    const factorIluminacion = iluminacionInfo.mapa[idxCuadrante];
                    if (factorIluminacion < 0.7 && factorIluminacion > 0) desviacionCorregida *= Math.min(1.3, 1 / factorIluminacion);
                }
                sumaDesviacionesRegion += desviacionCorregida;
                countVentanasRegion++;
            }
        }
        if(countVentanasRegion > 0) desviacionesRegionales.push(sumaDesviacionesRegion / countVentanasRegion);
    }
    if (desviacionesRegionales.length < 2) return 0.5; 
    const mediaDesviaciones = desviacionesRegionales.reduce((sum, v) => sum + v, 0) / desviacionesRegionales.length;
    const varianzaDesviaciones = desviacionesRegionales.reduce((sum, v) => sum + Math.pow(v - mediaDesviaciones, 2), 0) / desviacionesRegionales.length;
    const coeficienteVariacion = Math.sqrt(varianzaDesviaciones) / (mediaDesviaciones || 1); 
    return Math.min(0.99, Math.max(0.01, 1 - Math.min(1, coeficienteVariacion * 1.8))); 
}

async function calcularDensidadBordes(data, width, height) {
    const muestras = Math.min(20000, Math.max(100, Math.floor(width * height / 10))); 
    if (muestras < 100) return 0.1; 
    let sumaMagnitudGradiente = 0;
    let puntosValidos = 0;
    for (let i = 0; i < muestras; i++) {
        const x = 1 + Math.floor(Math.random() * (width - 2)); 
        const y = 1 + Math.floor(Math.random() * (height - 2));
        const gx = aplicarKernel(data, width, x, y, sobelXKernel);
        const gy = aplicarKernel(data, width, x, y, sobelYKernel);
        sumaMagnitudGradiente += Math.sqrt(gx * gx + gy * gy);
        puntosValidos++;
    }
    if (puntosValidos === 0) return 0.1; 
    const densidadMediaGradiente = sumaMagnitudGradiente / puntosValidos;
    return Math.max(0.01, Math.min(1, densidadMediaGradiente / 70)); 
}

async function calcularContrasteMicroRefinado(data, width, height) {
    const muestras = 200; 
    let sumaDesviacionesMicro = 0;
    let ventanasProcesadas = 0;
    if (width < 3 || height < 3) return 0.5; 
    for (let i = 0; i < muestras; i++) {
        const cx = 1 + Math.floor(Math.random() * (width - 2)); 
        const cy = 1 + Math.floor(Math.random() * (height - 2));
        let microSuma = 0, microSumaSq = 0, microCount = 0;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const val = data[(cy + dy) * width + (cx + dx)];
                microSuma += val; microSumaSq += val * val; microCount++;
            }
        }
        if (microCount > 0) { 
            const microMedia = microSuma / microCount;
            const microVarianza = (microSumaSq / microCount) - (microMedia * microMedia);
            sumaDesviacionesMicro += Math.sqrt(Math.max(0, microVarianza)); 
            ventanasProcesadas++;
        }
    }
    if (ventanasProcesadas === 0) return 0.5; 
    const contrasteMedio = sumaDesviacionesMicro / ventanasProcesadas; 
    return Math.max(0.01, Math.min(0.99, 1 - Math.min(1, contrasteMedio / 40))); 
}

async function calcularEscalaTextural(data, width, height, tamañoVentanaOriginal, maxMuestras, iluminacionInfo) {
    const resultadoEscala = await calcularEstadisticaOptimizada(data, width, height, tamañoVentanaOriginal, maxMuestras,
        (stats) => stats.desviacionNormalizada * (stats.media*255) / 15, 
        false, 
        iluminacionInfo
    );
    return Math.min(1, Math.max(0, resultadoEscala));
}

async function calcularAnisotropiaTextural(data, width, height) {
    const muestras = Math.min(1000, Math.max(100, Math.floor(width*height/500))); 
    if (muestras < 100 || width < 3 || height < 3) return 0.5; 
    const histogramaAngulos = new Array(18).fill(0); 
    let gradientesSignificativos = 0;
    for (let i = 0; i < muestras; i++) {
        const x = 1 + Math.floor(Math.random() * (width - 2));
        const y = 1 + Math.floor(Math.random() * (height - 2));
        const gx = aplicarKernel(data, width, x, y, sobelXKernel);
        const gy = aplicarKernel(data, width, x, y, sobelYKernel);
        const magnitud = Math.sqrt(gx * gx + gy * gy);
        if (magnitud > 20) { 
            gradientesSignificativos++;
            let angulo = Math.atan2(gy, gx) * (180 / Math.PI); 
            if (angulo < 0) angulo += 180; 
            if (angulo >= 180) angulo = 179.9; 
            const bin = Math.floor(angulo / 10);
            if (bin >=0 && bin < 18) histogramaAngulos[bin]++;
        }
    }
    if (gradientesSignificativos < 50) return 0.5; 
    const totalEnHist = histogramaAngulos.reduce((sum, val) => sum + val, 0);
    if (totalEnHist === 0) return 0.5;
    const histNormalizado = histogramaAngulos.map(val => val / totalEnHist);
    let entropiaDirecciones = 0;
    for (const p of histNormalizado) {
        if (p > 0) entropiaDirecciones -= p * Math.log2(p);
    }
    const entropiaNormalizada = entropiaDirecciones / Math.log2(18); 
    return Math.min(0.99, Math.max(0.01, 1 - entropiaNormalizada));
}

async function calcularEntropiaGlobal(data, width, height) {
    const pasoMuestreo = Math.max(1, Math.floor((width * height) / 50000)); 
    const histograma = new Array(256).fill(0);
    let totalMuestras = 0;
    for (let i = 0; i < data.length; i += pasoMuestreo) {
        histograma[data[i]]++;
        totalMuestras++;
    }
    if (totalMuestras === 0) return 0.1; 
    const entropia = -histograma
        .map(h => h / totalMuestras) 
        .filter(p => p > 0) 
        .reduce((sum, p) => sum + p * Math.log2(p), 0);
    return Math.max(0.01, Math.min(1, entropia / 8)); 
}

function generarMensaje(score) {
    if (score === null) return "Análisis fallido o no disponible.";
    if (score >= 7.0) return "La imagen presenta texturas con características predominantemente naturales y orgánicas.";
    if (score >= 5.0) return "La imagen muestra texturas con algunas irregularidades o características que podrían sugerir origen sintético. Requiere análisis cuidadoso.";
    return "La imagen presenta patrones texturales con fuertes indicios de artificialidad, sugestivos de generación por IA.";
}