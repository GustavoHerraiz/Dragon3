# Respuesta Analítica: Cache Redis y Presión de Memoria en Dragon3

## 1. Causas del cache hit rate 0%

### a) Key Mismatch o Serialización Inconsistente
- **Claves mal construidas:** Las claves usadas en SET y GET podrían diferir por:
  - Parámetros no normalizados (ej: userID vs user_id).
  - Hashing inconsistente (ej: usar SHA256(image) sin considerar metadata).
  - Prefijos dinámicos incorrectos (ej: dev_cache:img_123 vs prod_cache:img_123).

**Diagnóstico:**
```javascript
// Ejemplo de logging para comparar claves
const cacheKey = generateKey(request);
logger.debug(`[CACHE][SET] Key: ${cacheKey}, TTL: ${ttl}`);
```

### b) TTL Cero o Evicción Agresiva
- Si el TTL está configurado en segundos pero se interpreta como milisegundos (EX 10 vs PX 10000), los datos se evictan inmediatamente.

**Diagnóstico:**
```bash
redis-cli TTL "clave_ejemplo"  # Si retorna -2 (no existe) o -1 (sin TTL)
```

### c) Fallo Silencioso en Serialización
- Si el objeto guardado usa un formato incompatible (ej: Buffer vs JSON), GET retorna null sin error.

**Diagnóstico:**
```javascript
// Verificar serialización
redis.set(key, JSON.stringify(data)); // SET
const data = JSON.parse(await redis.get(key)); // GET (falla si no es JSON válido)
```

### d) Lógica de Cache Omitida
- Bug en el flujo donde SET no se ejecuta tras el análisis exitoso, o el GET se salta por condiciones erróneas (ej: if (!forceRefresh) mal evaluado).

---

## 2. Recomendaciones de Diagnóstico/Solución

### a) Verificar Claves y Serialización
- Auditar key builder:
```javascript
// Asegurar consistencia en claves
const generateKey = (request) => `cache:${md5(request.imageURL + request.userAgent)}`;
```
- Inspeccionar datos en Redis:
```bash
redis-cli --scan --pattern "cache:*" | xargs redis-cli dump
```

### b) Monitoreo Avanzado de Redis
- Comandos críticos:
```bash
redis-cli info stats | grep "keyspace_hits\|keyspace_misses"
redis-cli config get maxmemory-policy  # Debe ser volatile-lru/allkeys-lru
redis-cli memory stats  # Verificar fragmentation_ratio
```

### c) Añadir Trazabilidad Estricta
- Inyectar logs con contexto:
```javascript
logger.info(`[CACHE][SET] Key:${key}, Size:${data.length}, TTL:${ttl}`);
logger.info(`[CACHE][GET] Key:${key}, Result:${result ? "HIT" : "MISS"}`);
```

### d) Soluciones Inmediatas
- Forzar un FLUSHDB y monitorizar repoblación de caché.
- Implementar circuit breaker en Redis: Si hit rate < 5% por 5 min, desactivar caché temporalmente.
- Usar redis-memory-analyzer para identificar keys anómalas.

---

## 3. Técnicas de Profiling de Memoria y Cache

### a) Profiling en Node.js
- **Heap Snapshots:**
```bash
node --inspect server.js  # Usar Chrome DevTools para capturar heaps
```
- **Tracing de GC:**
```bash
node --trace-gc --trace-gc-verbose server.js
```
- **Librerías:**
  - clinic.js (CPU + Memoria)
  - memwatch-next para detectar leaks

### b) Redis Profiling
- **Monitor en tiempo real:**
```bash
redis-cli monitor > redis_ops.log
```
- **Slow Log:**
```bash
redis-cli slowlog get 25  # Verificar operaciones > 10ms
```

### c) Correlación Memoria-Caché
- Graficar simultáneamente:
  - Cache hit rate (Prometheus)
  - RSS/Heap de Node.js (Grafana)
  - Memoria usada de Redis (INFO memory)
- Alerta: Si hit rate < 20% y RSS > 90%, escalar emergencia.

---

## 4. Mejores Prácticas para Sistemas Distribuidos con Redis

### a) Caché de Imágenes
- **Claves eficientes:** Usar xxhash (más rápido que SHA) para hashing de imágenes.
- **Compresión:** Almacenar resultados como Protocol Buffers (no JSON) para reducir tamaño.
- **TTL Dinámico:**
```javascript
const ttl = isPremiumUser ? 3600 : 300;  // TTL diferenciado
```

### b) Gestión de Memoria
- **Streams Redis:** Asegurar que los consumer groups lean con XACK.
- **Limitar longitud de streams:** XTRIM ... MAXLEN.
- **Liberación explícita:**
```javascript
// En analizadorImagen.js
function processImage(image) {
  const result = runAIAlgorithm(image);
  image = null; // Liberar referencia
  return result;
}
```

### c) Configuración Redis
- **Directivas clave:**
```bash
maxmemory 16gb  # 80% de RAM física
maxmemory-policy allkeys-lru  # Evicción agresiva
timeout 300  # Desconectar clientes inactivos
```
- Recomendado: Usar redis-stack-server para módulos de búsqueda (ej: RediSearch).

### d) Seguridad y Resiliencia
- **Connection Pooling:** Limitar conexiones con redis.createPool().
- **Rotación de claves:** Credenciales automáticas mediante Vault.
- **Backup RDB/AOF:** Programar snapshots cada 1 hora en sistema distribuido.

---

## Resumen Ejecutivo

**Causa Raíz:**
Falla en la construcción/consulta de claves de Redis + procesamiento redundante agravando presión de memoria.

**Acciones Críticas:**
- Auditar generación de claves y serialización.
- Implementar logging detallado con trazabilidad de operaciones SET/GET.
- Ajustar maxmemory-policy y TTLs.
- Profiling de memoria en Node.js (heap snapshots + clinic.js).
- Plan de escalado horizontal para Redis (cluster + réplicas).

**Impacto Esperado:**
- Recuperar cache hit rate >80%.
- Reducir memoria usada en 40-60% al evitar reprocesamiento.
- Garantizar P95 <200ms.

---
