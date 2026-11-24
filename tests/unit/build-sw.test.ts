// @vitest-environment node
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DETAIL_SHELL,
  IA_RUNTIME,
  IA_WORKER,
  CATALOG_FILE,
  CATALOG_SOURCE,
  OCR_FILES,
  PDFJS_ASSETS,
  SCAN_FILES,
  SHELL_ROUTES,
  catalogCacheName,
  iaCacheName,
  modelConfig,
  ocrCacheName,
  ocrSource,
  ortDist,
  renderSw,
  renderWorker,
  scanCacheName,
} from "../../scripts/build-sw.mjs";

const root = join(__dirname, "../..");
const template = readFileSync(join(root, "scripts/sw.template.js"), "utf8");

/** Rutas estáticas reales: cada carpeta de src/app con page.tsx, anidadas incluidas (sin las dinámicas). */
function appRoutes(): string[] {
  const root0 = join(root, "src/app");
  const routes = ["/"];
  const walk = (rel: string) => {
    for (const e of readdirSync(join(root0, rel), { withFileTypes: true })) {
      if (!e.isDirectory() || e.name === "api" || /[[(]/.test(e.name)) continue;
      const next = rel ? `${rel}/${e.name}` : e.name;
      if (existsSync(join(root0, next, "page.tsx"))) routes.push(`/${next}`);
      walk(next);
    }
  };
  walk("");
  return routes;
}

describe("contrato service worker ↔ app (regla 19)", () => {
  it("precachea el cascarón de TODAS las pantallas (y /conoce, que es un rewrite)", () => {
    expect([...SHELL_ROUTES].sort()).toEqual(
      [...appRoutes(), "/conoce"].sort(),
    );
  });

  it("el detalle de alimento tiene su cascarón y el SW lo precachea y lo usa de respaldo", () => {
    expect(existsSync(join(root, "src/app/dieta/[id]/page.tsx"))).toBe(true);
    expect(DETAIL_SHELL).toBe("/dieta/_");
    const out = renderSw(template, "x");
    expect(out).toContain(
      `const DETAIL_SHELL = ${JSON.stringify(DETAIL_SHELL)}`,
    );
    expect(out).toContain("[...SHELL_ROUTES, DETAIL_SHELL]");
    expect(out).not.toContain("__DETAIL_SHELL__");
  });

  it("estampa versión y pantallas, sin dejar marcadores", () => {
    const out = renderSw(template, "abc1234-xyz");
    expect(out).toContain('const VERSION = "abc1234-xyz"');
    expect(out).toContain(JSON.stringify(SHELL_ROUTES));
    expect(out).not.toContain("__BUILD_ID__");
    expect(out).not.toContain("__SHELL_ROUTES__");
  });

  it("pdf.js y su worker salen de la app y se precachean (el PDF se lee sin red, ADR-010)", () => {
    const out = renderSw(template, "x");
    expect(out).toContain(
      `const EXTRA_ASSETS = ${JSON.stringify(PDFJS_ASSETS)}`,
    );
    // …en su caché propia, nombrada con la versión de pdf.js, que `activate` conserva.
    expect(out).toMatch(/const PDFJS_CACHE = "nutrikids-pdfjs-\d+\.\d+\.\d+"/);
    expect(out).toContain("k !== PDFJS_CACHE");
    expect(out).not.toContain("__PDFJS_VERSION__");
    expect(out).not.toContain("__EXTRA_ASSETS__");
    expect(PDFJS_ASSETS.every((a) => a.startsWith("/pdfjs/"))).toBe(true);
    // La copia sale de la build instalada (versión fijada en package.json), jamás de una CDN.
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(pkg.dependencies["pdfjs-dist"]).toMatch(/^\d+\.\d+\.\d+$/);
    expect(template).not.toMatch(/https?:\/\//);
  });

  it("dos builds distintos dan SW distintos (si no, el navegador no avisa)", () => {
    expect(renderSw(template, "a-1")).not.toBe(renderSw(template, "a-2"));
  });

  it("la versión nueva espera: ni skipWaiting al instalar ni recarga forzada", () => {
    const code = template
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const install = code.slice(
      code.indexOf('addEventListener("install"'),
      code.indexOf('addEventListener("activate"'),
    );
    expect(install).not.toContain("skipWaiting");
    expect(code).not.toMatch(/\.reload\(/);
  });

  it("el mensaje de aceptar es el mismo en el SW y en la página", () => {
    const page = readFileSync(
      join(root, "src/components/app-shell/sw-register.tsx"),
      "utf8",
    );
    const m = /SKIP_WAITING_MESSAGE = "([A-Z_]+)"/.exec(page);
    expect(m?.[1]).toBe("SKIP_WAITING");
    expect(template).toContain(`type === "${m?.[1]}"`);
  });
});

describe("contrato del worker de la cámara (S12 · ADR-018, regla 19)", () => {
  const workerTemplate = readFileSync(
    join(root, "scripts/vision-worker.template.js"),
    "utf8",
  );
  const model = modelConfig();
  const worker = renderWorker(workerTemplate, model);

  /** Ejecuta el worker estampado con un `self` falso y devuelve su `guardedFetch`. */
  function sandbox() {
    const calls: string[] = [];
    const self: Record<string, unknown> = {
      location: { origin: "https://app.test" },
      postMessage: () => {},
      onmessage: null,
      // Las demás puertas de red que un worker trae de fábrica.
      XMLHttpRequest: function Xhr() {},
      WebSocket: function Ws() {},
      EventSource: function Es() {},
    };
    const fakeFetch = (input: unknown) => {
      calls.push(
        typeof input === "string"
          ? input
          : String(
              (input as { url?: string; href?: string }).url ??
                (input as { href?: string }).href,
            ),
      );
      return Promise.resolve("ok");
    };
    const guarded = new Function(
      "self",
      "fetch",
      `${worker.replace(/^export .*$/gm, "")}\nreturn guardedFetch;`,
    )(self, fakeFetch) as (
      input: unknown,
      init?: { method?: string; body?: unknown },
    ) => Promise<unknown>;
    return { guarded, calls, self };
  }

  it("se estampa sin marcadores, con la revisión fijada por commit y el runtime de la app", () => {
    expect(worker).not.toContain("__MODEL__");
    expect(worker).toContain(JSON.stringify(model));
    expect(model.revision).toMatch(/^[0-9a-f]{40}$/);
    expect(worker).toContain('wasmPaths = "/ia/"');
    expect(worker).toContain('RUNTIME = "/ia/transformers.min.js"');
    expect(worker).toContain("allowLocalModels = false");
    // Ninguna CDN escrita en la plantilla: el runtime sale de la app y los pesos del Hub.
    expect(workerTemplate).not.toMatch(/https?:\/\//);
    expect(IA_WORKER).toBe("/ia/vision-worker.js");
    expect(IA_RUNTIME.every((f) => !f.includes("/"))).toBe(true);
  });

  it("el runtime que se copia es el que el JS pide: con prefijo de cadena, ort solo pide `asyncify`, y esos archivos existen", () => {
    const js = readFileSync(
      join(
        root,
        "node_modules/@huggingface/transformers/dist/transformers.min.js",
      ),
      "utf8",
    );
    // Los nombres de runtime que el código fija a mano (sin el camino de wasmPaths por defecto,
    // que el worker nunca usa porque pone `wasmPaths = "/ia/"`).
    expect(js).toContain('"ort-wasm-simd-threaded.asyncify.mjs"');
    const wanted = new Set(
      [...js.matchAll(/ort-wasm-simd-threaded\.asyncify\.(?:mjs|wasm)/g)].map(
        (m) => m[0],
      ),
    );
    for (const name of wanted) expect(IA_RUNTIME, name).toContain(name);
    for (const name of IA_RUNTIME.filter((n) => n.startsWith("ort-")))
      expect(existsSync(join(ortDist(), name)), name).toBe(true);
  });

  it("la puerta de red del worker: GET sin cuerpo al runtime de la app o al Hub; todo lo demás se bloquea", async () => {
    const { guarded, calls } = sandbox();
    const hub = `https://huggingface.co/${model.id}/resolve/${model.revision}/config.json`;
    await expect(
      guarded("/ia/ort-wasm-simd-threaded.asyncify.wasm"),
    ).resolves.toBe("ok");
    await expect(guarded(hub)).resolves.toBe("ok");
    // El mismo destino como `URL` y como objeto tipo `Request` pasa igual…
    await expect(guarded(new URL(hub))).resolves.toBe("ok");
    await expect(guarded({ url: hub, method: "GET" })).resolves.toBe("ok");
    expect(calls).toHaveLength(4);
    // …y las formas que intentan colarse, no.
    const bad: [unknown, { method?: string; body?: unknown }?][] = [
      ["https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/x.wasm"],
      ["https://evil.test/upload"],
      ["http://huggingface.co/x"],
      ["https://huggingface.co/api/x", { method: "POST" }],
      ["https://huggingface.co/api/x", { method: "post" }],
      ["https://huggingface.co/x", { body: "foto" }],
      ["https://huggingface.co:8443/x"],
      ["https://user:pass@huggingface.co/x"],
      ["https://huggingface.co.evil.test/x"],
      ["https://evilhuggingface.co/x"],
      ["//evil.test/upload"],
      ["\\\\evil.test\\upload"],
      ["/api/family"],
      ["/api/family", { method: "PUT" }],
      ["/ia/../api/family"],
      [new URL("https://evil.test/x")],
      [{ url: "https://evil.test/x", method: "GET" }],
      [{ url: hub, method: "POST" }],
      [{ url: hub, method: "GET", body: "foto" }],
      [{ href: "https://evil.test/x" }],
      ["data:text/plain,hola"],
      ["blob:https://app.test/abc"],
      ["javascript:alert(1)"],
      [null],
      [undefined],
    ];
    for (const [input, init] of bad) {
      await expect(guarded(input, init), String(input)).rejects.toThrow(
        "blocked-request",
      );
    }
    expect(calls).toHaveLength(4);
  });

  it("`self.fetch` queda reemplazado y XHR, WebSocket y EventSource ya no se pueden usar", async () => {
    const { self, guarded, calls } = sandbox();
    expect(self.fetch).toBe(guarded);
    for (const name of ["XMLHttpRequest", "WebSocket", "EventSource"]) {
      expect(() => new (self[name] as new () => unknown)(), name).toThrow(
        "blocked-request",
      );
      // y no se puede volver a poner el original
      expect(() => {
        "use strict";
        self[name] = function Back() {};
      }, name).toThrow();
    }
    await expect(
      (self.fetch as typeof guarded)("https://evil.test/x"),
    ).rejects.toThrow("blocked-request");
    expect(calls).toEqual([]);
  });

  it("los errores salen como código, jamás con el contenido", () => {
    expect(worker).toMatch(
      /postMessage\(\{ type: "error", id: msg\.id, of: msg\.type, code \}\)/,
    );
    expect(worker).not.toMatch(/err\.stack|String\(err\)|err\.message\s*\}/);
  });

  it("el SW guarda /ia/ en su caché propia y al activar no borra el modelo descargado", () => {
    const out = renderSw(template, "x");
    expect(out).toMatch(/const IA_CACHE = "nutrikids-ia-[0-9a-f]{12}"/);
    expect(out).not.toContain("__IA_CACHE__");
    expect(out).toContain("k !== IA_CACHE");
    // Solo se borran cachés propias viejas: la del modelo (otro nombre) sobrevive a cada versión.
    expect(out).toContain("OWN_CACHE.test(k)");
    const own = /const OWN_CACHE = (\/.*\/);/.exec(out)?.[1];
    const re = new Function(`return ${own}`)() as RegExp;
    expect(re.test("nutrikids-shell-old")).toBe(true);
    expect(re.test("nutrikids-ia-abc")).toBe(true);
    expect(re.test(model.cacheKey)).toBe(false);
    expect(re.test("transformers-cache")).toBe(false);
    // Un worker distinto da una caché distinta (si no, un teléfono se quedaría con el viejo).
    expect(iaCacheName("a", "1.0.0")).not.toBe(iaCacheName("b", "1.0.0"));
    expect(iaCacheName("a", "1.0.0")).not.toBe(iaCacheName("a", "1.0.1"));
  });

  it("el SW guarda TODO /ocr/ (código, núcleo e idiomas) en su caché propia, que activate conserva", () => {
    const out = renderSw(template, "x");
    expect(out).toMatch(/const OCR_CACHE = "nutrikids-ocr-[0-9a-f]{12}"/);
    expect(out).not.toContain("__OCR_CACHE__");
    expect(out).toContain("k !== OCR_CACHE");
    const own = /const OWN_CACHE = (\/.*\/);/.exec(out)?.[1];
    const re = new Function(`return ${own}`)() as RegExp;
    expect(re.test("nutrikids-ocr-abc")).toBe(true);
    const pat = /const OCR_PATTERN = (\/.*\/);/.exec(out)?.[1];
    const ocr = new Function(`return ${pat}`)() as RegExp;
    // Contrato SW ↔ página (regla 19): cada archivo que el lector pide cae en su caché…
    for (const name of Object.keys(OCR_FILES))
      expect(ocr.test(`/ocr/${name}`), name).toBe(true);
    // …y nada fuera de /ocr/ ni con un `..` se cuela.
    expect(ocr.test("/ocr/../api/family")).toBe(false);
    expect(ocr.test("/ia/transformers.min.js")).toBe(false);
    expect(ocr.test("/ocr/lang/x.json")).toBe(false);
    expect(ocrCacheName("7.0.0+7.0.0+1.0.0+1.0.0")).not.toBe(
      ocrCacheName("7.0.0+7.0.1+1.0.0+1.0.0"),
    );
  });

  it("el SW guarda /scan/ y /catalogo/ en cachés propias, que activate conserva (contrato SW ↔ página)", () => {
    const out = renderSw(template, "x");
    expect(out).toMatch(/const SCAN_CACHE = "nutrikids-scan-[0-9a-f]{12}"/);
    expect(out).toMatch(/const CATALOG_CACHE = "nutrikids-catalog-[0-9a-f]{12}"/);
    expect(out).not.toContain("__SCAN_CACHE__");
    expect(out).not.toContain("__CATALOG_CACHE__");
    expect(out).toContain("k !== SCAN_CACHE");
    expect(out).toContain("k !== CATALOG_CACHE");
    const own = /const OWN_CACHE = (\/.*\/);/.exec(out)?.[1];
    const re = new Function(`return ${own}`)() as RegExp;
    expect(re.test("nutrikids-scan-abc")).toBe(true);
    expect(re.test("nutrikids-catalog-abc")).toBe(true);
    expect(re.test("nutrikids-model")).toBe(false);
    const scanPat = new Function(`return ${/const SCAN_PATTERN = (\/.*\/);/.exec(out)?.[1]}`)() as RegExp;
    const catPat = new Function(`return ${/const CATALOG_PATTERN = (\/.*\/);/.exec(out)?.[1]}`)() as RegExp;
    // Cada archivo que el súper pide cae en su caché…
    for (const name of Object.keys(SCAN_FILES)) expect(scanPat.test(`/scan/${name}`), name).toBe(true);
    expect(catPat.test(`/catalogo/${CATALOG_FILE}`)).toBe(true);
    // …y nada fuera de esas carpetas ni con un `..` se cuela.
    expect(scanPat.test("/scan/../api/family")).toBe(false);
    expect(scanPat.test("/ocr/worker.min.js")).toBe(false);
    expect(catPat.test("/catalogo/off-co.js")).toBe(false);
    expect(catPat.test("/scan/off-co.json")).toBe(false);
    // Una versión nueva de zxing o un worker distinto, otra caché; un catálogo distinto, otra caché.
    expect(scanCacheName("3.1.6", "a")).not.toBe(scanCacheName("3.1.7", "a"));
    expect(scanCacheName("3.1.6", "a")).not.toBe(scanCacheName("3.1.6", "b"));
    expect(catalogCacheName(Buffer.from("a"))).not.toBe(catalogCacheName(Buffer.from("b")));
    expect(catalogCacheName(Buffer.from("a"))).toBe(catalogCacheName(Buffer.from("a")));
  });

  // Se mira el ORIGEN de cada copia: `public/scan/` y `public/catalogo/` los arma el build (gitignore) y la
  // CI corre las unitarias antes del build; que la copia llegue lo prueban el build y la e2e.
  it("los archivos del súper salen de node_modules (zxing 3.1.6 fijado), de scripts/ y de data/, y existen", () => {
    for (const [name, rel] of Object.entries(SCAN_FILES)) {
      expect(rel, name).not.toMatch(/^https?:|\/\//);
      expect(rel, name).toMatch(/^(node_modules\/zxing-wasm\/|scripts\/)/);
      expect(existsSync(join(root, rel)), name).toBe(true);
    }
    expect(CATALOG_SOURCE).toBe("data/catalog/off-co.json");
    expect(CATALOG_FILE).toBe("off-co.json");
    expect(existsSync(join(root, CATALOG_SOURCE))).toBe(true);
    expect(Object.keys(SCAN_FILES).sort()).toEqual([
      "scan-worker.js",
      "zxing-reader.js",
      "zxing_reader.wasm",
    ]);
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(pkg.dependencies["zxing-wasm"]).toBe("3.1.6");
  });

  it("los archivos del lector salen de node_modules (versión fijada), jamás de una CDN, y existen", () => {
    for (const [name, rel] of Object.entries(OCR_FILES)) {
      expect(rel, name).not.toMatch(/^https?:|\/\//);
      // El origen de la copia (node_modules), no `public/ocr/`, que lo arma el build.
      expect(ocrSource(rel), name).toMatch(/[/\\]node_modules[/\\]/);
      expect(existsSync(ocrSource(rel)), name).toBe(true);
    }
    // Solo LSTM: los núcleos sin `-lstm` (legacy, más pesados) no se copian.
    const core = Object.keys(OCR_FILES).filter((n) => n.startsWith("core/"));
    expect(core.every((n) => n.endsWith("-lstm.wasm.js"))).toBe(true);
    expect(Object.keys(OCR_FILES).filter((n) => n.startsWith("lang/")).sort()).toEqual([
      "lang/eng.traineddata.gz",
      "lang/spa.traineddata.gz",
    ]);
  });
});
