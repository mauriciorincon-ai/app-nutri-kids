// @vitest-environment node
// Regla dura 5 · ADR-008: el chat contesta con código; ningún SDK de IA en la nube
// ni ruta de servidor vuelve a entrar sin un ADR nuevo.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });

const CLOUD_SDK =
  /^(ai|@ai-sdk\/.*|openai|@anthropic-ai\/.*|@google\/genai|@google\/generative-ai|@google-cloud\/.*|groq-sdk|@azure\/openai|@aws-sdk\/client-bedrock.*|@mistralai\/.*|cohere-ai|@huggingface\/inference|replicate|together-ai|@langchain\/.*|langchain|ollama|@xenova\/transformers)$/;

// Toda vía de red desde el navegador: fetch, XHR, beacons, sockets y streams de eventos.
const NETWORK_CALL =
  /\b(fetch\s*\(|XMLHttpRequest|sendBeacon|new\s+WebSocket|new\s+EventSource)/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory()
      ? sourceFiles(p)
      : /\.(ts|tsx)$/.test(p)
        ? [p]
        : [];
  });
}

describe("sin IA en la nube (regla dura 5)", () => {
  it("package.json no trae SDKs de proveedores", () => {
    expect(deps.filter((d) => CLOUD_SDK.test(d))).toEqual([]);
  });

  it("no hay rutas de servidor bajo src/app/api", () => {
    expect(existsSync(resolve("src/app/api"))).toBe(false);
  });

  it("ningún archivo de src/ importa un SDK de proveedor ni abre una vía de red", () => {
    const offenders = sourceFiles(resolve("src")).filter((f) => {
      const code = readFileSync(f, "utf8");
      const imports = [...code.matchAll(/from\s+["']([^"']+)["']/g)].map(
        (m) => m[1],
      );
      return imports.some((i) => CLOUD_SDK.test(i)) || NETWORK_CALL.test(code);
    });
    expect(offenders).toEqual([]);
  });
});
