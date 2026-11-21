/**
 * La prueba en el teléfono (S12 · mirada de DECISIÓN al cierre de la F1). Quien cuida marca cada
 * cosa que el modelo dijo: ✓ está en la foto, ✗ no está (inventada). Aquí se cuentan las cifras y
 * se arma el texto de «Copiar resultados». Puro: sin la foto, sin nombres de la familia; solo
 * motor, tamaños, tiempos y conteos (y lo que el modelo nombró, que es comida de la cocina).
 */
export type Mark = "yes" | "no" | null;
export type TrialPhoto = { ms: number; seen: { label: string; mark: Mark }[] };

export type TrialMeta = {
  engine: "webgpu" | "wasm";
  modelBytes: number;
  runtimeBytes: number;
  fromCache: boolean;
  loadMs: number;
  agent: string;
};

/** Los umbrales de la prueba que aprobó el dueño (G-Plan del S12). */
export const PASS = { maxMB: 200, maxSeconds: 20, minHits: 7, of: 10, maxInvented: 1 } as const;

export type TrialSummary = {
  photos: number;
  /** Fotos con al menos una cosa marcada ✓. */
  hits: number;
  invented: number;
  unmarked: number;
  medianMs: number;
  maxMs: number;
  totalMB: number;
};

export function summarize(photos: readonly TrialPhoto[], meta: Pick<TrialMeta, "modelBytes" | "runtimeBytes">): TrialSummary {
  const times = photos.map((p) => p.ms).sort((a, b) => a - b);
  const mid = times.length >> 1;
  const medianMs = times.length === 0 ? 0 : times.length % 2 ? times[mid] : Math.round((times[mid - 1] + times[mid]) / 2);
  const marks = photos.flatMap((p) => p.seen.map((s) => s.mark));
  return {
    photos: photos.length,
    hits: photos.filter((p) => p.seen.some((s) => s.mark === "yes")).length,
    invented: marks.filter((m) => m === "no").length,
    unmarked: marks.filter((m) => m === null).length,
    medianMs,
    maxMs: times.at(-1) ?? 0,
    totalMB: Math.round(((meta.modelBytes + meta.runtimeBytes) / 1e6) * 10) / 10,
  };
}

export type Verdict = { size: boolean; speed: boolean; hits: boolean; invented: boolean; complete: boolean };

export function verdict(s: TrialSummary): Verdict {
  return {
    size: s.totalMB > 0 && s.totalMB <= PASS.maxMB,
    speed: s.photos > 0 && s.maxMs <= PASS.maxSeconds * 1000,
    hits: s.hits >= PASS.minHits,
    invented: s.invented <= PASS.maxInvented,
    complete: s.photos >= PASS.of && s.unmarked === 0,
  };
}

/** «Android 14 · Chrome 131» desde el user agent: lo justo para saber en qué se probó. */
export function shortAgent(ua: string): string {
  const os =
    /Android [\d.]+/.exec(ua)?.[0] ??
    (/iPhone OS ([\d_]+)/.exec(ua)?.[1] ? `iOS ${/iPhone OS ([\d_]+)/.exec(ua)![1].replace(/_/g, ".")}` : null) ??
    (/Mac OS X ([\d_]+)/.test(ua) ? "macOS" : null) ??
    (/Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "?");
  const browser =
    /(?:Chrome|CriOS)\/(\d+)/.exec(ua)?.[1] ? `Chrome ${/(?:Chrome|CriOS)\/(\d+)/.exec(ua)![1]}` :
    /Version\/(\d+).*Safari/.exec(ua)?.[1] ? `Safari ${/Version\/(\d+).*Safari/.exec(ua)![1]}` :
    /Firefox\/(\d+)/.exec(ua)?.[1] ? `Firefox ${/Firefox\/(\d+)/.exec(ua)![1]}` : "?";
  return `${os} · ${browser}`;
}

const secs = (ms: number) => (ms / 1000).toFixed(1);

/** El texto plano que se copia. Las etiquetas vienen del idioma activo. */
export function trialText(
  photos: readonly TrialPhoto[],
  meta: TrialMeta,
  t: { title: string; engine: string; size: string; load: string; perPhoto: string; max: string; hits: string; invented: string; fromCache: string; device: string; photo: string },
): string {
  const s = summarize(photos, meta);
  const lines = [
    t.title,
    `${t.device}: ${meta.agent}`,
    `${t.engine}: ${meta.engine === "webgpu" ? "WebGPU" : "WASM"}`,
    `${t.size}: ${s.totalMB} MB${meta.fromCache ? ` (${t.fromCache})` : ""}`,
    `${t.load}: ${secs(meta.loadMs)} s`,
    `${t.perPhoto}: ${secs(s.medianMs)} s (${t.max} ${secs(s.maxMs)} s)`,
    `${t.hits}: ${s.hits}/${s.photos}`,
    `${t.invented}: ${s.invented}`,
    ...photos.map(
      (p, i) =>
        `${t.photo} ${i + 1} · ${secs(p.ms)} s · ` +
        (p.seen.length ? p.seen.map((x) => `${x.mark === "yes" ? "✓" : x.mark === "no" ? "✗" : "·"} ${x.label}`).join(", ") : "—"),
    ),
  ];
  return lines.join("\n");
}
