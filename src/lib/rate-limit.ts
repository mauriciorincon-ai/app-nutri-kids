/**
 * Rate limiting por IP — ventana deslizante en memoria del proceso.
 *
 * Suficiente para una app familiar en serverless (el volumen es bajo y una
 * instancia atiende la ráfaga de una familia). NO es un límite global fuerte:
 * si Vercel escala a varias instancias, cada una lleva su propia cuenta. El ADR
 * de proveedor lo documenta; el endurecimiento (KV/Upstash) es deuda para
 * volumen real (roadmap S3+).
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
};

/**
 * @param key      identificador (IP)
 * @param limit    peticiones permitidas por ventana
 * @param windowMs tamaño de la ventana en ms
 */
export function rateLimit(
  key: string,
  limit = 20,
  windowMs = 60_000,
  now: number = Date.now(),
): RateLimitResult {
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  if (bucket.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return { ok: true, remaining: limit - bucket.count, retryAfterSec: 0 };
}

/** Solo para tests: limpia el estado en memoria. */
export function __resetRateLimit(): void {
  buckets.clear();
}
