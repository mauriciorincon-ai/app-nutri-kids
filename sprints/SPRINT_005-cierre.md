---
sprint: 005
app: nutri-kids
hito: H-2
opened: 2026-11-15
closed: 2026-11-15
branch: sprint-005/todo-de-el
pr: se abre con este cierre
---

# Sprint 005 — Todo de él: el perfil en el teléfono

- **Objetivo:** el plan trae lo que dijo el profesional y quien cuida lo completa en el teléfono; cada dato con su origen y todo dentro del aparato.
- **Resultado / estado:** cumplido (6 de 6 frases de «Resultado esperado» § 1 verificadas con ruta:línea por el auditor) · listo para PR (STOP único).
- **Tiempo:** estimado 3,0 h · real 1,9 h (`node scripts/horas-sprint.mjs`, 13 commits, 1 sesión, tomada antes de este cierre; span 1,4 h) · diferencia −1,1 h.
  Fases: F1 0,6 h (5 commits) · F2 0,2 h (2) · F3 1,1 h (6, con auditoría y pago).
- **Entregables:** schema v2 + `migrate.ts` · `profile-notes.ts` (clave aparte) · `texture.ts` · pantalla `/perfil` (novena del cascarón) · chat de sueño, actividad, alergia y medicamentos · scrubber de Sentry · ADR-009 · manual, guía (bloque K), BLUEPRINT, brochure (21 funcionalidades) y export (9 pantallas) · e2e `perfil.spec.ts`.
- **Verde (medido al final, sobre 108e6f4):** tsc y eslint limpios · vitest 514/514, 23 archivos (líneas 99,43 %, 703 de 707) · e2e `CI=1` 138/138 (móvil y escritorio, axe en claro y «dark») · gitleaks y `cero-enlaces` limpios. Lighthouse y los checks del PR los lee la CI al final.
- **No completado:** nada del alcance. Vercel: sin CLI ni sesión aquí, no se tocó. Para el dueño, en el panel del proyecto → Settings → Environment Variables, borrar `CHAT_PROVIDER`, `CHAT_ENABLED`, `NEXT_PUBLIC_CHAT_ENABLED`, `CHAT_MODEL` y `GROQ_API_KEY` (no se leyeron valores).
- **Desviaciones:** `CLAUDE.md:17` («Estructura») no lista `perfil`, `profile-notes`, `texture` ni `migrate`: es copia exacta del núcleo, la planeadora lo corrige.
- **Decisiones (defaults técnicos):** una consulta del perfil («¿es alérgico a X?», «¿qué medicamentos toma?») ya no es consejo médico: pasa solo si es lectura y sin ninguna señal de acción; todo lo demás sigue al profesional. Alergia no listada: nunca «no», sino la lista y «tu plan no lo dice». Textura: ordena, jamás oculta. El chat usa también lo anotado por quien cuida, dicho como «anotado por ti». Suplementos en el perfil: conteo + enlace al calendario.
- **Auditoría (Sonnet 5.5 high, una pasada; veredicto inicial «requiere ajustes», ahora «listo para cierre»):**
  - Alcance · 6/6 completo; hallazgo 12 (orden de bloques, B) pagado · 1d3ec63; hallazgos 3 (chat sin lo anotado, M) · 9fd4477 y su manual · 108e6f4; hallazgo 9 (mapa del brochure, M) · 108e6f4.
  - Calidad · 1 guardrail dejaba pasar cambios de medicación (A) pagado · 9fd4477 (lista blanca + 13 frases en test); 2 «descanso terminó» sin saber el día (M) · 1d3ec63; 4 alergia por palabra suelta (M) · 9fd4477; 6 demo contradictoria (M) · 9fd4477; 10 escritura al migrar (B) · 1d3ec63; 11 plural (B) · 1d3ec63.
  - Seguridad y privacidad · 5 consejo inventado en «alergia sí» (M) · 9fd4477; 7 «Borrar datos» no decía que borra el perfil (M) · 108e6f4; 13 Sentry: URL, transacciones y cobertura de `privacy/` (B) · 108e6f4.
  - Frases caducadas · 8 cifras del export (M) · e3b216d; 14 separador de la guía (B) · 108e6f4; 15 patrones nuevos en `design-system.md` y ADR-009 (B) · 108e6f4; «Se sella cuando terminen…» (B): sigue vigente y un test lo exige, sin cambio; 16 → desviación de arriba.
- **Aprendizajes:** los prefetch de enlaces de Next en producción ensucian un «cero red»: esperar `networkidle` antes de contar; un botón «activo» relleno con el color primario no pasa AA (3,54): usar borde + símbolo.
- **Deuda:** ninguna imposible.
- **Modelo por fase:** F1 Opus 5.5 · F2 y F3 Sonnet 5.5, sin desvío · **/compact pedidos: 2** (F1→F2, F2→F3) · **relevos: 0**.
- **Recomendación / esfuerzo-beneficio:** mergear; alto beneficio (perfil completo, privado y sin red) por 1,9 h.
- **Servidores al STOP:** `lsof` LISTEN en este repo: 0.
- **Para mergear:** squash y borrar la rama; después `/cierre-sprint nutri-kids` en la planeadora.
