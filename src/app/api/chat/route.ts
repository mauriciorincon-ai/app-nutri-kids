/**
 * POST /api/chat — el "Camino B" del chat (preguntas abiertas).
 *
 * Orden de defensa (todo lo que rechaza lo hace SIN gastar tokens):
 *   kill-switch → rate limit → validación → guardrails → streamText.
 *
 * Privacidad: los logs son SOLO metadatos (proveedor, latencia, tokens,
 * outcome) — jamás la pregunta ni la respuesta. La conversación no se persiste.
 */
import { convertToModelMessages, streamText, type UIMessage } from "ai";

import { dietPlanSchema } from "@/lib/diet/schema";
import { buildGroundedSystem } from "@/lib/ia/grounding";
import {
  MAX_INPUT_CHARS,
  rejectionMessage,
  screenInput,
} from "@/lib/ia/guardrails";
import {
  isChatEnabled,
  providerMeta,
  resolveModel,
  staticModel,
} from "@/lib/ia/provider";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/log";

export const runtime = "nodejs";

type Locale = "es" | "en";

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Texto plano del último turno del usuario (para longitud y guardrails). */
function lastUserText(messages: UIMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user");
  if (!last) return "";
  return last.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join(" ");
}

/** Streamea un texto estático como respuesta del asistente (sin tokens). */
async function streamStatic(
  text: string,
  messages: UIMessage[],
  outcome: string,
) {
  const result = streamText({
    model: staticModel(text),
    messages: await convertToModelMessages(messages),
  });
  // El cliente lee `x-chat-outcome` para pintar el rechazo distinto de una
  // respuesta de IA (sin la etiqueta "Respuesta de IA").
  return result.toUIMessageStreamResponse({
    headers: { "x-chat-outcome": outcome },
  });
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const { provider, model } = providerMeta();
  const ip = clientIp(req);

  // 1) Kill-switch — la IA queda pausada, el cliente muestra "apagado".
  if (!isChatEnabled()) {
    log.info({ event: "chat", outcome: "disabled", provider });
    return Response.json(
      { error: "chat-disabled" },
      { status: 503, headers: { "x-chat-outcome": "disabled" } },
    );
  }

  // 2) Rate limit por IP (antes de leer/validar el cuerpo).
  const rl = rateLimit(ip);
  if (!rl.ok) {
    log.warn({ event: "chat", outcome: "rate-limited", provider });
    return Response.json(
      { error: "rate-limited" },
      {
        status: 429,
        headers: {
          "retry-after": String(rl.retryAfterSec),
          "x-chat-outcome": "rate-limited",
        },
      },
    );
  }

  // 3) Validación del cuerpo (nunca logueamos su contenido).
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid-body" }, { status: 400 });
  }
  const {
    messages,
    diet: rawDiet,
    locale: rawLocale,
  } = (body ?? {}) as {
    messages?: UIMessage[];
    diet?: unknown;
    locale?: unknown;
  };
  const locale: Locale = rawLocale === "en" ? "en" : "es";

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "no-messages" }, { status: 400 });
  }
  const parsedDiet = dietPlanSchema.safeParse(rawDiet);
  if (!parsedDiet.success) {
    log.warn({ event: "chat", outcome: "invalid-diet", provider });
    return Response.json({ error: "invalid-diet" }, { status: 400 });
  }

  const userText = lastUserText(messages);
  if (userText.length > MAX_INPUT_CHARS) {
    return Response.json({ error: "too-long" }, { status: 413 });
  }

  // 4) Guardrails SIN tokens (frontera consulta-vs-cambio).
  const screen = screenInput(userText);
  if (screen !== "ok") {
    log.info({ event: "chat", outcome: screen, provider, locale });
    return streamStatic(rejectionMessage(screen, locale), messages, screen);
  }

  // 5) LLM grounded, en streaming.
  try {
    const system = buildGroundedSystem(parsedDiet.data, locale, new Date());
    const result = streamText({
      model: resolveModel(locale),
      system,
      messages: await convertToModelMessages(messages),
      maxOutputTokens: 500,
      abortSignal: AbortSignal.timeout(20_000),
      onFinish({ usage }) {
        log.info({
          event: "chat",
          outcome: "ok",
          provider,
          model,
          locale,
          latencyMs: Date.now() - startedAt,
          tokensIn: usage?.inputTokens,
          tokensOut: usage?.outputTokens,
        });
      },
    });
    return result.toUIMessageStreamResponse();
  } catch (err) {
    // El detail va a Sentry vía instrumentación; el log lleva SOLO metadatos.
    log.error({
      event: "chat",
      outcome: "error",
      provider,
      model,
      latencyMs: Date.now() - startedAt,
    });
    throw err;
  }
}
