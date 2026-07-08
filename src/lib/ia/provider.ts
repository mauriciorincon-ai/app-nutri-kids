/**
 * Adapter de proveedor LLM conmutable por env — el "Camino B" del chat.
 *
 * `CHAT_PROVIDER` elige el proveedor SIN tocar código; `CHAT_MODEL` sobreescribe
 * el modelo. `mock` es un modelo determinístico (fixture) que NO llama a ninguna
 * red — es lo que usa CI y el default cuando no hay proveedor configurado.
 *
 * Este módulo es SERVER-ONLY (lo importa la route). Las API keys nunca llegan
 * al cliente.
 */
import type { LanguageModel } from "ai";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";

import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAzure } from "@ai-sdk/azure";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// `LanguageModelV4StreamPart` no se exporta públicamente; anclamos `doStream`
// al tipo que espera el constructor del mock (no a `any`). El runtime del
// streaming queda cubierto por los tests de integración de la route.
type MockConfig = NonNullable<
  ConstructorParameters<typeof MockLanguageModelV4>[0]
>;

export type ChatProvider =
  "groq" | "gemini" | "azure" | "anthropic" | "openai-compatible" | "mock";

const KNOWN_PROVIDERS: ChatProvider[] = [
  "groq",
  "gemini",
  "azure",
  "anthropic",
  "openai-compatible",
  "mock",
];

/** Default de modelo por proveedor (sobreescribible con `CHAT_MODEL`). */
const DEFAULT_MODEL: Record<Exclude<ChatProvider, "mock">, string> = {
  groq: "llama-3.3-70b-versatile",
  gemini: "gemini-2.5-flash",
  azure: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5",
  "openai-compatible": "",
};

export function getChatProvider(): ChatProvider {
  const raw = process.env.CHAT_PROVIDER?.trim().toLowerCase();
  if (raw && (KNOWN_PROVIDERS as string[]).includes(raw)) {
    return raw as ChatProvider;
  }
  return "mock";
}

/** Kill-switch del Camino B. Sin `CHAT_ENABLED=true`, la IA queda pausada. */
export function isChatEnabled(): boolean {
  return process.env.CHAT_ENABLED === "true";
}

/** Metadatos del proveedor activo — SOLO para logs (nunca la key). */
export function providerMeta(): { provider: ChatProvider; model: string } {
  const provider = getChatProvider();
  const model =
    process.env.CHAT_MODEL?.trim() ||
    (provider === "mock" ? "mock" : DEFAULT_MODEL[provider]);
  return { provider, model };
}

/** Respuesta demo determinística del mock, en el idioma activo. Solo verdes. */
function mockResponse(locale: "es" | "en"): string {
  return locale === "en"
    ? "With your plan you can put together something using the green options: proteins like chicken or egg, firm vegetables and a portion of grain. (Demo: this reply comes from the test provider, no real AI is contacted.)"
    : "Con tu plan puedes preparar algo con las opciones verdes: proteínas como pollo o huevo, verduras firmes y una porción de cereal. (Demo: esta respuesta la genera el proveedor de prueba, sin conectarse a una IA real.)";
}

/**
 * Modelo determinístico que streamea `text` palabra por palabra. Base del
 * `mock` y de las respuestas estáticas (rechazos/apagado) — todas viajan por el
 * mismo camino de streaming del SDK que consume el cliente.
 */
export function staticModel(text: string): LanguageModel {
  const words = text.split(" ");
  const chunks = [
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: "0" },
    ...words.map((w, i) => ({
      type: "text-delta" as const,
      id: "0",
      delta: i === 0 ? w : ` ${w}`,
    })),
    { type: "text-end", id: "0" },
    {
      type: "finish" as const,
      finishReason: "stop" as const,
      usage: {
        inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: words.length, text: words.length, reasoning: 0 },
      },
    },
  ];
  const doStream = (async () => ({
    stream: simulateReadableStream({ chunkDelayInMs: 8, chunks }),
  })) as MockConfig["doStream"];
  return new MockLanguageModelV4({
    doStream,
  });
}

function mockModel(locale: "es" | "en"): LanguageModel {
  return staticModel(mockResponse(locale));
}

/**
 * Resuelve el modelo del proveedor activo. Para `mock`, la respuesta es
 * determinística y depende del idioma (los proveedores reales obedecen el
 * idioma vía system prompt). Lanza si al proveedor real le falta su key.
 */
export function resolveModel(locale: "es" | "en"): LanguageModel {
  const { provider, model } = providerMeta();
  switch (provider) {
    case "mock":
      return mockModel(locale);
    case "groq":
      return createGroq({ apiKey: process.env.GROQ_API_KEY })(model);
    case "gemini":
      return createGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      })(model);
    case "azure":
      return createAzure({
        resourceName: process.env.AZURE_RESOURCE_NAME,
        apiKey: process.env.AZURE_API_KEY,
      })(model);
    case "anthropic":
      return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(model);
    case "openai-compatible":
      return createOpenAICompatible({
        name: "chat",
        baseURL: process.env.CHAT_BASE_URL ?? "",
        apiKey: process.env.CHAT_API_KEY,
      })(model);
  }
}
