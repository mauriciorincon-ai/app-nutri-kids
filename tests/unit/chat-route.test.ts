import { describe, expect, it, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { POST } from "@/app/api/chat/route";
import { __resetRateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/log";

const diet = JSON.parse(readFileSync(resolve("data/demo-diet.json"), "utf8"));

function userMessage(text: string) {
  return { id: "m1", role: "user", parts: [{ type: "text", text }] };
}

function makeRequest(
  body: unknown,
  headers: Record<string, string> = { "x-forwarded-for": "10.0.0.1" },
) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

/** Reconstruye el texto del asistente concatenando los `text-delta` del SSE. */
async function readStream(res: Response): Promise<string> {
  const raw = await res.text();
  let text = "";
  for (const line of raw.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const payload = line.slice(6).trim();
    if (payload === "[done]") continue;
    try {
      const evt = JSON.parse(payload);
      if (evt.type === "text-delta" && typeof evt.delta === "string") {
        text += evt.delta;
      }
    } catch {
      // líneas no-JSON del protocolo SSE → se ignoran
    }
  }
  return text;
}

beforeEach(() => {
  __resetRateLimit();
  process.env.CHAT_PROVIDER = "mock";
  process.env.CHAT_ENABLED = "true";
  process.env.CHAT_MODEL = "";
});

describe("POST /api/chat — kill-switch", () => {
  it("con CHAT_ENABLED != true devuelve 503 (apagado)", async () => {
    process.env.CHAT_ENABLED = "false";
    const res = await POST(
      makeRequest({ messages: [userMessage("hola")], diet, locale: "es" }),
    );
    expect(res.status).toBe(503);
    expect(res.headers.get("x-chat-outcome")).toBe("disabled");
  });
});

describe("POST /api/chat — rate limit", () => {
  it("bloquea con 429 tras superar el límite por IP", async () => {
    const ip = { "x-forwarded-for": "10.0.0.99" };
    let last: Response | undefined;
    for (let i = 0; i < 21; i++) {
      last = await POST(
        makeRequest(
          { messages: [userMessage("¿pollo?")], diet, locale: "es" },
          ip,
        ),
      );
    }
    expect(last!.status).toBe(429);
    expect(last!.headers.get("retry-after")).toBeTruthy();
  });
});

describe("POST /api/chat — validación", () => {
  it("sin mensajes → 400", async () => {
    const res = await POST(makeRequest({ messages: [], diet, locale: "es" }));
    expect(res.status).toBe(400);
  });
  it("dieta inválida → 400 invalid-diet", async () => {
    const res = await POST(
      makeRequest({
        messages: [userMessage("hola")],
        diet: { bad: 1 },
        locale: "es",
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/chat — guardrails (sin tokens)", () => {
  it("consejo médico → redirección streameada", async () => {
    const res = await POST(
      makeRequest({
        messages: [userMessage("¿le subo la dosis de la B12?")],
        diet,
        locale: "es",
      }),
    );
    expect(res.status).toBe(200);
    const text = await readStream(res);
    expect(text).toMatch(/profesional|pediatra|nutricionista/i);
  });

  it("off-topic → redirección streameada", async () => {
    const res = await POST(
      makeRequest({
        messages: [userMessage("¿quién ganó el partido?")],
        diet,
        locale: "es",
      }),
    );
    const text = await readStream(res);
    expect(text).toMatch(/plan/i);
  });
});

describe("POST /api/chat — respuesta grounded (mock)", () => {
  it("pregunta abierta → streaming con la respuesta demo", async () => {
    const res = await POST(
      makeRequest({
        messages: [userMessage("no tengo pollo, ¿qué le doy?")],
        diet,
        locale: "es",
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await readStream(res);
    expect(text.toLowerCase()).toContain("plan");
  });

  it("respeta el idioma (en → respuesta demo en inglés)", async () => {
    const res = await POST(
      makeRequest({
        messages: [userMessage("I have no chicken, what can I give?")],
        diet,
        locale: "en",
      }),
    );
    const text = await readStream(res);
    expect(text.toLowerCase()).toContain("green options");
  });
});

describe("POST /api/chat — privacidad de logs", () => {
  it("los logs NUNCA contienen el texto de la pregunta ni la respuesta", async () => {
    const secret = "brocoliSecretoXYZ";
    const seen: string[] = [];
    const spyInfo = vi.spyOn(log, "info").mockImplementation((obj: unknown) => {
      seen.push(JSON.stringify(obj));
      return undefined as never;
    });
    const spyWarn = vi.spyOn(log, "warn").mockImplementation((obj: unknown) => {
      seen.push(JSON.stringify(obj));
      return undefined as never;
    });

    const res = await POST(
      makeRequest({
        messages: [userMessage(`no tengo ${secret}, ¿qué le doy?`)],
        diet,
        locale: "es",
      }),
    );
    await readStream(res);

    const joined = seen.join(" ");
    expect(joined).not.toContain(secret);
    expect(joined).toMatch(/"outcome":"ok"/);
    expect(joined).toMatch(/"provider":"mock"/);

    spyInfo.mockRestore();
    spyWarn.mockRestore();
  });
});
