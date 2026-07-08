# ADR 006 — Privacidad del chat: no-persistencia y logs solo-metadatos

- **Estado:** aceptada · Sprint 002 · 2026-07-07
- **Contexto:** el chat maneja datos de salud de un **menor** (Ley 1581/2012: minimización, alta
  privacidad por defecto, propósito limitado). Parte del contenido (la dieta anonimizada) sale del
  dispositivo hacia un proveedor de IA de terceros para responder preguntas abiertas.
- **Decisión (tres reglas):**
  1. **No-persistencia.** La conversación vive SOLO en memoria del componente
     (`use-chat-thread.ts`) — ni localStorage ni servidor. Al recargar/cerrar, el hilo desaparece
     (verificado por e2e). "Borrar datos" no cambia: no hay nada nuevo que borrar.
  2. **Logs solo-metadatos.** `/api/chat` loguea `{event, provider, model, latencyMs, tokensIn,
tokensOut, outcome}` — **jamás** la pregunta ni la respuesta (verificado por test unit que
     inyecta un término secreto y confirma que no aparece en ningún log).
  3. **Minimización de lo que viaja.** Al proveedor solo va la dieta **anonimizada** (`childAlias`
     "el niño/peque", sin nombre real — regla dura del repo) + la pregunta. El Camino A (lookups
     "¿X se puede?") se resuelve **en el dispositivo**, sin salir: menos preguntas cruzan la red.
- **Transparencia:** nota de IA visible en el **primer uso** del chat (qué hace, qué NO —no es
  consejo médico—, y que la dieta anonimizada se envía a un proveedor de IA) y consultable en
  **Ajustes**. Cada respuesta del LLM lleva "Respuesta de IA — verifícalo con tu profesional".
- **Guardrails de dominio:** pre-filtros sin tokens rechazan consejo médico/dosis nuevas y
  off-topic; el system prompt prohíbe recomendar fuera del plan y el lenguaje de calorías/peso.
- **Razones:** para datos de un menor, no-persistir es la minimización más fuerte y elimina toda
  una clase de riesgo (fuga de historial). Los logs de solo-metadatos conservan la observabilidad
  (estándar 3) sin exponer contenido.
- **Consecuencias / deuda:** no hay historial de conversación (decisión de producto, no bug). El
  rate-limit por IP es in-memory por instancia (ver [[004-llm-provider-adapter]]) — suficiente
  para volumen familiar; KV/Upstash queda como deuda para volumen real (S3+). El "acuerdo de
  procesamiento" con el proveedor de IA se formaliza al pasar de free tier a uso real (F-release).
