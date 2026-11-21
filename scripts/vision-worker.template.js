/**
 * El worker que mira la foto (S12 · ADR-018). PLANTILLA: `scripts/build-sw.mjs` la estampa en
 * `public/ia/vision-worker.js` con la config de `src/lib/camera/model.json`. Ninguna ruta de la
 * app lo importa: la pantalla de la cámara lo crea con una URL literal y solo tras el toque.
 *
 * Lo que hace y lo que NO:
 *  - Carga el runtime desde la propia app (`/ia/`, ninguna CDN) y los pesos del Hub público,
 *    fijados por commit; quedan en la caché del navegador para usarse sin red.
 *  - La foto llega como píxeles en memoria, se analiza y se suelta: no se guarda ni sale.
 *  - `guardedFetch` es la ÚNICA red del worker: solo GET, sin cuerpo, solo a la app o al Hub.
 *  - Devuelve TEXTO. Qué es un alimento, su semáforo y la receta los decide el código de la app.
 */
const MODEL = __MODEL__;
const RUNTIME = "/ia/transformers.min.js";

let tf = null;
let loaded = null; // { processor, model, engine }

function guardedFetch(input, init) {
  const url = new URL(typeof input === "string" ? input : input.url, self.location.origin);
  const method = (init && init.method) || (typeof input === "string" ? "GET" : input.method) || "GET";
  const sameOrigin = url.origin === self.location.origin;
  if (
    method.toUpperCase() !== "GET" ||
    (init && init.body != null) ||
    url.protocol !== "https:" && !sameOrigin ||
    !(sameOrigin || MODEL.allowedHosts.includes(url.hostname))
  ) {
    return Promise.reject(new Error("blocked-request"));
  }
  return fetch(input, init);
}

async function runtime() {
  if (tf) return tf;
  tf = await import(RUNTIME);
  tf.env.allowLocalModels = false;
  tf.env.allowRemoteModels = true;
  tf.env.useBrowserCache = true;
  tf.env.useWasmCache = true;
  tf.env.cacheKey = MODEL.cacheKey;
  tf.env.fetch = guardedFetch;
  tf.env.backends.onnx.wasm.wasmPaths = "/ia/";
  // Sin COOP/COEP no hay SharedArrayBuffer: un hilo, sin proxy.
  tf.env.backends.onnx.wasm.numThreads = 1;
  tf.env.backends.onnx.wasm.proxy = false;
  return tf;
}

async function probe() {
  let webgpu = false;
  try {
    webgpu = !!(self.navigator.gpu && (await self.navigator.gpu.requestAdapter()));
  } catch {
    webgpu = false;
  }
  const wasm = typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function";
  return { webgpu, wasm };
}

async function load(engine) {
  const t = await runtime();
  const t0 = performance.now();
  const progress_callback = (p) => {
    if (p && p.status === "progress" && p.file) {
      self.postMessage({ type: "progress", file: p.file, loaded: p.loaded || 0, total: p.total || 0 });
    }
  };
  const opts = { revision: MODEL.revision, progress_callback };
  const processor = await t.AutoProcessor.from_pretrained(MODEL.id, opts);
  const model = await t.AutoModelForVision2Seq.from_pretrained(MODEL.id, {
    ...opts,
    dtype: MODEL.dtype,
    device: engine === "webgpu" ? "webgpu" : "wasm",
  });
  loaded = { processor, model, engine };
  // Lo que pesó el runtime servido por la app (mismo origen: el navegador da el tamaño transferido).
  const runtimeBytes = performance
    .getEntriesByType("resource")
    .filter((e) => e.name.startsWith(self.location.origin + "/ia/"))
    .reduce((n, e) => n + (e.transferSize || 0), 0);
  return { ms: Math.round(performance.now() - t0), runtimeBytes };
}

async function analyze(image) {
  const t = await runtime();
  const { processor, model } = loaded;
  const t0 = performance.now();
  let raw = new t.RawImage(new Uint8ClampedArray(image.data), image.width, image.height, 4);
  const messages = [{ role: "user", content: [{ type: "image" }, { type: "text", text: MODEL.prompt }] }];
  const prompt = processor.apply_chat_template(messages, { add_generation_prompt: true });
  const inputs = await processor(prompt, [raw], { do_image_splitting: false });
  const out = await model.generate({ ...inputs, max_new_tokens: MODEL.maxNewTokens, do_sample: false, repetition_penalty: MODEL.repetitionPenalty });
  const n = inputs.input_ids.dims.at(-1);
  const [text] = processor.batch_decode(out.slice(null, [n, null]), { skip_special_tokens: true });
  raw = null; // la foto se suelta aquí: nada la guarda
  return { text: String(text || "").trim(), ms: Math.round(performance.now() - t0) };
}

self.onmessage = async (event) => {
  const msg = event.data || {};
  try {
    if (msg.type === "probe") {
      self.postMessage({ type: "probe", ...(await probe()) });
    } else if (msg.type === "load") {
      const { ms, runtimeBytes } = await load(msg.engine);
      self.postMessage({ type: "ready", engine: msg.engine, ms, runtimeBytes });
    } else if (msg.type === "analyze") {
      if (!loaded) throw new Error("not-loaded");
      const { text, ms } = await analyze(msg.image);
      self.postMessage({ type: "result", id: msg.id, text, ms });
    }
  } catch (err) {
    // Solo un código: jamás el contenido (regla dura 6).
    const code = err && err.message === "blocked-request" ? "blocked-request" : msg.type === "load" ? "load-failed" : "analyze-failed";
    self.postMessage({ type: "error", id: msg.id, code });
  }
};
