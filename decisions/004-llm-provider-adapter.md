# ADR 004 — Proveedor LLM y adapter conmutable por env

- **Estado:** aceptada · Sprint 002 · 2026-07-07
- **Contexto:** el chat "habla con tu dieta" (Camino B) necesita un LLM para las preguntas
  abiertas. La visión exige proveedor **agnóstico** (no atarse a uno) y presupuesto runtime
  **≤ US$20/mes**. CI no puede llamar a un proveedor real (determinismo + costo + privacidad).
- **Decisión:** adapter sobre **Vercel AI SDK** (`ai` v7) en `src/lib/ia/provider.ts`.
  `CHAT_PROVIDER` ∈ `groq` (inicial) · `gemini` · `azure` · `anthropic` · `openai-compatible` ·
  `mock`; `CHAT_MODEL` sobreescribe el modelo sin tocar código. `mock` es un modelo
  determinístico (`MockLanguageModelV4` + `simulateReadableStream`) que **no llama a la red** — es
  el default sin env y lo que usa CI. Se instalan los 5 paquetes de proveedor para que el cambio
  sea solo de env (verificado por test: `resolveModel` construye cada uno).
- **Proveedor inicial — Groq (verificado 2026-07, free tier, sin tarjeta):** para
  `llama-3.3-70b-versatile` el plan gratuito da **30 RPM · 1.000 RPD · 12K TPM · 100K TPD**
  (["Groq Free Tier Limits 2026"](https://tokenmix.ai/blog/groq-free-tier-limits-2026),
  [pricepertoken](https://pricepertoken.com/endpoints/groq/free)). Con el grounding medido
  (~730 tokens demo, ~1.5K la dieta real) + pregunta + salida ≤500 ⇒ ~3K tokens/request ⇒
  **~30 preguntas/día** dentro del TPD gratuito — holgado para uso familiar. Costo esperado: **$0**
  (free tier); el kill-switch y el rate limit protegen de sorpresas. El prompt caching de Groq
  (prefijo de sistema estable) extiende el margen.
- **Razones:** un adapter por env evita el lock-in y permite degradar/rotar proveedor sin
  redeploy de código; `mock` mantiene la CI determinística y gratis; Groq encaja en el
  presupuesto con velocidad alta.
- **Consecuencias / deuda:** los defaults de modelo de los proveedores alternos se re-verifican
  cuando se activen (no ahora). El límite operativo real (100K TPD) se monitorea con los logs de
  tokens; si el volumen lo supera, se sube a un tier pago o se rota proveedor por env. Ver
  [[005-grounding-strategy]] (tamaño del contexto) y [[006-chat-privacy]] (qué viaja al proveedor).
