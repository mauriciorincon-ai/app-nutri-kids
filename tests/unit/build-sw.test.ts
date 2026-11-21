// @vitest-environment node
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DETAIL_SHELL,
  IA_RUNTIME,
  IA_WORKER,
  PDFJS_ASSETS,
  SHELL_ROUTES,
  iaCacheName,
  modelConfig,
  renderSw,
  renderWorker,
} from "../../scripts/build-sw.mjs";

const root = join(__dirname, "../..");
const template = readFileSync(join(root, "scripts/sw.template.js"), "utf8");

/** Rutas estáticas reales: cada carpeta de src/app con page.tsx (sin las dinámicas). */
function appRoutes(): string[] {
  const dir = join(root, "src/app");
  const routes = ["/"];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && existsSync(join(dir, e.name, "page.tsx")))
      routes.push(`/${e.name}`);
  }
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
    expect(out).toContain(`const EXTRA_ASSETS = ${JSON.stringify(PDFJS_ASSETS)}`);
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
    const self = {
      location: { origin: "https://app.test" },
      postMessage: () => {},
      onmessage: null as unknown,
    };
    const fakeFetch = (input: string | { url: string }) => {
      calls.push(typeof input === "string" ? input : input.url);
      return Promise.resolve("ok");
    };
    const guarded = new Function(
      "self",
      "fetch",
      `${worker.replace(/^export .*$/gm, "")}\nreturn guardedFetch;`,
    )(self, fakeFetch) as (
      input: string,
      init?: { method?: string; body?: unknown },
    ) => Promise<unknown>;
    return { guarded, calls };
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

  it("la única red del worker: GET sin cuerpo a la app o al Hub; todo lo demás se bloquea", async () => {
    const { guarded, calls } = sandbox();
    await expect(guarded("/ia/ort-wasm-simd-threaded.asyncify.wasm")).resolves.toBe("ok");
    await expect(
      guarded(`https://huggingface.co/${model.id}/resolve/${model.revision}/config.json`),
    ).resolves.toBe("ok");
    for (const [url, init] of [
      ["https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/x.wasm", undefined],
      ["https://evil.test/upload", undefined],
      ["http://huggingface.co/x", undefined],
      ["https://huggingface.co/api/x", { method: "POST" }],
      ["/api/family", { method: "PUT" }],
      ["https://huggingface.co/x", { body: "foto" }],
    ] as const) {
      await expect(guarded(url, init), url).rejects.toThrow("blocked-request");
    }
    expect(calls).toHaveLength(2);
  });

  it("los errores salen como código, jamás con el contenido", () => {
    expect(worker).toMatch(/postMessage\(\{ type: "error", id: msg\.id, code \}\)/);
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
});
