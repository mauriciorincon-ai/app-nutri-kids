---
sprint: 004
app: nutri-kids
hito: H-2
opened: 2026-11-15
closed: 2026-11-15
branch: sprint-004/dieta-sin-internet
pr: se abre con este cierre
---

# Sprint 004 — La dieta responde sin internet

- **Objetivo:** el chat responde con código sobre el plan (sin nube) y TODA la app abre y funciona sin señal, con aviso de versión nueva.
- **Resultado / estado:** cumplido · listo para PR (STOP único).
- **Tiempo:** estimado 3,5 h · real 1,8 h (`node scripts/horas-sprint.mjs --rango main..HEAD`: 21 commits, 1 sesión, 1,8 h activas) · diferencia −1,7 h.
- **Fases:** F1 0,5 h (adopción núcleo/anexo/kit, puerto 3600) · F2 0,3 h (motor del chat, fuera 5 adaptadores y `/api/chat`, ADR-008) · F3 1,1 h (SW, docs, auditoría y pago).
- **Entregables:** `src/lib/diet/answer.ts` (motor), `src/lib/ia/device-accent.ts` (acento opcional del aparato, Zod), `scripts/sw.template.js` + `build-sw.mjs` (precache de 8 pantallas + cascarón del detalle), aviso de versión, ADR-008, manual/guía/BLUEPRINT/brochure + export al día.
- **Verde (medido al final):** tsc y eslint limpios · vitest 389/389 (cobertura de líneas 99,26 %, 538 de 542) · e2e `CI=1` 118/118 (móvil y escritorio, axe incluido) · Lighthouse dentro del presupuesto · cero peticiones del chat verificado por e2e.
- **No completado:** nada del alcance.
- **Desviaciones:** (1) la `CLAUDE.md` de la planeadora cambió a mitad del sprint (regla 17: homepage = el propio repo): recopiada con `cero-enlaces.mjs` y `deploy-check.md`, cmp = 0. (2) El copiloto del archivo del sprint no trae código que portar.
- **Decisiones (defaults técnicos):** SW propio con `__BUILD_ID__`, sin `skipWaiting` (la página lo pide al aceptar); detalle offline vía `/dieta/_` leyendo el id de la URL; el modelo del aparato se consulta una vez por página e idioma (evita un crash de Chromium); «dark» en axe es solo una guarda: el sistema de diseño es claro.
- **Deuda:** ninguna imposible. Fuera de mi alcance, para la planeadora: `CLAUDE.md:17` dice ADR 001–007 y ya hay 008; Vercel conserva variables de chat obsoletas que el usuario puede borrar.
- **Aprendizajes:** un cache de `availability()` evita cuelgues de navegación; los gates de «sin red» se prueban con navegación real offline, no con mocks.
- **Recomendación / esfuerzo-beneficio:** mergear; alto beneficio (promesa «sin internet» cumplida y verificada) por 1,8 h.

## Auditoría (Sonnet 5.5, solo lectura, una pasada · todo pagado)

| Casilla                | Hallazgos                                                                                                                                                                                            | Estado                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Alcance                | C1 brochure «solo el chat necesita conexión» · C9 «8 pantallas» ambiguo · C10 fila 002 del manual                                                                                                    | pagado · e6fa711, 634b6b9                   |
| Calidad                | motor (comodines, opciones seguras, lookup gana, receta) · esquema del acento · SW (instalación resiliente, detalle, multi-pestaña, primera instalación) · Q7 dark · Q18 no-nube · 1l «Dieta activa» | pagado · d6d2018, 99f6a25, bd742ef, c1ad632 |
| Seguridad y privacidad | cero red del chat, sin SDK ni `fetch`/XHR/beacon/WebSocket en `src/` (test ampliado)                                                                                                                 | pagado · c1ad632                            |
| Frases caducadas       | C3–C8 skills, ADR-007, comentarios, nombres, puerto, versiones del BLUEPRINT · S1 dominio en el log · C2 métricas                                                                                    | pagado · e6fa711, a2ff898, 634b6b9          |

- **C11** (`CLAUDE.md:17`): solo la planeadora puede corregirlo; queda declarado en «Deuda».
- **Fase pasada > 50 %:** ninguna (todas por debajo de lo estimado).
- **Modelo por fase:** F1 Sonnet 5.5 · F2 Opus 5.5 · F3 Sonnet 5.5 · sin desvío. **Relevos:** ninguno.
- **Servidores al STOP:** `lsof` LISTEN en este repo: 0.

Para mergear: squash y borrar la rama; después `/cierre-sprint nutri-kids`.
