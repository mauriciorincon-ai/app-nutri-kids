// @vitest-environment node
// Regla dura 5 · ADR-008: el chat contesta con código; ningún SDK de IA en la nube
// ni ruta de servidor vuelve a entrar sin un ADR nuevo. La ÚNICA excepción es la de la
// familia (S7 · ADR-011): guarda cifrados, y solo dos archivos abren la red.
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

  it("la única ruta de servidor es la de la familia (ADR-011)", () => {
    expect(existsSync(resolve("src/app/api"))).toBe(true);
    const routes = sourceFiles(resolve("src/app/api")).map((f) =>
      f.slice(resolve("src/app/api").length + 1),
    );
    expect(routes).toEqual(["family/[...op]/route.ts"]);
  });

  it("el cliente de la familia solo llama a su propia ruta, y la base solo desde el servidor", () => {
    const client = readFileSync(resolve("src/lib/family/client.ts"), "utf8");
    expect(client).toMatch(/FAMILY_API = "\/api\/family"/);
    expect(client).not.toMatch(/https?:\/\//);
    const upstash = readFileSync(
      resolve("src/lib/family/server/upstash.ts"),
      "utf8",
    );
    expect(upstash).not.toMatch(/^"use client"/m);
  });

  it("ningún archivo de src/ importa un SDK de proveedor ni abre una vía de red (salvo los dos de la familia)", () => {
    const allowed = new Set([
      resolve("src/lib/family/client.ts"),
      resolve("src/lib/family/server/upstash.ts"),
    ]);
    const offenders = sourceFiles(resolve("src")).filter((f) => {
      const code = readFileSync(f, "utf8");
      const imports = [...code.matchAll(/from\s+["']([^"']+)["']/g)].map(
        (m) => m[1],
      );
      return (
        imports.some((i) => CLOUD_SDK.test(i)) ||
        (NETWORK_CALL.test(code) && !allowed.has(f))
      );
    });
    expect(offenders).toEqual([]);
  });
});
