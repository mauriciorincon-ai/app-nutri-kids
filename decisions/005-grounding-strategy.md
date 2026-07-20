# ADR 005 — Estrategia de grounding: serialización compacta mono-idioma

- **Estado:** aceptada · Sprint 002 · 2026-07-07
- **Contexto:** el LLM debe responder **anclado a la dieta cargada** (demo o real), que vive en el
  dispositivo (localStorage), nunca en un servidor. Hay que hacerle llegar el plan como contexto
  sin exceder el presupuesto de tokens del free tier ni filtrar contenido innecesario.
- **Decisión:** el cliente envía la `DietPlan` en el body del request; el servidor la valida con
  zod y `src/lib/ia/grounding.ts` la **serializa compacta en UN solo idioma** (el activo en la UI,
  sin duplicar ES+EN) + **contexto del día** (fecha, día de la semana, suplementos de hoy —
  determinístico desde `logic.ts`). El system prompt estricto ("solo lo que el plan autoriza; si
  no está, dilo; nunca consejo médico; sin calorías/peso") va **siempre server-side**.
- **Tamaño medido:** el system completo (instrucciones + plan serializado + día) pesa **~730
  tokens** con la dieta demo (ES) y se estima **~1.5K** con la dieta real (≈2× el contenido). Con
  la pregunta (~50) y salida capada a `maxOutputTokens: 500`, un request ronda **~3K tokens** —
  ~30 preguntas/día bajo el TPD gratuito de Groq (ver [[004-llm-provider-adapter]]).
- **Razones:** serializar mono-idioma **reduce a la mitad** el contexto frente a mandar los
  `{es,en}` crudos; enviar el plan en el request (en vez de retrieval) es simple y suficiente al
  tamaño actual; el day-context determinístico evita que el modelo "adivine" el día.
- **Alternativa descartada (por ahora):** retrieval por secciones (la pregunta selecciona qué
  partes del plan viajan). No hace falta al tamaño medido; queda documentado como **plan B** si una
  dieta real futura crece o si se agrega historial que infle el contexto.
- **Consecuencias:** la dieta anonimizada (con `childAlias`, sin nombre real) viaja al proveedor
  en cada pregunta abierta — es el trade-off explícito de [[006-chat-privacy]]. El grounding se
  cubre con tests (serialización estable, mono-idioma, day-context correcto).
