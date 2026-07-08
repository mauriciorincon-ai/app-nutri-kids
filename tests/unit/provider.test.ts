import { describe, expect, it, beforeEach } from "vitest";
import {
  getChatProvider,
  isChatEnabled,
  providerMeta,
  resolveModel,
  type ChatProvider,
} from "@/lib/ia/provider";

beforeEach(() => {
  process.env.CHAT_PROVIDER = "";
  process.env.CHAT_MODEL = "";
  process.env.CHAT_ENABLED = "";
});

describe("getChatProvider", () => {
  it("sin env → mock (default seguro para CI)", () => {
    expect(getChatProvider()).toBe("mock");
  });
  it("valor desconocido → mock", () => {
    process.env.CHAT_PROVIDER = "no-existe";
    expect(getChatProvider()).toBe("mock");
  });
  it("normaliza mayúsculas/espacios", () => {
    process.env.CHAT_PROVIDER = "  GROQ ";
    expect(getChatProvider()).toBe("groq");
  });
});

describe("isChatEnabled — kill-switch", () => {
  it("solo 'true' habilita", () => {
    expect(isChatEnabled()).toBe(false);
    process.env.CHAT_ENABLED = "false";
    expect(isChatEnabled()).toBe(false);
    process.env.CHAT_ENABLED = "true";
    expect(isChatEnabled()).toBe(true);
  });
});

describe("providerMeta", () => {
  it("CHAT_MODEL sobreescribe el default sin código", () => {
    process.env.CHAT_PROVIDER = "groq";
    expect(providerMeta().model).toBe("llama-3.3-70b-versatile");
    process.env.CHAT_MODEL = "llama-4-scout";
    expect(providerMeta().model).toBe("llama-4-scout");
  });
});

describe("resolveModel — conmutación por env (construye sin llamar a la red)", () => {
  const providers: Exclude<ChatProvider, "openai-compatible">[] = [
    "mock",
    "groq",
    "gemini",
    "azure",
    "anthropic",
  ];
  for (const p of providers) {
    it(`CHAT_PROVIDER=${p} construye un modelo`, () => {
      process.env.CHAT_PROVIDER = p;
      const model = resolveModel("es");
      expect(model).toBeTruthy();
    });
  }
  it("openai-compatible con CHAT_BASE_URL", () => {
    process.env.CHAT_PROVIDER = "openai-compatible";
    process.env.CHAT_BASE_URL = "http://localhost:1234/v1";
    process.env.CHAT_MODEL = "local-model";
    expect(resolveModel("es")).toBeTruthy();
  });
});
